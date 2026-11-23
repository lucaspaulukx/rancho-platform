import json
import unittest
from unittest.mock import patch

from scripts import release_artifact_rehearsal as rehearsal


class ReleaseArtifactRehearsalTest(unittest.TestCase):
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
