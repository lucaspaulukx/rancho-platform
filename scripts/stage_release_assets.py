"""Verify and stage GitHub release assets. Does not upload or publish anything."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys


REPO = 'lucaspaulukx/rancho-platform'
COMPONENTS = (
    'backend', 'console', 'database', 'restore', 'agent', 'ipsec-holder', 'ipsec-router',
    'ipsec-cni', 'network-manager', 'metadata', 'dns', 'healthcheck', 'scheduler',
)
PLAIN_SHA = re.compile(r'[0-9a-f]{64}')
MAX_ASSET_BYTES = 2 * 1024**3 - 1
METADATA_LIMIT = 4096


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify_attestation(path, workflow, commit):
    command = [
        'gh', 'attestation', 'verify', str(path), '--repo', REPO,
        '--signer-workflow', f'{REPO}/.github/workflows/{workflow}.yml',
        '--source-ref', 'refs/heads/main', '--source-digest', commit, '--deny-self-hosted-runners',
    ]
    subprocess.run(command, check=True, capture_output=True, timeout=60)


def regular(path, limit=MAX_ASSET_BYTES):
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= limit:
        raise ValueError(f'Missing, empty, oversized or unsafe asset: {path.name}')
    return path


def read_manifest(directory, expected):
    manifest = regular(directory / 'SHA256SUMS.txt', METADATA_LIMIT)
    raw = manifest.read_bytes()
    hashes = {}
    for line in raw.decode('ascii').splitlines():
        parts = line.split('  ')
        if len(parts) != 2 or not PLAIN_SHA.fullmatch(parts[0]):
            raise ValueError('Malformed checksum manifest')
        value, name = parts
        if name not in expected or name in hashes:
            raise ValueError('Unexpected or duplicate checksum entry')
        hashes[name] = value
    if set(hashes) != set(expected):
        raise ValueError('Missing checksum entry')
    for name, value in hashes.items():
        if digest(regular(directory / name)) != value:
            raise ValueError(f'Checksum mismatch: {name}')
    return manifest, hashlib.sha256(raw).hexdigest(), hashes


def stage(root, output, commit, *, verifier=verify_attestation):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('A full lower-case commit SHA is required')
    root, output = Path(root), Path(output)
    if root.is_symlink() or output.is_symlink():
        raise ValueError('Artifact and output directories cannot be symbolic links')
    root, output = root.resolve(), output.resolve()
    if output.is_relative_to(root) or output.exists():
        raise ValueError('Use a new output directory outside the artifact tree')

    def folder(name):
        path = root / name
        if path.is_symlink() or not path.is_dir():
            raise ValueError(f'Invalid artifact directory: {name}')
        return path

    files = {}
    def add(original, name, sha):
        if name in files:
            raise ValueError(f'Duplicate release asset: {name}')
        files[name] = (original, sha)

    source_name = f'rancho-platform-{commit}-source.zip'
    source = folder('source')
    sums, sums_sha, hashes = read_manifest(source, (source_name,))
    verifier(source / source_name, 'source-provenance', commit)
    add(source / source_name, source_name, hashes[source_name])
    add(sums, 'rancho-source-SHA256SUMS.txt', sums_sha)

    image_ids = {}
    for component in COMPONENTS:
        directory = folder(component)
        name = f'rancho-{component}-{commit}.docker.tar.gz'
        sums, sums_sha, hashes = read_manifest(directory, (name, 'IMAGE-ID.txt'))
        verifier(directory / name, 'runtime-provenance', commit)
        verifier(sums, 'runtime-provenance', commit)
        if digest(sums) != sums_sha:
            raise ValueError('Checksum manifest changed during attestation verification')
        id_path = regular(directory / 'IMAGE-ID.txt', METADATA_LIMIT)
        raw_id = id_path.read_bytes()
        if hashlib.sha256(raw_id).hexdigest() != hashes['IMAGE-ID.txt']:
            raise ValueError('Image ID changed during attestation verification')
        image_id = raw_id.decode('ascii').strip()
        if not re.fullmatch(r'sha256:[0-9a-f]{64}', image_id):
            raise ValueError(f'Malformed Docker image ID: {component}')
        image_ids[component] = image_id
        add(directory / name, name, hashes[name])
        add(id_path, f'rancho-{component}-IMAGE-ID.txt', hashes['IMAGE-ID.txt'])
        add(sums, f'rancho-{component}-SHA256SUMS.txt', sums_sha)

    required_bytes = sum(path.stat().st_size for path, _ in files.values())
    if shutil.disk_usage(output.parent).free < required_bytes + 1024**2:
        raise ValueError('Not enough disk space to stage the release assets')
    output.mkdir()
    for name, (path, sha) in sorted(files.items()):
        destination = output / name
        with path.open('rb') as source, destination.open('xb') as target:
            shutil.copyfileobj(source, target)
        if digest(destination) != sha:
            raise ValueError(f'Asset changed during staging: {name}')

    # The index is written last, so a partial output cannot be mistaken for success.
    report = {
        'commit': commit, 'platform': 'linux/amd64',
        'scope': 'verified project source and runtime archives; excludes corresponding dependency sources',
        'imageIds': image_ids,
        'assets': {name: sha for name, (_, sha) in sorted(files.items())},
    }
    with (output / 'rancho-asset-index.json').open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        report = stage(args.input, args.output, args.commit)
    except ValueError as exc:
        print(f'Asset staging failed: {exc}', file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError) as exc:
        print(f'Asset staging failed: {type(exc).__name__}', file=sys.stderr)
        return 1
    print(f"Staged {len(report['assets'])} verified files and an index. Nothing uploaded.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
