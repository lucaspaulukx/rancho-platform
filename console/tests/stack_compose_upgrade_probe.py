"""Native Compose upgrade/rollback on the named zero-scale fixture only."""
import importlib.util,json,urllib.request,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];state=json.loads((ROOT/'console/stack-compose-upgrade-fixture.json').read_text(encoding='utf-8'));assert state['name'].startswith('console-stack-compose-')
s=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.BASE='http://localhost:18090';u=m.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',m.CONFIG['RANCHER_ADMIN_PASSWORD']);base='projects/1a12/';stackPath=base+'stacks/'+state['stack'];servicePath=base+'services/'+state['service']
stack=u.api(stackPath);assert stack['name']==state['name'] and stack['description']==state['marker'] and not stack.get('externalId');service=u.api(servicePath);assert service['scale']==0 and service['stackId']==stack['id']
a=u.api(stackPath+'?action=exportconfig',{});b=u.api(stackPath+'?action=exportconfig',{});assert a['type']=='composeConfig';fields=['dockerComposeConfig','rancherComposeConfig'];assert all(a.get(k)==b.get(k) for k in fields)
assert 'alpine:3.20' in a['dockerComposeConfig'] and 'scale: 0' in a['rancherComposeConfig']
report={'repeatExportStable':True,'zeroScaleExported':True,'outputFields':fields}
body={'dockerCompose':a['dockerComposeConfig'].replace('alpine:3.20','alpine:3.19'),'rancherCompose':a['rancherComposeConfig']}
for k in ['environment','answers','templates']:
 if stack.get(k) is not None:body[k]=stack[k]
u.api(stackPath+'?action=upgrade',body)
def wait(path,condition):
 for _ in range(90):
  v=u.api(path)
  if condition(v):return v
  time.sleep(.3)
 raise AssertionError('Native Compose transition did not stabilize')
stack=wait(stackPath,lambda v:v['state'] in ('upgraded','error') and v.get('transitioning')!='yes');report['upgradeState']=stack['state'];assert stack['state']=='upgraded';v=wait(servicePath,lambda v:v['launchConfig']['imageUuid']=='docker:alpine:3.19');assert v['scale']==0
u.api(stackPath+'?action=rollback',{});stack=wait(stackPath,lambda v:v['state']=='active' and v.get('transitioning')!='yes');v=wait(servicePath,lambda v:v['launchConfig']['imageUuid']=='docker:alpine:3.20');assert v['scale']==0;assert not [v for v in u.api(servicePath+'/instances')['data'] if not v.get('removed')]
report.update({'rollbackRestoredImage':True,'noPhysicalContainers':True,'stackStateAfterRollback':stack['state']});(ROOT/'console/stack-compose-upgrade-contract-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
