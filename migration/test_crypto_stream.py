import io
from pathlib import Path
import tempfile
import unittest

from migration import crypto_stream as crypto
from migration.tool import MigrationError


class CryptoStreamTests(unittest.TestCase):
    password = 'synthetic-only-recovery-passphrase-' + 'x' * 24

    def artifact(self, folder, data):
        target = Path(folder) / 'archive.enc'
        with target.open('xb') as output:
            metadata = crypto.encrypt(io.BytesIO(data), output, self.password)
        return target, metadata

    def test_multi_chunk_roundtrip_and_digest(self):
        data = b'non-private-fixture' * 180000
        with tempfile.TemporaryDirectory() as folder:
            target, metadata = self.artifact(folder, data)
            self.assertEqual(crypto.verify(target, self.password), metadata['sha256'])
            output = io.BytesIO()
            crypto.decrypt_to(target, output, self.password, expected_sha256=metadata['sha256'])
            self.assertEqual(output.getvalue(), data)
            self.assertEqual(metadata['plaintextBytes'], len(data))

    def test_empty_stream_is_authenticated(self):
        with tempfile.TemporaryDirectory() as folder:
            target, metadata = self.artifact(folder, b'')
            self.assertEqual(crypto.verify(target, self.password), metadata['sha256'])

    def test_bad_password_never_writes_plaintext(self):
        with tempfile.TemporaryDirectory() as folder:
            target, _ = self.artifact(folder, b'fixture')
            output = io.BytesIO()
            with self.assertRaises(MigrationError):
                crypto.decrypt_to(target, output, 'wrong-passphrase-' * 3)
            self.assertEqual(output.getvalue(), b'')

    def test_tampered_header_ciphertext_and_tag_never_write(self):
        for position in (len(crypto.MAGIC) + 2, crypto.HEADER + 1, -1):
            with tempfile.TemporaryDirectory() as folder:
                target, _ = self.artifact(folder, b'synthetic-fixture-data')
                data = bytearray(target.read_bytes()); data[position] ^= 1; target.write_bytes(data)
                output = io.BytesIO()
                with self.assertRaises(MigrationError):
                    crypto.decrypt_to(target, output, self.password)
                self.assertEqual(output.getvalue(), b'')

    def test_wrong_manifest_digest_never_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            target, _ = self.artifact(folder, b'fixture')
            output = io.BytesIO()
            with self.assertRaises(MigrationError):
                crypto.decrypt_to(target, output, self.password, expected_sha256='0' * 64)
            self.assertEqual(output.getvalue(), b'')

    def test_truncation_and_oversize_block_restore(self):
        with tempfile.TemporaryDirectory() as folder:
            target, _ = self.artifact(folder, b'fixture' * 100)
            with self.assertRaises(MigrationError):
                crypto.verify(target, self.password, max_bytes=5)
            target.write_bytes(target.read_bytes()[:-20])
            with self.assertRaises(MigrationError):
                crypto.verify(target, self.password)

    def test_encryption_size_bound_and_short_passphrase(self):
        with self.assertRaises(MigrationError):
            crypto.encrypt(io.BytesIO(b'too-large'), io.BytesIO(), self.password, max_bytes=2)
        with self.assertRaises(MigrationError):
            crypto.encrypt(io.BytesIO(b'fixture'), io.BytesIO(), 'short')


if __name__ == '__main__':
    unittest.main()
