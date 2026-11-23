import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from migration import tool
from migration.schema import apply_schema


class FakeDatabase:
    container = 'rancher-rehearsal-owned'

    def __init__(self, engine='InnoDB', version='5.5.62', missing=False, invalid_name=False):
        self.calls = []
        self.engine, self.version = engine, version
        self.tables = list(tool.CORE) + ['credential']
        if missing:
            self.tables.remove('account')
        if invalid_name:
            self.tables += ['unsafe`;DROP DATABASE cattle;']
        self.stored_checksum = ''

    def image(self):
        return 'sha256:' + 'a' * 64

    def dump(self):
        return b'CREATE DATABASE cattle;\n-- synthetic fixture\n'

    def query(self, sql):
        self.calls.append(sql)
        if sql == 'SELECT VERSION();':
            return self.version
        if 'information_schema.tables' in sql:
            return '\n'.join(t + '\t' + self.engine for t in self.tables)
        if sql.startswith('SELECT COUNT(*)'):
            return '20'
        if sql.startswith('CHECKSUM TABLE'):
            return '\n'.join('cattle.' + t + '\t123' for t in self.tables)
        if sql.startswith('CHECK TABLE'):
            return '\n'.join('cattle.' + t + '\tcheck\tstatus\tOK' for t in self.tables)
        if sql.startswith('SELECT checksum'):
            return self.stored_checksum
        if sql.startswith('INSERT INTO cattle.community_schema_migration'):
            self.stored_checksum = sql.split("'")[1]
        return ''


