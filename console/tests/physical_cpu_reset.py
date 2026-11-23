"""One owned service; physical CPU reset rollback finish preserving memory/security."""
import hashlib, importlib.util, json, re, secrets, time, urllib.request
from pathlib import Path
from legacy_guest import run_guest
ROOT=Path(__file__).resolve().parents[2];MANIFEST=ROOT/'console/physical-cpu-reset-fixture.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18080'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);BASE='projects/1a12/'
assert not MANIFEST.exists(), 'Recover previous owned CPU upgrade fixture first'
outcome='failed';checks=[];stack=None;service=None;name='console-physical-cpu-reset-'+secrets.token_hex(6)
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
def inspect_fields(instance,shares,quota,cpuset,blkio,reset=False):
 did=instance['externalId'];assert re.fullmatch('[a-f0-9]{64}',did)
 fmt='FIXTURE_STATUS:shares={{.HostConfig.CpuShares}} period={{.HostConfig.CpuPeriod}} quota={{.HostConfig.CpuQuota}} cpuset={{.HostConfig.CpusetCpus}} blkio={{.HostConfig.BlkioWeight}} memory={{.HostConfig.Memory}} readonly={{.HostConfig.ReadonlyRootfs}} privileged={{.HostConfig.Privileged}}'
 result=run_guest("sudo docker inspect --format '"+fmt+"' "+did);raw=' '.join(result.get('status',[]));assert result.get('exitCode')==0
 assert ('shares='+str(shares)+' period='+str(0 if reset else 100000)+' quota='+str(quota)+' cpuset='+cpuset+' blkio='+str(blkio)+' memory=134217728 readonly=true privileged=false') in raw
 import shlex
 script='for path in cpu/cpu.shares cpu/cpu.cfs_period_us cpu/cpu.cfs_quota_us cpuset/cpuset.cpus blkio/blkio.weight; do printf "FIXTURE_STATUS:%s=" "$path"; cat /sys/fs/cgroup/$path; done'
 kernel=run_guest('sudo docker exec '+did+' sh -c '+shlex.quote(script))
 assert kernel.get('exitCode')==0 and set(['FIXTURE_STATUS:cpu/cpu.shares='+str(shares),'FIXTURE_STATUS:cpu/cpu.cfs_period_us=100000','FIXTURE_STATUS:cpu/cpu.cfs_quota_us='+str(quota),'FIXTURE_STATUS:cpuset/cpuset.cpus='+(default_cpuset if reset else cpuset),'FIXTURE_STATUS:blkio/blkio.weight='+str(500 if reset else blkio)]).issubset(set(kernel.get('status',[])))

def owned():
 current=u.api(BASE+'services/'+service['id']);assert current['stackId']==stack['id'] and current['description']==name and current['accountId']=='1a12';return current
def upgrade(patch):
 current=owned();schema=u.api(BASE+'schemas/launchConfig');launch={k:v for k,v in current['launchConfig'].items() if schema['resourceFields'].get(k,{}).get('create') and v is not None};launch.update(patch)
 code,_,_=u.request(current['actions']['upgrade'],{'inServiceStrategy':{'batchSize':1,'intervalMillis':100,'startFirst':False,'launchConfig':launch}},'POST');assert code in (200,201,202)
 wait_service('upgraded')
try:
 infra=[v for v in rows('services') if v.get('system')];check('native infrastructure ready',len(infra)==6 and all(v['state']=='active' and v['healthState']=='healthy' for v in infra))
 defaults=run_guest("printf 'FIXTURE_STATUS:default-cpuset='; cat /sys/fs/cgroup/cpuset/cpuset.cpus");assert defaults.get('exitCode')==0
 default_cpuset=next(v.split('=',1)[1] for v in defaults.get('status',[]) if v.startswith('FIXTURE_STATUS:default-cpuset='));assert re.fullmatch(r'[0-9,-]+',default_cpuset)
 save();stack=u.api(BASE+'stacks',{'name':name,'description':name});state['stack']=stack['id'];save()
 service=u.api(BASE+'services',{'name':'cpu-worker','description':name,'stackId':stack['id'],'scale':1,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','requestedHostId':'1h1','networkMode':'none','command':['/bin/sh','-c','exec sleep 86400'],'memory':134217728,'readOnly':True,'privileged':False,'cpuShares':512,'milliCpuReservation':250,'cpuPeriod':100000,'cpuQuota':50000,'cpuSet':'0','blkioWeight':100}});state['service']=service['id'];save()
 first=running();wait_service('active');inspect_fields(first,256,50000,'0',100);check('initial CPU reservation precedence cgroups memory and security applied')
 patch={'cpuShares':0,'milliCpuReservation':0,'cpuPeriod':0,'cpuQuota':-1,'cpuSet':'','blkioWeight':0}
 upgrade(patch);second=running(first['externalId']);inspect_fields(second,2,-1,'',0,True);check('explicit CPU reset restores minimum shares unlimited quota inherited cpus and default IO physically')
 action(owned(),'rollback');wait_service('active');rolled=running(second['externalId']);inspect_fields(rolled,256,50000,'0',100);check('rollback restores CPU reservation precedence quota cpuset and IO physically')
 upgrade(patch);finished=running(rolled['externalId']);inspect_fields(finished,2,-1,'',0,True);action(owned(),'finishupgrade');wait_service('active');inspect_fields(running(),2,-1,'',0,True);check('finish retains reset defaults in cgroups and unchanged memory/security')
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
 (ROOT/'console/physical-cpu-reset-results.json').write_text(json.dumps({'status':outcome,'checks':checks,'scope':'one host CPU reset rollback finish: minimum shares default period unlimited quota inherited cpuset default IO; no throughput acceptance'},indent=2),encoding='utf-8')
 if MANIFEST.exists():MANIFEST.unlink()
