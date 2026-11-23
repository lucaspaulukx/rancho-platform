"""Inspect a disposable native receiver, never invoke its webhook URL."""
import importlib.util,json,urllib.request,urllib.parse,secrets,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/webhook-probe-fixture.json';REPORT=ROOT/'console/webhook-contract-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090';base='projects/1a12/'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
assert not STATE.exists();name='console-webhook-probe-'+secrets.token_hex(4);state={'name':name,'environment':'1a12','stack':None,'service':None};STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8');receiver=None
try:
 stack=u.api(base+'stacks',{'name':name,'description':'Disposable webhook contract '+name});state['stack']=stack['id'];STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
 service=u.api(base+'services',{'name':'webhook-target','description':name,'stackId':stack['id'],'scale':0,'startOnCreate':False,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'managed'}});state['service']=service['id'];STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
 for _ in range(90):
  current=u.api(base+'services/'+state['service'])
  if current.get('state')=='inactive':break
  time.sleep(.5)
 assert current.get('state')=='inactive'
 code,receiver,_=u.request('/v1-webhooks/receivers?projectId=1a12',{'name':name,'driver':'scaleService','scaleServiceConfig':{'type':'scaleService','serviceId':service['id'],'action':'up','amount':1,'min':1,'max':2}},method='POST');print(json.dumps({'createStatus':code,'responseFields':list(receiver) if isinstance(receiver,dict) else [],'errorTerms':[word for word in ['permission','unauthorized','forbidden','service','not found','invalid','project','token','connection','refused','CSRF','driver','authenticate','Failed'] if word.lower() in json.dumps(receiver).lower()]}),flush=True);assert code in (200,201,202) and receiver.get('id')
 parsed=urllib.parse.urlparse(receiver.get('url',''));report={'createStatus':code,'fieldNames':list(receiver),'idLength':len(receiver['id']),'invocationPathContainsId':receiver['id'] in parsed.path,'invocationQueryKeys':list(urllib.parse.parse_qs(parsed.query)),'queryContainsId':any(receiver['id']==v for vs in urllib.parse.parse_qs(parsed.query).values() for v in vs),'selfPathContainsId':receiver['id'] in urllib.parse.urlparse(receiver.get('links',{}).get('self','')).path,'invocationNeverCalled':True}
 REPORT.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report),flush=True)
finally:
 # Discover by the exact random fixture name after a failed create too; no bearer IDs in the manifest.
 code,page,_=u.request('/v1-webhooks/receivers?projectId=1a12');assert code==200
 for row in page.get('data',[]):
  if row.get('name')!=name:continue
  assert row.get('driver')=='scaleService' and row.get('scaleServiceConfig',{}).get('serviceId')==state['service']
  code,_,_=u.request('/v1-webhooks/receivers/'+urllib.parse.quote(row['id'],safe='')+'?projectId=1a12',method='DELETE');assert code in (200,202,204)
 if state['stack']:
  stack=u.api(base+'stacks/'+state['stack']);assert stack['name']==name and stack['description']=='Disposable webhook contract '+name
  if not stack.get('removed'):
   target=urllib.parse.urlparse(stack['actions']['remove']);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/'+base+'stacks/'+stack['id'] and target.query=='action=remove';code,_,_=u.request(stack['actions']['remove'],{},method='POST');assert code in (200,201,202,204)
  for _ in range(120):
   current=u.api(base+'stacks/'+stack['id'])
   if current.get('removed'):break
   time.sleep(.5)
  assert current.get('removed')
  if state['service']:assert u.api(base+'services/'+state['service']).get('removed')
 STATE.unlink();print('PASS: exact receiver and inert target fixture removed without invocation',flush=True)
