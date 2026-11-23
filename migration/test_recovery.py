from contextlib import contextmanager
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from migration import crypto_stream, modern_recovery, recovery
from migration.tool import MigrationError


class RecoveryTests(unittest.TestCase):
    password = 'synthetic-recovery-test-passphrase-0123456789'

    def test_reject_capture_after_kill_oom_or_unexpected_exit(self):
        for state in [{'Running': True, 'ExitCode': 0}, {'Running': False, 'ExitCode': 137},
                      {'Running': False, 'ExitCode': 1}, {'Running': False, 'ExitCode': 0, 'OOMKilled': True}]:
            with self.assertRaises(MigrationError):
                recovery.require_stopped_cleanly(state)
        recovery.require_stopped_cleanly({'Running': False, 'ExitCode': 0})
        recovery.require_stopped_cleanly({'Running': False, 'ExitCode': 143})

    def test_backup_requires_explicit_maintenance_before_any_docker_action(self):
        with patch.object(recovery, 'run') as docker:
            with self.assertRaises(MigrationError):
                recovery.backup({}, Path('must-not-be-created'), self.password)
            docker.assert_not_called()

    def test_modern_db_requires_dedicated_internal_network(self):
        def compose(service, environment=()):
            return {'Id': service, 'Config': {'Env': list(environment), 'Labels': {
                'com.docker.compose.project': 'fixture', 'com.docker.compose.service': service}},
                'HostConfig': {}, 'NetworkSettings': {'Networks': {
                    'fixture_database': {'NetworkID': 'isolated-network', 'Aliases': ['db']}}}}

        sources = {
            'console': compose('console'),
            'rancher': compose('rancher', ('CATTLE_DB_CATTLE_MYSQL_HOST=db',
                                           'CATTLE_DB_CATTLE_USERNAME=cattle', 'CATTLE_DB_CATTLE_PASSWORD=fixture')),
            'database': compose('db', ('MARIADB_DATABASE=cattle', 'MARIADB_USER=cattle', 'MARIADB_PASSWORD=fixture')),
        }
        with patch.object(recovery, 'inspect', return_value={'Internal': True, 'Containers': {'rancher': {}, 'db': {}}}):
            for service in ('rancher', 'rancho'):
                with self.subTest(service=service):
                    sources['rancher']['Config']['Labels']['com.docker.compose.service'] = service
                    recovery.validate_modern_database(sources)
            sources['rancher']['Config']['Labels']['com.docker.compose.service'] = 'unrelated'
            with self.assertRaisesRegex(MigrationError, 'same modern Compose project'):
                recovery.validate_modern_database(sources)
            sources['rancher']['Config']['Labels']['com.docker.compose.service'] = 'rancho'
        with patch.object(recovery, 'inspect', return_value={'Internal': True, 'Containers': {'unrelated': {}}}):
            with self.assertRaisesRegex(MigrationError, 'network dedicated'):
                recovery.validate_modern_database(sources)

    def test_modern_health_requires_innodb_and_mariadb_10_11(self):
        sources = {'database': {'Id': 'fixture-db'}}
        for version, non_innodb, accepted in (
            ('10.11.19-MariaDB-ubu2204', 0, True),
            ('10.11.19-MariaDB-ubu2204', 1, False),
            ('11.8.8-MariaDB', 0, False),
            ('10.11.19-OtherEngine', 0, False),
        ):
            with self.subTest(version=version, non_innodb=non_innodb), patch.object(
                recovery, 'preflight', return_value={'databaseVersion': version, 'nonInnoDbTables': non_innodb}
            ):
                self.assertEqual(recovery.database_preflight(sources)['coldVolumeRecoverySupported'], accepted)

    def test_modern_rehearsal_rejects_changed_table_with_same_row_counts(self):
        recorded = {'inventoryCounts': {'service': 1},
                    'tableChecksums': {'service': '123', 'project_member': '456'}}
        for checksums in (recorded['tableChecksums'], {'service': '124', 'project_member': '456'},
                          {'service': '123'}):
            current = {**recorded, 'tableChecksums': checksums}
            with self.subTest(checksums=checksums), patch.object(modern_recovery, 'preflight', return_value=current):
                if current == recorded:
                    modern_recovery.verify_database(None, recorded)
                else:
                    with self.assertRaisesRegex(MigrationError, 'differ from the backup'):
                        modern_recovery.verify_database(None, recorded)

    def test_restart_even_when_stop_times_out_after_stopping_source(self):
        sources = {role: {'Id': role, 'Image': 'sha256:' + 'a' * 64, 'State': {'Running': True}}
                   for role in ('console', 'rancher', 'keycloak')}
        calls = []

        def docker(arguments, **kwargs):
            calls.append(arguments)
            if arguments[:1] == ['stop'] and arguments[-1] == 'rancher':
                raise MigrationError('Synthetic timeout after stop side effect')
            return b''

        @contextmanager
        def capabilities(*args, **kwargs):
            yield b'--acls --xattrs --sparse'

        with tempfile.TemporaryDirectory() as folder, \
                patch.object(recovery, 'select_sources', return_value=(sources, [])), \
                patch.object(recovery, 'run', side_effect=docker), \
                patch.object(recovery, 'helper', capabilities), \
                patch.object(recovery, 'preflight', return_value={'offlineRehearsalSupported': True}), \
                patch.object(recovery, 'read_configuration', return_value=[]):
            target = Path(folder) / 'bundle'
            with self.assertRaises(MigrationError):
                recovery.backup({}, target, self.password, quiesce=True)
            self.assertEqual([call for call in calls if call[0] == 'start'], [['start', 'rancher'], ['start', 'console']])
            self.assertFalse((target / 'bundle.json').exists())
            self.assertIn('cold-backup-failed', (target / 'journal.jsonl').read_text())

    def test_authenticate_every_archive_before_allocating_recovery_resources(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)
            with (target / 'volume-0.tar.gz.enc').open('xb') as out:
                integrity = crypto_stream.encrypt(io.BytesIO(b'synthetic tar data'), out, self.password)
            metadata = {'format': 1, 'volumes': [{'archive': 'volume-0.tar.gz.enc', 'integrity': integrity}]}
            with (target / 'metadata.enc').open('xb') as out:
                crypto_stream.encrypt(io.BytesIO(json.dumps(metadata).encode()), out, self.password)
            artifact = target / 'volume-0.tar.gz.enc'
            corrupted = bytearray(artifact.read_bytes())
            corrupted[-1] ^= 1
            artifact.write_bytes(corrupted)
            with patch.object(recovery, 'run') as docker:
                with self.assertRaises(MigrationError):
                    recovery.rehearse_files(target, self.password)
                docker.assert_not_called()

    def test_metadata_cannot_escape_bundle_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)
            with (target / 'metadata.enc').open('xb') as out:
                crypto_stream.encrypt(io.BytesIO(json.dumps({'format': 1, 'volumes': [{'archive': '../outside.enc'}]}).encode()), out, self.password)
            with patch.object(recovery.crypto_stream, 'verify') as verify:
                with self.assertRaises(MigrationError):
                    recovery.read_metadata(target, self.password)
                verify.assert_not_called()

    def test_never_remove_recovery_volume_with_changed_ownership(self):
        metadata = {'sources': {'rancher': {'Image': 'sha256:' + 'a' * 64}}, 'volumes': [
            {'archive': 'volume-0.tar.gz.enc', 'integrity': {'sha256': 'unused'}, 'manifest': []}]}

        @contextmanager
        def restore(*args, **kwargs):
            yield b''

        with tempfile.TemporaryDirectory() as folder, \
                patch.object(recovery, 'read_metadata', return_value=metadata), \
                patch.object(recovery, 'run', return_value=b'') as docker, \
                patch.object(recovery, 'helper', restore), \
                patch.object(recovery, 'manifest', return_value=[]), \
                patch.object(recovery, 'inspect', return_value={'Labels': {recovery.OWNER: 'changed'}}):
            with self.assertRaises(MigrationError):
                recovery.rehearse_files(folder, self.password)
            self.assertFalse(any(call.args[0][:2] == ['volume', 'rm'] for call in docker.call_args_list))


if __name__ == '__main__':
    unittest.main()
