import json
from subprocess import CompletedProcess
import unittest
from unittest.mock import patch

from scripts import release_artifact_rehearsal as rehearsal


class ReleaseArtifactRehearsalTest(unittest.TestCase):
    def test_cluster_flags_must_be_explicitly_rejected_without_a_network(self):
        rejection = CompletedProcess([], 2, b'', b'The experimental backend supports single-node mode only.')
        with patch.object(rehearsal.subprocess, 'run', return_value=rejection) as run:
            rehearsal.check_single_node_boundary('backend-id')
        flags = {call.args[0][-2] for call in run.call_args_list}
        self.assertEqual(flags, {
            f'{prefix}_MODULE_PROFILE_HAZELCAST_{profile}=true'
            for prefix in ('CATTLE', 'DEFAULT_CATTLE')
            for profile in ('EVENTING', 'LOCK', 'CONFIG_CUSTOM')
        })
        for call in run.call_args_list:
            command = call.args[0]
            self.assertEqual(command[command.index('--network') + 1], 'none')
            self.assertEqual(command[-1], 'backend-id')
        with patch.object(rehearsal.subprocess, 'run',
                          return_value=CompletedProcess([], 2, b'', b'Unexpected startup failure')):
            with self.assertRaisesRegex(RuntimeError, 'unsupported cluster flag'):
                rehearsal.check_single_node_boundary('backend-id')

    def test_modern_rehearsal_pins_database_and_backend_across_both_migration_stages(self):
        report = {}
        rollback = {'status': 'passed', 'cleanupComplete': True,
                    'images': {'previous': 'previous-id', 'candidate': 'candidate-id'},
                    'configurationSha256': 'a' * 64}
        with (patch.object(rehearsal, 'image_id', side_effect=[
            'backend-id', 'previous-id', 'candidate-id', 'database-id', 'restore-id',
        ]), patch.object(rehearsal, 'check_single_node_boundary') as boundary,
              patch.object(rehearsal, 'run_check', side_effect=['', '', json.dumps(rollback)]) as check):
            rehearsal.rehearse('backend:tag', 'previous:tag', 'candidate:tag', None, report,
                               modern_database='db:tag', restore_image='restore:tag')
        first, database, frontend = (call.args[0] for call in check.call_args_list)
        self.assertEqual(first, ['-m', 'migration.test_first_start_lab',
                                '--backend-image', 'backend-id', '--console-image', 'candidate-id',
                                '--database-image', 'database-id', '--restore-image', 'restore-id'])
        self.assertEqual(database, ['-m', 'migration.rehearse_modern_backend',
                                   '--backend-image', 'backend-id', '--database-image', 'database-id'])
        self.assertEqual(frontend[-2:], ['--candidate-image', 'candidate-id'])
        self.assertTrue(report['firstStartMigrationPassed'])
        self.assertTrue(report['databaseRollbackPassed'])
        boundary.assert_called_once_with('backend-id')
        self.assertTrue(report['singleNodeBoundaryPassed'])

    def test_pins_the_same_candidate_in_both_stages(self):
        report = {}
        rollback = {
            'status': 'passed', 'cleanupComplete': True,
            'images': {'previous': 'previous-id', 'candidate': 'candidate-id'},
            'configurationSha256': 'a' * 64,
        }
        with (patch.object(rehearsal, 'image_id', side_effect=['backend-id', 'previous-id', 'candidate-id']),
              patch.object(rehearsal, 'run_check', side_effect=['', json.dumps(rollback)]) as check):
            rehearsal.rehearse('backend:tag', 'previous:tag', 'candidate:tag', None, report,
                               configuration_reversal=True)
        self.assertEqual(check.call_args_list[0].args[0][-3:],
                         ['--console-image', 'candidate-id', '--configuration-reversal'])
        self.assertEqual(check.call_args_list[1].args[0][-2:], ['--candidate-image', 'candidate-id'])
        self.assertTrue(report['cleanupComplete'])
        self.assertTrue(report['configurationReversalPassed'])

    def test_rejects_evidence_from_another_artifact(self):
        report = {}
        rollback = {
            'status': 'passed', 'cleanupComplete': True,
            'images': {'previous': 'previous-id', 'candidate': 'different-id'},
        }
        with (patch.object(rehearsal, 'image_id', side_effect=['backend-id', 'previous-id', 'candidate-id']),
              patch.object(rehearsal, 'run_check', side_effect=['', json.dumps(rollback)])):
            with self.assertRaises(RuntimeError):
                rehearsal.rehearse('backend:tag', 'previous:tag', 'candidate:tag', None, report)
        self.assertEqual(report['stage'], 'frontend-rollback')
        self.assertNotIn('cleanupComplete', report)
