import contextlib
import io
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


if __name__ == '__main__':
    unittest.main()
