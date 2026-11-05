"""Metadata-only manifest and exact cleanup for disposable API key acceptance."""
import importlib.util,json,sys,time,secrets,urllib.request,urllib.parse,traceback,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/api-keys-fixture.json';REPORT=ROOT/'console/api-keys-cleanup-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies));token=user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
def collection(base,removed=False):
 rows=[];path=base+'apikeys?limit=100'+('&_removed=true&removed_notnull=true' if removed else '')
 while path:
  page=user.api(path);rows+=page['data'];path=(page.get('pagination') or {}).get('next')
  if path:
   u=urllib.parse.urlparse(path);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/');path=u.path.removeprefix('/v2-beta/')+('?' +u.query if u.query else '')
 return rows
def digest(row):return hashlib.sha256(json.dumps({k:row.get(k) for k in ['id','name','description','accountId','state','removed','publicValue']},sort_keys=True).encode()).hexdigest()
def snapshot(exclude=()):
 return {scope:{v['id']:digest(v) for v in collection(base)+collection(base,True) if v['id'] not in exclude} for scope,base in [('accounts',''),('environment','projects/1a12/')]}
def wait(read,ready):
 end=time.monotonic()+90
 while time.monotonic()<end:
  value=read()
  if ready(value):return value
  time.sleep(1)
 raise TimeoutError('API key cleanup did not stabilize')
try:
 mode=sys.argv[1]
 if mode=='seed':
  assert not STATE.exists();name='console-api-'+secrets.token_hex(4);state={'environment':'1a12','account':token['accountId'],'name':name,'marker':'Disposable API key acceptance '+name,'baseline':snapshot(),'keys':[]}
  STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in state.items() if k!='baseline'}),flush=True)
 elif mode=='cleanup':
  state=json.loads(STATE.read_text(encoding='utf-8'));assert state['environment']=='1a12' and state['marker']=='Disposable API key acceptance '+state['name']
  for scope,base in [('accounts',''),('environment','projects/1a12/')]:
   for row in collection(base)+collection(base,True):
    if row.get('name') in [state['name']+'-'+scope,state['name']+'-'+scope+'-edited'] and row.get('description')==state['marker'] and not any(v['id']==row['id'] for v in state['keys']):state['keys'].append({'id':row['id'],'name':row['name'],'accountId':row['accountId'],'scope':scope})
  STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
  for key in state['keys']:
   base='projects/1a12/' if key['scope']=='environment' else ''
   status,row,_=user.request('/v2-beta/'+base+'apikeys/'+key['id'])
   if status==404:continue
   assert status==200 and row['name'] in [state['name']+'-'+key['scope'],state['name']+'-'+key['scope']+'-edited'] and row['description']==state['marker'] and row['accountId']==key['accountId']
   if row.get('state')=='active':
    url=row['actions']['deactivate'];u=urllib.parse.urlparse(url);assert u.netloc=='localhost:18090' and u.path.rstrip('/') in ['/v2-beta/'+base+'apikeys/'+key['id'],'/v2-beta/apikeys/'+key['id']] and u.query=='action=deactivate'
    code,_,_=user.request(url,{},method='POST');assert code in (200,201,202)
    row=wait(lambda:user.api(base+'apikeys/'+key['id']),lambda v:v.get('state')=='inactive')
   if not row.get('removed'):
    url=row.get('actions',{}).get('remove') or row['links']['self'];u=urllib.parse.urlparse(url);assert u.netloc=='localhost:18090' and u.path.rstrip('/') in ['/v2-beta/'+base+'apikeys/'+key['id'],'/v2-beta/apikeys/'+key['id']] and u.query in ('','action=remove')
    code,_,_=user.request(url,{} if row.get('actions',{}).get('remove') else None,method='POST' if row.get('actions',{}).get('remove') else 'DELETE');assert code in (200,201,202,204)
   def gone():
    code,value,_=user.request('/v2-beta/'+base+'apikeys/'+key['id']);return code==404 or code==200 and bool(value.get('removed'))
   wait(gone,bool)
  ids={v['id'] for v in state['keys']};current=snapshot(ids);native_purges=[]
  for scope,base in [('accounts',''),('environment','projects/1a12/')]:
   assert current[scope].keys()==state['baseline'][scope].keys()
   for row in collection(base,True):
    key_id=row['id']
    if key_id in ids or key_id not in state['baseline'][scope]:continue
    if current[scope][key_id]!=state['baseline'][scope][key_id]:
     assert row.get('state')=='purged' and row.get('removed') and any(digest({**row,'state':native_state})==state['baseline'][scope][key_id] for native_state in ('removing','removed','purging'))
     current[scope][key_id]=state['baseline'][scope][key_id];native_purges.append(key_id)
  assert current==state['baseline']
  REPORT.write_text(json.dumps({'fixture':state['name'],'keyIds':sorted(ids),'status':'passed','preexistingKeysPreserved':True,'nativeRemovedToPurgedTransitions':native_purges,'secretsWrittenToArtifacts':False},indent=2)+'\n',encoding='utf-8');STATE.unlink();print('PASS: exact fixture keys revoked and preexisting keys preserved; no secrets stored',flush=True)
 else:raise ValueError('Unknown mode')
except Exception as error:
 print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
