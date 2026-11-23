"""Build only staged public files + pinned upstream; no private worktree artifacts.

--reuse-local-upstream rewrites this process's clone URL to the existing official
object store, without global Git configuration or copying untracked changes.
Disposable build directories/logs remain ignored for investigation.
"""
import argparse
import os
import json
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reuse-local-upstream', action='store_true')
    args = parser.parse_args()
    destination = ROOT / 'migration-runs' / ('clean-backend-package-' + secrets.token_hex(6))
    destination.mkdir(parents=True)
    subprocess.run(['git', '-c', 'core.longpaths=true', 'checkout-index', '--all', '--prefix', destination.as_posix() + '/'],
                   cwd=ROOT, check=True, capture_output=True)
    assert (destination / 'migration/sql/001-local-groups.sql').is_file(), 'Versioned migration missing from staged package.'
    assert not (destination / '.env').exists() and not (destination / 'keycloak/realm.json').exists()
    environment = dict(os.environ)
    if args.reuse_local_upstream:
        upstream = json.loads((ROOT / 'upstream.json').read_text(encoding='utf-8'))
        environment['GIT_CONFIG_COUNT'] = str(len(upstream))
        for index, (name, spec) in enumerate(upstream.items()):
            assert (ROOT / name / '.git').exists()
            environment['GIT_CONFIG_KEY_' + str(index)] = 'url.' + (ROOT / name).as_uri() + '.insteadOf'
            environment['GIT_CONFIG_VALUE_' + str(index)] = spec['url']
    for action in ('apply', 'check'):
        subprocess.run(['python', 'scripts/upstream.py', action], cwd=destination,
                       env=environment, check=True, timeout=300)
    with (destination / 'build.log').open('xb') as log:
        result = subprocess.run(['docker', 'build', '-t', 'rancher16-clean-schema:validation', '.'],
                                cwd=destination, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    assert result.returncode == 0, 'Clean package build failed; inspect ignored build log.'
    print('PASS: clean staged package includes SQL, applies/checks pinned upstream, and builds backend without private files.')


if __name__ == '__main__':
    main()
