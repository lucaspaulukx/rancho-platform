"""Real shared creation UI, independent primary/sidecar process limits, owned fixture cleanup."""
import hashlib,json,os,re,secrets,subprocess,time,traceback
from pathlib import Path
import ws_revocation as lab
from scheduler_relay_window import RelayAllocationWindow
from legacy_guest import run_guest

ROOT=lab.ROOT;STATE=ROOT/'console/service-ulimits-fixture.json';REPORT=ROOT/'console/service-sidecar-ulimits-results.json';BASE='projects/1a12/'

def main():
 assert not STATE.exists()
 if REPORT.exists():(ROOT/'migration-runs'/('service-sidecar-ulimits-'+str(time.time_ns())+'-results.json')).write_bytes(REPORT.read_bytes())
 admin=lab.session();assert admin.api('projects/1a12')['name']=='UI-OPS-LAB'
 stack=None;relay=None;marker='console-ulimits-'+secrets.token_hex(6)
 def rows(kind):return [v for v in admin.api(BASE+kind+'?limit=-1')['data'] if not v.get('removed')]
 def snapshot():return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for v in rows('services') if not v.get('system') and (not stack or v.get('stackId')!=stack['id'])}
 baseline=snapshot();volumes={v['id'] for v in rows('volumes')};containers={v['id'] for v in rows('containers') if not v.get('system')}
 state={'name':marker,'environment':'1a12','baseline':baseline,'volumes':sorted(volumes),'containers':sorted(containers)}
 with STATE.open('x',encoding='utf-8') as file:json.dump(state,file)
 result={'status':'failed','checks':[],'cleanupComplete':False}
 def check(name,condition=True):assert condition;result['checks'].append(name);print('PASS: '+name,flush=True)
 try:
  stack=admin.api(BASE+'stacks',{'name':marker,'description':marker});state['stack']=stack['id'];STATE.write_text(json.dumps(state,indent=2),encoding='utf-8')
  for _ in range(90):
   if admin.api(BASE+'stacks/'+stack['id'])['state']=='active':break
   time.sleep(.5)
  else:raise AssertionError('Owned stack did not activate.')
  relay=RelayAllocationWindow(admin,'rancher.console.ulimits-fixture',marker);relay.start()
  runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node';browser=Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
  payload={'marker':marker,'stackId':stack['id'],'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(browser),'cookies':[{'name':c.name,'value':c.value} for c in admin.cookies if c.name in ('token','CSRF')]}
  result['stage']='browser-create'
  child=subprocess.run([str(runtime/'bin/node.exe'),str(ROOT/'console/tests/e2e/ulimits-sidecar-create.cjs')],input=json.dumps(payload),text=True,encoding='utf-8',capture_output=True,timeout=100,env=dict(os.environ,DEBUG='',NODE_DEBUG=''))
  result['browser']=json.loads(child.stdout);check('real service/sidecar creation UI passed',child.returncode==0 and result['browser']['status']=='passed' and result['browser']['browserClosed'])
  service=admin.api(BASE+'services/'+result['browser']['serviceId']);assert service['stackId']==stack['id'] and service['description']==marker
  result['stage']='physical-allocation';until=time.monotonic()+90
  while time.monotonic()<until:
   found=[v for v in rows('services/'+service['id']+'/instances') if v['state']=='running' and re.fullmatch('[a-f0-9]{64}',v.get('externalId') or '')]
   if len(found)==2:break
   time.sleep(1)
  else:raise AssertionError('Owned primary/sidecar did not start.')
  assert all(v['hostId']=='1h1' for v in found)
  result['allocationRelay']=relay.finish();assert result['allocationRelay']['allocationRelayAccepted'] and result['allocationRelay']['filesCleaned']
  check('relay removed before measuring both containers',result['allocationRelay']['ruleRemoved'])
  helpers=[v for v in found if v.get('labels',{}).get('io.rancher.service.launch.config')=='helper'];assert len(helpers)==1
  for instance in found:
   helper=instance['id']==helpers[0]['id'];soft,hard=(128,256) if helper else (1024,2048);did=instance['externalId']
   command="sudo docker inspect --format 'FIXTURE_STATUS:count={{len .HostConfig.Ulimits}} {{range .HostConfig.Ulimits}}name={{.Name}} soft={{.Soft}} hard={{.Hard}}{{end}}' "+did+" && sudo docker exec "+did+" sh -c 'printf \"FIXTURE_STATUS:soft=%s hard=%s\\n\" \"$(ulimit -Sn)\" \"$(ulimit -Hn)\"'"
   measured=run_guest(command);assert measured.get('exitCode')==0
   check(('sidecar' if helper else 'primary')+' independent Docker/process limits match',f'FIXTURE_STATUS:count=1 name=nofile soft={soft} hard={hard}' in measured['status'] and f'FIXTURE_STATUS:soft={soft} hard={hard}' in measured['status'])
  result['status']='passed';result['stage']='measured'
 except Exception as error:
  result['errorType']=type(error).__name__;result['errorLocations']=[{'file':Path(v.filename).name,'line':v.lineno} for v in traceback.extract_tb(error.__traceback__)]
 finally:
  errors=[]
  if relay:
   try:tail=relay.finish();assert tail['filesCleaned'] and tail['ruleRemoved']
   except Exception as error:errors.append({'stage':'relay','errorType':type(error).__name__})
  try:
   if stack:
    current=admin.api(BASE+'stacks/'+stack['id']);assert current['name']==marker and current['description']==marker and current['accountId']=='1a12'
    if not current.get('removed'):assert admin.request(current['actions']['remove'],{},'POST')[0] in (200,201,202,204)
   until=time.monotonic()+100
   while time.monotonic()<until:
    if {v['id'] for v in rows('containers') if not v.get('system')}==containers and {v['id'] for v in rows('volumes')}==volumes and (not stack or admin.api(BASE+'stacks/'+stack['id']).get('removed')):break
    time.sleep(1)
   assert snapshot()==baseline and {v['id'] for v in rows('containers') if not v.get('system')}==containers and {v['id'] for v in rows('volumes')}==volumes
   assert admin.request('/v2-beta/token/current',None,'DELETE')[0] in (200,204);result['controlSessionRevoked']=True;result['cleanupComplete']=not errors
   if result['cleanupComplete']:assert json.loads(STATE.read_text(encoding='utf-8'))['name']==marker;STATE.unlink()
  except Exception as error:errors.append({'stage':'workload','errorType':type(error).__name__})
  if errors:result['cleanupErrors']=errors;result['status']='failed'
  REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
 return 0 if result['status']=='passed' and result['cleanupComplete'] else 1

if __name__=='__main__':raise SystemExit(main())
