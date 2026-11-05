"""One owned service; physical sidecar upgrade, rollback, addition and removal."""
import hashlib, importlib.util, json, re, secrets, time, urllib.request
from pathlib import Path
from legacy_guest import run_guest
ROOT=Path(__file__).resolve().parents[2];MANIFEST=ROOT/'console/physical-sidecar-upgrades-fixture.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);BASE='projects/1a12/'
assert not MANIFEST.exists(), 'Recover previous owned sidecar upgrade fixture first'
outcome='failed';checks=[];stack=None;service=None;name='console-physical-sidecar-upgrades-'+secrets.token_hex(6)
def check(label,condition=True):
 assert condition,label
 checks.append({'check':label,'status':'passed'});(ROOT/'console/physical-sidecar-upgrades-results.json').write_text(json.dumps({'status':'running','checks':checks},indent=2),encoding='utf-8');print('PASS: '+label,flush=True)
def rows(path):return [v for v in u.api(BASE+path+'?limit=-1')['data'] if not v.get('removed')]
def snapshot(exclude=()):return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for v in rows('services') if v['id'] not in exclude}
before=snapshot();containers={v['id'] for v in rows('containers')};volumes={v['id'] for v in rows('volumes')}
state={'name':name,'marker':name,'baseline':before,'containers':sorted(containers),'volumes':sorted(volumes)}
def save():MANIFEST.write_text(json.dumps(state,indent=2),encoding='utf-8')
def action(value,key):
 code,_,_=u.request(value['actions'][key],{},'POST');assert code in (200,201,202,204)
def running(count=2):
 for _ in range(300):
  instances=rows('services/'+service['id']+'/instances')
  found=[v for v in instances if v['state']=='running' and v.get('externalId')]
  if len(found)==count:return found
  time.sleep(1)
 raise AssertionError('Owned sidecar containers did not start')
def owned():
 current=u.api(BASE+'services/'+service['id']);assert current['stackId']==stack['id'] and current['description']==name and current['accountId']=='1a12';return current

def wait_service(expected):
 for _ in range(300):
  current=owned()
  if current['state']==expected:return current
  time.sleep(1)
 raise AssertionError('Owned sidecar upgrade state timeout')

def upgrade(sidecars):
 current=owned();schema=u.api(BASE+'schemas/launchConfig');launch={k:v for k,v in current['launchConfig'].items() if schema['resourceFields'].get(k,{}).get('create') and v is not None}
 code,_,_=u.request(current['actions']['upgrade'],{'inServiceStrategy':{'batchSize':1,'intervalMillis':100,'startFirst':False,'launchConfig':launch,'secondaryLaunchConfigs':sidecars}},'POST');assert code in (200,201,202)
 return wait_service('upgraded')

def verify(count,revision):
 instances=running(count);assert all(v['hostId']=='1h1' for v in instances)
 worker=next(v for v in instances if v.get('labels',{}).get('io.rancher.service.launch.config')=='worker')
 primary=next(v for v in instances if v.get('labels',{}).get('io.rancher.service.launch.config')!='worker' and v.get('labels',{}).get('io.rancher.service.launch.config')!='cache')
 wid=worker['externalId'];pid=primary['externalId'];assert re.fullmatch('[a-f0-9]{64}',wid) and re.fullmatch('[a-f0-9]{64}',pid)
 result=run_guest("sudo docker inspect --format 'FIXTURE_STATUS:network={{.HostConfig.NetworkMode}}' "+wid)
 assert result.get('exitCode')==0 and ('FIXTURE_STATUS:network=container:'+pid) in result.get('status',[])
 import shlex
 command='test "$(cat /share/marker)" = sidecar-verified && test "$(wget -qO- -T 5 http://127.0.0.1:8080/marker)" = sidecar-verified && test "$SIDECAR_REVISION" = '+revision+' && echo FIXTURE_STATUS:sidecar-upgrade-verified'
 result=run_guest('sudo docker exec '+wid+' sh -c '+shlex.quote(command))
 assert result.get('exitCode')==0 and 'FIXTURE_STATUS:sidecar-upgrade-verified' in result.get('status',[])
 return worker['externalId']

try:
 infra=[v for v in rows('services') if v.get('system')];check('native infrastructure ready',len(infra)==6 and all(v['state']=='active' and v['healthState']=='healthy' for v in infra))
 save();stack=u.api(BASE+'stacks',{'name':name,'description':name});state['stack']=stack['id'];save()
 service=u.api(BASE+'services',{'name':'web','description':name,'stackId':stack['id'],'scale':1,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:busybox:1.36.1','networkMode':'managed','dataVolumes':['/share'],'command':['/bin/sh','-c','mkdir -p /share; echo sidecar-verified > /share/marker; exec httpd -f -p 8080 -h /share']},'secondaryLaunchConfigs':[{'name':'worker','imageUuid':'docker:alpine:3.20','networkMode':'container','networkLaunchConfig':'web','dataVolumesFromLaunchConfigs':['web'],'environment':{'SIDECAR_REVISION':'one'},'command':['/bin/sh','-c','exec tail -f /dev/null']}]});state['service']=service['id'];save()
 wait_service('active');first=verify(2,'one');check('initial sidecar physically shares primary volume and network')
 worker={'name':'worker','imageUuid':'docker:alpine:3.20','networkMode':'container','networkLaunchConfig':'web','dataVolumesFromLaunchConfigs':['web'],'environment':{'SIDECAR_REVISION':'two'},'command':['/bin/sh','-c','exec tail -f /dev/null']}
 upgrade([worker]);second=verify(2,'two');check('same-image sidecar upgrade recreates worker and preserves real sharing',first!=second)
 action(owned(),'rollback');wait_service('active');rolled=verify(2,'one');check('rollback restores original sidecar revision and real sharing',rolled!=second)
 cache={'name':'cache','imageUuid':'docker:alpine:3.20','networkMode':'none','command':['/bin/sh','-c','exec tail -f /dev/null']}
 upgrade([worker,cache]);verify(3,'two');check('adding sidecar starts three physical containers with original sharing')
 action(owned(),'finishupgrade');wait_service('active');verify(3,'two');check('finish persists added sidecar and shared namespaces')
 upgrade([worker,{'name':'cache','imageUuid':'rancher/none'}]);verify(2,'two');check('native removal sentinel removes only selected sidecar physically')
 action(owned(),'finishupgrade');final=wait_service('active');verify(2,'two');check('finished removal retains worker and excludes removed sidecar', [v['name'] for v in final['secondaryLaunchConfigs']]==['worker'])
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
 (ROOT/'console/physical-sidecar-upgrades-results.json').write_text(json.dumps({'status':outcome,'checks':checks,'scope':'one owned service on original host; same-image sidecar revision rollback addition removal; actual shared network and anonymous volume'},indent=2),encoding='utf-8')
 if MANIFEST.exists():MANIFEST.unlink()
