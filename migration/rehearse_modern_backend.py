"""Rehearse the modern backend migration and rollback using only synthetic Docker fixtures."""

import argparse
import json
import os
import secrets
import subprocess
import time
from uuid import uuid4

from migration.test_fresh_install_lab import image_id, require
from migration.tool import Database

owner = uuid4().hex[:12]
prefix = f"rancho-modern-migration-{owner}"
label = "community.console.modern-migration"
source = prefix + "-source"
db = prefix + "-db"
app = prefix + "-app"
rollback = prefix + "-rollback"
source_image = "rancher/server:v1.6.30@sha256:95b55603122c28baea4e8d94663aa34ad770bbc624a9ed6ef986fb3ea5224d91"
db_image = "mariadb:10.11@sha256:7d829180b5b2a9ba74f6242876ab401a0d7dd338a807e522ef92bc9698760f20"
password = secrets.token_urlsafe(32)


def docker(*args, env=None, data=None, check=True):
    p = subprocess.run(
        ["docker", *args], capture_output=True, input=data, env=env, timeout=160
    )
    if check and p.returncode:
        raise RuntimeError(f"Docker {args[0]} failed ({p.returncode})")
    return p


def ready(*args):
    for _ in range(65):
        if docker(*args, check=False).returncode == 0:
            return
        time.sleep(2)
    raise RuntimeError("Readiness check expired")


def launch(name, *args, env=None):
    docker(
        "run",
        "-d",
        "--pull",
        "never",
        "--name",
        name,
        "--network",
        prefix,
        "--label",
        f"{label}={owner}",
        *args,
        env=env,
    )


def api(name, path, payload=None):
    args = ["exec", name, "curl", "-fsS"]
    if payload is not None:
        args += ["-H", "Content-Type: application/json", "-d", json.dumps(payload)]
    args += ["http://127.0.0.1:8080/v2-beta/" + path]
    return json.loads(docker(*args).stdout)


def target_sql(sql):
    return (
        docker(
            "exec",
            db,
            "sh",
            "-c",
            'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb -u "$MARIADB_USER" -NB cattle -e "$1"',
            "sh",
            sql,
        )
        .stdout.decode()
        .strip()
    )


