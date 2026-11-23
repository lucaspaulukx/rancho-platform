"""Check reachable Git history before publication; never print matching content.

This complements the staged-content gate, not a comprehensive secret audit.
Local policy terms and known credentials are loaded from ignored files only.
"""
import json
from pathlib import Path
import re
import subprocess
import argparse

ROOT = Path(__file__).resolve().parents[1]


def git(*args, **kwargs):
    return subprocess.check_output(['git', *args], cwd=ROOT, **kwargs)


def main(*, require_policy=False):
    common = Path(git('rev-parse', '--git-common-dir').decode().strip())
    policy = (common if common.is_absolute() else ROOT / common) / 'private-policy.json'
    if require_policy and not policy.is_file():
        raise RuntimeError('A private publication policy is required; store it in the common Git directory.')
    terms = json.loads(policy.read_text(encoding='utf-8')).get('retiredTerms', []) if policy.exists() else []
    if not isinstance(terms, list) or any(not isinstance(term, str) or not term.strip() for term in terms):
        raise RuntimeError('Invalid private publication policy.')
    if require_policy and not terms:
        raise RuntimeError('The private publication policy must contain blocked identity terms.')
    secrets = []
    env = ROOT / '.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            if '=' not in line:
                continue
            key, value = line.split('=', 1)
            if re.search(r'PASSWORD|SECRET|TOKEN|PRIVATE_KEY', key) and len(value) >= 12:
                secrets.append(value.encode())
    patterns = [
        rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=]{40,}',
        rb'\bgh[pousr]_[A-Za-z0-9]{36,}\b',
        rb'\bgithub_pat_[A-Za-z0-9_]{70,}\b',
        rb'\bAKIA[0-9A-Z]{16}\b',
    ]
    paths = set(filter(None, git('log', '--all', '--format=', '--name-only', '-z').decode('utf-8').split('\0')))
    forbidden = ('cattle/', 'websocket-proxy/', 'ui/', 'rancher/', 'references/', 'migration-runs/', 'backups/', 'evidence/')
    for raw in paths:
        path = raw.strip('\r\n')
        if (path.startswith(forbidden) or '/node_modules/' in path or Path(path).name == '.env'
                or path.endswith(('.dump', '.dpapi', '.enc', '.log', '.sql.gz', '.sql.zip', '.sql.xz', '.sql.bz2', '.dump.gz', '.dump.zip'))
                or (path.endswith('.sql') and not path.startswith('migration/sql/'))
                or any(term.lower() in path.lower() for term in terms)):
            raise RuntimeError('Non-distributable historical path found; details withheld.')
    ids = sorted({line.split(b' ', 1)[0] for line in git('rev-list', '--objects', '--all').splitlines()})
    metadata = git('cat-file', '--batch-check', input=b''.join(value+b'\n' for value in ids))
    objects = [line.split()[0] for line in metadata.splitlines() if line.split()[1] in (b'blob', b'commit', b'tag')]
    batch = git('cat-file', '--batch', input=b''.join(value+b'\n' for value in objects))
    offset = 0
    for _ in objects:
        end = batch.index(b'\n', offset)
        size = int(batch[offset:end].split()[2])
        data = batch[end+1:end+1+size]
        offset = end+size+2
        if (any(secret in data for secret in secrets)
                or any(term.lower().encode() in data.lower() for term in terms)
                or any(re.search(pattern, data) for pattern in patterns)):
            raise RuntimeError('Sensitive historical content found; details withheld.')
    count = int(git('rev-list', '--count', '--all'))
    print(f'PASS: {count} reachable commits and {len(objects)} content objects checked; no configured sensitive matches.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-policy', action='store_true')
    main(require_policy=parser.parse_args().require_policy)
