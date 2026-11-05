"""Read-only source diagnostics and encrypted database recovery rehearsal.

Never launches a Rancher engine against restored data. No automatic production cutover.
"""
import argparse
from datetime import datetime, timezone
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import threading
import time

FORMAT = b'RANCHER-DB-GCM-1\n'
CORE = ('account', 'project_member', 'environment', 'service', 'instance', 'host', 'volume')
MAX_BYTES = 256 * 1024 * 1024


class MigrationError(Exception):
    pass


def identifier(value):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', value):
        raise MigrationError('Invalid Docker identifier.')
    return value


def run(args, data=None, timeout=180):
    try:
        result = subprocess.run(['docker', *args], input=data, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise MigrationError('Docker unavailable or operation timed out; private diagnostics withheld.') from None
    if result.returncode:
        raise MigrationError('Docker/database operation failed; private diagnostics withheld.')
    return result.stdout


class Database:
    def __init__(self, container, defaults_file=None):
        self.container = identifier(container)
        self.options = ['--user=root']
        if defaults_file:
            if not re.fullmatch(r'/[A-Za-z0-9_./-]+', defaults_file):
                raise MigrationError('Invalid container defaults-file path.')
            self.options = ['--defaults-extra-file=' + defaults_file]

    def query(self, sql):
        return run(['exec', self.container, 'mysql', *self.options, '--batch', '--skip-column-names', '-e', sql]).decode('utf-8').strip()

    def image(self):
        image = run(['inspect', '--format', '{{.Image}}', self.container]).decode().strip()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
            raise MigrationError('Invalid source image digest.')
        return image

    def dump(self):
        args = ['docker', 'exec', self.container, 'mysqldump', *self.options,
                '--single-transaction', '--skip-lock-tables', '--skip-add-locks',
                '--routines', '--events', '--triggers', '--hex-blob',
                '--default-character-set=utf8mb4', '--databases', 'cattle']
        # Bound memory; consume stderr privately without risking a full pipe deadlock.
        with open(os.devnull, 'wb') as private_errors:
            child = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=private_errors)
            deadline = threading.Timer(300, child.kill)
            deadline.start()
            try:
                data = bytearray()
                while True:
                    block = child.stdout.read(1024 * 1024)
                    if not block:
                        break
                    data.extend(block)
                    if len(data) > MAX_BYTES:
                        raise MigrationError('Database exceeds this tool\'s 256MiB rehearsal limit; use the documented external-backup workflow.')
                if child.wait(timeout=120) != 0:
                    raise MigrationError('Database dump failed; private diagnostics withheld.')
                if not data:
                    raise MigrationError('Empty database dump.')
                return bytes(data)
            finally:
                deadline.cancel()
                if child.poll() is None:
                    child.kill()
                child.wait()