def inventory(name):
    return {p["name"] for p in api(name, "projects?limit=-1")["data"] if p.get("name")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend-image", required=True, help="Local Java 17 candidate image"
    )
    args = parser.parse_args()
    app_image = image_id(args.backend_image)
    image_id(source_image)
    image_id(db_image)
    try:
        docker("network", "create", "--internal", "--label", f"{label}={owner}", prefix)
        launch(source, source_image)
        ready("exec", source, "curl", "-fsS", "http://127.0.0.1:8080/v2-beta/projects")
        for index in range(20):
            api(
                source,
                "projects",
                {"name": f"MODERN-MIGRATION-{index:02}", "orchestration": "cattle"},
            )
        before = inventory(source)
        require(
            sum(p.startswith("MODERN-MIGRATION-") for p in before) == 20,
            "Create 20 source environments",
        )
        dump = Database(source).dump()
        require(
            b"CREATE TABLE `account`" in dump,
            "Verify source dump contains the account schema",
        )
        print(
            "PASS: original Rancher and 20 synthetic environments captured", flush=True
        )
        launch(
            db,
            "-e",
            "MARIADB_DATABASE=cattle",
            "-e",
            "MARIADB_USER=cattle",
            "-e",
            "MARIADB_RANDOM_ROOT_PASSWORD=1",
            "-e",
            "MARIADB_PASSWORD",
            db_image,
            env={**os.environ, "MARIADB_PASSWORD": password},
        )
        ready("exec", db, "healthcheck.sh", "--connect", "--innodb_initialized")
        docker(
            "exec",
            "-i",
            db,
            "sh",
            "-c",
            'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb -u "$MARIADB_USER" cattle',
            data=dump,
        )

        launch(
            app,
            "-e",
            "CATTLE_DB_CATTLE_MYSQL_HOST=" + db,
            "-e",
            "CATTLE_DB_CATTLE_MYSQL_PORT=3306",
            "-e",
            "CATTLE_DB_CATTLE_MYSQL_NAME=cattle",
            "-e",
            "CATTLE_DB_CATTLE_USERNAME=cattle",
            "-e",
            "CATTLE_DB_CATTLE_PASSWORD",
            "-e",
            "RANCHER_SCHEMA_MIGRATIONS_ENABLED=true",
            "-e",
            "RANCHER_LOCAL_RBAC_ENABLED=true",
            app_image,
            env={**os.environ, "CATTLE_DB_CATTLE_PASSWORD": password},
        )
        ready("exec", app, "curl", "-fsS", "http://127.0.0.1:8080/v2-beta/projects")
        require(inventory(app) == before, "Compare restored environment inventory")
        schema_query = "SELECT version, checksum, UNIX_TIMESTAMP(applied) FROM community_schema_migration"
        migration = target_sql(schema_query)
        require(migration.startswith("1\t"), "Verify recorded Rancho schema migration")
        docker("restart", app)
        ready("exec", app, "curl", "-fsS", "http://127.0.0.1:8080/v2-beta/projects")
        require(
            inventory(app) == before and target_sql(schema_query) == migration,
            "Verify persisted inventory and migration row",
        )
        require(
            inventory(source) == before, "Verify source inventory remains available"
        )
        print(
            "PASS: all environments survived MariaDB migration and backend restart; source remains readable",
            flush=True,
        )
        volume = prefix + "-rollback-db"
        docker("volume", "create", "--label", f"{label}={owner}", volume)
        bootstrap = rollback + "-bootstrap"
        mysql_only = """set -e
    mysql_install_db --user=mysql --datadir=/var/lib/mysql >/tmp/init.log 2>&1
    mkdir -p /var/run/mysqld
    chown mysql:mysql /var/run/mysqld
    exec mysqld --user=mysql --datadir=/var/lib/mysql --skip-networking --event-scheduler=OFF --log-error=/tmp/mysql.log
    """
        docker(
            "run",
            "-d",
            "--pull",
            "never",
            "--name",
            bootstrap,
            "--network",
            "none",
            "--label",
            f"{label}={owner}",
            "--mount",
            f"type=volume,src={volume},dst=/var/lib/mysql,volume-nocopy",
            "--entrypoint",
            "/bin/sh",
            source_image,
            "-c",
            mysql_only,
        )
        ready("exec", bootstrap, "mysqladmin", "-uroot", "ping")
        docker(
            "exec",
            "-i",
            bootstrap,
            "mysql",
            "-uroot",
            "--default-character-set=utf8mb4",
            data=dump,
        )
        del dump
        docker("stop", "--time", "90", bootstrap)
        require(
            docker("wait", bootstrap).stdout.strip() == b"0",
            "Verify clean MySQL shutdown",
        )
        launch(
            rollback,
            "--mount",
            f"type=volume,src={volume},dst=/var/lib/mysql,volume-nocopy",
            source_image,
        )
        ready(
            "exec", rollback, "curl", "-fsS", "http://127.0.0.1:8080/v2-beta/projects"
        )
        require(
            inventory(rollback) == before,
            "Verify the original image can read the restored inventory",
        )
        print(
            "PASS: original image restored the pre-upgrade inventory from the same logical backup",
            flush=True,
        )
    finally:
        for name in (rollback, rollback + "-bootstrap", app, db, source):
            inspected = docker(
                "inspect",
                "--format",
                '{{index .Config.Labels "' + label + '"}}',
                name,
                check=False,
            )
            if inspected.returncode == 0 and inspected.stdout.decode().strip() == owner:
                docker("rm", "-fv", name)
        inspected = docker(
            "network",
            "inspect",
            "--format",
            '{{index .Labels "' + label + '"}}',
            prefix,
            check=False,
        )
        if inspected.returncode == 0 and inspected.stdout.decode().strip() == owner:
            docker("network", "rm", prefix)

        volume = prefix + "-rollback-db"
        inspected = docker(
            "volume",
            "inspect",
            "--format",
            '{{index .Labels "' + label + '"}}',
            volume,
            check=False,
        )
        if inspected.returncode == 0 and inspected.stdout.decode().strip() == owner:
            docker("volume", "rm", volume)


if __name__ == "__main__":
    main()
