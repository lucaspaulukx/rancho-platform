"""Promote a verified image archive to an immutable version tag in GHCR."""

import argparse
import json
from pathlib import Path
import re
import subprocess

from scripts.stage_release_assets import COMPONENTS, read_manifest, regular, verify_attestation


REGISTRY = 'ghcr.io/lucaspaulukx/rancho-platform'
VERSION = re.compile(r'0\.[0-9]+\.[0-9]+(?:-(?:alpha|beta|rc)\.[0-9]+)?')
SHA = re.compile(r'[0-9a-f]{40}')
DIGEST = re.compile(r'sha256:[0-9a-f]{64}')


def checked(args, timeout=300):
    result = subprocess.run(args, check=True, capture_output=True, timeout=timeout)
    return result.stdout


def verified_archive(directory, commit, component, version, *, verifier=verify_attestation):
    if not SHA.fullmatch(commit) or component not in COMPONENTS or not VERSION.fullmatch(version):
        raise ValueError('Invalid pinned commit, component or release version')
    directory = Path(directory)
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('Use a regular artifact directory')
    name = f'rancho-{component}-{commit}.docker.tar.gz'
    manifest, _, hashes = read_manifest(directory, (name, 'IMAGE-ID.txt'))
    verifier(directory / name, 'runtime-provenance', commit)
    verifier(manifest, 'runtime-provenance', commit)
    # Recheck all bytes after attestation verification.
    if read_manifest(directory, (name, 'IMAGE-ID.txt'))[2] != hashes:
        raise ValueError('Artifact changed during verification')
    image_id = regular(directory / 'IMAGE-ID.txt', 4096).read_text(encoding='ascii').strip()
    if not DIGEST.fullmatch(image_id):
        raise ValueError('Malformed archived image ID')
    return directory / name, image_id, hashes[name]


def metadata(reference):
    result = json.loads(checked(['docker', 'image', 'inspect', reference]))
    if len(result) != 1:
        raise ValueError('Expected one image')
    return result[0]


def promote(directory, commit, component, version, output):
    archive, expected, archive_sha = verified_archive(directory, commit, component, version)
    output = Path(output)
    if output.exists() or output.is_symlink():
        raise ValueError('Use a new report path')
    checked(['docker', 'image', 'load', '-i', str(archive)])
    source = metadata(f'rancho-release-{component}:{commit}')
    if source['Id'] != expected or source['Config'].get('Labels', {}).get('org.opencontainers.image.revision') != commit:
        raise ValueError('Loaded image does not match the verified source identity')
    tag = f'{REGISTRY}:{component}-{version}'
    probe = subprocess.run(['docker', 'manifest', 'inspect', tag],
                           capture_output=True, timeout=90)
    reused = probe.returncode == 0
    if not reused:
        diagnostic = probe.stderr.decode(errors='replace').lower()
        if not any(text in diagnostic for text in ('manifest unknown', 'no such manifest', 'not found')):
            raise ValueError('Registry lookup failed; refusing to overwrite an unverified tag')
        checked(['docker', 'image', 'tag', expected, tag])
        checked(['docker', 'image', 'push', tag], timeout=600)
    digest = checked(['docker', 'buildx', 'imagetools', 'inspect', tag,
                      '--format', '{{.Manifest.Digest}}']).decode().strip()
    if not DIGEST.fullmatch(digest):
        raise ValueError('Malformed registry manifest digest')
    reference = REGISTRY + '@' + digest
    checked(['docker', 'image', 'pull', reference], timeout=600)
    published = metadata(reference)
    if published['Config'] != source['Config'] or published['RootFS'] != source['RootFS']:
        raise ValueError('Registry readback differs from the verified image')
    report = {
        'commit': commit, 'component': component, 'version': version,
        'archiveSha256': archive_sha, 'sourceImageId': expected,
        'registryImageId': published['Id'], 'tag': tag, 'digest': digest,
        'reference': reference, 'reusedExistingTag': reused,
        'registryReadbackPassed': True,
    }
    with output.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--component', choices=COMPONENTS, required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = promote(args.input, args.commit, args.component, args.version, args.output)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print('Registry promotion failed: ' + type(error).__name__)
        return 1
    print(report['reference'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
