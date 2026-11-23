"""Create one owned container through the real UI and compare native/Docker/process limits."""
import hashlib,json,os,re,secrets,subprocess,time,traceback
from pathlib import Path
import ws_revocation as lab
from legacy_guest import run_guest

ROOT=lab.ROOT
STATE=ROOT/'console/ulimits-fixture.json'
REPORT=ROOT/'console/ulimits-physical-results.json'
BASE='projects/1a12/'

def main():
 assert not STATE.exists(),'Recover owned fixture first.'
 if REPORT.exists():
  (ROOT/'migration-runs'/('ulimits-physical-'+str(time.time_ns())+'-results.json')).write_bytes(REPORT.read_bytes())
 admin=lab.session();assert admin.api('projects/1a12')['name']=='UI-OPS-LAB'
 def rows(kind):return [v for v in admin.api(BASE+kind+'?limit=-1')['data'] if not v.get('removed')]
 def snapshot():return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for v in rows('services') if not v.get('system')}
 marker='console-ulimits-'+secrets.token_hex(6)
 baseline=snapshot();volumes={v['id'] for v in rows('volumes')};containers={v['id'] for v in rows('containers') if not v.get('system')}
 state={'name':marker,'environment':'1a12','baseline':baseline,'volumes':sorted(volumes),'containers':sorted(containers)}
 with STATE.open('x',encoding='utf-8') as file:json.dump(state,file)
 relay=None;identity=None
 result={'status':'failed','cleanupComplete':False,'checks':[]}
 def check(name,condition=True):
  assert condition;result['checks'].append(name);print('PASS: '+name,flush=True)
 try:
  runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
  browser=Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
  assert browser.is_file()
  payload={'marker':marker,'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(browser),'cookies':[{'name':c.name,'value':c.value} for c in admin.cookies if c.name in ('token','CSRF')]}
  from scheduler_relay_window import RelayAllocationWindow
  relay=RelayAllocationWindow(admin,'rancher.console.ulimits-fixture',marker)
  result['stage']='scheduler-allocation-window';relay.start()
  result['stage']='browser-creation'
  child=subprocess.run([str(runtime/'bin/node.exe'),str(ROOT/'console/tests/e2e/ulimits-create.cjs')],input=json.dumps(payload),text=True,encoding='utf-8',capture_output=True,timeout=110,env=dict(os.environ,DEBUG='',NODE_DEBUG=''))
  result['browser']=json.loads(child.stdout)
  check('real creation UI passed with exact mutation scope',child.returncode==0 and result['browser']['status']=='passed' and result['browser']['browserClosed'])
  result['stage']='physical-start'
  until=time.monotonic()+90
  while time.monotonic()<until:
   own=[v for v in rows('containers') if v.get('name')==marker and v.get('description')==marker]
   if len(own)==1 and own[0]['state']=='running' and re.fullmatch('[a-f0-9]{64}',own[0].get('externalId') or ''):break
   time.sleep(1)
  else:raise AssertionError('Owned physical container did not start.')
  current=own[0];assert current['hostId']=='1h1' and current['id']==result['browser']['containerId']
  check('native container limits persist',[{k:v.get(k) for k in ('name','soft','hard')} for v in current['ulimits']]==[{'name':'nofile','soft':1024,'hard':2048}])
  result['allocationRelay']=relay.finish()
  assert result['allocationRelay']['allocationRelayAccepted'] and result['allocationRelay']['filesCleaned']
  check('relay removed before Docker/process verification',result['allocationRelay']['ruleRemoved'])
  docker_id=current['externalId']
  command="sudo docker inspect --format 'FIXTURE_STATUS:count={{len .HostConfig.Ulimits}} {{range .HostConfig.Ulimits}}name={{.Name}} soft={{.Soft}} hard={{.Hard}}{{end}}' "+docker_id+" && sudo docker exec "+docker_id+" sh -c 'printf \"FIXTURE_STATUS:soft=%s hard=%s\\n\" \"$(ulimit -Sn)\" \"$(ulimit -Hn)\"'"
  observed=run_guest(command);assert observed.get('exitCode')==0
  check('Docker HostConfig uses requested limits','FIXTURE_STATUS:count=1 name=nofile soft=1024 hard=2048' in observed['status'])
  check('container process reports actual soft/hard limits','FIXTURE_STATUS:soft=1024 hard=2048' in observed['status'])
  result['stage']='authorization-denial'
  from subscription_identity_fixture import identity_factory
  identity=identity_factory('grant',role='member')(admin)
  identity['invalidate']()
  assert identity['session'].api('projects')['data']==[]
  code,_,_=identity['session'].request('/v2-beta/'+BASE+'containers',{'name':marker+'-denied','description':marker,'imageUuid':'docker:alpine:3.20','startOnCreate':False,'ulimits':[{'name':'nofile','soft':1024,'hard':2048}]},'POST')
  check('revoked identity cannot create container in the environment',code in (401,403,404))
  result['status']='passed';result['stage']='measured'
 except Exception as error:
  result['errorType']=type(error).__name__
  result['errorLocations']=[{'file':Path(v.filename).name,'line':v.lineno} for v in traceback.extract_tb(error.__traceback__)]
 finally:
  cleanup_errors=[]
  if relay:
   try:
    result['allocationRelay']=relay.finish()
    assert result['allocationRelay']['filesCleaned'] and result['allocationRelay']['ruleRemoved']
   except Exception as error:cleanup_errors.append({'stage':'relay','errorType':type(error).__name__})
  if identity:
   try:
    identity['prepare_cleanup']();identity['cleanup']();result['identityFixtureCleaned']=True
   except Exception as error:cleanup_errors.append({'stage':'identity','errorType':type(error).__name__})
  try:
   for current in rows('containers'):
    if current.get('name') in (marker,marker+'-denied') and current.get('description')==marker and current['id'] not in containers:
     assert current['accountId']=='1a12'
     if 'remove' not in current['actions']:
      assert 'stop' in current['actions']
      assert admin.request(current['actions']['stop'],{},'POST')[0] in (200,201,202,204)
      for _ in range(60):
       current=admin.api(BASE+'containers/'+current['id'])
       if 'remove' in current['actions']:break
       time.sleep(1)
     assert admin.request(current['actions']['remove'],{},'POST')[0] in (200,201,202,204)
   for _ in range(100):
    if not [v for v in rows('containers') if v.get('name')==marker and v.get('description')==marker]:break
    time.sleep(1)
   check('owned container removed and prior workloads preserved',snapshot()==baseline and {v['id'] for v in rows('containers') if not v.get('system')}==containers)
   check('prior volumes preserved without residual volumes',{v['id'] for v in rows('volumes')}==volumes)
   assert admin.request('/v2-beta/token/current',None,'DELETE')[0] in (200,204)
   result['controlSessionRevoked']=True
   result['cleanupComplete']=not cleanup_errors
   if result['cleanupComplete']:
    assert json.loads(STATE.read_text(encoding='utf-8'))['name']==marker
    STATE.unlink()
  except Exception as error:cleanup_errors.append({'stage':'workload','errorType':type(error).__name__})
  if cleanup_errors:result['cleanupErrors']=cleanup_errors;result['status']='failed'
  REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
 return 0 if result['status']=='passed' and result['cleanupComplete'] else 1

if __name__=='__main__':raise SystemExit(main())
