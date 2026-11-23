"""Disposable credential process; never replay existing workloads."""
import importlib.util,json,urllib.request,urllib.parse,secrets,sys,time,traceback,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/process-fixture.json';REPORT=ROOT/'console/process-cleanup-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
def wait(read,ready):
 for _ in range(90):
  v=read()
  if ready(v):return v
  time.sleep(.3)
 raise AssertionError('Native fixture did not stabilize')
def signature(v):return hashlib.sha256(json.dumps({k:v.get(k) for k in ['id','name','description','accountId','state','publicValue']},sort_keys=True).encode()).hexdigest()
try:
 mode=sys.argv[1]
 if mode=='seed':
  assert not STATE.exists();name='console-process-'+secrets.token_hex(4);state={'name':name,'marker':'Disposable process acceptance '+name,'key':None,'process':None}
  def save():STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  save();created=u.api('apikeys',{'name':name,'description':state['marker']});state['key']=created['id'];created=None;save()
  key=wait(lambda:u.api('apikeys/'+state['key']),lambda v:v['state']=='active')
  target=urllib.parse.urlparse(key['actions']['deactivate']);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/apikeys/'+state['key'] and target.query=='action=deactivate'
  code,_,_=u.request(key['actions']['deactivate'],{},method='POST');assert code in (200,201,202)
  wait(lambda:u.api('apikeys/'+state['key']),lambda v:v['state']=='inactive')
  u.api('apikeys/'+state['key'],{'name':name,'description':state['marker']+' updated'},method='PUT')
  def process():
   return next((v for v in u.api('processinstances?resourceId='+state['key']+'&limit=100&sort=id&order=desc')['data'] if v.get('processName')=='credential.deactivate' and v.get('endTime')),None)
  pi=wait(process,bool);assert pi['resourceId']==state['key'] and pi['resourceType']=='credential' and pi.get('actions',{}).get('replay')
  state['process']=pi['id'];state['executionCount']=pi.get('executionCount');state['resourceSignature']=signature(u.api('apikeys/'+state['key']));save();print(json.dumps({k:state[k] for k in ['name','key','process','executionCount']}),flush=True)
 elif mode=='resume':
  state=json.loads(STATE.read_text(encoding='utf-8'));assert state['name'].startswith('console-process-') and state['marker']=='Disposable process acceptance '+state['name'];key=u.api('apikeys/'+state['key'])
  assert key['name']==state['name'] and key['description']==state['marker']+' updated' and key['accountId']=='1a1' and key['state']=='inactive'
  pi=next(v for v in u.api('processinstances?resourceId='+state['key']+'&limit=100&sort=id&order=desc')['data'] if v.get('processName')=='credential.deactivate' and v.get('endTime'))
  assert pi['resourceId']==state['key'] and pi['resourceType']=='credential' and pi.get('actions',{}).get('replay');state['process']=pi['id'];state['executionCount']=pi.get('executionCount');state['resourceSignature']=signature(key);STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:state[k] for k in ['name','key','process','executionCount']}),flush=True)
 elif mode=='cleanup':
  state=json.loads(STATE.read_text(encoding='utf-8'));assert state['name'].startswith('console-process-') and state['marker']=='Disposable process acceptance '+state['name'];key=u.api('apikeys/'+state['key'])
  assert key['name']==state['name'] and key['description'] in [state['marker'],state['marker']+' updated'] and key['accountId']=='1a1'
  if state.get('resourceSignature'):assert signature(key)==state['resourceSignature']
  if key['state']=='active':
   target=urllib.parse.urlparse(key['actions']['deactivate']);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/apikeys/'+state['key'] and target.query=='action=deactivate'
   code,_,_=u.request(key['actions']['deactivate'],{},method='POST');assert code in (200,201,202);key=wait(lambda:u.api('apikeys/'+state['key']),lambda v:v['state']=='inactive')
  if not key.get('removed'):
   assert key['state']=='inactive';u.api('apikeys/'+state['key'],method='DELETE');wait(lambda:u.api('apikeys/'+state['key']),lambda v:bool(v.get('removed')))
  REPORT.write_text(json.dumps({'fixture':state['name'],'keyId':state['key'],'processId':state['process'],'status':'passed','replayResourceMetadataPreserved':bool(state.get('resourceSignature')),'secretsWrittenToArtifacts':False},indent=2)+'\n',encoding='utf-8');STATE.unlink();print('PASS: exact process fixture revoked; resource metadata preserved',flush=True)
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
