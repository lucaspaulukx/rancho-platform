"""Exact zero-scale/stopped fixtures. Configuration acceptance only, no mount/traffic claim."""
import importlib.util,json,sys,time,secrets,urllib.request,urllib.parse,traceback,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/workload-bindings-fixture.json';REPORT=ROOT/'console/workload-bindings-test-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies));user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);base='projects/1a12/'
checks=json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else []
def check(name,ok):
 assert ok,name
 checks[:]=[v for v in checks if v['check']!=name];checks.append({'check':name,'status':'passed'});REPORT.write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8');print('PASS: '+name,flush=True)
def wait(read,ready):
 end=time.monotonic()+120
 while time.monotonic()<end:
  value=read()
  if ready(value):return value
  time.sleep(1)
 raise TimeoutError('Binding fixture did not stabilize')
def collection(path):
 rows=[]
 while path:
  page=user.api(path);rows+=page['data'];path=(page.get('pagination') or {}).get('next')
  if path:
   u=urllib.parse.urlparse(path);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base);path=u.path.removeprefix('/v2-beta/')+('?' +u.query if u.query else '')
 return rows
def volumes():return sorted(v['id'] for v in collection(base+'volumes?limit=100') if not v.get('removed'))
def payload(state,kind):
 data={**state,'kind':kind,'schemas':{s['id']:s for s in collection(base+'schemas')}}
 result=subprocess.run(['node',str(ROOT/'console/tests/workload_bindings_payload.cjs')],input=json.dumps(data),capture_output=True,text=True,encoding='utf-8');assert result.returncode==0,result.stderr
 return json.loads(result.stdout)
def cleanup(state):
 stack=user.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
 for kind in ['container','service']:
  if kind not in state:continue
  value=user.api(base+kind+'s/'+state[kind]);assert value['name']==state['name']+'-'+kind and value['description']==state['marker'] and value['accountId']=='1a12' and value['stackId']==stack['id']
  if not value.get('removed'):
   u=urllib.parse.urlparse(value['actions']['remove']);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
   status,_,_=user.request(value['actions']['remove'],{});assert status in (200,201,202,204)
  wait(lambda:user.api(base+kind+'s/'+value['id']),lambda v:bool(v.get('removed')))
 if not stack.get('removed'):
  u=urllib.parse.urlparse(stack['actions']['remove']);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
  status,_,_=user.request(stack['actions']['remove'],{});assert status in (200,201,202,204)
 wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:bool(v.get('removed')))
 check('exact binding fixture resources removed',True);check('preexisting volume inventory preserved and no named volume instantiated',volumes()==state['baselineVolumes']);STATE.unlink()
try:
 mode=sys.argv[1]
 if mode=='run':
  assert not STATE.exists();name='console-bindings-'+secrets.token_hex(4);marker='Disposable workload bindings '+name
  previous=volumes();stack=user.api(base+'stacks',{'name':name,'description':marker})
  state={'environment':'1a12','name':name,'marker':marker,'stack':stack['id'],'baselineVolumes':previous};STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8');wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:v['state']=='active')
  for kind in ['service','container']:
   expected=payload(state,kind);value=user.api(base+kind+'s',expected);state[kind]=value['id'];STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
   value=wait(lambda:user.api(base+kind+'s/'+value['id']),lambda v:v['state'] in ('inactive','stopped','error'))
   native=value['launchConfig'] if kind=='service' else value;target=expected['launchConfig'] if kind=='service' else expected
   check(kind+' preserves structured TCP UDP and IPv4 ports',native.get('ports')==target['ports'])
   check(kind+' preserves volume sources targets and access modes',native.get('dataVolumes')==target['dataVolumes'])
   check(kind+' stays inactive zero-scale or stopped',value['state']==('inactive' if kind=='service' else 'stopped') and (value.get('scale')==0 if kind=='service' else True))
  reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
  for kind in ['service','container']:
   status,_,_=reader.request('/v2-beta/'+base+kind+'s',payload(state,kind));check('user without environment cannot create binding '+kind,status in (403,404))
  print(json.dumps({k:v for k,v in state.items() if k!='baselineVolumes'}),flush=True)
 elif mode=='cleanup':cleanup(json.loads(STATE.read_text(encoding='utf-8')))
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
