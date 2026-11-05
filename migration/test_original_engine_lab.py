"""Cold capture then original20 -> custom engine -> corresponding original restore.

Only explicit --quiesce against the existing local lab. No production source option.
"""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import time
import urllib.request

from migration.engines import ORIGINAL, authentication_probe, rehearse_engines
from migration.recovery import OWNER, backup, inspect, require_stopped_cleanly
from migration.tool import Database, run


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quiesce', action='store_true', required=True)
    parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    config = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines() if '=' in line)
    credentials = {'rancherUsername': 'labadmin', 'rancherPassword': config['RANCHER_ADMIN_PASSWORD'],
                   'keycloakUsername': 'labadmin', 'keycloakPassword': config['KEYCLOAK_ADMIN_PASSWORD']}
    names = {'rancher': 'rancher16-rbac-lab', 'keycloak': 'rancher16-keycloak-lab', 'console': 'rancher16-community-console'}
    before = {role: inspect(name)['Id'] for role, name in names.items()}
    target = inspect('rancher16-local-rbac:schema-validation', 'image')['Id']
    run(['image', 'inspect', ORIGINAL])
    password = secrets.token_urlsafe(48)
    directory = root / 'migration-runs' / ('original-engine-' + time.strftime('%Y%m%d-%H%M%S'))
    report = {'backup': backup(names, directory, password, quiesce=True), 'status': 'failed'}
    checksum = hashlib.sha256((root / 'migration/sql/001-local-groups.sql').read_text(encoding='utf-8').encode()).hexdigest()
    checks = []

    def check(name, valid):
        assert valid, name
        checks.append(name); print('PASS:', name, flush=True)

    def runtime_contract(copies, anchor, metadata, label):
        copy = copies['rancher']
        assert inspect(copy)['Config']['Labels'].get(OWNER) == label
        db = Database(copy)
        installed = db.query('SELECT version,checksum,applied FROM cattle.community_schema_migration;')
        check('custom engine startup records the exact packaged schema', installed.startswith('1\t' + checksum + '\t'))
        run(['stop', '--time', '120', copy], timeout=150)
        require_stopped_cleanly(inspect(copy)['State'])
        run(['start', copy])
        code, result = authentication_probe(anchor, credentials, 20, local_only=True)
        check('custom engine restarts with administrator and20 environments', code == 0 and result.get('status') == 'passed')
        check('runtime restart preserves single migration row and applied timestamp', db.query('SELECT version,checksum,applied FROM cattle.community_schema_migration;') == installed)
        db.query("UPDATE cattle.community_schema_migration SET checksum=REPEAT('0',64) WHERE version=1;")
        run(['stop', '--time', '120', copy], timeout=150)
        require_stopped_cleanly(inspect(copy)['State'])
        run(['start', copy])
        deadline = time.monotonic() + 120
        while inspect(copy)['State']['Running'] and time.monotonic() < deadline:
            time.sleep(1)
        check('corrupt schema prevents custom engine startup', not inspect(copy)['State']['Running'])

    def original_contract(copies, anchor, metadata, label):
        assert inspect(copies['rancher'])['Config']['Labels'].get(OWNER) == label
        count = Database(copies['rancher']).query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle' AND (table_name LIKE 'local_rbac_%' OR table_name='community_schema_migration');")
        check('rollback engine uses restored original schema without custom tables', count == '0')

    try:
        print('PASS: cold source captured and resumed; beginning original20 engine upgrade.', flush=True)
        report['upgrade'] = rehearse_engines(directory, password, credentials, target_image=target,
                                             original_twenty=True, schema_migrations=True, _after_probe=runtime_contract)
        print('PASS: upgrade and fail-closed checks; restoring corresponding original snapshot.', flush=True)
        report['rollback'] = rehearse_engines(directory, password, credentials, target_image=ORIGINAL,
                                              original_twenty=True, schema_migrations=False,
                                              probe_oidc=False, _after_probe=original_contract)
        report.update(status='passed', checks=checks, originalEngineUpgradeAccepted=True,
                      correspondingOriginalRestoreAccepted=True, completeMigrationAccepted=False)
    finally:
        report['sourceContainerIdsPreserved'] = all(inspect(name)['Id'] == before[role] and inspect(name)['State']['Running']
                                                   for role, name in names.items())
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for url in ('http://localhost:18080/ping', 'http://localhost:18081/realms/master/.well-known/openid-configuration',
                    'http://localhost:18090/console/login'):
            with opener.open(url, timeout=20) as response:
                assert response.status == 200
        report['sourceHttpReady'] = True
        (directory / 'original-engine-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    check('original lab container IDs and HTTP preserved', report['sourceContainerIdsPreserved'] and report['sourceHttpReady'])
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
