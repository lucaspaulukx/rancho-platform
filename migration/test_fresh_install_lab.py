"""Boot two explicitly selected local images on a disposable, private Docker bridge."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import secrets
import subprocess
import time


OWNER = "rancho.fresh-install.owner"
SQL = Path(__file__).parent / "sql" / "001-local-groups.sql"
MOUNTS = ("/var/lib/mysql", "/var/lib/cattle", "/var/log/mysql")


class RehearsalError(RuntimeError):
    pass


def docker(step, *args, timeout=20):
    try:
        result = subprocess.run(
            ("docker", *args), capture_output=True, text=True, timeout=timeout,
            encoding="utf-8", errors="replace", check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise RehearsalError(step) from None
    if result.returncode:
        raise RehearsalError(step)
    return result.stdout.strip()


def inspect(kind, identity):
    return json.loads(docker(f"Inspect {kind}", kind, "inspect", identity))[0]


def require(condition, step):
    if not condition:
        raise RehearsalError(step)


def image_id(reference):
    image = inspect("image", reference)
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", image["Id"]), "Resolve immutable local image ID")
    require(image["Os"] == "linux", "Validate Linux image")
    return image["Id"]


def poll(step, container, check, seconds=240):
    deadline = time.monotonic() + seconds
    failure = "readiness not observed"
    while time.monotonic() < deadline:
        require(inspect("container", container)["State"]["Running"], f"{step}: container exited")
        try:
            return check()
        except RehearsalError as error:
            failure = str(error)
            time.sleep(2)
    raise RehearsalError(f"{step}: {failure}")


def http(container, url, *, console=False):
    if console:
        return docker("Read console HTTP response", "exec", container, "wget", "-q", "-T", "5", "-O", "-", url)
    return docker("Read backend HTTP response", "exec", container, "curl", "-fsSL", "--max-time", "5", url)


def native_api(container, url, *, console=False):
    try:
        response = json.loads(http(container, url, console=console))
    except json.JSONDecodeError:
        raise RehearsalError("Parse native API version document") from None
    require(isinstance(response, dict) and response.get("id") == "v2-beta" and
            response.get("type") == "apiVersion", "Verify native API version document")


def query(container, sql):
    return docker("Query isolated MySQL", "exec", container, "mysql", "--user=root", "--batch",
                  "--skip-column-names", "cattle", "-e", sql)


def schema(container, checksum):
    row = query(container, "SELECT version,checksum,UNIX_TIMESTAMP(applied) FROM community_schema_migration;")
    require(re.fullmatch(r"1\t" + checksum + r"\t[1-9][0-9]*", row), "Verify migration version, checksum and timestamp")
    for table in ("group", "member", "grant", "audit", "audit_detail", "oidc_user"):
        require(query(container, f"SELECT COUNT(*) FROM local_rbac_{table};") == "0",
                f"Verify empty local RBAC {table} table")
    return row


def backend_ready(container):
    require("pong" in http(container, "http://127.0.0.1:8080/ping").lower(), "Check backend ping")
    document = http(container, "http://127.0.0.1:8080/index.html")
    require("/local-rbac-extension.js" in document, "Verify classic UI serves the packaged extension")
    require(http(container, "http://127.0.0.1:8080/local-rbac-extension.js"), "Read classic extension")
    native_api(container, "http://127.0.0.1:8080/v2-beta")


def console_ready(container):
    base = "http://127.0.0.1:8080"
    document = http(container, base + "/console/", console=True)
    asset = re.search(r'src="(/console/assets/[A-Za-z0-9_.-]+\.js)"', document)
    require(asset, "Find console bundle")
    bundle = http(container, base + asset[1], console=True)
    require(bundle and "<!doctype html>" not in bundle[:80].lower(), "Read packaged console bundle")
    native_api(container, base + "/v2-beta", console=True)


def rehearse(backend, console):
    token = secrets.token_hex(12)
    prefix = f"rancho-fresh-{token}"
    label = f"{OWNER}={token}"
    owned = []
    checksum = hashlib.sha256(SQL.read_text(encoding="utf-8").encode()).hexdigest()

    def create(kind, name, *args):
        identity = docker(f"Create {kind}", kind, "create", "--label", label, *args)
        owned.append((kind, name, identity))
        return identity

    def boot(container, step):
        docker(step, "start", container)
        info = inspect("container", container)
        require({item["NetworkID"] for item in info["NetworkSettings"]["Networks"].values()} == {network},
                "Verify running container has only the private bridge")

    try:
        network = create("network", prefix, "--internal", "--driver", "bridge", prefix)
        network_info = inspect("network", network)
        require(network_info["Internal"] and network_info["Driver"] == "bridge", "Verify private bridge")
        mounts = []
        volume_names = set()
        for target in MOUNTS:
            name = prefix + "-" + target.lstrip("/").replace("/", "-")
            volume = create("volume", name, name)
            volume_names.add(volume)
            # The base image seeds MySQL system tables, without a cattle database.
            mounts += ["--mount", f"type=volume,src={volume},dst={target}"]
        common = ("--pull=never", "--log-driver=local", "--log-opt", "max-size=1m", "--log-opt", "max-file=2",
                  "--network", network)
        rancher = create(
            "container", prefix + "-backend", "--name", prefix + "-backend", *common, "--network-alias", "rancher",
            "--memory", "2g", *mounts,
            "--env", "DEFAULT_CATTLE_CATALOG_EXECUTE=false", "--env", "CATTLE_CATALOG_EXECUTE=false",
            "--env", "RANCHER_CUSTOMIZATION_ENABLED=true", "--env", "RANCHER_SCHEMA_MIGRATIONS_ENABLED=true",
            "--env", "RANCHER_LOCAL_RBAC_ENABLED=true", "--env", "RANCHER_DISABLE_AUTO_ENVIRONMENT=true",
            "--env", "RANCHER_OIDC_ENABLED=false", "--env", "RANCHER_MODERN_UI_ENABLED=false", backend,
        )
        modern = create(
            "container", prefix + "-console", "--name", prefix + "-console", *common, "--memory", "256m", console,
        )
        for identity, image, expected_volumes in ((rancher, backend, volume_names), (modern, console, set())):
            info = inspect("container", identity)
            config = info["HostConfig"]
            require(info["Image"] == image and not config["Privileged"] and not config["PortBindings"],
                    "Verify candidate image and container isolation")
            require(config["NetworkMode"] in (network, prefix) and
                    set(info["NetworkSettings"]["Networks"]) == {prefix},
                    "Verify private network attachment")
            require(all(mount["Type"] == "volume" for mount in info["Mounts"]) and
                    {mount["Name"] for mount in info["Mounts"]} == expected_volumes, "Verify exact owned mounts")
        boot(rancher, "Start fresh Rancher")
        poll("Fresh backend did not become ready", rancher, lambda: backend_ready(rancher))
        first = poll("Fresh schema did not validate", rancher, lambda: schema(rancher, checksum))
        print("PASS: classic UI, native API and empty versioned schema on fresh volumes", flush=True)
        boot(modern, "Start packaged console")
        poll("Packaged console did not become ready", modern, lambda: console_ready(modern), 60)
        docker("Restart isolated backend", "restart", "--timeout", "15", rancher, timeout=30)
        poll("Backend did not recover after restart", rancher, lambda: backend_ready(rancher))
        require(schema(rancher, checksum) == first, "Verify migration record unchanged after restart")
        poll("Packaged console proxy did not recover", modern, lambda: console_ready(modern), 60)
        print("PASS: console HTML and bundle, native API proxy, and unchanged migration after restart", flush=True)
    finally:
        failed = []
        for kind, name, identity in reversed(owned):
            try:
                info = inspect(kind, identity)
                labels = info["Config"]["Labels"] if kind == "container" else info["Labels"]
                require(labels.get(OWNER) == token and info["Name"].lstrip("/") == name and
                        (kind == "volume" or info["Id"] == identity), "Refuse cleanup without exact ownership")
                flags = ("-f", "-v") if kind == "container" else ()
                docker(f"Remove owned {kind}", kind, "rm", *flags, identity)
            except RehearsalError:
                failed.append(name)
        if failed:
            raise RehearsalError("Cleanup incomplete for " + ", ".join(failed))
        if owned:
            print("PASS: removed all owned fixture resources", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-image", required=True)
    parser.add_argument("--console-image", required=True)
    args = parser.parse_args()
    try:
        backend, console = image_id(args.backend_image), image_id(args.console_image)
        print(f"Backend {backend}\nConsole {console}", flush=True)
        rehearse(backend, console)
    except RehearsalError as error:
        parser.exit(1, f"FAIL: {error}\n")


if __name__ == "__main__":
    main()
