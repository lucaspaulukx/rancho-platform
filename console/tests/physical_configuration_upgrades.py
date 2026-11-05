"""One owned service; verify physical memory and security upgrade/rollback."""
import hashlib, importlib.util, json, re, secrets, time, urllib.request
from pathlib import Path
from legacy_guest import run_guest
ROOT=Path(__file__).resolve().parents[2];MANIFEST=ROOT/'console/physical-config-upgrade-fixture.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);BASE='projects/1a12/'
assert not MANIFEST.exists(), 'Recover previous owned healthcheck fixture first'
outcome='failed';checks=[];stack=None;service=None;name='console-physical-config-'+secrets.token_hex(6)
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
def wait_service(expected):
 for _ in range(150):
  current=u.api(BASE+'services/'+service['id'])
  if current['state']==expected:return current
  time.sleep(1)
 raise AssertionError('Owned configuration upgrade state timeout')
def running(previous=None):
 for _ in range(140):
  found=[v for v in rows('services/'+service['id']+'/instances') if v['state']=='running' and v.get('externalId') and v['externalId']!=previous]
  if len(found)==1:return found[0]
  time.sleep(1)
 raise AssertionError('Owned upgraded container did not start')
def inspect_fields(instance,memory,reservation,readonly,added,dropped):
 did=instance['externalId'];assert re.fullmatch('[a-f0-9]{64}',did)
 fmt='FIXTURE_STATUS:memory={{.HostConfig.Memory}} reservation={{.HostConfig.MemoryReservation}} readonly={{.HostConfig.ReadonlyRootfs}} privileged={{.HostConfig.Privileged}} add={{range .HostConfig.CapAdd}}{{.}} {{end}} drop={{range .HostConfig.CapDrop}}{{.}} {{end}}'
 result=run_guest("sudo docker inspect --format '"+fmt+"' "+did)
 raw=' '.join(result.get('status',[]));assert result.get('exitCode')==0
 assert ('memory='+str(memory)+' reservation='+str(reservation)+' readonly='+str(readonly).lower()+' privileged=false') in raw
 actual_add=raw.split(' add=',1)[1].split(' drop=',1)[0].split();actual_drop=raw.split(' drop=',1)[1].split()
 assert set(actual_add)==set(added) and set(actual_drop)==set(dropped)
def owned():
 current=u.api(BASE+'services/'+service['id']);assert current['stackId']==stack['id'] and current['description']==name and current['accountId']=='1a12';return current
def upgrade(patch):
 current=owned();schema=u.api(BASE+'schemas/launchConfig');launch={k:v for k,v in current['launchConfig'].items() if schema['resourceFields'].get(k,{}).get('create') and v is not None};launch.update(patch)
 code,_,_=u.request(current['actions']['upgrade'],{'inServiceStrategy':{'batchSize':1,'intervalMillis':100,'startFirst':False,'launchConfig':launch}},'POST');assert code in (200,201,202)
 wait_service('upgraded')
try:
 infra=[v for v in rows('services') if v.get('system')];check('native infrastructure ready',len(infra)==6 and all(v['state']=='active' and v['healthState']=='healthy' for v in infra))
 save();stack=u.api(BASE+'stacks',{'name':name,'description':name});state['stack']=stack['id'];save()
 service=u.api(BASE+'services',{'name':'config-worker','description':name,'stackId':stack['id'],'scale':1,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','requestedHostId':'1h1','networkMode':'none','command':['/bin/sh','-c','exec sleep 86400'],'memory':134217728,'memoryReservation':67108864,'readOnly':True,'privileged':False,'capAdd':['NET_BIND_SERVICE'],'capDrop':['ALL']}});state['service']=service['id'];save()
 first=running();wait_service('active');inspect_fields(first,134217728,67108864,True,['NET_BIND_SERVICE'],['ALL']);check('initial physical memory and security applied')
 upgrade({'memory':201326592,'memoryReservation':100663296});second=running(first['externalId']);inspect_fields(second,201326592,100663296,True,['NET_BIND_SERVICE'],['ALL']);check('same-image memory upgrade applied physically and preserves security')
 action(owned(),'rollback');wait_service('active');rolled=running(second['externalId']);inspect_fields(rolled,134217728,67108864,True,['NET_BIND_SERVICE'],['ALL']);check('rollback restores physical memory reservation and security')
 upgrade({'capAdd':[],'capDrop':[],'readOnly':False,'privileged':False});relaxed=running(rolled['externalId']);inspect_fields(relaxed,134217728,67108864,False,[],[]);check('security upgrade clears physical capability overrides and rootfs readonly')
 action(owned(),'finishupgrade');wait_service('active');inspect_fields(running(),134217728,67108864,False,[],[]);check('finished upgrade retains physical security and memory state')
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
 (ROOT/'console/physical-config-upgrade-results.json').write_text(json.dumps({'status':outcome,'checks':checks,'scope':'one host same-image memory upgrade and rollback; security reset and finish; no privileged execution or OOM'},indent=2),encoding='utf-8')
 if MANIFEST.exists():MANIFEST.unlink()