class MigrationTests(unittest.TestCase):
    def test_preflight_is_read_only_and_counts_twenty_environments(self):
        database = FakeDatabase()
        result = tool.preflight(database, True)
        self.assertTrue(result['offlineRehearsalSupported'])
        self.assertEqual(result['inventoryCounts']['environments'], 20)
        self.assertFalse(result['sourceModifiedByTool'])
        self.assertTrue(all(c.startswith(('SELECT ', 'CHECKSUM TABLE ', 'CHECK TABLE ')) for c in database.calls))

    def test_non_innodb_blocks_online_backup(self):
        self.assertFalse(tool.preflight(FakeDatabase(engine='MyISAM'))['onlineSnapshotEligible'])

    def test_external_newer_mysql_is_reported_but_not_accepted_for_rehearsal(self):
        self.assertFalse(tool.preflight(FakeDatabase(version='8.0.40'))['offlineRehearsalSupported'])

    def test_missing_native_schema_fails(self):
        with self.assertRaises(tool.MigrationError):
            tool.preflight(FakeDatabase(missing=True))

    def test_untrusted_table_identifier_never_enters_dynamic_sql(self):
        database = FakeDatabase(invalid_name=True)
        with self.assertRaises(tool.MigrationError):
            tool.preflight(database)
        self.assertFalse(any('CHECKSUM' in c for c in database.calls))

    def test_incomplete_checksum_set_blocks_acceptance(self):
        database = FakeDatabase()
        original = database.query
        database.query = lambda sql: 'cattle.account\t123' if sql.startswith('CHECKSUM') else original(sql)
        with self.assertRaises(tool.MigrationError):
            tool.preflight(database)

    def test_corrupt_table_fails_without_repair(self):
        database = FakeDatabase()
        original = database.query
        database.query = lambda sql: 'cattle.account\tcheck\terror\tCorrupt' if sql.startswith('CHECK TABLE') else original(sql)
        with self.assertRaises(tool.MigrationError):
            tool.preflight(database, True)
        self.assertFalse(any('REPAIR' in c for c in database.calls))

    def test_backup_authenticated_roundtrip_and_randomization(self):
        password = 'test-only-passphrase-' + 'x' * 30
        raw = b'CREATE DATABASE cattle;\n-- synthetic fixture\n'
        one, two = tool.encrypt(raw, password), tool.encrypt(raw, password)
        self.assertNotEqual(one, two)
        self.assertEqual(tool.decrypt(one, password), raw)
        self.assertNotIn(raw, one)

    def test_wrong_passphrase_and_modified_header_or_ciphertext_fail(self):
        password = 'test-only-passphrase-' + 'x' * 30
        encrypted = tool.encrypt(b'synthetic', password)
        variants = [encrypted[:-1] + bytes([encrypted[-1] ^ 1]), encrypted[:20] + bytes([encrypted[20] ^ 1]) + encrypted[21:]]
        for data, phrase in [(encrypted, 'wrong-' * 10), *((v, password) for v in variants)]:
            with self.assertRaises(tool.MigrationError):
                tool.decrypt(data, phrase)

    def test_short_passphrase_rejected(self):
        with self.assertRaises(tool.MigrationError):
            tool.encrypt(b'test', 'short')

    def test_output_never_overwrites(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'backup'
            tool.write_new(path, b'original')
            with self.assertRaises(FileExistsError):
                tool.write_new(path, b'replacement')
            self.assertEqual(path.read_bytes(), b'original')

    def test_existing_output_directory_is_not_changed_on_refusal(self):
        with tempfile.TemporaryDirectory() as directory, patch('migration.tool.run') as docker:
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(tool.main(['preflight', '--source-container', 'fixture', '--output', directory]), 1)
            self.assertEqual(list(Path(directory).iterdir()), [])
            docker.assert_not_called()

    def test_invalid_container_names_are_rejected(self):
        for value in ['--privileged', '../source', 'source;whoami', 'a b']:
            with self.assertRaises(tool.MigrationError):
                tool.Database(value)

    def test_docker_error_never_discloses_native_stderr(self):
        result = type('Result', (), {'returncode': 1, 'stdout': b'', 'stderr': b'private-database-password'})()
        with patch('subprocess.run', return_value=result):
            with self.assertRaises(tool.MigrationError) as caught:
                tool.run(['exec', 'fixture', 'mysql'])
            self.assertNotIn('private-database-password', str(caught.exception))

    def test_versioned_migration_is_idempotent(self):
        database = FakeDatabase()
        apply_schema(database)
        writes = len([s for s in database.calls if s.startswith('INSERT')])
        apply_schema(database)
        self.assertEqual(len([s for s in database.calls if s.startswith('INSERT')]), writes)

    def test_migration_checksum_drift_blocks_sql(self):
        database = FakeDatabase()
        database.stored_checksum = 'unrecognized'
        with self.assertRaises(tool.MigrationError):
            apply_schema(database)
        self.assertFalse(any(c.startswith('USE cattle') for c in database.calls))

    def test_migration_does_not_accept_source_container(self):
        database = FakeDatabase()
        database.container = 'production-source'
        with self.assertRaises(tool.MigrationError):
            apply_schema(database)
        self.assertEqual(database.calls, [])


class BackupManifestTests(unittest.TestCase):
    password = 'synthetic-backup-passphrase-for-tests'

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.bundle = Path(directory.name)
        self.metadata = tool.backup(FakeDatabase(), self.bundle, self.password)
        self.manifest = self.bundle / 'backup.json'
        self.seal = self.bundle / 'backup.json.enc'
        self.dump = self.bundle / 'cattle.sql.enc'

    def assert_rejected(self, message, **options):
        with patch.object(tool, 'run') as docker:
            with self.assertRaisesRegex(tool.MigrationError, message):
                tool.rehearse(self.bundle, self.password, **options)
        docker.assert_not_called()

    def assert_reaches_allocation(self, **options):
        with patch.object(tool, 'run', side_effect=tool.MigrationError('Mock stopped at allocation.')) as docker:
            with self.assertRaisesRegex(tool.MigrationError, 'Mock stopped at allocation'):
                tool.rehearse(self.bundle, self.password, **options)
        docker.assert_called_once()
        self.assertEqual(docker.call_args.args[0][:2], ['volume', 'create'])

    def test_v2_manifest_accepts_untampered_bundle_and_keeps_sql_readable(self):
        self.assertEqual(self.metadata['formatVersion'], 2)
        self.assertEqual(tool.decrypt(self.dump.read_bytes(), self.password), FakeDatabase().dump())
        self.assert_reaches_allocation()

    def test_changed_image_digest_or_observations_fail_before_allocation(self):
        changes = {
            'sourceImageId': 'sha256:' + 'b' * 64,
            'inventoryCounts': {**self.metadata['inventoryCounts'], 'environments': 19},
            'tableChecksums': {**self.metadata['tableChecksums'], 'account': '124'},
        }
        for field, value in changes.items():
            with self.subTest(field=field):
                self.manifest.write_text(json.dumps({**self.metadata, field: value}, indent=2) + '\n', encoding='utf-8')
                self.assert_rejected('differs from its authenticated seal')

    def test_missing_v2_seal_cannot_use_legacy_digest(self):
        trusted = hashlib.sha256(self.manifest.read_bytes()).hexdigest()
        self.seal.unlink()
        self.assert_rejected('regular backup file', trusted_legacy_metadata_sha256=trusted)

    def test_tampered_or_swapped_bundle_files_fail_before_allocation(self):
        seal = self.seal.read_bytes()
        self.seal.write_bytes(seal[:-1] + bytes([seal[-1] ^ 1]))
        self.assert_rejected('Backup authentication failed')

        with tempfile.TemporaryDirectory() as other:
            other_bundle = Path(other)
            tool.backup(FakeDatabase(), other_bundle, self.password)
            self.seal.write_bytes((other_bundle / self.seal.name).read_bytes())
            self.assert_rejected('differs from its authenticated seal')
            self.seal.write_bytes(seal)
            self.dump.write_bytes((other_bundle / self.dump.name).read_bytes())
            self.assert_rejected('Encrypted backup checksum differs')

    def test_legacy_requires_trusted_digest_of_exact_bytes(self):
        self.metadata.pop('formatVersion')
        self.manifest.write_text(json.dumps(self.metadata), encoding='utf-8')
        self.assert_rejected('Legacy backup must not have a manifest seal')
        self.seal.unlink()
        self.assert_rejected('independently trusted metadata SHA-256')
        self.assert_rejected('independently trusted metadata SHA-256', trusted_legacy_metadata_sha256='0' * 64)
        trusted = hashlib.sha256(self.manifest.read_bytes()).hexdigest()
        self.assert_reaches_allocation(trusted_legacy_metadata_sha256=trusted)
        self.manifest.write_bytes(self.manifest.read_bytes() + b'\n')
        self.assert_rejected('independently trusted metadata SHA-256', trusted_legacy_metadata_sha256=trusted)

    def test_manifest_seal_and_dump_symlinks_are_rejected(self):
        # Windows without Developer Mode cannot create symlinks as an ordinary user.
        is_symlink = Path.is_symlink
        for path in (self.manifest, self.seal, self.dump):
            with self.subTest(file=path.name):
                with patch.object(Path, 'is_symlink', lambda candidate: candidate == path or is_symlink(candidate)):
                    self.assert_rejected('not a symlink')

    def test_oversized_manifest_and_seal_are_rejected(self):
        with patch.object(tool, 'MAX_MANIFEST_BYTES', 1):
            self.assert_rejected('exceeds the supported limit')
        self.seal.write_bytes(b'\x00' * (tool.MAX_MANIFEST_BYTES + 1024))
        self.assert_rejected('exceeds the supported limit')

    def test_cli_passes_trusted_legacy_digest_to_rehearsal(self):
        with (patch.object(tool, 'rehearse') as rehearse,
              patch.dict(tool.os.environ, {'RANCHER_MIGRATION_BACKUP_PASSWORD': self.password}),
              contextlib.redirect_stdout(io.StringIO())):
            status = tool.main(['rehearse-db', '--output', str(self.bundle),
                                '--trusted-legacy-metadata-sha256', 'A' * 64])
        self.assertEqual(status, 0)
        rehearse.assert_called_once_with(self.bundle.resolve(), self.password, trusted_legacy_metadata_sha256='a' * 64)


if __name__ == '__main__':
    unittest.main()
