"""Exact inert setting fixture; stores hashes, never configuration values."""
import importlib.util,json,urllib.request,secrets,sys,hashlib,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/settings-fixture.json';REPORT=ROOT/'console/settings-cleanup-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
def digest(v):return hashlib.sha256(json.dumps({k:v.get(k) for k in ['name','value','activeValue','source','inDb']},sort_keys=True).encode()).hexdigest()
def snapshot(exclude=None):return {v['name']:digest(v) for v in u.api('settings?limit=10000')['data'] if v['name']!=exclude}
def wait(read,ready):
 for _ in range(40):
  v=read()
  if ready(v):return v
  time.sleep(.3)
 raise AssertionError('Setting state did not converge')
try:
 mode=sys.argv[1]
 if mode=='seed':
  assert not STATE.exists();name='console.lab.fixture.'+secrets.token_hex(5);baseline=snapshot();assert name not in baseline
  state={'name':name,'baseline':baseline,'value':'preview-only\nfixture-initial','updatedValue':'preview-only\nfixture-updated'};STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  v=u.api('settings',{'name':name,'value':state['value']});assert v['name']==name
  wait(lambda:u.api('settings/'+name),lambda v:v.get('inDb') and v.get('activeValue')==state['value']);print(json.dumps({'name':name,'preexistingSettings':len(baseline)}),flush=True)
 elif mode=='cleanup':
  state=json.loads(STATE.read_text(encoding='utf-8'));name=state['name'];assert name.startswith('console.lab.fixture.') and name not in state['baseline']
  v=u.api('settings/'+name);assert v['name']==name
  if v.get('inDb'):
   assert v.get('value') in [state['value'],state['updatedValue']];u.api('settings/'+name,method='DELETE')
  wait(lambda:u.api('settings/'+name),lambda v:not v.get('inDb') and v.get('activeValue') is None)
  assert snapshot(name)==state['baseline']
  REPORT.write_text(json.dumps({'name':name,'status':'passed','preexistingSettingsPreserved':True,'secretsWrittenToArtifacts':False},indent=2)+'\n',encoding='utf-8');STATE.unlink();print('PASS: fixture override removed and all preexisting settings preserved',flush=True)
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
