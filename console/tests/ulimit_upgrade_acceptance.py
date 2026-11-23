"""Owned zero-scale service only: real contextual upgrade, rollback, finish and empty reset."""
import hashlib,json,os,re,secrets,subprocess,time,traceback
from pathlib import Path
import ws_revocation as lab

ROOT=lab.ROOT
STATE=ROOT/'console/ulimit-upgrade-fixture.json'
REPORT=ROOT/'console/ulimit-upgrade-results.json'
BASE='projects/1a12/'

def main():
 assert not STATE.exists()
 if REPORT.exists():(ROOT/'migration-runs'/('ulimit-upgrade-'+str(time.time_ns())+'-results.json')).write_bytes(REPORT.read_bytes())
 admin=lab.session();assert admin.api('projects/1a12')['name']=='UI-OPS-LAB'
 def rows(kind):return [v for v in admin.api(BASE+kind+'?limit=-1')['data'] if not v.get('removed')]
 def snapshot(exclude=()):return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for v in rows('services') if not v.get('system') and v['id'] not in exclude}
 baseline=snapshot();volumes={v['id'] for v in rows('volumes')};containers={v['id'] for v in rows('containers') if not v.get('system')}
 marker='console-ulimit-upgrade-'+secrets.token_hex(6);state={'name':marker,'environment':'1a12','baseline':baseline,'volumes':sorted(volumes),'containers':sorted(containers)}
 result={'status':'failed','cleanupComplete':False};stack=None;service=None;identity=None
 def save():STATE.write_text(json.dumps(state,indent=2),encoding='utf-8')
 def wait(kind,id,predicate):
  for _ in range(90):
   value=admin.api(BASE+kind+'/'+id)
   if predicate(value):return value
   time.sleep(.5)
  raise AssertionError('Owned native transition timeout.')
 with STATE.open('x',encoding='utf-8') as file:json.dump(state,file)
 try:
  stack=admin.api(BASE+'stacks',{'name':marker,'description':marker});state['stack']=stack['id'];save();wait('stacks',stack['id'],lambda v:v['state']=='active')
  service=admin.api(BASE+'services',{'name':'limit-web','description':marker,'stackId':stack['id'],'scale':0,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'bridge','command':['/bin/sh','-c','sleep 86400'],'memory':67108864,'environment':{'ULIMIT_FIXTURE':'preserved'}}})
  state['service']=service['id'];save();wait('services',service['id'],lambda v:v['state']=='active')
  runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node';browser=Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
  payload={'marker':marker,'serviceId':service['id'],'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(browser),'cookies':[{'name':c.name,'value':c.value} for c in admin.cookies if c.name in ('token','CSRF')]}
  result['stage']='real-browser'
  child=subprocess.run([str(runtime/'bin/node.exe'),str(ROOT/'console/tests/e2e/ulimit-upgrades.cjs')],input=json.dumps(payload),text=True,encoding='utf-8',capture_output=True,timeout=200,env=dict(os.environ,DEBUG='',NODE_DEBUG=''))
  result['childExitCode']=child.returncode
  result['childErrorCategories']=re.findall(r'([A-Za-z]+Error):',child.stderr)
  result['childErrorLines']=[int(v) for v in re.findall(r'ulimit-upgrades\.cjs:([0-9]+)',child.stderr)]
  result['browser']=json.loads(child.stdout);assert child.returncode==0 and result['browser']['status']=='passed' and result['browser']['browserClosed']
  assert not rows('services/'+service['id']+'/instances');result['noPhysicalInstancesScheduled']=True
  result['stage']='authorization-denial'
  from subscription_identity_fixture import identity_factory
  identity=identity_factory('grant',role='member')(admin);identity['invalidate']()
  assert identity['session'].api('projects')['data']==[]
  own=admin.api(BASE+'services/'+service['id'])
  code,_,_=identity['session'].request(own['actions']['upgrade'],{'inServiceStrategy':{'batchSize':1,'intervalMillis':100,'startFirst':False,'launchConfig':{'imageUuid':'docker:alpine:3.20','ulimits':[{'name':'nofile','soft':1024,'hard':2048}]}}},'POST')
  assert code in (401,403,404);result['revokedIdentityUpgradeDenied']=True
  result['status']='passed';result['stage']='measured'
 except Exception as error:
  result['errorType']=type(error).__name__;result['errorLocations']=[{'file':Path(v.filename).name,'line':v.lineno} for v in traceback.extract_tb(error.__traceback__)]
 finally:
  if identity:
   try:identity['prepare_cleanup']();identity['cleanup']();result['identityFixtureCleaned']=True
   except Exception as error:result['identityCleanupErrorType']=type(error).__name__;result['status']='failed'
  try:
   if stack:
    current=admin.api(BASE+'stacks/'+stack['id']);assert current['name']==marker and current['description']==marker and current['accountId']=='1a12'
    if service:
     current_service=admin.api(BASE+'services/'+service['id']);assert current_service['scale']==0 and current_service['stackId']==stack['id'] and current_service['description']==marker
     assert not rows('services/'+service['id']+'/instances')
    if not current.get('removed'):assert admin.request(current['actions']['remove'],{},'POST')[0] in (200,201,202,204)
    wait('stacks',stack['id'],lambda v:bool(v.get('removed')))
    if service:wait('services',service['id'],lambda v:bool(v.get('removed')))
   assert snapshot()==baseline and {v['id'] for v in rows('volumes')}==volumes and {v['id'] for v in rows('containers') if not v.get('system')}==containers
   assert admin.request('/v2-beta/token/current',None,'DELETE')[0] in (200,204)
   result['controlSessionRevoked']=True;result['cleanupComplete']='identityCleanupErrorType' not in result
   assert json.loads(STATE.read_text(encoding='utf-8'))['name']==marker
   if result['cleanupComplete']:STATE.unlink()
  except Exception as error:result['cleanupErrorType']=type(error).__name__;result['status']='failed'
  REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
 return 0 if result['status']=='passed' and result['cleanupComplete'] else 1

if __name__=='__main__':raise SystemExit(main())
