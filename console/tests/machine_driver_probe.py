"""Native inactive custom-driver contract; exact fixtures only, no binary activation."""
import importlib.util,urllib.request,json,secrets,time,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(s);s.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
name='consolefixture'+secrets.token_hex(5);state=ROOT/'console/machine-driver-probe-fixture.json';report={};resume=json.loads(state.read_text(encoding='utf-8')) if state.exists() else None
if resume:name=resume['name']
def fingerprint(row):return hashlib.sha256(json.dumps({k:row.get(k) for k in ['id','name','state','builtin','url','uiUrl','checksum','description','externalId']},sort_keys=True).encode()).hexdigest()
baseline=resume['baseline'] if resume else {v['id']:fingerprint(v) for v in u.api('machinedrivers?limit=100')['data']};state.write_text(json.dumps({'name':name,'baseline':baseline}),encoding='utf-8')
try:
 row=u.api('machinedrivers/'+resume['id']) if resume else u.api('machinedrivers',{'url':'http://127.0.0.1:9/docker-machine-driver-'+name,'activateOnCreate':False,'description':name});driver_id=row['id'];state.write_text(json.dumps({'name':name,'id':driver_id,'baseline':baseline}),encoding='utf-8')
 for _ in range(30):
  row=u.api('machinedrivers/'+driver_id)
  if row['state'] in ('inactive','error'):break
  time.sleep(.2)
 assert row['state'] in ('inactive','error') and row['name']==name and not row['builtin'];report['createRequestedInactive']=True;report['registrationState']=row['state']
 row=u.api('machinedrivers/'+driver_id,{'url':row['url'],'checksum':'','uiUrl':'','description':name+' edited'},method='PUT')
 for _ in range(30):
  row=u.api('machinedrivers/'+driver_id)
  if row['state'] in ('inactive','error') and row['description']==name+' edited':break
  time.sleep(.2)
 assert row['description']==name+' edited' and row['state'] in ('inactive','error');report['metadataUpdate']=True
 reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
 for method,path,body in [('GET','/v2-beta/machinedrivers',None),('POST','/v2-beta/machinedrivers',{'url':'http://127.0.0.1:9/docker-machine-driver-'+name+'denied','activateOnCreate':False}),('PUT','/v2-beta/machinedrivers/'+driver_id,{'url':row['url'],'description':'forbidden'}),('DELETE','/v2-beta/machinedrivers/'+driver_id,None)]:
  status,_,_=reader.request(path,body,method=method);report[method+'Status']=status;assert status==200 if method=='GET' else status in (401,403,404,405)
finally:
 rows=u.api('machinedrivers?limit=100')['data']
 for row in rows:
  if row.get('name')!=name:continue
  assert row.get('url')=='http://127.0.0.1:9/docker-machine-driver-'+name and row.get('builtin') is False and row.get('state') in ('inactive','error')
  u.api('machinedrivers/'+row['id'],expected=(200,202,204),method='DELETE')
 for _ in range(30):
  rows=u.api('machinedrivers?limit=100')['data']
  if not any(v.get('name')==name for v in rows):break
  time.sleep(.2)
 assert not any(v.get('name')==name for v in rows)
 assert {v['id']:fingerprint(v) for v in rows}==baseline
 report.update({'fixtureRemoved':True,'previousDriversPreserved':len(baseline),'externalEndpoint':'localhost closed port only','providerActivationRequested':False});(ROOT/'console/machine-driver-contract-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');state.unlink();print(json.dumps(report))
