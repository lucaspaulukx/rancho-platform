"""Offline, bounded dependency inventory of local artifacts. Never starts an app image."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
SCANNER = 'anchore/syft:v1.56.0@sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313'
VERSION = '1.56.0'
IMAGE_ID = re.compile(r'sha256:[a-f0-9]{64}')


def digest_file(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def text(value, limit=4096):
    if not isinstance(value, str) or not value or len(value) > limit or any(ord(c) < 32 for c in value):
        raise ValueError('Invalid inventory field')
    return value


def public_bom(raw, label, digest, scope):
    """Rebuild a CycloneDX document; unknown fields and image configuration never cross this boundary."""
    if raw.get('bomFormat') != 'CycloneDX' or raw.get('specVersion') != '1.6' or not re.fullmatch('[a-f0-9]{64}', digest):
        raise ValueError('Unsupported inventory document')
    components, references, excluded = {}, {}, set()
    root_ref = 'urn:community:artifact:' + digest
    old_root = raw.get('metadata', {}).get('component', {}).get('bom-ref')
    if old_root:
        references[text(old_root)] = root_ref
    for source in raw.get('components', []):
        if source.get('type') == 'file':
            if source.get('bom-ref') != old_root:
                excluded.add(text(source.get('bom-ref')))
            continue
        component = {'type': text(source.get('type')), 'name': text(source.get('name'))}
        for key in ('group', 'version'):
            if source.get(key):
                component[key] = text(source[key])
        if source.get('purl'):
            # Registry URLs/qualifiers and subpaths can contain private information.
            purl = text(source['purl']).split('?', 1)[0].split('#', 1)[0]
            if not purl.startswith('pkg:'):
                raise ValueError('Invalid package URL')
            component['purl'] = purl
        licenses = []
        for item in source.get('licenses', []):
            if item.get('expression'):
                expression = text(item['expression'])
                if expression not in ('NOASSERTION', 'NONE'):
                    licenses.append({'expression': expression})
            elif isinstance(item.get('license'), dict):
                license_data = item['license']
                key = 'id' if license_data.get('id') else 'name'
                if license_data.get(key) and license_data[key] not in ('NOASSERTION', 'NONE'):
                    licenses.append({'license': {key: text(license_data[key])}})
        if licenses:
            component['licenses'] = sorted({canonical(v): v for v in licenses}.values(), key=canonical)
        hashes = []
        for item in source.get('hashes', []):
            length = {'MD5': 32, 'SHA-1': 40, 'SHA-256': 64, 'SHA-384': 96, 'SHA-512': 128}.get(item.get('alg'))
            if length and re.fullmatch('[a-fA-F0-9]{' + str(length) + '}', str(item.get('content', ''))):
                hashes.append({'alg': item['alg'], 'content': item['content'].lower()})
        if hashes:
            component['hashes'] = sorted(hashes, key=canonical)
        reference = 'urn:community:component:' + hashlib.sha256(canonical(component)).hexdigest()
        old_ref = text(source.get('bom-ref'))
        if old_ref in references and references[old_ref] != reference:
            raise ValueError('Ambiguous component reference')
        references[old_ref] = reference
        component['bom-ref'] = reference
        components[reference] = component
    if excluded.intersection(references):
        raise ValueError('Ambiguous component reference')
    dependencies = {}
    for source in raw.get('dependencies', []):
        if source.get('ref') in excluded:
            continue
        targets = [v for v in source.get('dependsOn', []) if v not in excluded]
        if source.get('ref') not in references or any(v not in references for v in targets):
            raise ValueError('Unresolved dependency reference')
        target = references[source['ref']]
        dependencies.setdefault(target, set()).update(references[v] for v in targets)
    components = sorted(components.values(), key=lambda v: v['bom-ref'])
    unknown = sum(not v.get('licenses') for v in components)
    graph = {'components': components, 'dependencies': [{'ref': key, 'dependsOn': sorted(values)} for key, values in sorted(dependencies.items())]}
    bom = {'$schema': 'http://cyclonedx.org/schema/bom-1.6.schema.json', 'bomFormat': 'CycloneDX', 'specVersion': '1.6',
           'serialNumber': 'urn:uuid:' + str(uuid.uuid5(uuid.NAMESPACE_URL, label + digest + VERSION)), 'version': 1,
           'metadata': {'component': {'type': 'container' if scope == 'runtime-image' else 'application', 'name': label,
                                      'bom-ref': root_ref, 'hashes': [{'alg': 'SHA-256', 'content': digest}]},
                        'tools': {'components': [{'type': 'application', 'name': 'syft', 'version': VERSION}]},
                        'properties': [{'name': 'community:scope', 'value': scope}, {'name': 'community:scanner-image', 'value': SCANNER}]}, **graph}
    return bom, {'components': len(components), 'licensesUnknown': unknown,
                 'graphSha256': hashlib.sha256(canonical(graph)).hexdigest(), 'completeLicenseReview': False}


def command(args, **kwargs):
    result = subprocess.run(args, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RuntimeError('Artifact inventory command failed; private diagnostics withheld')
    return result


def image_info(reference):
    # Scalar-only inspect: never read or export Config.Env/labels/authentication.
    result = command(['docker', 'image', 'inspect', '--format', '{{.Id}} {{.Size}}', reference], stdout=subprocess.PIPE)
    identity, size = result.stdout.decode('ascii').strip().split()
    if not IMAGE_ID.fullmatch(identity) or not size.isdigit():
        raise ValueError('Unexpected image identity')
    return {'imageId': identity, 'sizeBytes': int(size)}


def plan(backend, console):
    images = {'backend': image_info(backend), 'console': image_info(console)}
    scanner = image_info(SCANNER)
    size = sum(v['sizeBytes'] for v in images.values())
    manifests = {'package.json': digest_file(ROOT / 'console/package.json'), 'package-lock.json': digest_file(ROOT / 'console/package-lock.json')}
    return {'version': 1, 'sourceManifests': manifests, 'sourceManifestSha256': hashlib.sha256(canonical(manifests)).hexdigest(), 'images': images, 'scannerImage': SCANNER, 'scannerLocalId': scanner['imageId'],
            'estimatedWorkingBytes': size * 4 + 1024**3, 'sourceLockSha256': digest_file(ROOT / 'console/package-lock.json'),
            'licenseReviewAccepted': False, 'vulnerabilityScanPerformed': False}


def scanner_arguments(input_mounts, scratch):
    ownership = uuid.uuid4().hex
    return ['docker', 'run', '--rm', '--name', 'rancher-inventory-' + ownership, '--label', 'rancher.community.inventory-owner=' + ownership, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges', '--memory', '2g', '--cpus', '2',
            '-e', 'SYFT_CHECK_FOR_APP_UPDATE=false', '-e', 'SYFT_JAVASCRIPT_INCLUDE_DEV_DEPENDENCIES=true',
            '-e', 'SYFT_JAVASCRIPT_SEARCH_REMOTE_LICENSES=false', '-e', 'SYFT_PARALLELISM=2',
            '--mount', 'type=bind,source=' + str(scratch) + ',target=/tmp', *input_mounts, SCANNER,
            'scan']


def run_scanner(arguments, target, timeout):
    name = arguments[arguments.index('--name') + 1]
    owner = arguments[arguments.index('--label') + 1].split('=', 1)[1]
    try:
        command(arguments, stdout=target, timeout=timeout)
    finally:
        found = subprocess.run(['docker', 'container', 'inspect', '--format',
                                '{{index .Config.Labels "rancher.community.inventory-owner"}}', name],
                               capture_output=True, timeout=15)
        if found.returncode == 0:
            if found.stdout.decode('ascii').strip() != owner or name != 'rancher-inventory-' + owner:
                raise RuntimeError('Scanner ownership changed; cleanup refused')
            command(['docker', 'rm', '--force', name], stdout=subprocess.DEVNULL, timeout=30)


def scan(output, evidence):
    output = Path(output).resolve()
    if output.exists() or not output.parent.is_dir():
        raise ValueError('Inventory requires a new output directory with an existing parent')
    if shutil.disk_usage(output.parent).free < evidence['estimatedWorkingBytes']:
        raise ValueError('Insufficient estimated working capacity')
    output.mkdir()
    os.chmod(output, 0o700)
    result = dict(evidence, status='in-progress', artifacts={})
    work = Path(tempfile.mkdtemp(prefix='.inventory-', dir=output)).resolve()
    ownership = uuid.uuid4().hex
    (work / '.owner').write_text(ownership, encoding='ascii')
    stage = 'source-manifest-snapshot'
    try:
        manifests = work / 'manifests'; manifests.mkdir()
        for name in ('package.json', 'package-lock.json'):
            data = (ROOT / 'console' / name).read_bytes()
            if len(data) > 16*1024**2 or hashlib.sha256(data).hexdigest() != evidence.get('sourceManifests', {}).get(name):
                raise ValueError('Source manifest changed after plan')
            (manifests / name).write_bytes(data)
        package = json.loads((manifests / 'package.json').read_text(encoding='utf-8'))
        lock = json.loads((manifests / 'package-lock.json').read_text(encoding='utf-8'))
        for key in ('name', 'version', 'license', 'dependencies', 'devDependencies'):
            if package.get(key) != lock.get('packages', {}).get('', {}).get(key):
                raise ValueError('Source package and lockfile disagree')
        for label, image in evidence['images'].items():
            stage = label + '-export'
            archive = work / (label + '.tar')
            command(['docker', 'save', '--output', str(archive), image['imageId']], stdout=subprocess.DEVNULL, timeout=600)
            stage = label + '-scan'
            scratch = work / (label + '-scratch'); scratch.mkdir()
            raw = work / (label + '.raw.json')
            mounts = ['--mount', 'type=bind,source=' + str(archive) + ',target=/input/image.tar,readonly']
            with raw.open('xb') as target:
                run_scanner(scanner_arguments(mounts, scratch) + ['docker-archive:/input/image.tar', '-o', 'cyclonedx-json@1.6', '--quiet'], target, timeout=1200)
            if raw.stat().st_size > 128 * 1024**2:
                raise ValueError('Inventory output exceeded bound')
            bom, summary = public_bom(json.loads(raw.read_text(encoding='utf-8')), label, image['imageId'][7:], 'runtime-image')
            (output / (label + '.cdx.json')).write_bytes(canonical(bom) + b'\n')
            result['artifacts'][label] = dict(summary, documentSha256=digest_file(output / (label + '.cdx.json')))
            archive.unlink()
            print('PASS: ' + label + ' runtime inventory generated; unknown licenses remain review items.', flush=True)
        stage = 'frontend-lockfile-scan'
        scratch = work / 'lockfile-scratch'; scratch.mkdir()
        mounts = []
        for name in ('package.json', 'package-lock.json'):
            mounts += ['--mount', 'type=bind,source=' + str(manifests / name) + ',target=/input/' + name + ',readonly']
        raw = work / 'lockfile.raw.json'
        with raw.open('xb') as target:
            run_scanner(scanner_arguments(mounts, scratch) + ['dir:/input', '-o', 'cyclonedx-json@1.6', '--quiet'], target, timeout=180)
        bom, summary = public_bom(json.loads(raw.read_text(encoding='utf-8')), 'frontend-lockfile', evidence['sourceManifestSha256'], 'source-lockfile-with-dev')
        (output / 'frontend-lockfile.cdx.json').write_bytes(canonical(bom) + b'\n')
        result['artifacts']['frontend-lockfile'] = dict(summary, documentSha256=digest_file(output / 'frontend-lockfile.cdx.json'))
        result['status'] = 'inventory-generated'
    except Exception as error:
        result.update(status='failed', stage=stage, errorType=type(error).__name__)
        raise RuntimeError('Inventory failed at ' + stage + '; no private diagnostics exported') from None
    finally:
        # Delete only the newly-created, owned staging directory, never caller data.
        if work.parent != output or work.is_symlink() or (work / '.owner').read_text(encoding='ascii') != ownership:
            raise RuntimeError('Staging ownership changed; cleanup refused')
        shutil.rmtree(work)
        (output / 'summary.json').write_bytes(canonical(result) + b'\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('plan', 'scan'))
    parser.add_argument('--backend-image', default='rancher16-local-rbac:dev')
    parser.add_argument('--console-image', default='rancher16-community-console:dev')
    parser.add_argument('--output')
    args = parser.parse_args()
    evidence = plan(args.backend_image, args.console_image)
    if args.action == 'plan':
        print(json.dumps(evidence, indent=2))
    else:
        if not args.output:
            parser.error('scan requires --output NEW_DIRECTORY')
        scan(args.output, evidence)
        print('PASS: inventory generated without starting application containers; license/security acceptance remains separate.')


if __name__ == '__main__':
    main()
