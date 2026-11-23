"""Host metadata and readonly contract acceptance in the disposable lab."""
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
    value.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(value.cookies))
    return value
def check(name, condition):
    assert condition, name
    checks.append({'check':name,'status':'passed'})
    print('PASS: ' + name, flush=True)
admin = session()
admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
fixture = json.loads((ROOT/'console/workload-fixture.json').read_text(encoding='utf-8'))
assert fixture['environment'] == '1a12'
hosts = admin.api('projects/1a12/hosts')['data']
host = next(value for value in hosts if value['id'] == fixture['hosts'][0]['id'])
check('registered fixture host is active with real capacity', host['state']=='active' and host['info']['cpuInfo']['count'] > 0 and host['info']['memoryInfo']['memTotal'] > 0)
containers = admin.api('projects/1a12/containers')['data']
check('physical container belongs to the registered host', any(value['id']==fixture['standalone'] and value.get('hostId')==host['id'] for value in containers))
schema = admin.api('projects/1a12/schemas/registrationToken')
tokens = admin.api('projects/1a12/registrationTokens')['data']
check('registration uses native token collection and command', 'POST' in schema['collectionMethods'] and any(value['state']=='active' and isinstance(value.get('command'),str) and value['command'] for value in tokens))
baseline = host.get('description')
try:
    changed = admin.api('projects/1a12/hosts/' + host['id'], {'description':'Synthetic host console acceptance'}, method='PUT')
    current = admin.api('projects/1a12/hosts/' + host['id'])
    check('host metadata change is persisted by Rancher', current.get('description')=='Synthetic host console acceptance')
finally:
    admin.api('projects/1a12/hosts/' + host['id'], {'description':baseline}, method='PUT')
reader = session()
reader.oidc('leitor')
host_schema = reader.api('projects/1a7/schemas/host')
registration_status, registration_schema, _ = reader.request('/v2-beta/projects/1a7/schemas/registrationToken')
check('reader host schema has no writes', host_schema['resourceMethods']==['GET'] and not host_schema.get('resourceActions'))
check('reader cannot prepare registration', registration_status == 404 or (registration_status == 200 and 'POST' not in registration_schema.get('collectionMethods', [])))
status, _, _ = reader.request('/v2-beta/projects/1a12/hosts')
check('host collection enforces environment isolation', status in (403,404))
(ROOT/'console/host-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
print(str(len(checks))+' host checks passed.')
