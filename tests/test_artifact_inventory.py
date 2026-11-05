import copy
import importlib.util
import json
import io
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('artifact_inventory', Path(__file__).resolve().parents[1] / 'scripts/artifact_inventory.py')
inventory = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inventory)


def fixture():
    return {'bomFormat': 'CycloneDX', 'specVersion': '1.6', 'metadata': {
        'component': {'bom-ref': 'old-root', 'properties': [{'name': 'Config.Env', 'value': 'sentinel-private'}]},
        'private': 'sentinel-private'},
        'components': [{'bom-ref': 'old-library', 'type': 'library', 'name': 'public-library', 'version': '1.0',
                        'purl': 'pkg:npm/public-library@1.0?repository_url=https://sentinel-private#sentinel-private',
                        'licenses': [{'license': {'id': 'MIT', 'url': 'https://sentinel-private', 'text': {'content': 'sentinel-private'}}}],
                        'properties': [{'name': 'secret', 'value': 'sentinel-private'}], 'evidence': {'path': 'sentinel-private'}}],
        'dependencies': [{'ref': 'old-root', 'dependsOn': ['old-library']}], 'services': [{'name': 'sentinel-private'}]}


class ArtifactInventoryContract(unittest.TestCase):
    def test_projection_excludes_private_unknown_metadata(self):
        bom, summary = inventory.public_bom(fixture(), 'backend', 'a' * 64, 'runtime-image')
        encoded = json.dumps(bom)
        self.assertNotIn('sentinel-private', encoded)
        self.assertNotIn('old-library', encoded)
        self.assertEqual(bom['components'][0]['licenses'], [{'license': {'id': 'MIT'}}])
        self.assertEqual(summary['components'], 1)
        self.assertEqual(summary['licensesUnknown'], 0)
        self.assertFalse(summary['completeLicenseReview'])
        self.assertEqual(bom['dependencies'][0]['dependsOn'], [bom['components'][0]['bom-ref']])

    def test_graph_is_stable_and_unknown_license_requires_review(self):
        source = fixture(); source['components'][0]['licenses'] = [{'expression': 'NOASSERTION'}]
        first, summary = inventory.public_bom(source, 'console', 'b' * 64, 'runtime-image')
        source['metadata']['timestamp'] = 'different-private-timestamp'
        second, other = inventory.public_bom(source, 'console', 'b' * 64, 'runtime-image')
        self.assertEqual(first, second)
        self.assertEqual(summary, other)
        self.assertEqual(summary['licensesUnknown'], 1)
        self.assertFalse(summary['completeLicenseReview'])

    def test_file_names_and_edges_are_excluded_from_package_inventory(self):
        source = fixture()
        source['components'].append({'type': 'file', 'name': 'sentinel-private', 'bom-ref': 'private-file'})
        source['dependencies'][0]['dependsOn'].append('private-file')
        source['dependencies'].append({'ref': 'private-file', 'dependsOn': ['old-library']})
        bom, summary = inventory.public_bom(source, 'backend', 'a' * 64, 'runtime-image')
        self.assertEqual(summary['components'], 1)
        self.assertNotIn('sentinel-private', json.dumps(bom))
        self.assertEqual(len(bom['dependencies']), 1)

    def test_unsupported_format_or_dangling_dependencies_fail_closed(self):
        for field, value in [('bomFormat', 'unknown'), ('specVersion', '1.7')]:
            source = fixture(); source[field] = value
            with self.assertRaises(ValueError): inventory.public_bom(source, 'backend', 'a' * 64, 'runtime-image')
        source = fixture(); source['dependencies'][0]['dependsOn'] = ['missing']
        with self.assertRaises(ValueError): inventory.public_bom(source, 'backend', 'a' * 64, 'runtime-image')
        source = fixture(); duplicate = copy.deepcopy(source['components'][0]); duplicate['name'] = 'different'; source['components'].append(duplicate)
        with self.assertRaises(ValueError): inventory.public_bom(source, 'backend', 'a' * 64, 'runtime-image')

    def test_plan_only_inspects_scalar_image_fields(self):
        with patch.object(inventory, 'image_info', return_value={'imageId': 'sha256:' + 'a' * 64, 'sizeBytes': 100}), patch.object(inventory, 'digest_file', return_value='b' * 64), patch.object(inventory, 'command') as mutate:
            result = inventory.plan('backend', 'console')
        mutate.assert_not_called()
        self.assertEqual(result['sourceLockSha256'], 'b' * 64)
        self.assertFalse(result['licenseReviewAccepted'])
        self.assertFalse(result['vulnerabilityScanPerformed'])

    def test_existing_output_refused_before_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            sentinel = Path(directory) / 'keep.txt'; sentinel.write_text('keep', encoding='utf-8')
            with patch.object(inventory, 'command') as mutate:
                with self.assertRaises(ValueError): inventory.scan(Path(directory), {})
                mutate.assert_not_called()
            self.assertEqual(sentinel.read_text(encoding='utf-8'), 'keep')

    def test_scanner_cannot_reach_network_or_daemon(self):
        command = inventory.scanner_arguments([], Path('/owned/scratch'))
        self.assertEqual(command[command.index('--network') + 1], 'none')
        self.assertIn('--read-only', command)
        self.assertIn('ALL', command)
        self.assertNotIn('docker.sock', ' '.join(command))
        self.assertNotIn('--privileged', command)

    def test_changed_lockfile_fails_with_owned_staging_removed(self):
        evidence = {'estimatedWorkingBytes': 0, 'images': {}, 'sourceManifests': {'package.json': inventory.digest_file(inventory.ROOT / 'console/package.json'), 'package-lock.json': 'a' * 64}}
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'new-inventory'
            with patch.object(inventory, 'command') as mutate:
                with self.assertRaises(RuntimeError): inventory.scan(output, evidence)
                mutate.assert_not_called()
            self.assertEqual(list(output.glob('.inventory-*')), [])
            report = json.loads((output / 'summary.json').read_text(encoding='utf-8'))
            self.assertEqual(report['status'], 'failed')
            self.assertEqual(report['stage'], 'source-manifest-snapshot')

    def test_timeout_removes_only_the_owned_scanner(self):
        arguments = inventory.scanner_arguments([], Path('/owned/scratch'))
        name = arguments[arguments.index('--name') + 1]
        owner = arguments[arguments.index('--label') + 1].split('=', 1)[1]
        with patch.object(inventory, 'command', side_effect=[subprocess.TimeoutExpired('scanner', 1), None]) as command, patch.object(inventory.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=owner.encode())):
            with self.assertRaises(subprocess.TimeoutExpired): inventory.run_scanner(arguments, io.BytesIO(), 1)
        self.assertEqual(command.call_args_list[1].args[0], ['docker', 'rm', '--force', name])

    def test_different_scanner_owner_refuses_deletion(self):
        arguments = inventory.scanner_arguments([], Path('/owned/scratch'))
        with patch.object(inventory, 'command') as command, patch.object(inventory.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'different-owner')):
            with self.assertRaises(RuntimeError): inventory.run_scanner(arguments, io.BytesIO(), 1)
        self.assertEqual(command.call_count, 1)


if __name__ == '__main__':
    unittest.main()
