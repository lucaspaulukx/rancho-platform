
"""Rehearse cold backup and recovery of a service using a named local volume."""

import hashlib
import json
from pathlib import Path
import secrets
import tempfile
import time

from migration import crypto_stream
from migration.recovery import (NODE, archive_local_volume, inspect, manifest,
                                mount_volume, require_stopped_cleanly, restore_local_volume)
from migration.rehearse_modern_backend import source_image
from migration.test_fresh_install_lab import image_id, require
from migration.tool import MigrationError, run


LABEL = 'community.console.workload-recovery'
SERVICE = r"""
    set -eu
    if [ "$1" = seed ]; then
        mkdir -p /data/app
        printf '%s' "$2" > /data/app/state
        chown 4242:4242 /data/app/state
        chmod 0640 /data/app/state
        ln -s app/state /data/current
    fi
    test "$(sha256sum /data/current | cut -d' ' -f1)" = "$3"
    printf 'persisted state available\n'
    trap 'exit 0' TERM
    sleep 86400 &
    wait "$!"
"""


def exercise(directory, tar_image, workload_image):
    owner = secrets.token_hex(12)
    names = {role: f'rancho-workload-{owner}-{role}' for role in
             ('source', 'source-data', 'target', 'target-data')}
    token = secrets.token_hex(32)
    checksum = hashlib.sha256(token.encode()).hexdigest()
    password = secrets.token_urlsafe(32)
    archive = directory / 'volume.tar.gz.enc'
    owned = []

    def create_volume(role):
        run(['volume', 'create', '--label', f'{LABEL}={owner}', names[role]])
        owned.append((role, 'volume'))

    def launch(role, mode):
        mount = mount_volume(names[role + '-data'], readonly=mode != 'seed')
        run(['run', '-d', '--pull', 'never', '--network', 'none',
             '--name', names[role], '--label', f'{LABEL}={owner}', '--log-driver', 'none',
             '--mount', mount, '--entrypoint', '/bin/sh', workload_image,
             '-ec', SERVICE, 'sh', mode, token if mode == 'seed' else '', checksum])
        owned.append((role, 'container'))

    def verify_service(role):
        name = names[role]
        for _ in range(20):
            try:
                value = run(['exec', name, '/bin/sh', '-ec',
                             "test -L /data/current; test -f /data/current; sha256sum /data/current"])
            except MigrationError:
                time.sleep(1)
                continue
            require(value.decode().split()[0] == checksum, 'Service sees the original checksum')
            return
        raise MigrationError('Restored workload did not expose persistent data.')

    def remove_owned(role, kind):
        name = names[role]
        info = inspect(name, kind)
        labels = (info['Config'] if kind == 'container' else info).get('Labels', {})
        require(labels.get(LABEL) == owner, 'Fixture ownership changed')
        run(['rm', '-fv', name] if kind == 'container' else ['volume', 'rm', name])

    try:
        create_volume('source-data')
        launch('source', 'seed')
        verify_service('source')
        run(['stop', '--time', '3', names['source']])
        require_stopped_cleanly(inspect(names['source'])['State'])
        original, integrity = archive_local_volume(tar_image, names['source-data'], archive, password)
        require(crypto_stream.verify(archive, password) == integrity['sha256'], 'Archive is authenticated')
        create_volume('target-data')
        restore_local_volume(tar_image, names['target-data'], archive, password, integrity, original)
        launch('target', 'read')
        verify_service('target')
        require(manifest(names['source-data']) == original, 'Source volume was preserved')
        require(manifest(names['target-data']) == original, 'Restored volume was preserved')
        print('PASS: encrypted local volume recovery restored a running service with matching bytes and metadata.', flush=True)
    finally:
        for role, kind in reversed(owned):
            remove_owned(role, kind)


def main():
    tar_image = image_id(source_image)
    workload_image = image_id('alpine:3.20')
    image_id(NODE)
    with tempfile.TemporaryDirectory(prefix='rancho-workload-volume-') as folder:
        exercise(Path(folder), tar_image, workload_image)


if __name__ == '__main__':
    main()
