"""CLI fixture/readback for manual CUA acceptance of the final numeric-template fix."""
import copy
import importlib.util
import json
import secrets
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / 'console/template-resume-fixture.json'
RESULT = ROOT / 'console/template-resume-test-results.json'
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
admin = lab.Session()
admin.opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(admin.cookies)
)
admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])

def wait_active(identifier):
    for _ in range(120):
        value = admin.api('projecttemplates/' + identifier)
        if value.get('state') == 'active':
            return value
        time.sleep(.5)
    raise AssertionError('Template did not stabilize')

mode = sys.argv[1]
if mode == 'seed':
    if STATE.exists():
        raise SystemExit('Existing fixture: inspect/clean it before creating another.')
    source = next(value for value in admin.api('projecttemplates')['data']
                  if value.get('name') == 'Cattle' and not value.get('removed'))
    name = 'console-template-resume-' + secrets.token_hex(4)
    marker = 'Disposable numeric-template CUA acceptance ' + name
    stacks = copy.deepcopy(source['stacks'])
    for index in (1, 2):
        stacks.append({
            'name': 'numeric-fixture-' + str(index),
            'dockerCompose': 'version: "2"\nservices: {}\n',
            'rancherCompose': 'version: "2"\nservices: {}\n',
            'answers': {'fixture_number': 3, 'fixture_boolean': True},
        })
    value = admin.api('projecttemplates', {
        'name': name, 'description': marker, 'isPublic': False, 'stacks': stacks,
    })
    state = {'id': value['id'], 'name': name, 'marker': marker,
             'sourceId': source['id'], 'nativeStacks': source['stacks']}
    STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    wait_active(value['id'])
    print(json.dumps({'id': value['id'], 'name': name, 'nativeStackCount': len(source['stacks'])}))
elif mode == 'verify':
    state = json.loads(STATE.read_text(encoding='utf-8'))
    value = wait_active(state['id'])
    assert value['description'] == state['marker']
    native = state['nativeStacks']
    stacks = value['stacks']
    checks = []
    def check(name, condition):
        assert condition, name
        checks.append({'check': name, 'status': 'passed'})
        print('PASS: ' + name)
    check('numeric-template edit preserves original infrastructure stacks', stacks[:len(native)] == native)
    check('removing the first numeric row preserves the second stack identity',
          len(stacks) == len(native) + 1 and stacks[-1]['name'] == 'numeric-fixture-2')
    answer = stacks[-1]['answers']
    check('browser persists a negative decimal as a number rather than empty zero or string',
          isinstance(answer['fixture_number'], (int, float)) and answer['fixture_number'] == -4.5)
    check('browser preserves boolean parameter and both Compose files',
          answer['fixture_boolean'] is True and stacks[-1]['dockerCompose'] and stacks[-1]['rancherCompose'])
    check('edited template remains private', value.get('isPublic') is False)
    source = admin.api('projecttemplates/' + state['sourceId'])
    check('native Cattle template remains unchanged', source['stacks'] == native)
    RESULT.write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
elif mode == 'cleanup':
    state = json.loads(STATE.read_text(encoding='utf-8'))
    value = admin.api('projecttemplates/' + state['id'])
    assert value['name'] == state['name'] and value['description'] == state['marker']
    if not value.get('removed'):
        url = value.get('actions', {}).get('remove')
        assert url
        parsed = urllib.parse.urlparse(url)
        assert parsed.hostname == 'localhost' and parsed.port == 18090
        assert parsed.path.startswith('/v2-beta/projecttemplates/')
        status, _, _ = admin.request(parsed.path + '?' + parsed.query, {})
        assert status in (200, 201, 202, 204), 'Native fixture removal failed'
    for _ in range(120):
        value = admin.api('projecttemplates/' + state['id'])
        if value.get('removed') or value.get('state') == 'removed':
            break
        time.sleep(.5)
    else:
        raise AssertionError('Fixture was not removed')
    checks = json.loads(RESULT.read_text(encoding='utf-8')) if RESULT.exists() else []
    checks.append({'check': 'only the named disposable numeric template was removed', 'status': 'passed'})
    RESULT.write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
    STATE.unlink()
    print('PASS: named disposable fixture cleanup')
else:
    raise SystemExit('Use seed, verify, or cleanup')
