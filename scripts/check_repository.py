"""Check staged contents without printing private matches. Does not replace a release audit."""
import json
from pathlib import Path
import re
import subprocess
import argparse

ROOT = Path(__file__).resolve().parents[1]


def main(*, require_policy=False):
    common = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], cwd=ROOT).decode().strip())
    common = (common if common.is_absolute() else ROOT / common).resolve()
    entries = subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=ROOT).split(b'\0')
    blobs = {}
    for entry in entries:
        if not entry:
            continue
        metadata, name = entry.split(b'\t', 1)
        mode, blob, stage = metadata.split()
        path = name.decode('utf-8')
        basename = Path(path).name
        if (Path(path).name.upper().startswith('HANDOFF') or path.startswith('docs/history/')
                or re.match(r'^docs/[0-9]+-[^/]+\.md$', path)):
            raise RuntimeError('Execution handoffs and phase diaries do not belong in the active package; retain history in Git.')
        if mode == b'160000':
            raise RuntimeError('Embedded Git repositories are not distributable sources.')
        if mode == b'120000':
            raise RuntimeError('Review symlinks explicitly before adding them to the public package.')
        if stage != b'0':
            raise RuntimeError('Resolve index conflicts before committing.')
        if (path == 'keycloak/realm.json'
                or (basename.startswith('.env.') and not basename.endswith('.example'))
                or basename.endswith(('-fixture.json', '-fixture.yaml', '-results.json'))):
            raise RuntimeError('Private/generated artifact found in index; path withheld.')
        if path.startswith(('cattle/', 'websocket-proxy/', 'ui/', 'rancher/', 'references/', 'migration-runs/', 'backups/', 'evidence/')) or '/node_modules/' in path or path.endswith(('.dump', '.dpapi', '.enc', '.log', '.sql.gz', '.sql.zip', '.sql.xz', '.sql.bz2', '.dump.gz', '.dump.zip')) or Path(path).name == '.env' or (path.endswith('.sql') and not path.startswith('migration/sql/')):
            raise RuntimeError('Private/generated artifact found in index; path withheld.')
        blobs[blob] = path
    values = []
    for env in {ROOT / '.env', common.parent / '.env'}:
        if not env.exists():
            continue
        for line in env.read_text(encoding='utf-8').splitlines():
            if '=' not in line:
                continue
            key, value = line.split('=', 1)
            if re.search(r'PASSWORD|SECRET|TOKEN|PRIVATE_KEY', key) and len(value) >= 12:
                values.append(value.encode())
    policy = common / 'private-policy.json'
    if require_policy and not policy.is_file():
        raise RuntimeError('A private publication policy is required; store it in the common Git directory.')
    terms = json.loads(policy.read_text(encoding='utf-8')).get('retiredTerms', []) if policy.exists() else []
    if not isinstance(terms, list) or any(not isinstance(term, str) or not term.strip() for term in terms):
        raise RuntimeError('Invalid private publication policy.')
    if require_policy and not terms:
        raise RuntimeError('The private publication policy must contain blocked identity terms.')
    output = subprocess.check_output(['git', 'cat-file', '--batch'], input=b''.join(blob + b'\n' for blob in blobs), cwd=ROOT)
    offset = 0
    for blob, path in blobs.items():
        end = output.index(b'\n', offset)
        header = output[offset:end].split()
        size = int(header[2])
        data = output[end+1:end+1+size]
        offset = end + size + 2
        if any(value in data for value in values):
            raise RuntimeError('Known local credential found in index; details withheld.')
        if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=]{40,}', data):
            raise RuntimeError('Private key found in index; details withheld.')
        lowered = data.lower()
        if any(term.lower().encode() in lowered or term.lower() in path.lower() for term in terms):
            raise RuntimeError('Retired identity found in index; details withheld.')
    print('PASS: staged repository excludes private artifacts, known local credentials and configured retired identities.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-policy', action='store_true')
    main(require_policy=parser.parse_args().require_policy)
