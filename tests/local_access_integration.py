"""Local group audit and access contracts; no credentials enter results."""
import importlib.util
import json
import secrets
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
checks = []
group = None
extra_group = None
temporary_project = None
stage = 'backend readiness'


def session():
    user = lab.Session()
    user.opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(user.cookies))
    return user


def check(name, condition=True):
    assert condition, name
    checks.append({'check': name, 'status': 'passed'})
    print('PASS: ' + name, flush=True)


def events(group_id, before=None):
    query = {'groupId': group_id}
    if before is not None:
        query['before'] = before
    return admin.api('localGroupAudits?' + urllib.parse.urlencode(query))['data']


def access(account='1a10', project='1a12'):
    return admin.api('localAccessReports?' + urllib.parse.urlencode(
        {'targetAccount': account, 'targetEnvironment': project}))['data'][0]


def self_report_checks():
    current = session()
    current.oidc('leitor')
    status, result, _ = current.request('/v2-beta/localAccessReports?targetAccount=self&targetEnvironment=1a7')
    check('self alias resolves the authenticated account without token GET accountId',
          status == 200 and result['data'][0]['accountId'] == '10')
    status, _, _ = current.request('/v2-beta/localAccessReports?targetAccount=self&targetEnvironment=1a8&projectId=1a7')
    check('self alias cannot probe an unauthorized environment through forged context', status in (403, 404))
    prefix = '/v2-beta/localAccessReports?targetAccount=1a10&targetEnvironment='
    status, result, _ = current.request(prefix + '1a7')
    check('ordinary user reads only own report in a natively authorized environment',
          status == 200 and result['data'][0]['accountId'] == '10'
          and result['data'][0]['effectiveRole'] == 'readonly')
    status, result, _ = current.request(prefix + '1a7&projectId=1a7')
    check('legitimate project context preserves authenticated self report subject',
          status == 200 and result['data'][0]['accountId'] == '10')
    schema = current.api('schemas/localAccessReport')
    check('ordinary self report schema exposes only collection read',
          schema.get('collectionMethods') == ['GET'] and not schema.get('resourceActions'))
    status, _, _ = current.request('/v2-beta/localAccessReports',
                                   {'targetAccount': '1a10', 'targetEnvironment': '1a7'})
    check('self report rejects forged writes', status in (403, 404, 405, 422))
    status, _, _ = current.request(prefix + '1a8')
    check('self report cannot probe an unauthorized environment', status in (403, 404))
    status, _, _ = current.request(prefix + '1a8&projectId=1a7')
    check('forged project context cannot bypass self report environment authorization', status in (403, 404))
    status, _, _ = current.request('/v2-beta/localAccessReports?targetAccount=1a1&targetEnvironment=1a7&projectId=1a7')
    check('project context cannot impersonate another report subject', status in (403, 404))


