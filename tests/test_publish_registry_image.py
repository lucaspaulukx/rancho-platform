from pathlib import Path
import tempfile
import unittest
import subprocess

from scripts.publish_registry_image import verified_archive, verify_candidate
from scripts.stage_release_assets import digest


class RegistryArchiveTests(unittest.TestCase):
    commit = 'a' * 40

    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.name = f'rancho-console-{self.commit}.docker.tar.gz'
        (self.root / self.name).write_bytes(b'owned synthetic archive')
        (self.root / 'IMAGE-ID.txt').write_text('sha256:' + 'b' * 64 + '\n')
        self.sums()
        self.calls = []

    def sums(self):
        (self.root / 'SHA256SUMS.txt').write_text(
            ''.join(f'{digest(self.root / name)}  {name}\n'
                    for name in (self.name, 'IMAGE-ID.txt')))

    def verify(self, path, workflow, commit):
        self.calls.append((path.name, workflow, commit))

    def check(self, **kwargs):
        return verified_archive(self.root, kwargs.get('commit', self.commit),
                                kwargs.get('component', 'console'), kwargs.get('version', '0.1.0'),
                                verifier=kwargs.get('verifier', self.verify))

    def test_archive_and_manifest_are_verified_before_promotion(self):
        path, image_id, checksum = self.check()
        self.assertEqual(path.name, self.name)
        self.assertEqual(image_id, 'sha256:' + 'b' * 64)
        self.assertEqual(checksum, digest(path))
        self.assertEqual([x[0] for x in self.calls], [self.name, 'SHA256SUMS.txt'])
        self.assertTrue(all(x[1:] == ('runtime-provenance', self.commit) for x in self.calls))

    def test_mutable_or_malformed_tags_are_not_accepted(self):
        for version in ('latest', '../escape', '0.1.0;exit', '0.1.0\n', 'v0.1.0', '1'):
            with self.subTest(version=version), self.assertRaises(ValueError):
                self.check(version=version)
        self.assertFalse(self.calls)

    def test_changed_archive_fails_before_attestation(self):
        (self.root / self.name).write_bytes(b'changed archive')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            self.check()
        self.assertFalse(self.calls)

    def test_change_during_attestation_cannot_be_published(self):
        def tamper(path, workflow, commit):
            self.verify(path, workflow, commit)
            (self.root / self.name).write_bytes(b'changed during verification')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            self.check(verifier=tamper)

    def test_wrong_commit_and_component_cannot_select_other_paths(self):
        for values in ({'commit': 'main'}, {'component': '../console'}, {'component': 'not-a-component'}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.check(**values)
        self.assertFalse(self.calls)

    def test_malformed_image_id_is_rejected_even_with_matching_checksums(self):
        (self.root / 'IMAGE-ID.txt').write_text('mutable-name:latest\n')
        self.sums()
        with self.assertRaisesRegex(ValueError, 'image ID'):
            self.check()


class AcceptedCandidateTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory(prefix='rancho-promotion-git-')
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.write('README.md', 'Public guide')
        self.write('console/example.ts', 'accepted runtime')
        self.commit()
        self.accepted = self.git('rev-parse', 'HEAD').strip()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True)

    def write(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data)

    def commit(self):
        self.git('add', '--all')
        self.git('commit', '-qm', 'Synthetic publication fixture')

    def test_documentation_only_followup_can_promote_the_same_tested_image(self):
        self.write('README.md', 'Reviewed release guide')
        self.write('docs/en/release.md', 'Reviewed public instructions')
        self.commit()
        self.assertEqual(verify_candidate(self.accepted, self.root),
                         self.git('rev-parse', 'HEAD').strip())

    def test_runtime_change_requires_a_new_candidate(self):
        self.write('console/example.ts', 'different runtime')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'Runtime inputs changed'):
            verify_candidate(self.accepted, self.root)

    def test_build_configuration_change_is_not_treated_as_documentation(self):
        self.write('scripts/build_release_image.sh', 'different build inputs')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'Runtime inputs changed'):
            verify_candidate(self.accepted, self.root)


if __name__ == '__main__':
    unittest.main()
