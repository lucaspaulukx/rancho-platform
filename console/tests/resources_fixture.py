"""Own zero-scale fixture only; no production or existing workload edits."""
import hashlib, importlib.util, json, secrets, sys, time, urllib.parse, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / 'console/resources-fixture.json'
sp = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(sp); sp.loader.exec_module(lab); lab.BASE = 'http://localhost:18090'
u = lab.Session(); u.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(u.cookies)); u.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
BASE = 'projects/1a12/'
def rows(path):
    values = []
    while path:
        page = u.api(path); values += page['data']; next_url = page.get('pagination', {}).get('next')
        if next_url:
            url = urllib.parse.urlparse(next_url)
            assert url.netloc == 'localhost:18090' and url.path.startswith('/v2-beta/' + BASE)
            path = url.path.removeprefix('/v2-beta/') + '?' + url.query
        else: path = None
    return [v for v in values if not v.get('removed')]
def snapshot(exclude=()):
    return {v['id']: hashlib.sha256(json.dumps({key: v.get(key) for key in ('id','stackId','launchConfig','secondaryLaunchConfigs','scale')}, sort_keys=True).encode()).hexdigest()
            for v in rows(BASE + 'services?limit=100') if v['id'] not in exclude}
def wait(path, predicate):
    for _ in range(90):
        value = u.api(BASE + path)
        if predicate(value): return value
        time.sleep(.5)
    raise AssertionError('Fixture state timeout')
def save(state): STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')
def main():
    if sys.argv[1] == 'seed':
        assert not STATE.exists(); assert u.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        name = 'console-resources-' + secrets.token_hex(5)
        state = {'name': name, 'marker': 'Disposable zero-scale resources ' + name, 'environment': '1a12',
                 'baseline': snapshot(), 'volumes': sorted(v['id'] for v in rows(BASE + 'volumes?limit=100')),
                 'containers': sorted(v['id'] for v in rows(BASE + 'containers?limit=100'))}
        save(state)
        stack = u.api(BASE + 'stacks', {'name': name, 'description': state['marker']})
        state['stack'] = stack['id']; save(state); wait('stacks/' + stack['id'], lambda v: v['state'] == 'active')
        print('PASS: isolated resources stack prepared', flush=True)
    elif sys.argv[1] == 'verify':
        state = json.loads(STATE.read_text(encoding='utf-8'))
        services = [v for v in rows(BASE + 'services?limit=100') if v.get('stackId') == state['stack']]
        assert {v['name'] for v in services} == {'resources-web'}
        assert services[0]['launchConfig']['memory'] == 134217728
        assert services[0]['launchConfig']['memoryReservation'] == 67108864
        for value in services:
            assert value['scale'] == 0 and value['state'] == 'inactive' and value['description'] == state['marker']
            assert not rows(BASE + 'services/' + value['id'] + '/instances?limit=100')
        outsider = lab.Session()
        outsider.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(outsider.cookies))
        outsider.oidc('sem-acesso')
        status, _, _ = outsider.request('/v2-beta/' + BASE + 'services', {
            'name':'forbidden-resources', 'description':state['marker'], 'stackId':state['stack'],
            'scale':0, 'startOnCreate':False,
            'launchConfig':{'imageUuid':'docker:alpine:3.20', 'memory':134217728,'memoryReservation':67108864}})
        assert status in (403, 404)
        report = {'status':'passed', 'memory':134217728,'reservation':67108864, 'zeroScale':True,
                  'noInstances':True, 'noEnvironmentUserCreationStatus':status, 'physicalSchedulingNotClaimed':True}
        (ROOT / 'console/resources-native-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('PASS: memory and reservation persisted inactive; ungranted user denied',flush=True)
    elif sys.argv[1] == 'cleanup':
        state = json.loads(STATE.read_text(encoding='utf-8')); assert state['name'].startswith('console-resources-')
        assert state['marker'] == 'Disposable zero-scale resources ' + state['name'] and state['environment'] == '1a12'
        stack = u.api(BASE + 'stacks/' + state['stack'])
        assert stack['name'] == state['name'] and stack['description'] == state['marker'] and stack['accountId'] == state['environment']
        services = [v for v in rows(BASE + 'services?limit=100') if v.get('stackId') == stack['id']]
        for value in services:
            assert value['description'] == state['marker'] and value['scale'] == 0 and value['state'] == 'inactive'
            assert not rows(BASE + 'services/' + value['id'] + '/instances?limit=100')
        if not stack.get('removed'):
            action = urllib.parse.urlparse(stack['actions']['remove'])
            assert action.netloc == 'localhost:18090' and action.path.rstrip('/') == '/v2-beta/' + BASE + 'stacks/' + stack['id'] and action.query == 'action=remove'
            status, _, _ = u.request(stack['actions']['remove'], {}, 'POST')
            assert status in (200, 201, 202, 204)
        wait('stacks/' + stack['id'], lambda v: bool(v.get('removed')))
        for value in services: wait('services/' + value['id'], lambda v: bool(v.get('removed')))
        assert snapshot() == state['baseline']
        assert sorted(v['id'] for v in rows(BASE + 'volumes?limit=100')) == state['volumes']
        assert sorted(v['id'] for v in rows(BASE + 'containers?limit=100')) == state['containers']
        report = {'status':'passed', 'ownedServicesRemoved':len(services), 'preexistingConfigurationsPreserved':True, 'volumesPreserved':True, 'containersPreserved':True, 'physicalSchedulingExecuted':False}
        (ROOT / 'console/resources-cleanup-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8'); STATE.unlink()
        print('PASS: resources fixtures removed; service configurations, containers and volumes preserved',flush=True)
    else: raise ValueError('Unknown mode')
try: main()
except Exception as e:
    import traceback
    print(json.dumps({'errorType':type(e).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(e.__traceback__)]}),flush=True)
    raise SystemExit(1)
