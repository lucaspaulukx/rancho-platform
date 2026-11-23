from contextlib import contextmanager
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from migration import crypto_stream, recovery
from migration.tool import MigrationError


class RecoveryTests(unittest.TestCase):
    password = 'synthetic-recovery-test-passphrase-0123456789'

    def test_backup_requires_explicit_maintenance_before_any_docker_action(self):
        with patch.object(recovery, 'run') as docker:
            with self.assertRaises(MigrationError):
                recovery.backup({}, Path('must-not-be-created'), self.password)
            docker.assert_not_called()

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
            artifact.write_bytes(artifact.read_bytes()[:-1] + b'x')
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
