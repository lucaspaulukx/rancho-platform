
"""Exercise first-start migration using fresh Docker resources and synthetic data."""

import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.request

from migration.test_fresh_install_lab import image_id, require
from migration.tool import Database, backup, write_new


ROOT = Path(__file__).resolve().parents[1]
SOURCE_IMAGE = 'rancher/server:v1.6.30@sha256:95b55603122c28baea4e8d94663aa34ad770bbc624a9ed6ef986fb3ea5224d91'
LABEL = 'community.console.first-start-test'


def docker(*args, env=None, check=True):
    result = subprocess.run(['docker', *args], cwd=ROOT, env=env,
                            capture_output=True, timeout=240)
    if check and result.returncode:
        raise RuntimeError(f'Docker {args[0]} failed; private diagnostics withheld.')
    return result


def source_projects(source, payload=None):
    args = [] if payload is None else ['-H', 'Content-Type: application/json',
                                      '--data', json.dumps(payload)]
    result = docker('exec', source, 'curl', '-fsS', *args,
                    'http://localhost:8080/v2-beta/projects', check=False)
    return json.loads(result.stdout) if result.returncode == 0 else None


def wait_for(check, message):
    deadline = time.monotonic() + 140
    while time.monotonic() < deadline:
        if result := check():
            return result
        time.sleep(2)
    raise RuntimeError(message)


def exercise(folder, images, port):
    owner = secrets.token_hex(10)
    project = 'rancho-first-start-' + owner
    source = project + '-source'
    network = project + '-source-net'
    password = secrets.token_urlsafe(32)
    bundle = folder / 'bundle'
    bundle.mkdir()
    passphrase = folder / 'passphrase'
    write_new(passphrase, password.encode())
    environment = dict(os.environ, RANCHO_DB_PASSWORD=secrets.token_urlsafe(32),
                       RANCHO_BACKEND_IMAGE=images['backend'],
                       RANCHO_CONSOLE_IMAGE=images['console'],
                       RANCHO_DATABASE_IMAGE=images['database'],
                       RANCHO_MIGRATION_RESTORE_IMAGE=images['restore'],
                       RANCHO_MIGRATION_PASSPHRASE_FILE=str(passphrase),
                       RANCHO_MIGRATION_BACKUP_DIRECTORY=str(bundle),
                       RANCHO_CONSOLE_PORT=str(port))

    def compose(*args, check=True, env=environment):
        return docker('compose', '-p', project, '-f', 'compose.modern.yaml',
                      '-f', 'compose.migrate.yaml', *args, env=env, check=check)

    def query(statement):
        return compose('exec', '-T', 'db', 'sh', '-ec',
                       'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb -u cattle -NB cattle -e "$1"',
                       'sh', statement).stdout

    selection = "SELECT id FROM account WHERE name='AUTOMATIC-IMPORT-TEST';"
    ledger = 'SELECT backup_sha256 FROM rancho_backup_import;'
    schema = 'SELECT version, checksum, UNIX_TIMESTAMP(applied) FROM community_schema_migration;'
    allocated = False
    try:
        docker('network', 'create', '--internal', '--label', f'{LABEL}={owner}', network)
        docker('run', '-d', '--pull', 'never', '--network', network, '--name', source,
               '--label', f'{LABEL}={owner}', '-e', 'CATTLE_CATALOG_EXECUTE=false',
               images['source'])
        wait_for(lambda: source_projects(source), 'Original Rancher did not become ready.')
        created = source_projects(source, {'name': 'AUTOMATIC-IMPORT-TEST', 'orchestration': 'cattle'})
        require(created and created.get('id'), 'Create the original environment')
        wait_for(lambda: any(item['id'] == created['id'] and item['state'] == 'active'
                             for item in (source_projects(source) or {}).get('data', [])),
                 'Original environment did not become active.')
        metadata = backup(Database(source), bundle, password, include_server_identity=True)
        expected_identity = metadata['encryptedBackupSha256'].encode()
        require(not compose('ps', '-aq').stdout.strip(), 'Target project starts empty')
        allocated = True
        compose('up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '150')
        require(b'"applied"' in compose('logs', '--no-color', 'restore-backup').stdout,
                'First Compose up imports the backup')
        original_id = query(selection)
        require(original_id.strip().isdigit(), 'Environment appeared in MariaDB')
        require(query(ledger).strip() == expected_identity, 'Database records the authenticated backup')
        schema_record = query(schema)
        require(schema_record.startswith(b'1\t'), 'Backend applied the Rancho schema')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(f'http://127.0.0.1:{port}/console/', timeout=20) as response:
            require(response.status == 200 and b'<html' in response.read().lower(), 'Console is reachable')
        print('PASS: Compose imported the sealed backup and started the backend and console.', flush=True)

        compose('up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '150')
        require(b'"already-applied"' in compose('logs', '--no-color', 'restore-backup').stdout,
                'Second Compose up skips importing')
        require(query(schema) == schema_record, 'Schema migration timestamp did not change')

        other = folder / 'different-backup'
        other.mkdir()
        # A second independently sealed backup of the same source has a different identity.
        backup(Database(source), other, password, include_server_identity=True)
        different = dict(environment, RANCHO_MIGRATION_BACKUP_DIRECTORY=str(other))
        result = compose('run', '--rm', '--no-deps', 'restore-backup', env=different, check=False)
        require(result.returncode != 0 and b'different backup' in result.stderr,
                'Another backup is refused on the populated destination')
        require(query(selection) == original_id and query(ledger).strip() == expected_identity,
                'The existing database is unchanged after the rejected import')
        require(query(schema) == schema_record, 'Rejected import preserved the schema migration')
        print('PASS: Repeat startup skipped the import and a different backup was rejected.', flush=True)
    finally:
        if allocated:
            compose('down', '--volumes', '--timeout', '20')
        mark = docker('inspect', '--format', '{{index .Config.Labels "' + LABEL + '"}}',
                      source, check=False)
        if mark.stdout.decode().strip() == owner:
            docker('rm', '-fv', source)
        mark = docker('network', 'inspect', '--format', '{{index .Labels "' + LABEL + '"}}',
                      network, check=False)
        if mark.stdout.decode().strip() == owner:
            docker('network', 'rm', network)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-image', default='rancho-backend-modern:local')
    parser.add_argument('--console-image', default='rancho-console:local')
    parser.add_argument('--database-image', default='rancho-mariadb:local')
    parser.add_argument('--restore-image', default='rancho-migration-restore:local')
    parser.add_argument('--port', type=int, default=18119)
    args = parser.parse_args()
    images = {name: image_id(getattr(args, name + '_image'))
              for name in ('backend', 'console', 'database', 'restore')}
    images['source'] = image_id(SOURCE_IMAGE)
    with tempfile.TemporaryDirectory(prefix='rancho-first-start-') as folder:
        exercise(Path(folder), images, args.port)


if __name__ == '__main__':
    main()
