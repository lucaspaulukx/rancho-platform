"""One owned service; inspect CPU CFS shares cpuset and block IO support."""
import hashlib, importlib.util, json, re, secrets, time, urllib.request, sys
from pathlib import Path
from legacy_guest import run_guest
ROOT=Path(__file__).resolve().parents[2];MANIFEST=ROOT/'console/physical-cpu-resources-fixture.json'
assert sys.argv[1:] in ([], ['--without-reservation']);reservation=0 if sys.argv[1:] else 250;expected_shares=512 if reservation==0 else 256;REPORT='physical-cpu-resources-without-reservation-results.json' if reservation==0 else 'physical-cpu-resources-results.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);BASE='projects/1a12/'
assert not MANIFEST.exists(), 'Recover previous owned CPU fixture first'
outcome='failed';checks=[];stack=None;service=None;name='console-physical-cpu-'+secrets.token_hex(6)
def check(label,condition=True):
 assert condition,label
 checks.append({'check':label,'status':'passed'});(ROOT/'console'/REPORT).write_text(json.dumps({'status':'running','checks':checks},indent=2),encoding='utf-8');print('PASS: '+label,flush=True)
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
 raise AssertionError('Owned CPU service state timeout')
def running(previous=None):
 for _ in range(140):
  found=[v for v in rows('services/'+service['id']+'/instances') if v['state']=='running' and v.get('externalId') and v['externalId']!=previous]
  if len(found)==1:return found[0]
  time.sleep(1)
 raise AssertionError('Owned CPU container did not start')
try:
 infra=[v for v in rows('services') if v.get('system')];check('native infrastructure ready',len(infra)==6 and all(v['state']=='active' and v['healthState']=='healthy' for v in infra))
 save();stack=u.api(BASE+'stacks',{'name':name,'description':name});state['stack']=stack['id'];save()
 service=u.api(BASE+'services',{'name':'cpu-worker','description':name,'stackId':stack['id'],'scale':1,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','requestedHostId':'1h1','networkMode':'none','command':['/bin/sh','-c','exec sleep 86400'],'cpuShares':512,'cpuPeriod':100000,'cpuQuota':50000,'cpuSet':'0','blkioWeight':100,'milliCpuReservation':reservation}});state['service']=service['id'];save()
 first=running();current=wait_service('active');did=first['externalId'];assert re.fullmatch('[a-f0-9]{64}',did)
 check('native CPU and IO values persist',all(current['launchConfig'].get(k)==v for k,v in {'cpuShares':512,'cpuPeriod':100000,'cpuQuota':50000,'cpuSet':'0','blkioWeight':100,'milliCpuReservation':reservation}.items()))
 fmt='FIXTURE_STATUS:shares={{.HostConfig.CpuShares}} period={{.HostConfig.CpuPeriod}} quota={{.HostConfig.CpuQuota}} cpuset={{.HostConfig.CpusetCpus}} blkio={{.HostConfig.BlkioWeight}}'
 result=run_guest("sudo docker inspect --format '"+fmt+"' "+did);raw=' '.join(result.get('status',[]));state['observedCpuFields']=result.get('status',[]);save();print({'selectedPhysicalFields':state['observedCpuFields']},flush=True);assert result.get('exitCode')==0
 check('physical Docker CFS quota period shares and cpuset applied',('shares='+str(expected_shares)+' period=100000 quota=50000 cpuset=0 ') in raw)
 check('physical Docker block IO weight configured','blkio=100' in raw)
 import shlex
 script='for path in cpu/cpu.shares cpu/cpu.cfs_period_us cpu/cpu.cfs_quota_us cpuset/cpuset.cpus blkio/blkio.weight; do if test -f /sys/fs/cgroup/$path; then printf "FIXTURE_STATUS:%s=" "$path"; cat /sys/fs/cgroup/$path; fi; done'
 kernel=run_guest('sudo docker exec '+did+' sh -c '+shlex.quote(script));state['observedCgroups']=kernel.get('status',[]);save();print({'selectedCgroups':state['observedCgroups']},flush=True)
 check('container cgroups enforce CPU shares period quota cpuset and IO weight',kernel.get('exitCode')==0 and set(['FIXTURE_STATUS:cpu/cpu.shares='+str(expected_shares),'FIXTURE_STATUS:cpu/cpu.cfs_period_us=100000','FIXTURE_STATUS:cpu/cpu.cfs_quota_us=50000','FIXTURE_STATUS:cpuset/cpuset.cpus=0','FIXTURE_STATUS:blkio/blkio.weight=100']).issubset(set(kernel.get('status',[]))))
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
 (ROOT/'console'/REPORT).write_text(json.dumps({'status':outcome,'checks':checks,'reservation':reservation,'expectedShares':expected_shares,'observedCpuFields':state.get('observedCpuFields'),'observedCgroups':state.get('observedCgroups'),'scope':'one owned service: CFS configuration shares cpuset IO weight and cgroup values; no throughput or CPU scheduling latency guarantee'},indent=2),encoding='utf-8')
 if MANIFEST.exists():MANIFEST.unlink()
