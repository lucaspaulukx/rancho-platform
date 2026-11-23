"""Zero-scale service configuration upgrade fixture. No physical traffic/mount claim."""
import importlib.util,json,secrets,sys,time,urllib.request,urllib.parse,traceback,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/sidecar-upgrade-fixture.json';REPORT=ROOT/'console/sidecar-upgrade-cleanup-results.json'
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
 if mode=='seed':
  assert not STATE.exists();assert u.api('projects/1a12')['name']=='UI-OPS-LAB';name='console-sidecar-upgrade-'+secrets.token_hex(4);marker='Disposable zero-scale sidecar upgrade '+name
  state={'name':name,'marker':marker,'environment':'1a12','baseline':snapshot(),'baselineVolumes':volumes()}
  def save():STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  save();stack=u.api(base+'stacks',{'name':name,'description':marker});state['stack']=stack['id'];save();wait('stacks/'+stack['id'],lambda v:v['state']=='active')
  v=u.api(base+'services',{'name':'config-web','description':marker,'stackId':stack['id'],'scale':0,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'managed','ports':['8080:80/tcp'],'dataVolumes':['/fixture'],'environment':{'CONFIG_UPGRADE_FIXTURE':'preserve-me'},'command':['/bin/sh','-c','sleep 86400']},'secondaryLaunchConfigs':[{'name':'worker','imageUuid':'docker:busybox:1.36','environment':{'SIDECAR_UPGRADE_FIXTURE':'preserve-me'},'command':['sh','-c','sleep 86400']}]});state['service']=v['id'];save();wait('services/'+v['id'],lambda v:v['state']=='active');print(json.dumps({k:state[k] for k in ['name','stack','service']}),flush=True)
 elif mode=='cleanup':
  state=json.loads(STATE.read_text(encoding='utf-8'));assert state['name'].startswith('console-sidecar-upgrade-') and state['marker']=='Disposable zero-scale sidecar upgrade '+state['name'];stack=u.api(base+'stacks/'+state['stack']);v=u.api(base+'services/'+state['service']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12' and v['description']==state['marker'] and v['stackId']==stack['id'] and v['scale']==0
  assert not [v for v in collection(base+'services/'+state['service']+'/instances?limit=100') if not v.get('removed')]
  if not stack.get('removed'):
   url=urllib.parse.urlparse(stack['actions']['remove']);assert url.netloc=='localhost:18090' and url.path.rstrip('/')=='/v2-beta/'+base+'stacks/'+stack['id'] and url.query=='action=remove';code,_,_=u.request(stack['actions']['remove'],{},method='POST');assert code in (200,201,202,204)
  wait('stacks/'+stack['id'],lambda v:bool(v.get('removed')));wait('services/'+v['id'],lambda v:bool(v.get('removed')))
  assert snapshot([state['service']])==state['baseline'] and volumes()==state['baselineVolumes']
  REPORT.write_text(json.dumps({'fixture':state['name'],'stack':stack['id'],'service':v['id'],'status':'passed','preexistingServiceConfigurationsPreserved':True,'preexistingVolumesPreserved':True,'noPhysicalContainersScheduled':True},indent=2)+'\n',encoding='utf-8');STATE.unlink();print('PASS: exact config upgrade fixture removed and previous service configurations/volumes preserved',flush=True)
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
