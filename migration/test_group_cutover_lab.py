"""Full group coexistence/native cutover/rollback in a recovered original20 copy.

Only explicit --quiesce captures the fixed local lab; no production apply option.
"""
import argparse
import io
import json
from pathlib import Path
import secrets
import subprocess
import time
import urllib.request

from migration import crypto_stream, grants
from migration.engines import rehearse_engines
from migration.recovery import OWNER, ROOT, backup, inspect, journal
from migration.test_grants_original_db_lab import seeded_grants
from migration.tool import Database, MigrationError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quiesce', action='store_true', required=True)
    parser.parse_args()
    root = ROOT.parent
    config = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines() if '=' in line)
    credentials = {'rancherUsername': 'labadmin', 'rancherPassword': config['RANCHER_ADMIN_PASSWORD'],
                   'keycloakUsername': 'labadmin', 'keycloakPassword': config['KEYCLOAK_ADMIN_PASSWORD']}
    names = {'rancher': 'rancher16-rbac-lab', 'keycloak': 'rancher16-keycloak-lab', 'console': 'rancher16-community-console'}
    source_ids = {role: inspect(name)['Id'] for role, name in names.items()}
    target = inspect('rancher16-local-rbac:schema-validation', 'image')['Id']
    directory = root / 'migration-runs' / ('group-cutover-' + time.strftime('%Y%m%d-%H%M%S'))
    password = secrets.token_urlsafe(48)
    report = {'status': 'failed', 'backup': backup(names, directory, password, quiesce=True)}

    def group_contract(copies, anchor, metadata, label):
        copy = inspect(copies['rancher'])
        assert copy['Config']['Labels'].get(OWNER) == label
        # Fixture helper refuses non-rehearsal names. This additional alias is
        # the exact current owned ID, renamed only inside this disposable scope.
        old_name = copy['Name'].lstrip('/')
        renamed = 'rancher-rehearsal-groups-' + secrets.token_hex(8)
        from migration.tool import run
        run(['rename', copy['Id'], renamed])
        db = Database(renamed)
        seeded_grants(db, reset_original=False)
        source = grants.snapshot(db)
        proposal = grants.plan(source)
        with (directory / 'private-groups-plan.enc').open('xb') as output:
            crypto_stream.encrypt(io.BytesIO(grants.canonical({'snapshot': source, 'plan': proposal})), output, password)
        users = []
        for row in db.query("SELECT id,name FROM cattle.account WHERE uuid IN ('7ff40000-0000-4000-8000-000000000000','7ff40000-0000-4000-8000-000000000001','7ff40000-0000-4000-8000-000000000002') ORDER BY id;").splitlines():
            account_id, name = row.split('\t')
            users.append({'id': int(account_id), 'name': name, 'password': secrets.token_urlsafe(36)})
        assert len(users) == 3 and len(proposal['groups']) == 2
        private = {'credentials': {key: credentials[key] for key in ('rancherUsername', 'rancherPassword')},
                   'users': users, 'plan': proposal}
        program = (ROOT / 'native-client.cjs').read_text(encoding='utf-8') + '\n' + (ROOT / 'group-probe.cjs').read_text(encoding='utf-8')
        result = subprocess.run(['docker', 'exec', '-i', anchor, 'node', '-e', program], input=json.dumps(private).encode(),
                                capture_output=True, timeout=480)
        try:
            outcome = json.loads(result.stdout)
        except ValueError:
            raise MigrationError('Group probe returned no safe report.') from None
        report['groups'] = outcome
        journal(directory, 'group-cutover-probe', probe=outcome)
        if result.returncode or outcome.get('status') != 'passed':
            raise MigrationError('Group coexistence/cutover/rollback probe failed; inspect safe stage.')
        assert inspect(copy['Id'])['Config']['Labels'].get(OWNER) == label
        run(['rename', copy['Id'], old_name])
        print(json.dumps(outcome, indent=2), flush=True)

    try:
        print('PASS: cold capture complete, source resumed; beginning isolated group cutover.', flush=True)
        report['recovery'] = rehearse_engines(directory, password, credentials, target_image=target,
                                              original_twenty=True, schema_migrations=True, _after_probe=group_contract)
        report.update(status='passed', productionCutoverAccepted=False)
    finally:
        report['sourceContainerIdsPreserved'] = all(inspect(name)['Id'] == source_ids[role] and inspect(name)['State']['Running']
                                                   for role, name in names.items())
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for url in ('http://localhost:18080/ping', 'http://localhost:18081/realms/master/.well-known/openid-configuration',
                    'http://localhost:18090/console/login'):
            with opener.open(url, timeout=20) as response:
                assert response.status == 200
        report['sourceHttpReady'] = True
        (directory / 'group-cutover-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    assert report['sourceContainerIdsPreserved'] and report['sourceHttpReady']
    print('PASS: group copy cleaned; source IDs and HTTP preserved.', flush=True)


if __name__ == '__main__':
    main()
