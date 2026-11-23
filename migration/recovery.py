"""Cold encrypted local-volume backup and file-level recovery rehearsal.

No cutover, Docker socket inside helpers, published ports, or engine startup.
All private inspect/configuration/manifests stay encrypted, never journaled.
"""
import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import getpass
import io
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import threading

from migration import crypto_stream
from migration import images
from migration.tool import Database, MigrationError, identifier, preflight, run, write_new

NODE = 'node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f'
OWNER = 'rancher.community.recovery'
ROOT = Path(__file__).resolve().parent
DESTINATIONS = {
    'rancher': {'/var/lib/cattle', '/var/lib/mysql', '/var/log/mysql'},
    'keycloak': {'/opt/keycloak/data'},
    'console': {'/var/cache/console-runtime'},
}


def inspect(name, kind=None):
    args = [kind, 'inspect', name] if kind else ['inspect', name]
    return json.loads(run(args))[0]


def select_sources(names):
    if len(set(names.values())) != len(names):
        raise MigrationError('Select distinct source containers.')
    sources = {role: inspect(identifier(name)) for role, name in names.items()}
    volumes = []
    for role, source in sources.items():
        if source['HostConfig'].get('Privileged'):
            raise MigrationError('Privileged source containers require a separate recovery design.')
        environment = dict(item.split('=', 1) for item in source['Config'].get('Env', []) if '=' in item)
        if role == 'keycloak' and (environment.get('KC_DB', 'dev-file') != 'dev-file'
                                   or any(arg.startswith('--db') for arg in source['Config'].get('Cmd') or [])):
            raise MigrationError('Only a dedicated Keycloak dev-file/H2 source is supported.')
        if role == 'rancher' and (any(key.startswith('CATTLE_DB_') and (key, value) != ('CATTLE_DB_CATTLE_DATABASE', 'mysql')
                                      for key, value in environment.items())
                                 or any('db-' in arg for arg in source['Config'].get('Cmd') or [])):
            raise MigrationError('External/overridden Rancher database settings require a separate recovery design.')
        found = set()
        for mount in source['Mounts']:
            if mount['Type'] == 'volume':
                if mount['Destination'] not in DESTINATIONS[role]:
                    raise MigrationError('Unrecognized source volume; no partial backup accepted.')
                volume = inspect(mount['Name'], 'volume')
                if volume['Driver'] != 'local' or volume.get('Options'):
                    raise MigrationError('Remote/custom volume drivers are unsupported.')
                if mount['Name'] in [v['name'] for v in volumes]:
                    raise MigrationError('Source volumes must be distinct.')
                found.add(mount['Destination'])
                volumes.append({'role': role, 'name': mount['Name'], 'destination': mount['Destination']})
            elif mount['Type'] != 'bind' or mount.get('RW'):
                raise MigrationError('Only named local volumes and read-only configuration files are supported.')
        required = DESTINATIONS[role] - ({'/var/log/mysql'} if role == 'rancher' else set())
        if not required.issubset(found):
            raise MigrationError('Required source state volume missing.')
    running = run(['ps', '-q']).decode().split()
    selected_ids = {s['Id'] for s in sources.values()}
    source_volumes = {v['name'] for v in volumes}
    for container_id in running:
        other = inspect(container_id)
        if other['Id'] in selected_ids:
            continue
        if any(m.get('Name') in source_volumes for m in other['Mounts']):
            raise MigrationError('Another running container shares source storage; refuse maintenance.')
    return sources, volumes