admin = session()
try:
    deadline = time.monotonic() + 180
    while True:
        try:
            admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise
    stage = 'self-service report scope'
    self_report_checks()
    stage = 'audit schema'
    schema = admin.api('schemas/localGroupAudit')
    check('group audit API is read only', schema.get('collectionMethods') == ['GET'])
    stage = 'effective local access'
    initial = access()
    check('account without environment grants has no effective local role',
          initial['complete'] and initial.get('effectiveRole') is None and initial['sources'] == [])
    global_admin = access('1a1')
    check('global administrator access is explicitly attributed',
          global_admin['complete'] and global_admin['effectiveRole'] == 'owner'
          and any(source['kind'] == 'globalAdmin' for source in global_admin['sources']))
    stage = 'create snapshot'
    group = admin.api('localGroups', {'name': 'Audit contract ' + secrets.token_hex(4),
                                     'members': ['10'], 'grants': {'12': 'readonly'}})
    group_id = group['id']
    effective = access()
    check('backend resolves readonly role and identifies the contributing local group',
          effective['complete'] and effective['effectiveRole'] == 'readonly'
          and len(effective['sources']) == 1 and effective['sources'][0]['kind'] == 'group'
          and effective['sources'][0]['name'] == group['name'])
    created = events(group_id)
    check('creation produces one detailed audit event', len(created) == 1 and created[0]['operation'] == 'create')
    check('creation records no previous state and persisted members and grants',
          created[0].get('before') is None and created[0]['after']['members'] == ['10']
          and created[0]['after']['grants'] == {'12': 'readonly'}
          and created[0]['after']['revision'] == group['revision'])
    check('audit attributes the real administrator and timestamp',
          created[0]['actorId'] == '1' and created[0]['created'].endswith('Z'))
    stage = 'update snapshot'
    original = dict(group)
    group = admin.api('localGroups', {'id': group_id, 'name': group['name'] + ' updated',
                                     'revision': group['revision'], 'members': ['10', '11'],
                                     'grants': {'12': 'member', '8': 'readonly'}})
    updated = events(group_id)
    effective = access()
    check('existing account access reflects updated group role without a new login',
          effective['effectiveRole'] == 'member' and effective['sources'][0]['role'] == 'member')
    check('update records exact prior state', len(updated) == 2 and updated[0]['before'] == created[0]['after'])
    check('update records new members grants and revision',
          updated[0]['after']['members'] == ['10', '11']
          and updated[0]['after']['grants'] == {'12': 'member', '8': 'readonly'}
          and updated[0]['after']['revision'] == group['revision'])
    page = events(group_id, updated[0]['id'])
    check('exclusive cursor returns older events without duplicates',
          len(page) == 1 and page[0]['id'] == created[0]['id'])
    stage = 'concurrent conflict'
    admin.api('localGroups', {'id': group_id, 'name': original['name'],
                              'revision': original['revision'], 'members': [], 'grants': {}}, expected=(409,))
    check('revision conflict creates neither audit nor resource change',
          events(group_id) == updated and next(item for item in admin.api('localGroups')['data']
                                            if item['id'] == group_id)['revision'] == group['revision'])
    stage = 'audit authorization'
    reader = session()
    reader.oidc('leitor')
    status, _, _ = reader.request('/v2-beta/localGroupAudits')
    check('ordinary user cannot enumerate detailed audit', status in (403, 404))
    status, _, _ = reader.request('/v2-beta/localAccessReports?targetAccount=1a1&targetEnvironment=1a12')
    check('ordinary user cannot inspect other account access', status in (403, 404))
    anonymous = session()
    status, _, _ = anonymous.request('/v2-beta/localGroupAudits')
    check('anonymous user cannot enumerate detailed audit', status in (401, 403, 404))
    status, _, _ = admin.request('/v2-beta/localGroupAudits', {'operation': 'forged'})
    check('audit API rejects forged writes', status in (403, 404, 405, 422))
    status, _, _ = admin.request('/v2-beta/localGroupAudits?before=-1')
    check('audit cursor rejects invalid input', status == 422)
    status, _, _ = admin.request('/v2-beta/localAccessReports?targetAccount=invalid&targetEnvironment=1a12')
    check('effective access rejects malformed account identifiers', status == 422)
    stage = 'delete snapshot'
    admin.api('localGroups', {'id': group_id, 'name': group['name'],
                              'revision': group['revision'], 'delete': True})
    group = None
    deleted = events(group_id)
    check('delete preserves exact previous state and no resulting group',
          len(deleted) == 3 and deleted[0]['operation'] == 'delete'
          and deleted[0]['before'] == updated[0]['after'] and deleted[0].get('after') is None)
    check('audit remains readable after resource deletion',
          not any(item['id'] == group_id for item in admin.api('localGroups')['data'])
          and len(events(group_id)) == 3)
    revoked = access()
    check('removing the group removes effective role and sources',
          revoked.get('effectiveRole') is None and revoked['sources'] == [])
    stage = 'native direct grants and competing group roles'
    temporary_project = admin.api('projects', {
        'name': 'Access contract ' + secrets.token_hex(4), 'orchestration': 'cattle',
        'members': [
            {'externalIdType': 'rancher_id', 'externalId': '1', 'role': 'owner'},
            {'externalIdType': 'rancher_id', 'externalId': '10', 'role': 'readonly'},
        ],
    })
    target = temporary_project['id']
    direct = access(project=target)
    check('native direct membership is attributed and evaluated by the backend',
          direct['effectiveRole'] == 'readonly'
          and any(source['kind'] == 'direct' and source['role'] == 'readonly' for source in direct['sources']))
    group = admin.api('localGroups', {'name': 'Access member ' + secrets.token_hex(4),
                                     'members': ['10'], 'grants': {target.removeprefix('1a'): 'member'}})
    extra_group = admin.api('localGroups', {'name': 'Access readonly ' + secrets.token_hex(4),
                                           'members': ['10'], 'grants': {target.removeprefix('1a'): 'readonly'}})
    combined = access(project=target)
    check('native priority resolves competing direct and local group grants',
          combined['effectiveRole'] == 'member' and len(combined['sources']) == 3)
    admin.api('localGroups', {'id': group['id'], 'name': group['name'],
                              'revision': group['revision'], 'delete': True})
    group = None
    check('removing stronger group falls back to remaining readonly grants',
          access(project=target)['effectiveRole'] == 'readonly')
    admin.api('localGroups', {'id': extra_group['id'], 'name': extra_group['name'],
                              'revision': extra_group['revision'], 'delete': True})
    extra_group = None
    preserved = access(project=target)
    check('removing every local group preserves the native direct grant',
          preserved['effectiveRole'] == 'readonly' and len(preserved['sources']) == 1
          and preserved['sources'][0]['kind'] == 'direct')
    check('existing readonly session still reads environment through preserved direct membership',
          reader.api('projects/' + target)['id'] == target)
except Exception as error:
    checks.append({'check': stage, 'status': 'failed', 'errorType': type(error).__name__})
    print('FAILED: ' + stage + ' (' + type(error).__name__ + '); sensitive output withheld.', flush=True)
finally:
    if extra_group:
        try:
            admin.api('localGroups', {'id': extra_group['id'], 'name': extra_group['name'],
                                      'revision': extra_group['revision'], 'delete': True})
        except Exception:
            checks.append({'check': 'competing group cleanup', 'status': 'failed'})
    if group:
        try:
            admin.api('localGroups', {'id': group['id'], 'name': group['name'],
                                      'revision': group['revision'], 'delete': True})
        except Exception:
            checks.append({'check': 'temporary group cleanup', 'status': 'failed'})
    if temporary_project:
        try:
            admin.api('projects/' + temporary_project['id'], method='DELETE')
        except Exception:
            checks.append({'check': 'temporary environment cleanup', 'status': 'failed'})
    (ROOT / 'local-access-test-results.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
if any(item['status'] != 'passed' for item in checks):
    raise SystemExit(1)
print(str(len(checks)) + ' local access checks passed.', flush=True)