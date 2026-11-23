"""Zero-scale Compose-backed stack upgrade fixture. No physical traffic/mount claim."""
import importlib.util,json,secrets,sys,time,urllib.request,urllib.parse,traceback,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/stack-compose-upgrade-fixture.json';REPORT=ROOT/'console/stack-compose-upgrade-cleanup-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090';base='projects/1a12/'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
def collection(path):
 rows=[]
 while path:
  page=u.api(path);rows+=page['data'];next_url=page.get('pagination',{}).get('next')
  if next_url:
   url=urllib.parse.urlparse(next_url);assert url.netloc=='localhost:18090' and url.path.startswith('/v2-beta/'+base);path=url.path.removeprefix('/v2-beta/')+'?'+url.query
  else:path=None
 return rows
def digest(v):return hashlib.sha256(json.dumps({k:v.get(k) for k in ['id','accountId','stackId','launchConfig','secondaryLaunchConfigs']},sort_keys=True).encode()).hexdigest()
def snapshot(exclude=()):return {v['id']:digest(v) for v in collection(base+'services?limit=100') if not v.get('removed') and v['id'] not in exclude}
def volumes():return sorted(v['id'] for v in collection(base+'volumes?limit=100') if not v.get('removed'))
def wait(path,ready):
 for _ in range(90):
  v=u.api(base+path)
  if ready(v):return v
  time.sleep(.5)
 raise AssertionError('Fixture did not stabilize')
try:
 mode=sys.argv[1]
 if mode in ('seed','resume-seed'):
  if mode=='seed':
   assert not STATE.exists();assert u.api('projects/1a12')['name']=='UI-OPS-LAB';name='console-stack-compose-'+secrets.token_hex(4);marker='Disposable zero-scale stack compose '+name
   state={'name':name,'marker':marker,'environment':'1a12','baseline':snapshot(),'baselineVolumes':volumes()}
   def save():STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
   dc="version: '2'\nservices:\n  compose-web:\n    image: alpine:3.20\n    command: [/bin/sh, -c, 'sleep 86400']\n    environment:\n      STACK_COMPOSE_FIXTURE: preserve-me\n      STACK_PARAMETER: ${STACK_PARAMETER}\n"
   rc="version: '2'\nservices:\n  compose-web:\n    scale: 0\n"
   save();stack=u.api(base+'stacks',{'name':name,'description':marker,'dockerCompose':dc,'rancherCompose':rc,'startOnCreate':False,'environment':{'STACK_PARAMETER':'preserved'}});state['stack']=stack['id'];save();wait('stacks/'+stack['id'],lambda v:v['state']=='active')
  else:
   state=json.loads(STATE.read_text(encoding='utf-8'));name=state['name'];marker=state['marker'];assert name.startswith('console-stack-compose-') and marker=='Disposable zero-scale stack compose '+name;stack=u.api(base+'stacks/'+state['stack']);assert stack['name']==name and stack['description']==marker
   def save():STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  for _ in range(90):
   services=[v for v in collection(base+'services?stackId='+stack['id']+'&limit=100') if not v.get('removed')]
   if services:break
   time.sleep(.5)
  assert len(services)==1 and services[0]['name']=='compose-web';v=services[0]
  state['service']=v['id'];save();u.api(base+'services/'+v['id'],{'description':marker,'scale':0},method='PUT');wait('services/'+v['id'],lambda v:v['state']=='inactive' and v['scale']==0 and v['description']==marker);print(json.dumps({k:state[k] for k in ['name','stack','service']}),flush=True)
 elif mode=='cleanup':
  state=json.loads(STATE.read_text(encoding='utf-8'));assert state['name'].startswith('console-stack-compose-') and state['marker']=='Disposable zero-scale stack compose '+state['name'];stack=u.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
  targets=collection(base+'services?stackId='+stack['id']+'&_removed=true&limit=100');assert len(targets)<=1
  instances=[v for v in collection(base+'containers?limit=100') if v.get('labels',{}).get('io.rancher.stack.name')==state['name']]
  for v in instances:assert v['accountId']=='1a12' and v.get('environment',{}).get('STACK_COMPOSE_FIXTURE')=='preserve-me' and v['labels'].get('io.rancher.stack_service.name')==state['name']+'/compose-web'
  for v in targets:
   assert v['name']=='compose-web' and v['stackId']==stack['id'] and v.get('description') in (None,'',state['marker']) and v['launchConfig']['environment']['STACK_COMPOSE_FIXTURE']=='preserve-me'
   state['service']=v['id']
  state['observedContainers']=[v['id'] for v in instances];STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  if not stack.get('removed'):
   url=urllib.parse.urlparse(stack['actions']['remove']);assert url.netloc=='localhost:18090' and url.path.rstrip('/')=='/v2-beta/'+base+'stacks/'+stack['id'] and url.query=='action=remove';code,_,_=u.request(stack['actions']['remove'],{},method='POST');assert code in (200,201,202,204)
  wait('stacks/'+stack['id'],lambda v:bool(v.get('removed')))
  for v in targets:wait('services/'+v['id'],lambda v:bool(v.get('removed')))
  for v in instances:
   current=u.api(base+'containers/'+v['id'])
   if not current.get('removed'):
    action=urllib.parse.urlparse(current['actions']['remove']);assert action.netloc=='localhost:18090' and action.path.rstrip('/')=='/v2-beta/'+base+'containers/'+v['id'] and action.query=='action=remove';code,_,_=u.request(current['actions']['remove'],{},method='POST');assert code in (200,201,202,204)
   wait('containers/'+v['id'],lambda v:bool(v.get('removed')))
  for v in collection(base+'volumes?limit=100'):
   if v['id'] in state['baselineVolumes']:continue
   assert v.get('instanceId') in state['observedContainers'] and not v.get('isHostPath') and v['accountId']=='1a12'
   current=wait('volumes/'+v['id'],lambda v:v['state']=='detached');action=urllib.parse.urlparse(current['actions']['remove']);assert action.netloc=='localhost:18090' and action.path.rstrip('/')=='/v2-beta/'+base+'volumes/'+v['id'] and action.query=='action=remove';code,_,_=u.request(current['actions']['remove'],{},method='POST');assert code in (200,201,202,204);wait('volumes/'+v['id'],lambda v:bool(v.get('removed')))
  assert snapshot([v['id'] for v in targets])==state['baseline'] and volumes()==state['baselineVolumes']
  REPORT.write_text(json.dumps({'fixture':state['name'],'stack':stack['id'],'services':[v['id'] for v in targets],'status':'passed','preexistingServiceConfigurationsPreserved':True,'preexistingVolumesPreserved':True,'observedContainerRecords':len(instances)},indent=2)+'\n',encoding='utf-8');STATE.unlink();print('PASS: exact stack Compose fixture removed and previous service configurations/volumes preserved',flush=True)
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