def preflight(db, check_tables=False):
    version = db.query('SELECT VERSION();')
    rows = db.query("SELECT TABLE_NAME,COALESCE(ENGINE,'VIEW') FROM information_schema.tables WHERE table_schema='cattle' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;")
    tables = {}
    for row in rows.splitlines():
        parts = row.split('\t')
        if len(parts) != 2 or not re.fullmatch(r'[a-zA-Z0-9_]+', parts[0]):
            raise MigrationError('Unexpected schema identifiers; no dynamic SQL executed.')
        tables[parts[0]] = parts[1]
    missing = sorted(set(CORE) - tables.keys())
    if missing:
        raise MigrationError('Required Cattle tables are missing; not a supported migration source.')
    non_innodb = sum(engine != 'InnoDB' for engine in tables.values())
    counts = {table: int(db.query('SELECT COUNT(*) FROM cattle.`' + table + '`;')) for table in CORE}
    counts['environments'] = int(db.query("SELECT COUNT(*) FROM cattle.account WHERE kind='project' AND removed IS NULL;"))
    checksums = {}
    names = ','.join('cattle.`' + table + '`' for table in tables)
    for line in db.query('CHECKSUM TABLE ' + names + ' EXTENDED;').splitlines():
        row = line.split('\t')
        if len(row) != 2 or not row[0].startswith('cattle.') or row[0][7:] not in tables or not row[1].isdigit():
            raise MigrationError('A table checksum is unavailable; restore cannot be verified.')
        if row[0][7:] in checksums:
            raise MigrationError('Duplicate table checksum.')
        checksums[row[0][7:]] = row[1]
    if set(checksums) != set(tables):
        raise MigrationError('Incomplete table checksums.')
    if check_tables:
        health = db.query('CHECK TABLE ' + names + ' QUICK;').splitlines()
        checked = [line.split('\t')[0] for line in health if line.endswith('\tstatus\tOK')]
        if len(checked) != len(tables) or set(checked) != {'cattle.' + name for name in tables}:
            raise MigrationError('Database integrity check did not return OK; no automatic repair attempted.')
    supported = version.startswith('5.5.')
    return {
        'toolVersion': 1, 'observedAtUtc': datetime.now(timezone.utc).isoformat(),
        'databaseVersion': version, 'sourceImageId': db.image(),
        'tables': len(tables), 'nonInnoDbTables': non_innodb, 'inventoryCounts': counts,
        'tableChecksums': checksums, 'integrityQuickChecked': check_tables,
        'onlineSnapshotEligible': non_innodb == 0,
        'offlineRehearsalSupported': supported and non_innodb == 0,
        'sourceModifiedByTool': False,
        'limits': ['Counts/checksums are sequential observations, not one transactional snapshot.',
                   'Checksums scan data and CHECK TABLE can take read locks; plan load/window.',
                   'This is database-only recovery, not a complete Rancher/IdP migration.'],
    }


def key(password, salt):
    from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
    return Scrypt(salt=salt, length=32, n=2**15, r=8, p=1).derive(password.encode('utf-8'))


def encrypt(data, password):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if len(password) < 20:
        raise MigrationError('Use a backup passphrase of at least20 characters.')
    salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
    header = FORMAT + salt + nonce
    return header + AESGCM(key(password, salt)).encrypt(nonce, data, header)


def decrypt(data, password):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if len(data) > MAX_BYTES + 1024 or not data.startswith(FORMAT) or len(data) < len(FORMAT) + 44:
        raise MigrationError('Invalid or oversized encrypted backup.')
    offset = len(FORMAT)
    salt, nonce = data[offset:offset+16], data[offset+16:offset+28]
    header = data[:offset+28]
    try:
        return AESGCM(key(password, salt)).decrypt(nonce, data[offset+28:], header)
    except Exception:
        raise MigrationError('Backup authentication failed; no restore attempted.') from None


def write_new(path, data):
    path = Path(path)
    if path.is_symlink():
        raise MigrationError('Refusing symlink output.')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)


def compare(before, after):
    return before['inventoryCounts'] == after['inventoryCounts'] and before['tableChecksums'] == after['tableChecksums']


def backup(db, directory, password):
    initial = preflight(db)
    if not initial['offlineRehearsalSupported']:
        raise MigrationError('Only all-InnoDB MySQL5.5 internal snapshots are accepted by this rehearsal version.')
    data = db.dump()
    encrypted = encrypt(data, password)
    write_new(directory / 'cattle.sql.enc', encrypted)
    initial.update({'encryptedBackupSha256': hashlib.sha256(encrypted).hexdigest(),
                    'plaintextDumpSha256': hashlib.sha256(data).hexdigest(),
                    'encryptedBytes': len(encrypted), 'completeRecoveryBackup': False})
    # No dump, passwords, table contents or configuration are written into the report.
    write_new(directory / 'backup.json', (json.dumps(initial, indent=2) + '\n').encode())
    return initial


def own_resource(kind, name, marker):
    field = '{{index .Config.Labels "community.console.rehearsal"}}' if kind == 'container' else '{{index .Labels "community.console.rehearsal"}}'
    args = ['inspect'] if kind == 'container' else ['volume', 'inspect']
    return run([*args, '--format', field, name]).decode().strip() == marker