@contextmanager
def helper(image, arguments, *, mounts=(), data=None, output=None, writer=None, timeout=900):
    """Helpers have no network or Docker logs; always remove by exact owned ID/name."""
    name = 'rancher-recovery-helper-' + secrets.token_hex(8)
    label = secrets.token_hex(16)
    args = ['docker', 'run', '--rm', '--name', name, '--label', OWNER + '=' + label,
            '--log-driver', 'none', '--network', 'none', '--memory', '512m', '-i']
    for mount in mounts:
        args += ['--mount', mount]
    args += ['--entrypoint', arguments[0], image, *arguments[1:]]
    with open(os.devnull, 'wb') as errors:
        child = subprocess.Popen(args, stdin=subprocess.PIPE if data is not None or writer else subprocess.DEVNULL,
                                 stdout=subprocess.PIPE, stderr=errors)
        timer = threading.Timer(timeout, child.kill)
        timer.start()
        try:
            if writer:
                writer(child.stdin)
                child.stdin.close()
                result = child.stdout.read(1024 * 1024)
            elif output:
                result = output(child.stdout)
            else:
                # Configuration and manifest output is bounded; archive output streams separately.
                if data is not None:
                    child.stdin.write(data)
                    child.stdin.close()
                result = child.stdout.read(64 * 1024 * 1024 + 1)
                if len(result) > 64 * 1024 * 1024:
                    raise MigrationError('Private helper output exceeds its size bound.')
            if child.wait(timeout=30):
                raise MigrationError('Recovery helper failed; private diagnostics withheld.')
            yield result
        finally:
            timer.cancel()
            if child.poll() is None:
                child.kill()
            child.wait()
            # The Docker client may die before its container. Never remove an unowned replacement.
            existing = subprocess.run(['docker', 'inspect', name], capture_output=True)
            if existing.returncode == 0:
                owned = json.loads(existing.stdout)[0]
                if owned['Config'].get('Labels', {}).get(OWNER) != label:
                    raise MigrationError('Helper ownership changed; manual inspection required.')
                run(['rm', '-f', '-v', owned['Id']])


def mount_volume(name, readonly=True):
    identifier(name)
    return 'type=volume,src=' + name + ',dst=/data' + (',readonly' if readonly else '')


def manifest(name):
    # Program goes over stdin, rather than requiring host path translation on Docker Desktop.
    program = (ROOT / 'volume-manifest.cjs').read_bytes()
    with helper(NODE, ['node', '-', '/data'], mounts=[mount_volume(name)], data=program) as result:
        return json.loads(result)


def read_configuration(source):
    bindings = []
    for mount in source['Mounts']:
        if mount['Type'] != 'bind':
            continue
        if ',' in mount['Source']:
            raise MigrationError('Unsupported bind source syntax.')
        program = b"const f=require('fs');const s=f.lstatSync('/config');if(!s.isFile()||s.size>1048576)process.exit(2);process.stdout.write(f.readFileSync('/config'));"
        with helper(NODE, ['node', '-'], mounts=['type=bind,src=' + mount['Source'] + ',dst=/config,readonly'], data=program) as content:
            bindings.append({'destination': mount['Destination'], 'bytesBase64': base64.b64encode(content).decode()})
    return bindings


def journal(directory, stage, **public):
    event = {'atUtc': datetime.now(timezone.utc).isoformat(), 'stage': stage, **public}
    with (directory / 'journal.jsonl').open('a', encoding='utf-8', newline='\n') as out:
        out.write(json.dumps(event, sort_keys=True) + '\n')


def require_stopped_cleanly(state):
    if state.get('Running') or state.get('OOMKilled') or state.get('ExitCode') not in (0, 143):
        raise MigrationError('Source did not stop cleanly; reject the cold capture and inspect its health.')


