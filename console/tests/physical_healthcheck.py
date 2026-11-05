"""Controlled HTTP404 on one owned service; never changes existing workloads."""
import hashlib, importlib.util, json, re, secrets, time, urllib.request
from pathlib import Path
from legacy_guest import run_guest
ROOT=Path(__file__).resolve().parents[2];MANIFEST=ROOT/'console/physical-healthcheck-fixture.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);BASE='projects/1a12/'
assert not MANIFEST.exists(), 'Recover previous owned healthcheck fixture first'
outcome='failed';checks=[];stack=None;service=None;name='console-physical-health-'+secrets.token_hex(6)
def check(label,condition=True):
 assert condition,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def rows(path):return [v for v in u.api(BASE+path+'?limit=-1')['data'] if not v.get('removed')]
def snapshot(exclude=()):return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for v in rows('services') if v['id'] not in exclude}
before=snapshot();containers={v['id'] for v in rows('containers')};volumes={v['id'] for v in rows('volumes')}
state={'name':name,'marker':name,'baseline':before,'containers':sorted(containers),'volumes':sorted(volumes)}
def save():MANIFEST.write_text(json.dumps(state,indent=2),encoding='utf-8')
def action(value,key):
 code,_,_=u.request(value['actions'][key],{},'POST');assert code in (200,201,202,204)
def healthy(previous=None):
 for _ in range(100):
  instances=rows('services/'+service['id']+'/instances')
  found=[v for v in instances if v['state']=='running' and v.get('healthState')=='healthy' and v.get('externalId') and v['externalId']!=previous]
  if len(found)==1:return found[0]
  time.sleep(1)
 raise AssertionError('Owned healthcheck service did not recover')
try:
 infra=[v for v in rows('services') if v.get('system')];check('native infrastructure ready',len(infra)==6 and all(v['state']=='active' and v['healthState']=='healthy' for v in infra))
 save();stack=u.api(BASE+'stacks',{'name':name,'description':name});state['stack']=stack['id'];save()
 service=u.api(BASE+'services',{'name':'health-web','description':name,'stackId':stack['id'],'scale':1,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:busybox:1.36.1','networkMode':'managed','command':['/bin/sh','-c','mkdir -p /www; echo ready > /www/health; exec httpd -f -p 8080 -h /www'],'healthCheck':{'port':8080,'requestLine':'GET "/health" "HTTP/1.0"','interval':1000,'responseTimeout':1000,'healthyThreshold':1,'unhealthyThreshold':2,'initializingTimeout':60000,'reinitializingTimeout':60000,'strategy':'recreate'}}});state['service']=service['id'];save()
 first=healthy();check('HTTP service reaches healthy on original host',first['hostId']=='1h1')
 did=first['externalId'];assert re.fullmatch('[a-f0-9]{64}',did)
 result=run_guest('sudo docker exec '+did+' rm /www/health && echo FIXTURE_STATUS:owned-health-endpoint-removed')
 check('only own HTTP endpoint was removed',result.get('exitCode')==0 and 'FIXTURE_STATUS:owned-health-endpoint-removed' in result.get('status',[]))
 recovered=healthy(did);check('native recreate replaces failed instance and recovers healthy',recovered['externalId']!=did and recovered['hostId']=='1h1')
 outcome='passed'
except Exception as error:
 checks.append({'check':'physical execution','status':'failed','errorType':type(error).__name__})
 raise
finally:
 if stack:
  current=u.api(BASE+'stacks/'+stack['id']);assert current['name']==name and current['description']==name and current['accountId']=='1a12'
  if not current.get('removed'):action(current,'remove')
  for _ in range(100):
   current=u.api(BASE+'stacks/'+stack['id'])
   if current.get('removed') and not [v for v in rows('containers') if v['id'] not in containers]:break
   time.sleep(1)
  check('owned stack and physical containers removed',bool(current.get('removed')) and {v['id'] for v in rows('containers')}==containers)
 check('previous configurations and volumes preserved',snapshot()==before and {v['id'] for v in rows('volumes')}==volumes)
 (ROOT/'console/physical-healthcheck-results.json').write_text(json.dumps({'status':outcome,'checks':checks,'scope':'one host HTTP recreate; no multi-host quorum'},indent=2),encoding='utf-8')
 if MANIFEST.exists():MANIFEST.unlink()
