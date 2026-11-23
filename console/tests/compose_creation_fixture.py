"""Readback/cleanup for two UI-created, strictly identified Compose acceptance stacks."""
import importlib.util
import json
import sys
import time
import urllib.parse
import urllib.request
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / 'console/compose-creation-fixture.json'
REPORT = ROOT / 'console/compose-creation-test-results.json'
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
user = lab.Session()
user.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base = 'projects/1a12/'
checks = json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else []

def check(name, condition):
    assert condition, name
    checks[:] = [v for v in checks if v['check'] != name]
    checks.append({'check': name, 'status': 'passed'})
    REPORT.write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
    print('PASS: ' + name, flush=True)

def wait(read, ready):
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        value = read()
        if ready(value): return value
        time.sleep(1)
    raise TimeoutError('Native Compose fixture did not stabilize')

def collection(path):
    values = []
    while path:
        page = user.api(path)
        values.extend(page['data'])
        path = page.get('pagination', {}).get('next')
        if path:
            parsed = urllib.parse.urlparse(path)
            assert parsed.netloc == 'localhost:18090' and parsed.path.startswith('/v2-beta/' + base)
            path = parsed.path.removeprefix('/v2-beta/') + ('?' + parsed.query if parsed.query else '')
    return values

def stack(state, name):
    matches = [v for v in collection(base + 'stacks?limit=100') if v.get('name') == name and not v.get('removed')]
    assert len(matches) == 1
    value = user.api(base + 'stacks/' + matches[0]['id'])
    assert value['description'] == state['marker'] and value['accountId'] == state['environment'] == '1a12'
    return value

try:
    mode = sys.argv[1]
    state = json.loads(STATE.read_text(encoding='utf-8'))
    assert state['name'].startswith('console-compose-') and state['emptyName'] == state['name'] + '-empty'
    if mode == 'verify-empty':
        value = stack(state, state['emptyName'])
        value = wait(lambda: user.api(base+'stacks/'+value['id']), lambda v: v['state'] == 'active')
        check('UI creates empty stack with original name, description and no services',
              not collection(base+'services?stackId='+value['id']+'&limit=100'))
        state['emptyStack'] = value['id']
    elif mode in ('verify-inactive', 'verify-running'):
        value = stack(state, state['name'])
        value = wait(lambda: user.api(base+'stacks/'+value['id']), lambda v: v['state'] == 'active')
        services = wait(lambda: collection(base+'services?stackId='+value['id']+'&limit=100'), lambda rows: len(rows) == 1)
        service = services[0]
        assert service['accountId'] == '1a12' and service['stackId'] == value['id'] and service['name'] == 'web'
        check('Compose files and UTF-8 interpolation value persist on native stack',
              value.get('dockerCompose') == state['dockerCompose'] and value.get('rancherCompose') == state['rancherCompose']
              and value.get('environment', {}).get('MESSAGE') == state['message'])
        check('Rancher imports service image, host network, quantity and interpolated environment',
              service['scale'] == 1 and service['launchConfig']['imageUuid'] == 'docker:alpine:3.20'
              and service['launchConfig'].get('networkMode') == 'host'
              and service['launchConfig'].get('environment', {}).get('MESSAGE') == state['message'])
        if mode == 'verify-inactive':
            check('unchecked startOnCreate leaves imported service inactive without containers',
                  service['state'] == 'inactive' and not user.api(base+'services/'+service['id']+'/instances')['data'])
        else:
            rows = wait(lambda: user.api(base+'services/'+service['id']+'/instances')['data'],
                        lambda rows: len([v for v in rows if v['state'] == 'running' and not v.get('removed')]) == 1)
            running = [v for v in rows if v['state'] == 'running' and not v.get('removed')]
            check('starting imported service from contextual menu runs one real container on isolated original host',
                  len(running) == 1 and running[0]['hostId'] == '1h1' and running[0]['accountId'] == '1a12')
        state.update(stack=value['id'], service=service['id'])
    elif mode == 'authorization':
        reader = lab.Session()
        reader.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(reader.cookies))
        reader.oidc('leitor')
        status, _, _ = reader.request('/v2-beta/'+base+'stacks', {'name': state['name']+'-denied', 'dockerCompose':'services: {}', 'startOnCreate':False})
        check('user without environment cannot create Compose stack through native POST', status in (403,404))
        check('denied request did not create a stack', not any(v.get('name') == state['name']+'-denied' for v in collection(base+'stacks?limit=100')))
    elif mode == 'cleanup':
        for key, name in [('stack',state['name']),('emptyStack',state['emptyName'])]:
            assert state.get(key), 'Read back fixture ID before cleanup'
            value = user.api(base+'stacks/'+state[key])
            assert value['name'] == name and value['description'] == state['marker'] and value['accountId'] == '1a12'
            services = collection(base+'services?stackId='+value['id']+'&limit=100')
            if key == 'stack' and state.get('service') and not any(v['id'] == state['service'] for v in services):
                service = user.api(base+'services/'+state['service'])
                assert service['stackId'] == value['id'] and service['accountId'] == '1a12'
                services.append(service)
            if not value.get('removed'):
                parsed = urllib.parse.urlparse(value['actions']['remove'])
                assert parsed.netloc == 'localhost:18090' and parsed.path.startswith('/v2-beta/'+base)
                status, _, _ = user.request(value['actions']['remove'], {})
                assert status in (200,201,202,204)
            wait(lambda: user.api(base+'stacks/'+value['id']), lambda v: bool(v.get('removed')))
            for service in services:
                wait(lambda: user.api(base+'services/'+service['id']), lambda v: bool(v.get('removed')))
                wait(lambda: user.api(base+'services/'+service['id']+'/instances')['data'], lambda rows: all(v.get('removed') or v['state'] in ('removed','purged') for v in rows))
        check('both precisely identified UI fixtures and dependent services/instances removed', True)
        STATE.unlink()
        raise SystemExit(0)
    else: raise ValueError('Unknown fixture operation')
    STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
except Exception as error:
    print(json.dumps({'operation':sys.argv[1], 'errorType':type(error).__name__, 'locations':[{'file':Path(v.filename).name,'line':v.lineno} for v in traceback.extract_tb(error.__traceback__)]}),flush=True)
    raise SystemExit(1)
