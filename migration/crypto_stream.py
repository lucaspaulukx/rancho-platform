"""Authenticated encrypted streams for private recovery archives; never plaintext files."""
import hashlib
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.exceptions import InvalidTag

from migration.tool import key, MigrationError

MAGIC = b'RANCHER-RECOVERY-GCM-1\n'
CHUNK = 1024 * 1024
HEADER = len(MAGIC) + 28


def encrypt(source, destination, password, *, max_bytes=10 * 1024**3):
    import secrets
    if len(password) < 20:
        raise MigrationError('Use a recovery passphrase of at least20 characters.')
    salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
    header = MAGIC + salt + nonce
    cipher = Cipher(algorithms.AES(key(password, salt)), modes.GCM(nonce)).encryptor()
    cipher.authenticate_additional_data(header)
    digest = hashlib.sha256()
    count = 0
    def write(block):
        destination.write(block)
        digest.update(block)
    write(header)
    while True:
        block = source.read(CHUNK)
        if not block:
            break
        count += len(block)
        if count > max_bytes:
            raise MigrationError('Recovery archive exceeds the configured size limit.')
        write(cipher.update(block))
    write(cipher.finalize())
    write(cipher.tag)
    return {'plaintextBytes': count, 'encryptedBytes': count + HEADER + 16, 'sha256': digest.hexdigest()}


def _pass(stream, password, sink, max_bytes):
    stream.seek(0, 2)
    size = stream.tell()
    if size < HEADER + 16 or size > max_bytes + HEADER + 16:
        raise MigrationError('Invalid or oversized recovery archive.')
    stream.seek(0)
    header = stream.read(HEADER)
    if not header.startswith(MAGIC):
        raise MigrationError('Unsupported recovery archive format.')
    offset = len(MAGIC)
    salt, nonce = header[offset:offset+16], header[offset+16:offset+28]
    stream.seek(-16, 2)
    tag = stream.read(16)
    decryptor = Cipher(algorithms.AES(key(password, salt)), modes.GCM(nonce, tag)).decryptor()
    decryptor.authenticate_additional_data(header)
    digest = hashlib.sha256(header)
    stream.seek(HEADER)
    left = size - HEADER - 16
    while left:
        block = stream.read(min(CHUNK, left))
        if not block:
            raise MigrationError('Truncated recovery archive.')
        left -= len(block)
        digest.update(block)
        plain = decryptor.update(block)
        if sink is not None:
            sink.write(plain)
    try:
        final = decryptor.finalize()
    except InvalidTag:
        raise MigrationError('Recovery authentication failed; do not use the destination.') from None
    if sink is not None:
        sink.write(final)
    digest.update(tag)
    return digest.hexdigest()


def verify(path, password, *, max_bytes=10 * 1024**3):
    path = Path(path)
    if path.is_symlink():
        raise MigrationError('Refusing symlink archive.')
    with path.open('rb') as stream:
        return _pass(stream, password, None, max_bytes)


def decrypt_to(path, destination, password, *, expected_sha256=None, max_bytes=10 * 1024**3):
    """Authenticate a complete first pass before writing anything to the destination.

    Revalidate on the second pass too. Callers restore only to disposable owned volumes,
    so a concurrent local file change can never become an accepted/cutover destination.
    """
    path = Path(path)
    if path.is_symlink():
        raise MigrationError('Refusing symlink archive.')
    with path.open('rb') as stream:
        digest = _pass(stream, password, None, max_bytes)
        if expected_sha256 is not None and digest != expected_sha256:
            raise MigrationError('Recovery archive checksum differs from authenticated metadata.')
        if _pass(stream, password, destination, max_bytes) != digest:
            raise MigrationError('Recovery archive changed during extraction; discard the owned destination.')

