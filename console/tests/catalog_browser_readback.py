"""Read-only verification of the stack created through the catalog UI."""
import importlib.util
import json
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
user=lab.Session()
user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12'
stack=next(value for value in user.api(base+'/stacks')['data'] if value.get('name')=='console-catalog-ui' and not value.get('removed'))
assert stack['accountId']=='1a12' and stack.get('description')=='Catalog browser fixture'
checks=[]
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
check('UI-created stack persists the selected catalog version',str(stack.get('externalId','')).startswith('catalog://community:influxdb:'))
check('UI parameter persists the no-exposure preference',stack.get('environment',{}).get('EXPOSE_SERVICE')=='false')
services=[value for value in user.api(base+'/services')['data'] if value.get('stackId')==stack['id'] and not value.get('removed')]
check('UI-created services remain inactive',bool(services) and all(value.get('state')=='inactive' for value in services))
# The upstream rancher-compose.yml unconditionally defines lb metadata. The Go
# condition in docker-compose.yml.tpl removes its image and published ports.
check('native conditional rendering omits published load-balancer ports',all(not value.get('launchConfig',{}).get('ports') for value in services if value.get('type')=='loadBalancerService'))
positive=next(value for value in user.api(base+'/stacks')['data'] if value.get('name')=='console-catalog-api' and not value.get('removed'))
positive_services=[value for value in user.api(base+'/services')['data'] if value.get('stackId')==positive['id'] and not value.get('removed')]
check('same native template includes ports when exposure is enabled',positive.get('environment',{}).get('EXPOSE_SERVICE')=='true' and any(value.get('type')=='loadBalancerService' and value.get('launchConfig',{}).get('ports') for value in positive_services))
(ROOT/'console/catalog-browser-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
print(str(len(checks))+' browser persistence checks passed.')
