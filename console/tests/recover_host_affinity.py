"""Recover only the host label and stack from an interrupted affinity test."""
import hashlib, importlib.util, json, re, time, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; manifest = ROOT / 'console/physical-host-affinity-fixture.json'
state = json.loads(manifest.read_text(encoding='utf-8'))
assert state['name'].startswith('console-host-affinity-') and state['marker'] == state['name'] and state['host'] == '1h1'
assert re.fullmatch(r'console\.lab\.affinity-[a-f0-9]{12}', state['labelKey'])
sp = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py'); lab = importlib.util.module_from_spec(sp); sp.loader.exec_module(lab); lab.BASE = 'http://localhost:18080'
u = lab.Session(); u.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(u.cookies)); u.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD']); BASE = 'projects/1a12/'
def digest(value): return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
def rows(kind): return [v for v in u.api(BASE + kind + '?limit=-1')['data'] if not v.get('removed')]
if state.get('stack'):
    stack = u.api(BASE + 'stacks/' + state['stack']); assert stack['name'] == state['name'] and stack['description'] == state['marker'] and stack['accountId'] == '1a12'
    for service_id in state.get('services', []):
        service = u.api(BASE + 'services/' + service_id); assert service['stackId'] == stack['id'] and service['description'] == state['marker'] and service['accountId'] == '1a12'
    if not stack.get('removed'): assert u.request(stack['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        if u.api(BASE + 'stacks/' + stack['id']).get('removed') and {v['id'] for v in rows('containers')} == set(state['containers']): break
        time.sleep(1)
    assert u.api(BASE + 'stacks/' + stack['id']).get('removed') and {v['id'] for v in rows('containers')} == set(state['containers'])
host = u.api(BASE + 'hosts/1h1'); assert host['accountId'] == '1a12' and not host.get('removed')
labels = dict(host.get('labels') or {}); key = state['labelKey']
if key in labels:
    assert labels[key] in ('eligible', 'ineligible'); del labels[key]
    assert u.request('/v2-beta/' + BASE + 'hosts/1h1', {'labels': labels}, 'PUT')[0] == 200
assert digest(u.api(BASE + 'hosts/1h1').get('labels') or {}) == state['hostLabelsHash']
assert {v['id'] for v in rows('containers')} == set(state['containers']) and {v['id'] for v in rows('volumes')} == set(state['volumes'])
snapshot = {v['id']: digest({k: v.get(k) for k in ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')}) for v in rows('services')}; assert snapshot == state['baseline']
(ROOT / 'console/physical-host-affinity-interruption-recovery.json').write_text(json.dumps({'status': 'passed', 'ownedStackContainersAndLabelRemoved': True, 'priorConfigurationsContainersVolumesLabelsPreserved': True, 'testAccepted': False}, indent=2), encoding='utf-8'); manifest.unlink()
print('PASS: interrupted affinity stack containers and owned label removed; previous configurations containers volumes labels preserved')
