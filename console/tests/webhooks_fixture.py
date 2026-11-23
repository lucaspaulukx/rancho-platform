"""Disposable native webhook targets and exact receiver cleanup; never store invocation URLs."""
import importlib.util,json,urllib.request,urllib.parse,secrets,sys,time,traceback,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/webhooks-fixture.json';REPORT=ROOT/'console/webhooks-cleanup-results.json';base='projects/1a12/'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
def wait(path,ready):
 for _ in range(90):
  v=u.api(base+path)
  if ready(v):return v
  time.sleep(.5)
 raise AssertionError('Webhook fixture did not stabilize')
def receivers():
 code,page,_=u.request('/v1-webhooks/receivers?projectId=1a12');assert code==200 and not page.get('pagination',{}).get('next');return page['data']
def digest(v):return hashlib.sha256(json.dumps({k:v.get(k) for k in ['id','name','driver','scaleServiceConfig','serviceUpgradeConfig','scaleHostConfig','forwardPostConfig','state']},sort_keys=True).encode()).hexdigest()
def snapshot(exclude=()):return {v['id']:digest(v) for v in receivers() if v['id'] not in exclude}
try:
 mode=sys.argv[1]
 if mode=='seed':
  assert not STATE.exists();name='console-webhooks-'+secrets.token_hex(4);state={'name':name,'marker':'Disposable native webhooks '+name,'environment':'1a12','baseline':snapshot(),'receivers':[],'stack':None,'service':None}
  def save():STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  save();stack=u.api(base+'stacks',{'name':name,'description':state['marker']});state['stack']=stack['id'];save();wait('stacks/'+stack['id'],lambda v:v['state']=='active')
  v=u.api(base+'services',{'name':'webhook-target','description':state['marker'],'stackId':stack['id'],'scale':0,'startOnCreate':False,'labels':{'console.webhook.fixture':name},'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'managed','labels':{'console.webhook.fixture':name}}});state['service']=v['id'];save();wait('services/'+v['id'],lambda v:v['state']=='inactive');print(json.dumps({k:state[k] for k in ['name','environment','stack','service']}),flush=True)
 elif mode=='cleanup':
  state=json.loads(STATE.read_text(encoding='utf-8'));assert state['name'].startswith('console-webhooks-') and state['marker']=='Disposable native webhooks '+state['name'];ids=[]
  allowed=[state['name']+'-'+v for v in ['scaleService','serviceUpgrade','scaleHost','clone']]
  for row in receivers():
   if row.get('name') not in allowed:continue
   if row['driver']=='scaleService':assert row['scaleServiceConfig']['serviceId']==state['service']
   elif row['driver']=='serviceUpgrade':assert row['serviceUpgradeConfig']['serviceSelector']=={'console.webhook.fixture':state['name']}
   elif row['driver']=='scaleHost':assert row['scaleHostConfig']['hostSelector']=={'console.webhook.fixture':state['name']}
   else:raise AssertionError('Unexpected driver in fixture')
   ids.append(row['id']);code,_,_=u.request('/v1-webhooks/receivers/'+urllib.parse.quote(row['id'],safe='')+'?projectId=1a12',method='DELETE');assert code in (200,202,204)
  assert snapshot()==state['baseline']
  stack=u.api(base+'stacks/'+state['stack']);service=u.api(base+'services/'+state['service']);assert stack['name']==state['name'] and stack['description']==state['marker'] and service['description']==state['marker'] and service['stackId']==stack['id'] and service['state']=='inactive' and service['scale']==0
  assert not [v for v in u.api(base+'services/'+service['id']+'/instances')['data'] if not v.get('removed')]
  if not stack.get('removed'):
   target=urllib.parse.urlparse(stack['actions']['remove']);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/'+base+'stacks/'+stack['id'] and target.query=='action=remove';code,_,_=u.request(stack['actions']['remove'],{},method='POST');assert code in (200,201,202,204)
  wait('stacks/'+stack['id'],lambda v:bool(v.get('removed')));wait('services/'+service['id'],lambda v:bool(v.get('removed')))
  REPORT.write_text(json.dumps({'fixture':state['name'],'createdReceiverIds':sorted(v['id'] for v in state['receivers']),'receiverIdsRemovedByCleanup':ids,'noFixtureReceiversRemain':True,'stack':stack['id'],'service':service['id'],'status':'passed','previousReceiversPreserved':True,'noEventDispatched':True,'targetKeptInactiveZeroScale':True,'secretsWrittenToArtifacts':False},indent=2)+'\n',encoding='utf-8');STATE.unlink();print('PASS: exact receivers and inactive target fixture removed, previous receivers preserved',flush=True)
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
