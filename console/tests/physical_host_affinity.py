"""One owned host label and stack; real required/preferred host-affinity placement."""
import hashlib, importlib.util, json, re, secrets, time, urllib.request
from pathlib import Path
from legacy_guest import run_guest
ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'console/physical-host-affinity-fixture.json'
REPORT = ROOT / 'console/physical-host-affinity-results.json'
assert not MANIFEST.exists(), 'Recover the previous owned affinity fixture first'
sp = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(sp); sp.loader.exec_module(lab); lab.BASE = 'http://localhost:18080'
u = lab.Session(); u.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(u.cookies))
u.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD']); BASE = 'projects/1a12/'
name = 'console-host-affinity-' + secrets.token_hex(6); key = 'console.lab.affinity-' + secrets.token_hex(6)
checks = []; stack = None; outcome = 'failed'; label_applied = False

def rows(path): return [v for v in u.api(BASE + path + '?limit=-1')['data'] if not v.get('removed')]
def digest(value): return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
def snapshot(): return {v['id']: digest({k: v.get(k) for k in ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')}) for v in rows('services')}
def host():
    value = u.api(BASE + 'hosts/1h1'); assert value['accountId'] == '1a12' and not value.get('removed'); return value
before = snapshot(); containers = {v['id'] for v in rows('containers')}; volumes = {v['id'] for v in rows('volumes')}
labels_hash = digest(host().get('labels') or {}); assert key not in (host().get('labels') or {})
state = {'name': name, 'marker': name, 'host': '1h1', 'labelKey': key, 'labelApplied': False, 'hostLabelsHash': labels_hash, 'baseline': before, 'containers': sorted(containers), 'volumes': sorted(volumes), 'services': []}
def save(): MANIFEST.write_text(json.dumps(state, indent=2), encoding='utf-8')
def check(label, condition=True):
    assert condition, label
    checks.append({'check': label, 'status': 'passed'}); REPORT.write_text(json.dumps({'status': 'running', 'checks': checks}, indent=2), encoding='utf-8'); print('PASS: ' + label, flush=True)
def set_label(value):
    global label_applied
    current = host(); labels = dict(current.get('labels') or {})
    assert key not in labels or labels[key] in ('eligible', 'ineligible')
    labels[key] = value; label_applied = True; state['labelApplied'] = True; save()
    assert u.request('/v2-beta/' + BASE + 'hosts/1h1', {'labels': labels}, 'PUT')[0] == 200
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if (host().get('labels') or {}).get(key) == value: return
        time.sleep(1)
    raise AssertionError('Owned host label did not converge')
def create(service_name, mode):
    value = u.api(BASE + 'services', {'name': service_name, 'description': name, 'stackId': stack['id'], 'scale': 1, 'startOnCreate': True, 'launchConfig': {'imageUuid': 'docker:alpine:3.20', 'networkMode': 'none', 'memory': 67108864, 'command': ['/bin/sh', '-c', 'exec sleep 86400'], 'labels': {'io.rancher.scheduler.affinity:host_label' + mode: key + '=eligible'}}})
    state['services'].append(value['id']); save(); return value
def instances(service): return rows('services/' + service['id'] + '/instances')
def running(service):
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        found = [v for v in instances(service) if v['state'] == 'running' and v.get('externalId')]
        if len(found) == 1:
            item = found[0]; assert item['hostId'] == '1h1' and re.fullmatch('[a-f0-9]{64}', item['externalId'])
            result = run_guest("sudo docker inspect --format 'FIXTURE_STATUS:affinity-running={{.State.Running}}' " + item['externalId'])
            assert result.get('exitCode') == 0 and 'FIXTURE_STATUS:affinity-running=true' in result.get('status', [])
            return item
        time.sleep(1)
    raise AssertionError('Owned affinity service did not run on eligible host')
def constraint_failure(service):
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        found = instances(service); assert not any(v.get('externalId') or v['state'] == 'running' for v in found)
        current = u.api(BASE + 'services/' + service['id'])
        messages = [str(v.get('transitioningMessage') or '') for v in [current, *found]]
        if any(key in message and 'needs host with label' in message.lower() for message in messages):
            state['constraintFailureObserved'] = True; save(); return
        time.sleep(1)
    raise AssertionError('No explicit native host-affinity constraint error observed')
try:
    infra = [v for v in rows('services') if v.get('system')]
    check('original host and native infrastructure ready', len(infra) == 6 and all(v['state'] == 'active' and v['healthState'] == 'healthy' for v in infra) and host()['state'] == 'active' and host()['agentState'] == 'active')
    save(); set_label('eligible'); stack = u.api(BASE + 'stacks', {'name': name, 'description': name}); state['stack'] = stack['id']; save()
    required = create('required', ''); running(required); check('required matching host label places a real container on original host')
    set_label('ineligible'); preferred = create('preferred', '_soft'); running(preferred); check('soft preference without a matching host still runs on available host')
    blocked = create('blocked', ''); constraint_failure(blocked); check('hard requirement without eligible host returns explicit native constraint error before container creation')
    set_label('eligible'); running(blocked); check('same blocked service recovers when host becomes eligible without changing its rule')
    outcome = 'passed'
except Exception as error:
    checks.append({'check': 'physical execution', 'status': 'failed', 'errorType': type(error).__name__}); raise
finally:
    if stack:
        current = u.api(BASE + 'stacks/' + stack['id']); assert current['name'] == name and current['description'] == name and current['accountId'] == '1a12'
        if not current.get('removed'): assert u.request(current['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            current = u.api(BASE + 'stacks/' + stack['id'])
            if current.get('removed') and {v['id'] for v in rows('containers')} == containers: break
            time.sleep(1)
        check('owned affinity stack and containers removed', bool(current.get('removed')) and {v['id'] for v in rows('containers')} == containers)
    if label_applied:
        labels = dict(host().get('labels') or {})
        if key in labels:
            assert labels[key] in ('eligible', 'ineligible'); del labels[key]
            assert u.request('/v2-beta/' + BASE + 'hosts/1h1', {'labels': labels}, 'PUT')[0] == 200
        state['labelApplied'] = False; save()
    check('only owned host label removed and previous labels preserved', digest(host().get('labels') or {}) == labels_hash)
    check('previous configurations containers and volumes preserved', snapshot() == before and {v['id'] for v in rows('containers')} == containers and {v['id'] for v in rows('volumes')} == volumes)
    REPORT.write_text(json.dumps({'status': outcome, 'checks': checks, 'scope': 'one host required-label positive, preferred fallback, explicit hard constraint error and recovery; no multi-host/global/container-affinity acceptance'}, indent=2), encoding='utf-8')
    MANIFEST.unlink(missing_ok=True)
