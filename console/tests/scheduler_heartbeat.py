"""Local transport comparison with an own project key; no scheduler credentials or event bodies."""
import base64,hashlib,json,re,secrets,shlex,subprocess,time,sys
from pathlib import Path
import ws_revocation as lab
from legacy_guest import run_guest
ROOT=lab.ROOT
STATE=ROOT/'console/scheduler-heartbeat-fixture.json'
assert all(arg in ('--global','--legacy-go','--empty-ping','--scheduler-network','--guest-bridge','--guest-only','--preflight-only','--mss-1000','--relay-control') for arg in sys.argv[1:])
GLOBAL='--global' in sys.argv[1:]
LEGACY='--legacy-go' in sys.argv[1:]
EMPTY='--empty-ping' in sys.argv[1:]
SCHEDULER_NET='--scheduler-network' in sys.argv[1:]
GUEST_BRIDGE='--guest-bridge' in sys.argv[1:]
CONTAINER_NET=SCHEDULER_NET or GUEST_BRIDGE
assert not (SCHEDULER_NET and GUEST_BRIDGE)
GUEST_ONLY='--guest-only' in sys.argv[1:]
PREFLIGHT='--preflight-only' in sys.argv[1:]
RELAY='--relay-control' in sys.argv[1:]
assert not RELAY or (SCHEDULER_NET and GUEST_ONLY and GLOBAL and not PREFLIGHT)
MSS=1000 if '--mss-1000' in sys.argv[1:] else 0
assert MSS==0 or (not LEGACY and SCHEDULER_NET and not PREFLIGHT)
assert not GUEST_ONLY or CONTAINER_NET
assert not PREFLIGHT or (CONTAINER_NET and GUEST_ONLY)
REPORT=ROOT/('console/scheduler-heartbeat-'+('global-' if GLOBAL else '')+('legacy-go-' if LEGACY else '')+('empty-ping-' if EMPTY else '')+('scheduler-network-' if SCHEDULER_NET else 'guest-bridge-' if GUEST_BRIDGE else '')+('guest-only-' if GUEST_ONLY else '')+('preflight-' if PREFLIGHT else '')+('mss1000-' if MSS else '')+('relay-control-' if RELAY else '')+'transport-results.json')
SERVER=r"""
import http.server,os,pathlib,sys
root=pathlib.Path(sys.argv[1]);assert str(root).startswith('/run/community-heartbeat-')
(root/'server.pid').write_text(str(os.getpid()))
class Handler(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  if self.path!='/probe':self.send_error(404);return
  value=(root/'probe').read_bytes();self.send_response(200);self.send_header('Content-Length',str(len(value)));self.end_headers();self.wfile.write(value)
 def log_message(self,*args):pass
http.server.HTTPServer(('127.0.0.1',8877),Handler).serve_forever()
"""
def command(args,**kwargs):
 value=subprocess.run(args,capture_output=True,timeout=kwargs.pop('timeout',60),**kwargs)
 assert value.returncode==0,'Private diagnostic process failed; output withheld.'
 return value.stdout

def parse(raw):
 match=re.search(r'^FIXTURE_STATUS:((?:handshake|invalidJson|invalidFields)=.*)$',raw,re.MULTILINE);assert match,'Probe returned no safe status.'
 return {k:int(v) for k,v in re.findall(r'([A-Za-z]+)=([0-9]+)',match.group(1))}

