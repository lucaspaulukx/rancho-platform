"""Local-only workload fixtures and API checks, without touching existing projects.
Synthetic stacks and stopped containers remain available for browser acceptance.
"""
import importlib.util
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
session = lab.Session()
session.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(session.cookies))
session.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
project = next(p for p in session.api('projects')['data'] if p.get('name') == 'UI-OPS-LAB' and not p.get('removed'))
base = 'projects/' + project['id']
results = []
def check(name, condition):
    assert condition, name
    results.append({'check': name, 'status': 'passed'})
def ensure(collection, name, payload):
    existing = session.api(base + '/' + collection)['data']
    found = next((r for r in existing if r.get('name') == name and not r.get('removed')), None)
    return found or session.api(base + '/' + collection, {'name': name, **payload})

store = ensure('stacks', 'console-store', {'description': 'Synthetic storefront fixture'})
internal = ensure('stacks', 'console-internal', {'description': 'Synthetic internal fixture'})
web = ensure('services', 'store-web', {'stackId': store['id'], 'scale': 0, 'startOnCreate': False, 'launchConfig': {'imageUuid': 'docker:alpine:3.20', 'command': ['sh', '-c', 'while true; do echo console-lab-log; sleep 5; done']}})
worker = ensure('services', 'internal-worker', {'stackId': internal['id'], 'scale': 0, 'startOnCreate': False, 'launchConfig': {'imageUuid': 'docker:alpine:3.20', 'command': ['sleep', '3600']}})
standalone = ensure('containers', 'console-standalone', {'imageUuid': 'docker:alpine:3.20', 'startOnCreate': False, 'command': ['sh', '-c', 'while true; do echo standalone-lab-log; sleep 5; done'], 'networkMode': 'host', 'labels': {'rancher.console.fixture': 'true'}})
check('stacks remain in the selected environment', store['accountId'] == project['id'] and internal['accountId'] == project['id'])
check('service belongs to its stack', web['stackId'] == store['id'] and worker['stackId'] == internal['id'])
check('service scale is initially zero', web['scale'] == 0 and worker['scale'] == 0)
check('standalone container does not inherit a service', not standalone.get('serviceIds'))
check('detail links keep the public console origin', web['links']['self'].startswith(lab.BASE + '/'))
status, _, _ = session.request('/v2-beta/projects/1a7/stacks/' + store['id'])
check('a stack cannot be read through another environment', status in (403, 404))
reader = lab.Session()
reader.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(reader.cookies))
reader.oidc('leitor')
status, _, _ = reader.request('/v2-beta/' + base + '/stacks')
check('user without this environment cannot list its stacks', status in (403, 404))
hosts = session.api(base + '/hosts')['data']
fixture = {'environment': project['id'], 'stacks': [store['id'], internal['id']], 'services': [web['id'], worker['id']], 'standalone': standalone['id'], 'hosts': [{'id': host['id'], 'state': host.get('state'), 'agentState': host.get('agentState')} for host in hosts]}
(ROOT / 'console/workload-fixture.json').write_text(json.dumps(fixture, indent=2) + '\n', encoding='utf-8')
(ROOT / 'console/workload-test-results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'checksPassed': len(results), 'fixture': fixture}))
