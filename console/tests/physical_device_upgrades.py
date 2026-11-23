"""Native physical effects complement the separate real-UI zero-scale upgrade acceptance."""
import hashlib,json,re,secrets,time,traceback
from pathlib import Path
import ws_revocation as lab
from scheduler_relay_window import RelayAllocationWindow
from legacy_guest import run_guest

ROOT=lab.ROOT;STATE=ROOT/'console/physical-device-upgrade-fixture.json';REPORT=ROOT/'console/physical-device-upgrade-results.json';BASE='projects/1a12/'

BASELINE='/dev/null:/dev/rancho-null-base:r'
UPGRADED='/dev/null:/dev/rancho-null-upgrade:r'

def main():
 assert not STATE.exists()
 if REPORT.exists():(ROOT/'migration-runs'/('physical-device-upgrade-'+str(time.time_ns())+'-results.json')).write_bytes(REPORT.read_bytes())
 admin=lab.session();assert admin.api('projects/1a12')['name']=='UI-OPS-LAB'
 def rows(kind):return [v for v in admin.api(BASE+kind+'?limit=-1')['data'] if not v.get('removed')]
 def snapshot():return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for v in rows('services') if not v.get('system') and (not service or v['id']!=service['id'])}
 marker='console-devices-'+secrets.token_hex(6);stack=None;service=None;relay=None
 baseline=snapshot();volumes={v['id'] for v in rows('volumes')};containers={v['id'] for v in rows('containers') if not v.get('system')}
 state={'name':marker,'environment':'1a12','baseline':baseline,'volumes':sorted(volumes),'containers':sorted(containers)}
 result={'status':'failed','cleanupComplete':False,'checks':[],'phases':{}}
 with STATE.open('x',encoding='utf-8') as file:json.dump(state,file)
 def save():STATE.write_text(json.dumps(state,indent=2),encoding='utf-8')
 def check(name,condition=True):assert condition;result['checks'].append(name);print('PASS: '+name,flush=True)
 def wait(kind,id,predicate,seconds=90):
  until=time.monotonic()+seconds
  while time.monotonic()<until:
   value=admin.api(BASE+kind+'/'+id)
   if predicate(value):return value
   time.sleep(1)
  raise AssertionError('Owned native transition timeout.')
 def action(value,key,body=None):
  assert value['accountId']=='1a12'
  assert admin.request(value['actions'][key],body or {},'POST')[0] in (200,201,202,204)
 def own_service():
  value=admin.api(BASE+'services/'+service['id']);assert value['description']==marker and value['stackId']==stack['id'] and value['scale']==1
  return value
 def start_relay():
  nonlocal relay
  relay=RelayAllocationWindow(admin,'rancher.console.devices-fixture',marker);relay.start()
 def measure(phase,previous=None,expected=None):
  until=time.monotonic()+90
  while time.monotonic()<until:
   found=[v for v in rows('services/'+service['id']+'/instances') if v['state']=='running' and re.fullmatch('[a-f0-9]{64}',v.get('externalId') or '') and v['externalId']!=previous]
   if len(found)==1:break
   time.sleep(1)
  else:raise AssertionError('Owned replacement did not start.')
  instance=found[0];assert instance['hostId']=='1h1';did=instance['externalId']
  result['phases'][phase]={'allocationRelay':relay.finish()}
  assert result['phases'][phase]['allocationRelay']['allocationRelayAccepted'] and result['phases'][phase]['allocationRelay']['filesCleaned']
  expected = expected or []
  check(phase+' native instance mapping matches', (instance.get('devices') or []) == expected)
  inspect = "sudo docker inspect --format 'FIXTURE_STATUS:privileged={{.HostConfig.Privileged}} devices={{len .HostConfig.Devices}}{{range .HostConfig.Devices}} {{.PathOnHost}}:{{.PathInContainer}}:{{.CgroupPermissions}}{{end}}' "+did
  paths = ['/dev/rancho-null-base', '/dev/rancho-null-upgrade']
  probe = '; '.join(
   'if [ -c '+path+' ] && dd if='+path+' of=/dev/null bs=1 count=1 2>/dev/null; then echo FIXTURE_STATUS:alias'+str(index)+'=1; elif [ ! -e '+path+' ]; then echo FIXTURE_STATUS:alias'+str(index)+'=0; else exit 9; fi'
   for index,path in enumerate(paths))
  observed=run_guest(inspect+" && sudo docker exec "+did+" sh -c '"+probe+"'")
  assert observed.get('exitCode')==0 and observed.get('completed')
  statuses=observed['status']
  check(phase+' Docker settings and process aliases match',
        'FIXTURE_STATUS:privileged=false devices='+str(len(expected))+(' '+expected[0] if expected else '') in statuses and
        all('FIXTURE_STATUS:alias'+str(index)+'='+str(int(any(path==mapping.split(':')[1] for mapping in expected))) in statuses
            for index,path in enumerate(paths)))
  return did
 def upgrade(devices):
  value=own_service();assert value['state']=='active'
  fields=admin.api(BASE+'schemas/launchConfig')['resourceFields']
  launch={k:v for k,v in value['launchConfig'].items() if fields.get(k,{}).get('create')}
  launch['devices']=devices
  action(value,'upgrade',{'inServiceStrategy':{'batchSize':1,'intervalMillis':100,'startFirst':False,'launchConfig':launch}})
 def finish():
  value=wait('services',service['id'],lambda v:v['state']=='upgraded');action(value,'finishupgrade');wait('services',service['id'],lambda v:v['state']=='active')
 try:
  stack=admin.api(BASE+'stacks',{'name':marker,'description':marker});state['stack']=stack['id'];save();wait('stacks',stack['id'],lambda v:v['state']=='active')
  start_relay()
  service=admin.api(BASE+'services',{'name':'device-physical','description':marker,'stackId':stack['id'],'scale':1,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'none','requestedHostId':'1h1','command':['/bin/sh','-c','while :; do sleep 5; done'],'environment':{'DEVICE_FIXTURE':'preserved'},'devices':[BASELINE],'labels':{'rancher.console.devices-fixture':marker}}})
  state['service']=service['id'];save()
  previous=measure('baseline',expected=[BASELINE])
  wait('services',service['id'],lambda v:v['state']=='active')
  start_relay();upgrade([UPGRADED]);previous=measure('upgrade',previous,[UPGRADED])
  value=wait('services',service['id'],lambda v:v['state']=='upgraded')
  start_relay();action(value,'rollback');previous=measure('rollback',previous,[BASELINE])
  wait('services',service['id'],lambda v:v['state']=='active')
  start_relay();upgrade([UPGRADED]);previous=measure('upgrade-finish',previous,[UPGRADED]);finish()
  check('finish retains explicit mapping',own_service()['launchConfig']['devices']==[UPGRADED])
  start_relay();upgrade([]);measure('reset',previous,[]);finish()
  check('empty reset persists',not own_service()['launchConfig'].get('devices'))
  value=own_service()
  check('image command environment and scale preserved',value['launchConfig']['imageUuid']=='docker:alpine:3.20' and value['launchConfig']['command']==['/bin/sh','-c','while :; do sleep 5; done'] and value['launchConfig']['environment']=={'DEVICE_FIXTURE':'preserved'} and value['scale']==1)
  result['status']='passed'
 except Exception as error:
  result['errorType']=type(error).__name__;result['errorLocations']=[{'file':Path(v.filename).name,'line':v.lineno} for v in traceback.extract_tb(error.__traceback__)]
 finally:
  errors=[]
  if relay:
   try:
    tail=relay.finish();assert tail['filesCleaned'] and tail['ruleRemoved']
   except Exception as error:errors.append({'stage':'relay','errorType':type(error).__name__})
  try:
   if stack:
    value=admin.api(BASE+'stacks/'+stack['id']);assert value['name']==marker and value['description']==marker and value['accountId']=='1a12'
    if not value.get('removed'):action(value,'remove')
    wait('stacks',stack['id'],lambda v:bool(v.get('removed')))
   until=time.monotonic()+100
   while time.monotonic()<until:
    if {v['id'] for v in rows('containers') if not v.get('system')}==containers and {v['id'] for v in rows('volumes')}==volumes:break
    time.sleep(1)
   assert snapshot()==baseline and {v['id'] for v in rows('containers') if not v.get('system')}==containers and {v['id'] for v in rows('volumes')}==volumes
   assert admin.request('/v2-beta/token/current',None,'DELETE')[0] in (200,204);result['controlSessionRevoked']=True
   result['cleanupComplete']=not errors
   if result['cleanupComplete']:assert json.loads(STATE.read_text(encoding='utf-8'))['name']==marker;STATE.unlink()
  except Exception as error:errors.append({'stage':'workload','errorType':type(error).__name__})
  if errors:result['cleanupErrors']=errors;result['status']='failed'
  REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
 return 0 if result['status']=='passed' and result['cleanupComplete'] else 1

if __name__=='__main__':raise SystemExit(main())