def main():
 assert not STATE.exists() and not (ROOT/'console/host-stream-fixture.json').exists()
 pin=command(['git','-C',str(ROOT/'migration-runs/scheduler-v0.8.6'),'rev-parse','HEAD']).decode().strip();assert pin=='d9a8d0a5b624a47649df52c72e125f29d582f36f'
 binary=ROOT/('migration-runs/scheduler-probe-build/scheduler-heartbeat-probe'+('-go1.9.7' if LEGACY else ''));assert binary.is_file(),'Build the client with scripts/build_scheduler_probe.py first.'
 admin=lab.session();key=None;uploaded=False
 name='community-heartbeat-'+secrets.token_hex(6);directory='/run/'+name;guest='/tmp/'+name
 result={'status':'failed','schedulerFixed':False,'schedulerSourceCommit':pin,'clientRuntime':('Go1.9.7' if LEGACY else 'Go1.27.3')+'; not proof of original scheduler binary runtime','binarySha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'intervalSeconds':5,'pongBudgetSeconds':10,'observationSeconds':35,'route':'global' if GLOBAL else 'project','emptyPing':EMPTY,'requestedSocketMSS':MSS,'localRelayControl':RELAY,'guestNamespace':'scheduler network only' if SCHEDULER_NET else 'guest Docker bridge' if GUEST_BRIDGE else 'guest host network','ownKeyCleaned':False,'privateServerCleaned':False}
 def wait_key(predicate):
  for _ in range(100):
   row=admin.api('apikeys/'+key['id'])
   if predicate(row):return row
   time.sleep(.2)
  raise AssertionError('Own credential did not converge')
 try:
  if not PREFLIGHT:
   key=admin.api('projects/1a12/apikeys',{'name':name,'description':name,'accountId':'1a12'});wait_key(lambda row:row['state']=='active')
   STATE.write_text(json.dumps({'name':name,'id':key['id'],'accountId':key['accountId'],'directory':directory,'guestPath':guest}),encoding='utf-8')
   payload=json.dumps({'URL':('ws://10.42.0.1:18880' if RELAY else 'ws://172.21.0.4:8080')+'/v2-beta/'+('' if GLOBAL else 'projects/1a12/')+'subscribe?eventNames=resource.change','Access':key['publicValue'],'Secret':key['secretValue'],'EmptyPing':EMPTY,'MaxSegment':MSS}).encode()
  else:
   payload=b'{}'
   result['credentialCreated']=False
   STATE.write_text(json.dumps({'name':name,'id':None,'directory':directory,'guestPath':guest}),encoding='utf-8')
  image='alpine@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc'
  if not GUEST_ONLY:
   raw=command(['docker','run','--rm','--pull','never','-i','--network','rancher16-rbac-lab_default','--read-only','--cap-drop','ALL','--pids-limit','32','--memory','64m','--cpus','0.5','--mount','type=bind,source='+str(binary)+',target=/probe,readonly','--entrypoint','/probe',image],input=payload,timeout=50)
   result['hostNetwork']=parse(raw.decode());print('PASS: host observation measured; no event frames retained.',flush=True)
  else: result['hostNetwork']={'notMeasured':True}
  upload="import pathlib,sys; p=pathlib.Path(sys.argv[1]);p.mkdir(mode=0o700);(p/'probe').write_bytes(sys.stdin.buffer.read())"
  command(['docker','exec','-i','rancher16-legacy-test-host','python3','-c',upload,directory],input=binary.read_bytes());uploaded=True
  command(['docker','exec','-d','rancher16-legacy-test-host','python3','-c',SERVER,directory]);time.sleep(.5)
  guest_command='wget -qO '+shlex.quote(guest)+' http://10.0.2.2:8877/probe && chmod 700 '+shlex.quote(guest)+' && printf %s '+shlex.quote(base64.b64encode(payload).decode())+' | '+shlex.quote(guest)
  if CONTAINER_NET:
   network='bridge'
   if SCHEDULER_NET:
    scheduler=next(row for row in admin.api('projects/1a12/containers?limit=-1')['data'] if row.get('name')=='scheduler-scheduler-1' and not row.get('removed'))
    target=scheduler['externalId'];assert re.fullmatch('[a-f0-9]{64}',target)
    network='container:'+target
    result['schedulerInstance']=scheduler['id']
   own=shlex.quote(name)
   relay_start=''
   relay_stop=''
   if RELAY:
    peer=scheduler.get('primaryIpAddress','');assert re.fullmatch(r'10\.42\.[0-9]{1,3}\.[0-9]{1,3}',peer)
    relay_start=shlex.quote(guest)+' relay '+shlex.quote(peer)+' & relay_pid=$!; sleep 1; if ! kill -0 "$relay_pid" 2>/dev/null; then exit 1; fi; '
    relay_stop='if [ '+shlex.quote(guest)+' -ef "/proc/$relay_pid/exe" ]; then kill "$relay_pid"; fi; echo FIXTURE_STATUS:own-relay-stopped; '
   nested=('set -o pipefail; cleanup() { '+relay_stop+'marker=$(docker inspect --format \'{{index .Config.Labels "rancher.console.probe"}}\' '+own+' 2>/dev/null); if [ "$marker" = '+own+' ]; then docker rm -f '+own+' >/dev/null && echo FIXTURE_STATUS:own-probe-container-removed; fi; }; trap cleanup EXIT; '+relay_start
    +'docker create --name '+own+' --label rancher.console.probe='+own+' --network '+network+' --cap-drop ALL --memory 64m --cpus 0.5 -i --entrypoint /bin/sh alpine:3.20 -c '+shlex.quote('printf e30= | /probe' if PREFLIGHT else '/probe')+' >/dev/null; rc=$?; printf "FIXTURE_STATUS:createExit=%s\\n" "$rc"; if [ "$rc" != 0 ]; then exit "$rc"; fi; '
    +'docker cp '+shlex.quote(guest)+' '+own+':/probe; rc=$?; printf "FIXTURE_STATUS:copyExit=%s\\n" "$rc"; if [ "$rc" != 0 ]; then exit "$rc"; fi; '
    +'printf %s '+shlex.quote(base64.b64encode(payload).decode())+' | docker start -a -i '+own+' 2>/tmp/'+name+'.stderr; rc=$?; printf "FIXTURE_STATUS:startExit=%s\\n" "$rc"; '+(('while IFS= read -r line; do safe=${line//[^a-zA-Z0-9_.:/ =-]/_}; printf "FIXTURE_STATUS:preflightError=%s\\n" "$safe"; done </tmp/'+name+'.stderr; ') if PREFLIGHT else '')+'rm -f /tmp/'+name+'.stderr; '
    +('docker inspect --format \'FIXTURE_STATUS:probeState={{.State.Status}} probeExit={{.State.ExitCode}} probeOOM={{.State.OOMKilled}}\' '+own+'; docker logs '+own+' >/tmp/'+name+'.log 2>&1; while IFS= read -r line; do safe=${line//[^a-zA-Z0-9_.:/ =-]/_}; printf "FIXTURE_STATUS:preflightLog=%s\\n" "$safe"; done </tmp/'+name+'.log; rm -f /tmp/'+name+'.log; ' if PREFLIGHT else '')
    +'if [ "$rc" != 0 ]; then error=$(docker inspect --format \'{{.State.Error}}\' '+own+'); case "${error,,}" in *"permission denied"*) echo FIXTURE_STATUS:startError=permission;;*"non running"*|*"not running"*) echo FIXTURE_STATUS:startError=target-stopped;;*"no space"*) echo FIXTURE_STATUS:startError=disk-full;;*"cgroup"*) echo FIXTURE_STATUS:startError=cgroup;;*"no such file"*) echo FIXTURE_STATUS:startError=missing-file;;*"apparmor"*|*"seccomp"*) echo FIXTURE_STATUS:startError=security-profile;;*) echo FIXTURE_STATUS:startError=other;;esac; fi; exit "$rc"')
   guest_command='wget -qO '+shlex.quote(guest)+' http://10.0.2.2:8877/probe && chmod 755 '+shlex.quote(guest)+' && sudo bash -c '+shlex.quote(nested)
  result['guestCommandBytes']=len(guest_command.encode())
  observed=run_guest(guest_command,timeout=65)
  result['guestCommand']={key:observed.get(key) for key in ('completed','exitCode','status')}
  text=' '.join(observed.get('diagnostics',[])).lower()
  result['guestErrorCategories']=[value for value in ('permission denied','no such file','not found','invalid','oci runtime','cannot') if value in text]
  if RELAY: result['relayStopped']='FIXTURE_STATUS:own-relay-stopped' in observed.get('status',[])
  if CONTAINER_NET: result['guestContainerCleaned']='FIXTURE_STATUS:own-probe-container-removed' in observed.get('status',[])
  assert observed.get('completed') and observed.get('exitCode')==0
  result['guestNetwork']=parse('\n'.join(observed.get('status',[])))
  if CONTAINER_NET:
   result['guestContainerCleaned']='FIXTURE_STATUS:own-probe-container-removed' in observed.get('status',[])
   assert result['guestContainerCleaned']
  if PREFLIGHT:
   assert result['guestNetwork'].get('invalidFields')==1
   result['status']='preflight'
  else:
   assert 'handshake' in result['guestNetwork'],'Guest measurement invalid before handshake.'
   result['status']='measured'
 except Exception as error:result['errorType']=type(error).__name__
 finally:
  try:
   clean=run_guest('for exe in /proc/[0-9]*/exe; do if [ '+shlex.quote(guest)+' -ef "$exe" ]; then pid=${exe#/proc/}; pid=${pid%/exe}; kill "$pid"; fi; done; rm -f '+shlex.quote(guest)+' && echo FIXTURE_STATUS:own-probe-removed',timeout=40);assert clean.get('exitCode')==0;result['guestBinaryCleaned']=True
  except Exception as error:result['guestCleanupErrorType']=type(error).__name__
  try:
   if uploaded:
    cleanup="import pathlib,sys,os,signal,shutil; p=pathlib.Path(sys.argv[1]);assert p.parent==pathlib.Path('/run') and p.name.startswith('community-heartbeat-');pid=int((p/'server.pid').read_text());assert str(p).encode() in pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes();os.kill(pid,signal.SIGTERM);shutil.rmtree(p)"
    command(['docker','exec','rancher16-legacy-test-host','python3','-c',cleanup,directory])
   result['privateServerCleaned']=True
  except Exception as error:result['serverCleanupErrorType']=type(error).__name__
  try:
   if key:
    row=admin.api('apikeys/'+key['id']);assert row['name']==name and row['description']==name and row['accountId']=='1a12'
    if row['state']=='active':admin.request(row['actions']['deactivate'],{},'POST');wait_key(lambda value:value['state']=='inactive')
    admin.api('apikeys/'+key['id'],method='DELETE');wait_key(lambda value:bool(value.get('removed')));result['ownKeyCleaned']=True
  except Exception as error:result['keyCleanupErrorType']=type(error).__name__
  if key is None and PREFLIGHT: result['ownKeyCleaned']=True
  if result['ownKeyCleaned'] and result['privateServerCleaned'] and result.get('guestBinaryCleaned') and (not CONTAINER_NET or result.get('guestContainerCleaned')) and (not RELAY or result.get('relayStopped')):STATE.unlink(missing_ok=True)
  result['ownSessionRevoked']=admin.request('/v2-beta/token/current',None,'DELETE')[0] in (200,204)
  REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps(result,indent=2),flush=True)
 return 0 if result['status'] in ('measured','preflight') and not STATE.exists() else 1
if __name__=='__main__':raise SystemExit(main())
