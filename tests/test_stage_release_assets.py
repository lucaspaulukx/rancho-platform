from pathlib import Path
import tempfile
import unittest

from scripts.stage_release_assets import COMPONENTS, digest, stage


class StageReleaseAssetsTests(unittest.TestCase):
    commit = 'f' * 40

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        self.inputs, self.output = root / 'inputs', root / 'publish'
        self.calls = []
        source = f'rancho-platform-{self.commit}-source.zip'
        self.bundle('source', {source: b'source'})
        for component in COMPONENTS:
            name = f'rancho-{component}-{self.commit}.docker.tar.gz'
            self.bundle(component, {name: component.encode(), 'IMAGE-ID.txt': b'sha256:' + b'1' * 64 + b'\n'})

    def bundle(self, component, files):
        folder = self.inputs / component
        folder.mkdir(parents=True)
        for name, content in files.items():
            (folder / name).write_bytes(content)
        (folder / 'SHA256SUMS.txt').write_text(
            ''.join(f'{digest(folder / name)}  {name}\n' for name in files), encoding='ascii',
        )

    def verifier(self, path, workflow, revision):
        self.assertEqual(revision, self.commit)
        self.calls.append((path.name, workflow))

    def test_flat_asset_names_do_not_change_signed_checksum_contents(self):
        report = stage(self.inputs, self.output, self.commit, verifier=self.verifier)
        self.assertEqual(len(report['assets']), 41)
        self.assertEqual(len(self.calls), 27)
        self.assertEqual(set(report['imageIds']), set(COMPONENTS))
        for component in COMPONENTS:
            self.assertEqual(
                (self.output / f'rancho-{component}-SHA256SUMS.txt').read_bytes(),
                (self.inputs / component / 'SHA256SUMS.txt').read_bytes(),
            )
        self.assertTrue((self.output / 'rancho-asset-index.json').is_file())

    def test_tampered_image_has_no_publish_directory(self):
        path = next((self.inputs / 'agent').glob('*.docker.tar.gz'))
        path.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            stage(self.inputs, self.output, self.commit, verifier=self.verifier)
        self.assertFalse(self.output.exists())

    def test_manifest_change_during_attestation_cannot_stage(self):
        def change_first_checksum(path, workflow, revision):
            self.verifier(path, workflow, revision)
            if path.parent.name == 'backend' and path.name == 'SHA256SUMS.txt':
                with path.open('ab') as stream:
                    stream.write(b'changed after read')

        with self.assertRaisesRegex(ValueError, 'changed during attestation'):
            stage(self.inputs, self.output, self.commit, verifier=change_first_checksum)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
