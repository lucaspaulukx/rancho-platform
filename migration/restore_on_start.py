"""Import a sealed Rancher database once, before an isolated Rancho starts."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

from migration.tool import (
    CORE,
    IDENTITY_FORMAT,
    MigrationError,
    decrypt,
    read_backup_manifest,
    read_backup_sql,
    read_bundle_file,
    write_new,
)

TABLE = 'cattle.rancho_backup_import'
IDENTITY_FILES = ('keys.properties', 'cluster-id')


def mysql(query=None, *, data=None):
    # This one-shot helper connects only to the Compose database network.
    # MariaDB 11.4+ clients otherwise require a verified TLS certificate by default.
    command = ['mariadb', '--host=db', '--user=cattle', '--batch',
               '--skip-ssl-verify-server-cert', '--skip-column-names',
               '--default-character-set=utf8mb4', 'cattle']
    if query is not None:
        command.extend(['--execute', query])
    try:
        result = subprocess.run(command, input=data, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=300, check=True)
    except (OSError, subprocess.SubprocessError):
        raise MigrationError('Target database operation failed; private diagnostics withheld.') from None
    return result.stdout.decode().strip()


def read_identity(backup, password, digest):
    if digest is None:
        return {}
    data = read_bundle_file(backup / 'server-identity.enc', 264 * 1024)
    if hashlib.sha256(data).hexdigest() != digest:
        raise MigrationError('Server identity does not match the sealed backup manifest.')
    identity = json.loads(decrypt(data, password, format_header=IDENTITY_FORMAT))
    if not isinstance(identity, dict) or set(identity) != set(IDENTITY_FILES):
        raise MigrationError('Invalid server identity archive.')
    decoded = {name: bytes.fromhex(value) for name, value in identity.items()}
    if any(not content or len(content) > 65536 for content in decoded.values()):
        raise MigrationError('Invalid server identity file size.')
    return decoded


def restore(backup, password, state, database=mysql):
    import fcntl  # The restore image runs on Linux.

    metadata = read_backup_manifest(backup, password, None)
    digest = metadata.get('encryptedBackupSha256')
    if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
        raise MigrationError('Invalid backup identity.')
    identity = read_identity(backup, password, metadata.get('serverIdentitySha256'))

    lock_path = state / '.rancho-import.lock'
    with lock_path.open('ab') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        pending = state / '.rancho-import-started'
        done = state / '.rancho-import-complete'
        inventory = "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema='cattle'"
        tables = set(database(inventory).splitlines())
        expected = set(metadata['tableChecksums'])
        if 'rancho_backup_import' in expected or not set(CORE) <= expected:
            raise MigrationError('Backup must originate from the supported Rancher schema.')
        if done.is_file():
            if (done.read_text() != digest or not expected <= tables or 'rancho_backup_import' not in tables
                    or database(f'SELECT backup_sha256 FROM {TABLE}') != digest):
                raise MigrationError('The existing target belongs to a different backup or is incomplete.')
            return 'already-applied'
        if tables or any(path != lock_path for path in state.iterdir()):
            raise MigrationError('Restore needs a new target. Preserve this target for inspection.')

        sql = read_backup_sql(backup, password, metadata)
        write_new(pending, digest.encode())
        database(data=sql)
        restored = set(database(inventory).splitlines())
        if restored != expected:
            raise MigrationError('Restored table inventory differs from the sealed backup.')
        for table in CORE:
            if int(database('SELECT COUNT(*) FROM cattle.' + table)) != metadata['inventoryCounts'][table]:
                raise MigrationError('Restored row counts differ from the sealed backup. Capture from a quiescent source.')
        for name, content in identity.items():
            write_new(state / name, content)
        database(f'CREATE TABLE {TABLE} (backup_sha256 CHAR(64) PRIMARY KEY) ENGINE=InnoDB')
        database(f"INSERT INTO {TABLE} VALUES ('{digest}')")
        write_new(done, digest.encode())
        return 'applied'


def main():
    try:
        password = read_bundle_file(Path('/run/secrets/migration_passphrase'), 4096).decode().rstrip('\r\n')
        status = restore(Path('/backup'), password, Path('/restore-state'))
        print(json.dumps({'databaseImport': status}))
        return 0
    except Exception as error:
        message = str(error) if isinstance(error, MigrationError) else 'Restore failed; private diagnostics withheld.'
        print(json.dumps({'databaseImport': 'failed', 'error': message}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
