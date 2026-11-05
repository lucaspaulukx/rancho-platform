"""Encrypted Docker image transport, identified by immutable image IDs only."""
import os
import re
import subprocess
import threading

from migration import crypto_stream
from migration.tool import MigrationError, run

LIMIT = 20 * 1024**3


def image_ids(values):
    values = sorted(set(values))
    if not 1 <= len(values) <= 8 or any(not re.fullmatch(r'sha256:[a-f0-9]{64}', value) for value in values):
        raise MigrationError('Invalid immutable image selection.')
    return values


def save(path, values, password):
    values = image_ids(values)
    for value in values:
        run(['image', 'inspect', value])
    with open(os.devnull, 'wb') as errors, path.open('xb') as destination:
        child = subprocess.Popen(['docker', 'image', 'save', *values], stdout=subprocess.PIPE, stderr=errors)
        timer = threading.Timer(900, child.kill)
        timer.start()
        try:
            integrity = crypto_stream.encrypt(child.stdout, destination, password, max_bytes=LIMIT)
            if child.wait(timeout=30):
                raise MigrationError('Immutable image export failed; discard incomplete bundle.')
        finally:
            timer.cancel()
            if child.poll() is None:
                child.kill()
            child.wait()
    return {'archive': 'images.tar.enc', 'imageIds': values, 'integrity': integrity}


def verify(directory, metadata, password):
    image_ids(metadata['imageIds'])
    if metadata.get('archive') != 'images.tar.enc':
        raise MigrationError('Unsafe image archive name.')
    if crypto_stream.verify(directory / 'images.tar.enc', password, max_bytes=LIMIT) != metadata['integrity']['sha256']:
        raise MigrationError('Image archive differs from authenticated metadata.')


def load_missing(directory, metadata, password):
    """Explicit opt-in only: authenticates before Docker receives any archive bytes.

    Saved by IDs, rather than tag selectors, so no mutable deployment tag is replaced.
    Existing images are never removed to manufacture a disaster-recovery test.
    """
    verify(directory, metadata, password)
    missing = [value for value in image_ids(metadata['imageIds'])
               if subprocess.run(['docker', 'image', 'inspect', value], capture_output=True).returncode]
    if not missing:
        return {'imageLoadNeeded': False, 'immutableImagesAvailable': True}
    with open(os.devnull, 'wb') as private:
        child = subprocess.Popen(['docker', 'image', 'load', '--quiet'], stdin=subprocess.PIPE,
                                 stdout=private, stderr=private)
        timer = threading.Timer(900, child.kill)
        timer.start()
        try:
            crypto_stream.decrypt_to(directory / metadata['archive'], child.stdin, password,
                                     expected_sha256=metadata['integrity']['sha256'], max_bytes=LIMIT)
            child.stdin.close()
            if child.wait(timeout=120):
                raise MigrationError('Immutable image import failed; no cutover permitted.')
        finally:
            timer.cancel()
            if child.poll() is None:
                child.kill()
            child.wait()
    for value in metadata['imageIds']:
        run(['image', 'inspect', value])
    return {'imageLoadNeeded': True, 'immutableImagesAvailable': True}
