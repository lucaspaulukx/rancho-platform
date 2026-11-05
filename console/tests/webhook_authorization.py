"""Native webhook authorization probe. URLs are never invoked or stored."""
import importlib.util,json,urllib.request,urllib.parse,secrets,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/webhook-role-fixture.json';REPORT=ROOT/'console/webhook-authorization-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090';base='projects/1a417/'
def session():
 u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));return u
admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);assert not STATE.exists();assert admin.api('projects/1a417')['name']=='CONSOLE-POLICY-LAB';name='console-webhook-role-'+secrets.token_hex(4);state={'name':name,'group':None,'stack':None,'service':None};report={'fixture':name,'invocationNeverCalled':True,'secretsWrittenToArtifacts':False}
def save():STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
def payload(suffix):return {'name':name+suffix,'driver':'scaleService','scaleServiceConfig':{'type':'scaleService','serviceId':state['service'],'action':'up','amount':1,'min':1,'max':2}}
def wait(path,ready):
 for _ in range(90):
  v=admin.api(base+path)
  if ready(v):return v
  time.sleep(.5)
 raise AssertionError('Native fixture did not stabilize')
save()
try:
 stack=admin.api(base+'stacks',{'name':name,'description':'Disposable webhook RBAC '+name});state['stack']=stack['id'];save()
 v=admin.api(base+'services',{'name':'webhook-role-target','description':name,'stackId':stack['id'],'scale':0,'startOnCreate':False,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'managed'}});state['service']=v['id'];save();wait('services/'+v['id'],lambda v:v['state']=='inactive')
 group=admin.api('localGroups',{'name':name,'members':['10'],'grants':{'417':'readonly'}});state['group']=group['id'];save()
 reader=session();token,_=reader.oidc('leitor');assert token['accountId']=='1a10';assert reader.api(base+'services/'+state['service'])['id']==state['service']
 code,hook,_=admin.request('/v1-webhooks/receivers?projectId=1a417',payload('-admin'),method='POST');assert code==200 and hook.get('id')
 code,schemas,_=reader.request('/v1-webhooks/schemas?projectId=1a417');assert code==200;receiver_schema=next(v for v in schemas['data'] if v['id']=='receiver');report['readonlyCollectionMethods']=receiver_schema.get('collectionMethods');report['readonlyResourceMethods']=receiver_schema.get('resourceMethods')
 code,single,_=reader.request('/v1-webhooks/receivers/'+urllib.parse.quote(hook['id'],safe='')+'?projectId=1a417');report['readonlySingleStatus']=code;report['readonlySingleHasInvocationUrl']=code==200 and bool(single.get('url'))
 code,body,_=reader.request('/v1-webhooks/receivers?projectId=1a417');report['readonlyListStatus']=code;report['readonlyReceivesInvocationUrl']=code==200 and any(v.get('name')==name+'-admin' and v.get('url') for v in body.get('data',[]))
 code,body,_=reader.request('/v1-webhooks/receivers?projectId=1a417',payload('-readonly'),method='POST');report['readonlyCreateStatus']=code;report['readonlyCreatesReceiver']=code in (200,201,202) and bool(body.get('id'))
 code,body,_=reader.request('/v1-webhooks/receivers?projectId=1a12',payload('-outside'),method='POST');report['withoutEnvironmentCreateStatus']=code;report['withoutEnvironmentCreatesReceiver']=code in (200,201,202) and bool(body.get('id'))
 code,_,_=reader.request('/v1-webhooks/receivers/'+urllib.parse.quote(hook['id'],safe='')+'?projectId=1a417',method='DELETE');report['readonlyDeleteStatus']=code;report['readonlyDeletesReceiver']=code in (200,202,204)
finally:
 for project in ['1a417','1a12']:
  code,page,_=admin.request('/v1-webhooks/receivers?projectId='+project);assert code==200
  for row in page.get('data',[]):
   if row.get('name') not in [name+'-admin',name+'-readonly',name+'-outside']:continue
   assert row.get('driver')=='scaleService' and row.get('scaleServiceConfig',{}).get('serviceId')==state['service']
   code,_,_=admin.request('/v1-webhooks/receivers/'+urllib.parse.quote(row['id'],safe='')+'?projectId='+project,method='DELETE');assert code in (200,202,204)
 if state['group']:
  g=next(v for v in admin.api('localGroups')['data'] if v['id']==state['group']);assert g['name']==name;admin.api('localGroups',{'id':g['id'],'name':g['name'],'revision':g['revision'],'delete':True})
 if state['stack']:
  stack=admin.api(base+'stacks/'+state['stack']);assert stack['name']==name and stack['description']=='Disposable webhook RBAC '+name
  if not stack.get('removed'):
   target=urllib.parse.urlparse(stack['actions']['remove']);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/'+base+'stacks/'+stack['id'] and target.query=='action=remove';code,_,_=admin.request(stack['actions']['remove'],{},method='POST');assert code in (200,201,202,204)
  wait('stacks/'+stack['id'],lambda v:bool(v.get('removed')))
  if state['service']:wait('services/'+state['service'],lambda v:bool(v.get('removed')))
 report['exactFixtureCleanup']='passed';REPORT.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');STATE.unlink();print(json.dumps(report),flush=True)
assert not any(report.get(k) for k in ['readonlySingleHasInvocationUrl','readonlyReceivesInvocationUrl','readonlyCreatesReceiver','withoutEnvironmentCreatesReceiver','readonlyDeletesReceiver']), 'Native webhook authorization requires hardening before UI enablement'