def rehearse(directory, password, *, _fixture_setup=None):
    metadata = json.loads((directory / 'backup.json').read_text(encoding='utf-8'))
    file = directory / 'cattle.sql.enc'
    if file.stat().st_size > MAX_BYTES + 1024:
        raise MigrationError('Encrypted backup exceeds the supported limit.')
    encrypted = file.read_bytes()
    if hashlib.sha256(encrypted).hexdigest() != metadata['encryptedBackupSha256']:
        raise MigrationError('Encrypted backup checksum differs; no restore attempted.')
    sql = decrypt(encrypted, password)  # Authenticate fully BEFORE creating resources or executing SQL.
    if hashlib.sha256(sql).hexdigest() != metadata['plaintextDumpSha256']:
        raise MigrationError('Dump checksum differs; no restore attempted.')
    # Backups must be produced by this tool from one Cattle database; SQL is executable input.
    # The restore sandbox has no network, no host binds, no Docker socket or source volume.
    image = metadata['sourceImageId']
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise MigrationError('Invalid restore image digest.')
    marker = secrets.token_hex(12)
    name = 'rancher-rehearsal-' + marker
    volume = name + '-db'
    created_volume = created_container = False
    report = {'toolVersion': 1, 'status': 'failed', 'startedAtUtc': datetime.now(timezone.utc).isoformat(),
              'engineStarted': False, 'sourceModifiedByTool': False,
              'network': 'none', 'sourceVolumesMounted': False, 'restoreMatchedBackup': False,
              'sourceObservationMatchedDump': False, 'cleanupComplete': False,
              'migrationTested': False, 'rollbackTested': False}
    script = '''set -e
mysql_install_db --user=mysql --datadir=/var/lib/mysql >/tmp/init.log 2>&1
mkdir -p /var/run/mysqld
chown mysql:mysql /var/run/mysqld
exec mysqld --user=mysql --datadir=/var/lib/mysql --skip-networking --skip-slave-start --event-scheduler=OFF --innodb-buffer-pool-size=64M --key-buffer-size=8M --max-connections=10 --log-error=/tmp/mysql.log
'''
    try:
        run(['volume', 'create', '--label', 'community.console.rehearsal=' + marker, volume])
        created_volume = True
        run(['create', '--name', name, '--label', 'community.console.rehearsal=' + marker,
             '--network', 'none', '--memory', '512m', '--cpus', '1', '--pids-limit', '128',
             '--security-opt', 'no-new-privileges:true', '--mount',
             'type=volume,source=' + volume + ',target=/var/lib/mysql,volume-nocopy',
             '--entrypoint', '/bin/sh', image, '-c', script])
        created_container = True
        run(['start', name])
        for attempt in range(60):
            try:
                run(['exec', name, 'mysqladmin', '--user=root', 'ping'], timeout=5)
                break
            except MigrationError:
                if attempt == 59:
                    raise
                time.sleep(1)
        if run(['inspect', '--format', '{{.HostConfig.NetworkMode}}', name]).decode().strip() != 'none':
            raise MigrationError('Isolation verification failed.')
        run(['exec', '-i', name, 'mysql', '--user=root', '--default-character-set=utf8mb4'], sql, timeout=300)
        if _fixture_setup:
            _fixture_setup(Database(name))
        restored = preflight(Database(name), check_tables=True)
        report['sourceObservationMatchedDump'] = compare(metadata, restored)
        report['restoredInventoryCounts'] = restored['inventoryCounts']
        # Live source observations are not snapshot metadata. Prove repeatable restoration
        # from the same authenticated dump, then compare migration/rollback against THIS copy.
        if not own_resource('container', name, marker):
            raise MigrationError('Restore sandbox ownership mismatch.')
        isolated = Database(name)
        isolated.query('DROP DATABASE cattle;')
        run(['exec', '-i', name, 'mysql', '--user=root', '--default-character-set=utf8mb4'], sql, timeout=300)
        if _fixture_setup:
            _fixture_setup(isolated)
        repeated = preflight(isolated, check_tables=True)
        report['restoreMatchedBackup'] = compare(restored, repeated)
        if not report['restoreMatchedBackup']:
            raise MigrationError('Repeated restoration differs; migration is blocked.')
        from migration.schema import apply_schema
        apply_schema(isolated)
        first = preflight(isolated, check_tables=True)
        apply_schema(isolated)
        second = preflight(isolated, check_tables=True)
        report['migrationTested'] = all(second['tableChecksums'].get(t) == value for t, value in restored['tableChecksums'].items())
        report['migrationIdempotent'] = compare(first, second)
        if not report['migrationTested'] or not report['migrationIdempotent']:
            raise MigrationError('Migration changed previous data or is not idempotent.')
        if not own_resource('container', name, marker):
            raise MigrationError('Rollback sandbox ownership mismatch.')
        isolated.query('DROP DATABASE cattle;')
        run(['exec', '-i', name, 'mysql', '--user=root', '--default-character-set=utf8mb4'], sql, timeout=300)
        if _fixture_setup:
            _fixture_setup(isolated)
        rollback = preflight(isolated, check_tables=True)
        report['rollbackTested'] = compare(restored, rollback)
        if not report['rollbackTested']:
            raise MigrationError('Rollback does not match the original restored snapshot.')
        report['status'] = 'passed'
        return report
    finally:
        # Never delete anything based only on a name or supplied manifest.
        if created_container:
            if not own_resource('container', name, marker):
                raise MigrationError('Container ownership mismatch; cleanup refused.')
            run(['rm', '--force', name])
        if created_volume:
            if not own_resource('volume', volume, marker):
                raise MigrationError('Volume ownership mismatch; cleanup refused.')
            run(['volume', 'rm', volume])
        report['cleanupComplete'] = True
        report['finishedAtUtc'] = datetime.now(timezone.utc).isoformat()
        write_new(directory / ('rehearsal-' + marker + '.json'), (json.dumps(report, indent=2) + '\n').encode())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['preflight', 'backup-db', 'rehearse-db'])
    parser.add_argument('--source-container')
    parser.add_argument('--defaults-file', help='Existing MySQL client defaults file INSIDE source container; never a password argument.')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--check-tables', action='store_true')
    args = parser.parse_args(argv)
    directory = args.output.resolve()
    allow_failure_report = False
    started = datetime.now(timezone.utc).isoformat()
    try:
        if args.command == 'rehearse-db':
            if args.source_container or args.defaults_file:
                raise MigrationError('Offline rehearsal does not accept a source connection.')
            if args.output.is_symlink() or not directory.is_dir():
                raise MigrationError('Expected an existing private backup directory, not a symlink.')
            allow_failure_report = True
            password = os.environ.get('RANCHER_MIGRATION_BACKUP_PASSWORD') or getpass.getpass('Backup passphrase: ')
            report = rehearse(directory, password)
        else:
            if not args.source_container:
                raise MigrationError('An explicit source container is required.')
            if args.output.is_symlink():
                raise MigrationError('Refusing symlink output directory.')
            directory.mkdir(mode=0o700, parents=True, exist_ok=False)
            allow_failure_report = True
            db = Database(args.source_container, args.defaults_file)
            if args.command == 'preflight':
                report = preflight(db, args.check_tables)
                write_new(directory / 'preflight.json', (json.dumps(report, indent=2) + '\n').encode())
            else:
                password = os.environ.get('RANCHER_MIGRATION_BACKUP_PASSWORD') or getpass.getpass('Backup passphrase: ')
                report = backup(db, directory, password)
        event = {'startedAtUtc': started, 'finishedAtUtc': datetime.now(timezone.utc).isoformat(),
                 'command': args.command, 'status': 'passed', 'toolVersion': 1,
                 'completeMigrationAccepted': False, 'sourceModifiedByTool': False}
        write_new(directory / ('operation-' + secrets.token_hex(8) + '.json'), (json.dumps(event, indent=2) + '\n').encode())
        print(json.dumps({'command': args.command, 'status': 'passed',
                          'completeMigrationAccepted': False, 'sourceModifiedByTool': False}))
        return 0
    except Exception as error:
        # Keep native exception messages (which can include SQL/data/paths) private.
        message = str(error) if isinstance(error, MigrationError) else 'Operation failed; private diagnostics withheld.'
        if allow_failure_report:
            event = {'timeUtc': datetime.now(timezone.utc).isoformat(), 'command': args.command,
                     'status': 'failed', 'error': message, 'completeMigrationAccepted': False}
            # Unique file; never replace a previous report or backup.
            write_new(directory / ('failure-' + secrets.token_hex(8) + '.json'), (json.dumps(event, indent=2) + '\n').encode())
        print(json.dumps({'command': args.command, 'status': 'failed', 'error': message}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
