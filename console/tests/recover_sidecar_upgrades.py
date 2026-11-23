"""Remove only the manifested sidecar-upgrade stack after an interrupted test."""
import hashlib, importlib.util, json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
manifest = ROOT / 'console/physical-sidecar-upgrades-fixture.json'
state = json.loads(manifest.read_text(encoding='utf-8'))
assert state['name'].startswith('console-physical-sidecar-upgrades-') and state['marker'] == state['name']
sp = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(sp); sp.loader.exec_module(lab); lab.BASE = 'http://localhost:18090'
u = lab.Session(); u.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(u.cookies))
u.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD']); base = 'projects/1a12/'

def rows(kind):
    return [v for v in u.api(base + kind + '?limit=-1')['data'] if not v.get('removed')]

if state.get('stack'):
    stack = u.api(base + 'stacks/' + state['stack'])
    assert stack['name'] == state['name'] and stack['description'] == state['marker'] and stack['accountId'] == '1a12'
    if state.get('service'):
        service = u.api(base + 'services/' + state['service'])
        assert service['stackId'] == stack['id'] and service['accountId'] == '1a12' and service['description'] == state['marker']
    if not stack.get('removed'):
        action = urllib.parse.urlparse(stack['actions']['remove'])
        assert action.netloc == 'localhost:18090' and action.path.rstrip('/') == '/v2-beta/' + base + 'stacks/' + stack['id'] and action.query == 'action=remove'
        assert u.request(stack['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
    for _ in range(180):
        if u.api(base + 'stacks/' + stack['id']).get('removed') and {v['id'] for v in rows('containers')} == set(state['containers']):
            break
        time.sleep(1)
    assert u.api(base + 'stacks/' + stack['id']).get('removed')
assert {v['id'] for v in rows('containers')} == set(state['containers'])
assert {v['id'] for v in rows('volumes')} == set(state['volumes'])
snapshot = {v['id']: hashlib.sha256(json.dumps({k: v.get(k) for k in ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')}, sort_keys=True).encode()).hexdigest() for v in rows('services')}
assert snapshot == state['baseline']
(ROOT / 'console/physical-sidecar-upgrades-interruption-recovery.json').write_text(json.dumps({'status': 'passed', 'ownedStackRemoved': True, 'priorConfigurationsContainersVolumesPreserved': True, 'testAccepted': False}, indent=2), encoding='utf-8')
manifest.unlink()
print('PASS: interrupted owned stack removed; prior configurations containers volumes preserved; no physical upgrade acceptance')
