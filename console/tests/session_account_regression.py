"""Read-only session/RBAC regression after enabling the native account guard."""
import importlib.util
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
checks = []


def session():
    value = lab.Session()
    value.opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(value.cookies)
    )
    return value


def check(label, condition):
    assert condition, label
    checks.append({'check': label, 'status': 'passed'})
    print('PASS: ' + label, flush=True)


admin = session()
login = admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
token = admin.api('token')['data'][0]
check('local administrator GET session uses native internal identity',
      login['accountId'] == '1a1' and token['userType'] == 'admin'
      and token['userIdentity']['externalIdType'] == 'rancher_id'
      and token['userIdentity']['externalId'] == '1')
configuration = admin.request('/oidc/config')[1]
check('native session guard and catalog protection remain enabled',
      configuration['effective']['SESSION_ACCOUNT_GUARD_ENABLED']
      and configuration['effective']['CATALOG_WRITE_GUARD_ENABLED'])
projects = {v['id'] for v in admin.api('projects?limit=-1')['data'] if not v.get('removed')}
for username, expected_account, role in (
    ('leitor', '1a10', 'readonly'), ('operador', '1a11', 'member'),
    ('sem-acesso', '1a9', None),
):
    user = session()
    login, _ = user.oidc(username)
    token = user.api('token')['data'][0]
    check(username + ' OIDC session retains ordinary role',
          login['accountId'] == expected_account and token['userType'] == 'user'
          and token['userIdentity']['externalIdType'] == 'rancher_id'
          and token['userIdentity']['externalId'] == expected_account[2:])
    visible = {v['id'] for v in user.api('projects?limit=-1')['data'] if not v.get('removed')}
    check(username + ' retains exact authorized environments', visible == ({'1a7'} if role else set()))
    if role:
        access = user.api('localAccessReports?targetAccount=self&targetEnvironment=1a7')['data'][0]
        check(username + ' retains complete effective role', access['complete'] and access['effectiveRole'] == role)
host = admin.api('projects/1a12/hosts/1h1')
check('original host and agent remain active', host['state'] == 'active' and host['agentState'] == 'active')
check('authentication does not create environments',
      {v['id'] for v in admin.api('projects?limit=-1')['data'] if not v.get('removed')} == projects)
report = {'status': 'passed', 'checks': checks, 'businessWrites': 0}
(ROOT / 'console/session-account-regression-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
