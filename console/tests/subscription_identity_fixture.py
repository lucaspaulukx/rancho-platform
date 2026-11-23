"""Disposable local identity/group for real subscribe authorization changes."""
import hashlib
import json
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.parse
import urllib.request

import ws_revocation as probe
from keycloak_lab import KeycloakLab

ROOT = probe.ROOT
ACCOUNT_STATE = ROOT / 'console/local-account-contract-fixture.json'
OWN_STATE = ROOT / 'console/subscription-identity-fixture.json'


def identity_factory(mode, *, oidc=False):
    assert mode in ('grant', 'deactivate')

    def create(admin):
        assert not ACCOUNT_STATE.exists() and not OWN_STATE.exists(), 'Recover the existing account fixture before testing.'
        name = 'console-account-' + secrets.token_hex(6)
        marker = 'Disposable account contract ' + name
        password = secrets.token_urlsafe(36)
        group = None
        account = credential = None
        keycloak = None
        keycloak_user = None
        original_mapping_checksum = None
        def snapshot(path, fields):
            return {v['id']: hashlib.sha256(json.dumps({k: v.get(k) for k in fields}, sort_keys=True).encode()).hexdigest()
                    for v in admin.api(path + '?limit=-1')['data'] if not v.get('removed')}
        state = {'name': name, 'marker': marker, 'account': None, 'credential': None,
                 'baselineAccounts': snapshot('accounts', ('name', 'description', 'kind', 'state', 'externalId', 'externalIdType')),
                 'baselineCredentials': snapshot('passwords', ('accountId', 'name', 'kind', 'state', 'publicValue'))}
        groups_before = hashlib.sha256(json.dumps(admin.api('localGroups')['data'], sort_keys=True).encode()).hexdigest()
        def save():
            data = json.dumps(state, indent=2)
            ACCOUNT_STATE.write_text(data, encoding='utf-8')
            OWN_STATE.write_text(data, encoding='utf-8')
        def wait(path, predicate):
            for _ in range(100):
                value = admin.api(path)
                if predicate(value): return value
                time.sleep(.3)
            raise AssertionError('Own identity fixture did not stabilize.')
        def account_action(action):
            value = admin.api('accounts/' + state['account'])
            target = urllib.parse.urlparse(value['actions'][action])
            assert target.netloc == 'localhost:18080' and target.path.rstrip('/') == '/v2-beta/accounts/' + state['account'] and target.query == 'action=' + action
            assert admin.request(value['actions'][action], {}, 'POST')[0] in (200, 201, 202, 204)
            return wait('accounts/' + state['account'], lambda v: v['state'] == ('inactive' if action == 'deactivate' else 'active'))
        def cleanup():
            nonlocal group
            if group:
                current = next((g for g in admin.api('localGroups')['data'] if g['id'] == group['id']), None)
                if current:
                    assert current['name'] == name + '-stream-group'
                    admin.api('localGroups', {'id': current['id'], 'name': current['name'], 'revision': current['revision'], 'members': [], 'grants': {}, 'delete': True})
                group = None
            assert hashlib.sha256(json.dumps(admin.api('localGroups')['data'], sort_keys=True).encode()).hexdigest() == groups_before
            result = subprocess.run([sys.executable, str(ROOT / 'console/tests/local_account_fixture_cleanup.py')], capture_output=True, timeout=180)
            assert result.returncode == 0, 'Exact identity cleanup failed; private diagnostics withheld.'
            if keycloak_user:
                fresh_keycloak = KeycloakLab(probe.lab.CONFIG['KEYCLOAK_ADMIN_PASSWORD'])
                code, own = fresh_keycloak.request('/admin/realms/rancher-lab/users/' + keycloak_user)
                assert code == 200 and own['username'] == name and own.get('lastName') == name
                assert fresh_keycloak.request('/admin/realms/rancher-lab/users/' + keycloak_user, method='DELETE')[0] == 204
            if oidc and state['account']:
                numeric = state['account'].removeprefix('1a'); assert numeric.isdigit()
                sql = "DELETE m FROM local_rbac_oidc_user m JOIN account a ON a.id=m.account_id WHERE a.id=" + numeric + " AND a.state IN ('removed','purged') AND a.removed IS NOT NULL AND a.name='" + name + "' AND a.description='" + marker + "';"
                result = subprocess.run(['docker','exec','-i','rancher16-rbac-lab','mysql','--user=root','cattle'], input=sql.encode(), capture_output=True)
                assert result.returncode == 0, 'Owned OIDC mapping cleanup failed; diagnostics withheld.'
                assert mapping_checksum() == original_mapping_checksum, 'Preexisting OIDC mappings changed.'
            OWN_STATE.unlink(missing_ok=True)
        try:
            save()
            def login_session():
                renewed = probe.lab.Session()
                renewed.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(renewed.cookies))
                if oidc:
                    previous = probe.lab.CONFIG['LAB_USER_PASSWORD']
                    try:
                        probe.lab.CONFIG['LAB_USER_PASSWORD'] = password
                        native_token, _ = renewed.oidc(name)
                        renewed.fixture_account_id = native_token['accountId']
                    finally:
                        probe.lab.CONFIG['LAB_USER_PASSWORD'] = previous
                else:
                    native_token = renewed.login(name, password)
                    renewed.fixture_account_id = native_token['accountId']
                return renewed
            def mapping_checksum():
                result = subprocess.run(['docker','exec','rancher16-rbac-lab','mysql','--user=root','--batch','--skip-column-names','-e','CHECKSUM TABLE cattle.local_rbac_oidc_user EXTENDED;'], capture_output=True)
                assert result.returncode == 0
                return result.stdout
            if oidc:
                original_mapping_checksum = mapping_checksum()
                state['baselineOidcMappingChecksum'] = original_mapping_checksum.decode().strip(); save()
                keycloak = KeycloakLab(probe.lab.CONFIG['KEYCLOAK_ADMIN_PASSWORD'])
                code, _ = keycloak.request('/admin/realms/rancher-lab/users', {'username': name, 'enabled': True, 'firstName': 'Console Fixture', 'lastName': name, 'email': name + '@example.invalid', 'emailVerified': True, 'attributes': {'consoleFixtureMarker': [marker]}, 'credentials': [{'type': 'password', 'value': password, 'temporary': False}]})
                assert code == 201
                code, found = keycloak.request('/admin/realms/rancher-lab/users?username=' + name + '&exact=true')
                assert code == 200 and len(found) == 1 and found[0]['username'] == name
                keycloak_user = found[0]['id']; state['keycloakUser'] = keycloak_user; save()
                ordinary = login_session()
                account = admin.api('accounts/' + ordinary.fixture_account_id)
                assert account['id'] not in state['baselineAccounts'] and account['name'] == name and account['kind'] == 'user'
                state['account'] = account['id']; save()
                account = admin.api('accounts/' + account['id'], {'description': marker}, method='PUT')
            else:
                account = admin.api('accounts', {'name': name, 'description': marker, 'kind': 'user'})
                state['account'] = account['id']; save()
                account = wait('accounts/' + account['id'], lambda v: v['state'] == 'active')
                credential = admin.api('passwords', {'accountId': account['id'], 'publicValue': name, 'secretValue': password})
                state['credential'] = credential['id']; save()
                wait('passwords/' + credential['id'], lambda v: v['state'] == 'active')
                ordinary = probe.lab.Session()
                ordinary.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(ordinary.cookies))
                ordinary.login(name, password)
            assert ordinary.api('projects')['data'] == []
            numeric = account['id'].removeprefix('1a'); assert numeric.isdigit()
            group = admin.api('localGroups', {'name': name + '-stream-group', 'members': [numeric], 'grants': {'12': 'readonly'}})
            state['streamGroup'] = group['id']; save()
            assert [v['id'] for v in ordinary.api('projects')['data']] == ['1a12']
            def renew_session(): return login_session()
            def invalidate():
                if mode == 'deactivate': account_action('deactivate')
                else:
                    current = next(g for g in admin.api('localGroups')['data'] if g['id'] == group['id'])
                    admin.api('localGroups', {'id': current['id'], 'name': current['name'], 'revision': current['revision'], 'members': [numeric], 'grants': {}})
            def prepare_cleanup():
                current = admin.api('accounts/' + account['id'])
                if current['state'] == 'inactive': account_action('activate')
            return {'session': ordinary, 'renew_session': renew_session, 'invalidate': invalidate, 'cleanup': cleanup,
                    'prepare_cleanup': prepare_cleanup, 'protected': '/v2-beta/projects/1a12',
                    'scope': ('own ordinary OIDC identity: ' if oidc else 'own ordinary local identity: ') + mode + '; readonly group only in UI-OPS-LAB; subscribe only'}
        except Exception:
            cleanup()
            raise
    return create


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'grant'
    status = probe.main(identity_factory=identity_factory(mode))
    if probe.REPORT.exists():
        (ROOT / ('console/ws-revocation-' + mode + '-results.json')).write_bytes(probe.REPORT.read_bytes())
    raise SystemExit(status)
