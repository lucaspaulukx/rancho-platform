"""Real key/RBAC acceptance. Local fixtures only; credentials remain in process memory."""
import sys,importlib.util,json,urllib.request,urllib.parse,urllib.error,base64,time,secrets,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
STATE=ROOT/'console/api-keys-roles-fixture.json';REPORT=ROOT/'console/api-keys-roles-results.json'
recover=len(sys.argv)>1 and sys.argv[1]=='cleanup'
assert recover or not STATE.exists(), 'An existing fixture requires inspection first'
name='console-key-roles-'+secrets.token_hex(4);marker='Disposable API key RBAC '+name
state={'name':name,'marker':marker,'environment':'1a417','keys':[],'group':None};checks=[]
if recover:
 state=json.loads(STATE.read_text(encoding='utf-8'));name=state['name'];marker=state['marker'];assert name.startswith('console-key-roles-') and marker=='Disposable API key RBAC '+name
def save(): STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
def session():
 u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));return u
def check(label,ok=True):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def wait(read,ready):
 for i in range(60):
  v=read()
  if ready(v):return v
  time.sleep(.3)
 raise AssertionError('Native state did not converge')
def basic(key,path,method='GET',body=None):
 auth=base64.b64encode((key['publicValue']+':'+key['secretValue']).encode()).decode()
 req=urllib.request.Request('http://localhost:18090/v2-beta/'+path,data=None if body is None else json.dumps(body).encode(),headers={'Accept':'application/json','Content-Type':'application/json','Authorization':'Basic '+auth},method=method)
 try:r=urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=20)
 except urllib.error.HTTPError as e:r=e
 try:return r.status
 finally:r.close()
def key(u,scope,owner):
 path=('projects/1a417/' if scope=='environment' else '')+'apikeys'
 v=u.api(path,{'name':name+'-'+scope,'description':marker,**({'accountId':'1a417'} if scope=='environment' else {})})
 state['keys'].append({'id':v['id'],'accountId':v['accountId'],'scope':scope,'name':v['name']});save()
 assert v['accountId']==owner
 return v
def remove_group():
 if state['group']:
  g=next(v for v in admin.api('localGroups')['data'] if v['id']==state['group']['id'])
  assert g['name']==name
  admin.api('localGroups',{'id':g['id'],'name':g['name'],'revision':g['revision'],'delete':True});state['group']=None;save()
def cleanup():
 remove_group()
 for k in state['keys']:
  path='apikeys/'+k['id'];v=admin.api(path);assert v['name']==k['name'] and v['description']==marker and v['accountId']==k['accountId']
  if v.get('removed'):continue
  if v['state']=='active':
   target=urllib.parse.urlparse(v['actions']['deactivate']);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/'+path and target.query=='action=deactivate'
   code,_,_=admin.request(v['actions']['deactivate'],{},method='POST');assert code in (200,201,202)
   v=wait(lambda:admin.api(path),lambda x:x['state']=='inactive')
  assert v['state']=='inactive'
  admin.api(path,method='DELETE');wait(lambda:admin.api(path),lambda x:bool(x.get('removed')))
 STATE.unlink()
admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);failure=None;save()
if recover:
 cleanup();print('PASS: recovered exact RBAC fixture cleanup',flush=True);raise SystemExit(0)
try:
 project=admin.api('projects/1a417');assert project['name']=='CONSOLE-POLICY-LAB' and not project.get('removed')
 group=admin.api('localGroups',{'name':name,'members':['10'],'grants':{'417':'readonly'}});state['group']={'id':group['id']};save()
 reader=session();token,_=reader.oidc('leitor');assert token['accountId']=='1a10'
 check('reader OIDC identity and isolated readonly group verified')
 personal=key(reader,'accounts','1a10')
 target='projects/1a417/stacks?limit=1'
 wait(lambda:basic(personal,target),lambda status:status==200)
 check('personal key inherits real readonly environment access')
 contract=reader.api('projects/1a417/schemas/apiKey')
 check('readonly project schema forbids key creation','POST' not in contract.get('collectionMethods',[]))
 code,value,_=reader.request('/v2-beta/projects/1a417/apikeys',{'name':name+'-denied','description':marker,'accountId':'1a417'},method='POST')
 if code in (200,201,202) and isinstance(value,dict) and value.get('id'):
  state['keys'].append({'id':value['id'],'accountId':value['accountId'],'scope':'environment','name':value['name']});save()
 check('readonly direct POST cannot mint privileged shared key',code in (403,404,405))
 check('readonly personal key cannot create workload',basic(personal,'projects/1a417/stacks','POST',{'name':name+'-denied-workload'}) in (403,404,405))
 shared=key(admin,'environment','1a417');wait(lambda:basic(shared,target),lambda status:status==200)
 check('shared project key has independently authenticated project access')
 remove_group()
 wait(lambda:basic(personal,target),lambda status:status in (403,404))
 check('revoking local group denies existing personal key project access')
 check('shared project key remains independent of removed user membership',basic(shared,target)==200)
finally:
 try:
  cleanup();check('temporary group and exact fixture keys cleaned up')
 finally:REPORT.write_text(json.dumps({'fixture':name,'checks':checks,'secretsWrittenToArtifacts':False},indent=2)+'\n',encoding='utf-8')