def backup(names, directory, password, *, quiesce=False, include_images=False):
    if not quiesce:
        raise MigrationError('Cold backup requires explicit --quiesce; use plan for read-only inspection.')
    if len(password) < 20:
        raise MigrationError('Use a recovery passphrase of at least20 characters.')
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    sources, volumes = select_sources(names)
    if shutil.disk_usage(directory).free < 1024**3:
        raise MigrationError('At least1GiB free destination space is required before maintenance; actual data can require more.')
    run(['image', 'inspect', NODE])  # All helpers available before any service is stopped.
    tar_image = sources['rancher']['Image']
    with helper(tar_image, ['tar', '--help']) as capabilities:
        if not all(flag in capabilities for flag in (b'--acls', b'--xattrs', b'--sparse')):
            raise MigrationError('Source image lacks required GNU tar support.')
    health = preflight(Database(sources['rancher']['Id']), check_tables=True)
    if not health['offlineRehearsalSupported']:
        raise MigrationError('Unsupported database: require internal MySQL5.5/InnoDB.')
    metadata = {'format': 1, 'sources': sources, 'volumes': [], 'configuration': {}, 'databasePreflight': health}
    for role, source in sources.items():
        metadata['configuration'][role] = read_configuration(source)
    if include_images:
        selected_images = [source['Image'] for source in sources.values()] + [inspect(NODE, 'image')['Id']]
        required_space = sum(inspect(image, 'image')['Size'] for image in set(selected_images)) + 1024**3
        if shutil.disk_usage(directory).free < required_space:
            raise MigrationError('Destination lacks estimated image export capacity plus1GiB reserve.')
        # Immutable image export takes place BEFORE maintenance, reducing service downtime.
        metadata['images'] = images.save(directory / 'images.tar.enc', selected_images, password)
        journal(directory, 'immutable-images-encrypted', imageCount=len(set(selected_images)))
    stopped = []
    resume_failures = []
    try:
        for role in ('console', 'rancher', 'keycloak'):
            source = sources[role]
            if source['State']['Running']:
                # Record before stopping: a timeout can still have stopped the source.
                stopped.append(source['Id'])
                run(['stop', '--time', '120', source['Id']], timeout=150)
        for source in sources.values():
            require_stopped_cleanly(inspect(source['Id'])['State'])
        # Recheck against a concurrent external restart before each capture too.
        journal(directory, 'sources-quiesced', sourceCount=len(stopped))
        for index, volume in enumerate(volumes):
            select_sources(names)  # Detect a separately restarted writer as well as selected sources.
            if any(inspect(s['Id'])['State']['Running'] for s in sources.values()):
                raise MigrationError('A source restarted during cold capture; discard this incomplete backup.')
            before = manifest(volume['name'])
            filename = 'volume-' + str(index) + '.tar.gz.enc'
            path = directory / filename
            with path.open('xb') as destination:
                with helper(tar_image, ['tar', '--create', '--gzip', '--format=pax', '--acls', '--xattrs',
                                       '--numeric-owner', '--sparse', '--file=-', '--directory=/data', '.'],
                            mounts=[mount_volume(volume['name'])],
                            output=lambda stream: crypto_stream.encrypt(stream, destination, password)) as checksum:
                    pass
            if before != manifest(volume['name']):
                raise MigrationError('Source storage changed during backup; discard the incomplete bundle.')
            metadata['volumes'].append({**volume, 'archive': filename, 'integrity': checksum, 'manifest': before})
            journal(directory, 'volume-encrypted', index=index, encryptedBytes=checksum['encryptedBytes'])
        private = io.BytesIO(json.dumps(metadata, sort_keys=True).encode())
        if private.getbuffer().nbytes > 64 * 1024 * 1024:
            raise MigrationError('Private metadata exceeds the supported recovery bound.')
        with (directory / 'metadata.enc').open('xb') as destination:
            crypto_stream.encrypt(private, destination, password)
        write_new(directory / 'bundle.json', json.dumps({'format': 1, 'volumeCount': len(volumes),
                  'imagesIncluded': include_images, 'engineRecoveryAccepted': False, 'completeMigrationAccepted': False}).encode())
        journal(directory, 'cold-backup-complete')
    except BaseException:
        journal(directory, 'cold-backup-failed', completeMigrationAccepted=False)
        raise
    finally:
        for source_id in reversed(stopped):
            try:
                run(['start', source_id])
            except MigrationError:
                resume_failures.append(source_id)
        journal(directory, 'source-resume', attempted=len(stopped), failed=len(resume_failures))
        if resume_failures:
            raise MigrationError('Source restart failed; inspect selected source containers immediately.')
    return {'backupComplete': True, 'volumes': len(volumes), 'sourceRestartCommandsSucceeded': True,
            'engineRecoveryAccepted': False}


def read_metadata(directory, password):
    directory = Path(directory)
    private = io.BytesIO()
    crypto_stream.decrypt_to(directory / 'metadata.enc', private, password, max_bytes=64 * 1024 * 1024)
    metadata = json.loads(private.getvalue())
    volumes = metadata.get('volumes', [])
    if metadata.get('format') != 1 or not 1 <= len(volumes) <= 8:
        raise MigrationError('Unsupported recovery metadata.')
    if metadata.get('images'):
        images.verify(directory, metadata['images'], password)
    archives = set()
    for volume in volumes:
        filename = volume['archive']
        if not re.fullmatch(r'volume-[0-7]\.tar\.gz\.enc', filename) or filename in archives:
            raise MigrationError('Unsafe or duplicate recovery archive name.')
        archives.add(filename)
        actual = crypto_stream.verify(directory / filename, password)
        if actual != volume['integrity']['sha256']:
            raise MigrationError('Recovery archive differs from authenticated metadata.')
    return metadata


