import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from migration import crypto_stream, images
from migration.tool import MigrationError


class ImageTransportTests(unittest.TestCase):
    def test_only_immutable_ids_no_tags_or_options(self):
        for values in [[], ['rancher/server:latest'], ['--all'], ['sha256:' + 'a' * 63]]:
            with self.assertRaises(MigrationError):
                images.image_ids(values)
        digest = 'sha256:' + 'a' * 64
        self.assertEqual(images.image_ids([digest, digest]), [digest])

    def test_corrupt_archive_never_reaches_docker(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            password = 'synthetic-image-recovery-passphrase'
            with (directory / 'images.tar.enc').open('xb') as out:
                integrity = crypto_stream.encrypt(io.BytesIO(b'synthetic archive'), out, password)
            metadata = {'archive': 'images.tar.enc', 'imageIds': ['sha256:' + 'a' * 64], 'integrity': integrity}
            artifact = directory / 'images.tar.enc'
            corrupted = bytearray(artifact.read_bytes())
            corrupted[-1] ^= 1
            artifact.write_bytes(corrupted)
            with patch.object(images.subprocess, 'run') as docker:
                with self.assertRaises(MigrationError):
                    images.load_missing(directory, metadata, password)
                docker.assert_not_called()

    def test_image_archive_cannot_escape_backup_directory(self):
        with patch.object(images.crypto_stream, 'verify') as verify:
            with self.assertRaises(MigrationError):
                images.verify(Path('.'), {'imageIds': ['sha256:' + 'a' * 64], 'archive': '../outside.enc'}, 'irrelevant')
            verify.assert_not_called()


if __name__ == '__main__':
    unittest.main()
