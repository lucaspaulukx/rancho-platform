import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from migration.restore_on_start import TABLE, restore
from migration.tool import CORE, MigrationError


@unittest.skipUnless(os.name == 'posix', 'Restore image uses Linux advisory locks')
class RestoreOnStartTests(unittest.TestCase):
    def setUp(self):
        self.digest = 'a' * 64
        self.tables = set()
        self.identity = ''
        self.imports = 0
        self.metadata = {'encryptedBackupSha256': self.digest,
                         'tableChecksums': {name: '0' for name in CORE},
                         'inventoryCounts': {name: 1 for name in CORE}}
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.state = Path(self.folder.name)
        sql = patch('migration.restore_on_start.read_backup_sql', return_value=b'synthetic')
        sql.start()
        self.addCleanup(sql.stop)

    def database(self, query=None, *, data=None):
        if data is not None:
            self.imports += 1
            self.tables.update(CORE)
        elif query.startswith('SELECT TABLE_NAME'):
            return '\n'.join(sorted(self.tables))
        elif query.startswith('SELECT COUNT(*)'):
            return '1'
        elif query.startswith('CREATE TABLE'):
            self.tables.add(TABLE.split('.')[1])
        elif query.startswith('INSERT INTO'):
            self.identity = self.digest
        elif query.startswith('SELECT backup_sha256'):
            return self.identity
        return ''

    def run_restore(self):
        with patch('migration.restore_on_start.read_backup_manifest', return_value=self.metadata):
            return restore(self.state, 'synthetic', self.state, self.database)

    def test_imports_once_and_rejects_a_different_bundle(self):
        self.assertEqual(self.run_restore(), 'applied')
        self.assertEqual(self.run_restore(), 'already-applied')
        self.assertEqual(self.imports, 1)
        self.metadata['encryptedBackupSha256'] = 'b' * 64
        with self.assertRaisesRegex(MigrationError, 'different backup'):
            self.run_restore()
        self.assertEqual(self.imports, 1)

    def test_refuses_a_nonempty_target_without_a_marker(self):
        self.tables.add('account')
        with self.assertRaisesRegex(MigrationError, 'new target'):
            self.run_restore()
        self.assertEqual(self.imports, 0)

    def test_import_failure_leaves_target_fenced(self):
        self.database = Mock(side_effect=['', MigrationError('import failed')])
        with self.assertRaisesRegex(MigrationError, 'import failed'):
            self.run_restore()
        self.database = Mock(return_value='')
        with self.assertRaisesRegex(MigrationError, 'new target'):
            self.run_restore()
        self.assertEqual(self.database.call_count, 1)