@contextmanager
def restored_volumes(directory, password, *, load_images=False):
    directory = Path(directory)
    metadata = read_metadata(directory, password)  # Verify ALL files before allocating anything.
    if load_images:
        if not metadata.get('images'):
            raise MigrationError('Bundle does not include immutable images.')
        images.load_missing(directory, metadata['images'], password)
    image = metadata['sources']['rancher']['Image']
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', image):
        raise MigrationError('Invalid immutable image identifier.')
    run(['image', 'inspect', image])
    run(['image', 'inspect', NODE])
    label = secrets.token_hex(16)
    owned = []
    try:
        for index, volume in enumerate(metadata['volumes']):
            name = 'rancher-recovery-copy-' + secrets.token_hex(12)
            run(['volume', 'create', '--label', OWNER + '=' + label, name])
            owned.append(name)
            with helper(image, ['tar', '--extract', '--gzip', '--acls', '--xattrs', '--numeric-owner',
                                 '--same-owner', '--same-permissions', '--file=-', '--directory=/data'],
                        mounts=[mount_volume(name, readonly=False)],
                        writer=lambda stream: crypto_stream.decrypt_to(directory / volume['archive'], stream, password,
                                                                      expected_sha256=volume['integrity']['sha256'])):
                pass
            if manifest(name) != volume['manifest']:
                raise MigrationError('Restored content/ownership/modes differ; engine startup prohibited.')
            journal(directory, 'file-restore-verified', index=index)
        yield metadata, owned
    except BaseException:
        journal(directory, 'file-rehearsal-failed', completeMigrationAccepted=False)
        raise
    finally:
        for name in reversed(owned):
            if inspect(name, 'volume').get('Labels', {}).get(OWNER) != label:
                raise MigrationError('Recovery volume ownership changed; refusing removal.')
            run(['volume', 'rm', name])
        journal(directory, 'file-rehearsal-cleanup', volumes=len(owned))


def rehearse_files(directory, password, *, load_images=False):
    with restored_volumes(directory, password, load_images=load_images) as (_, owned):
        count = len(owned)
    return {'fileRecoveryAccepted': True, 'volumes': count, 'engineRecoveryAccepted': False,
            'completeMigrationAccepted': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['plan', 'backup', 'rehearse-files'])
    parser.add_argument('--rancher', default='rancher16-rbac-lab')
    parser.add_argument('--keycloak', default='rancher16-keycloak-lab')
    parser.add_argument('--console', default='rancher16-community-console')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--quiesce', action='store_true')
    parser.add_argument('--include-images', action='store_true', help='Encrypt immutable images before maintenance.')
    parser.add_argument('--load-images', action='store_true', help='Explicitly allow loading bundled missing images for rehearsal.')
    args = parser.parse_args()
    try:
        names = {role: getattr(args, role) for role in DESTINATIONS}
        if args.command == 'plan':
            sources, volumes = select_sources(names)
            result = {'readOnly': True, 'selectedContainers': len(sources), 'localVolumes': len(volumes),
                      'database': preflight(Database(sources['rancher']['Id']), check_tables=True),
                      'sourceWillBeStoppedOnlyWithQuiesce': True, 'engineRecoveryAccepted': False}
        else:
            if not args.output:
                raise MigrationError('--output is required.')
            password = os.environ.get('RANCHER_MIGRATION_BACKUP_PASSWORD') or getpass.getpass('Recovery passphrase: ')
            result = backup(names, args.output, password, quiesce=args.quiesce, include_images=args.include_images) if args.command == 'backup' else rehearse_files(args.output, password, load_images=args.load_images)
        print(json.dumps(result, indent=2))
    except MigrationError as error:
        print('Recovery refused/failed: ' + str(error), file=__import__('sys').stderr)
        return 1
    except (ValueError, KeyError, OSError, subprocess.SubprocessError):
        # Never echo exceptions which can contain private configuration or archive paths.
        print('Recovery operation failed; no cutover performed. Inspect selected service state and safe journal.', file=__import__('sys').stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
