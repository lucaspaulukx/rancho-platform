"""Explicit integration entrypoint; cold maintenance ONLY with --quiesce.

Never imported as an automatic test: reads only this lab's existing private .env.
Ephemeral recovery passphrase intentionally discarded; bundle is a test artifact.
"""
import argparse
import json
from pathlib import Path
import secrets
import time
import urllib.request

from migration.engines import rehearse_engines
from migration.recovery import backup, inspect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quiesce', action='store_true', required=True)
    parser.add_argument('--include-images', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    config = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines() if '=' in line)
    names = {'rancher': 'rancher16-rbac-lab', 'keycloak': 'rancher16-keycloak-lab', 'console': 'rancher16-community-console'}
    original = {role: inspect(name)['Id'] for role, name in names.items()}
    password = secrets.token_urlsafe(48)
    folder = root / 'migration-runs' / ('engines-' + time.strftime('%Y%m%d-%H%M%S'))
    result = {'backup': backup(names, folder, password, quiesce=True, include_images=args.include_images)}
    print('PASS: cold capture complete; original containers restarted.', flush=True)
    try:
        result['recovery'] = rehearse_engines(folder, password, {
            'rancherUsername': 'labadmin', 'rancherPassword': config['RANCHER_ADMIN_PASSWORD'],
            'keycloakUsername': 'labadmin', 'keycloakPassword': config['KEYCLOAK_ADMIN_PASSWORD']})
    finally:
        result['sourceContainerIdsPreserved'] = all(inspect(name)['Id'] == original[role] and inspect(name)['State']['Running']
                                                  for role, name in names.items())
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for url in ('http://localhost:18080/ping', 'http://localhost:18081/realms/master/.well-known/openid-configuration',
                    'http://localhost:18090/console/login'):
            deadline = time.monotonic() + 300
            while True:
                try:
                    with opener.open(url, timeout=10) as response:
                        if response.status == 200:
                            break
                except Exception:
                    pass
                if time.monotonic() > deadline:
                    raise RuntimeError('Original lab HTTP readiness did not recover.')
                time.sleep(2)
        result['sourceHttpReady'] = True
        (folder / 'lab-engine-recovery-results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    assert result['sourceContainerIdsPreserved'] and result['sourceHttpReady']
    print(json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    main()
