"""Shared 120s allocation-only scheduler relay; stops before workload stream checks."""
import ipaddress,json,queue,re,secrets,shlex,threading,time
import scheduler_heartbeat as diagnostic
from legacy_guest import run_guest
ROOT=diagnostic.ROOT
STATE=ROOT/'console/scheduler-relay-window-fixture.json'
BASE='projects/1a12/'

class RelayAllocationWindow:
 def __init__(self, admin, label_key, label_value):
  assert label_key in ('rancher.console.scheduler-relay','rancher.console.stream-fixture','rancher.console.ulimits-fixture')
  assert re.fullmatch(r'(?:community-scheduler-relay-|console-host-stream-|console-ulimits-)[a-f0-9]{12}',label_value)
  self.admin=admin
  self.label_key,self.label_value=label_key,label_value
  self.marker='community-scheduler-relay-'+secrets.token_hex(6)
  self.private='/run/community-heartbeat-'+self.marker
  self.guest='/tmp/'+self.marker
  self.thread=None;self.output=queue.Queue();self.uploaded=False;self.result=None;self.rule=None;self.owns_state=False

 def start(self):
  assert not STATE.exists() and not (ROOT/'console/scheduler-heartbeat-fixture.json').exists()
  binary=ROOT/'migration-runs/scheduler-probe-build/scheduler-heartbeat-probe';assert binary.is_file()
  admin=self.admin;marker,private,guest=self.marker,self.private,self.guest
  state={'name':marker,'environment':'1a12','guestBinary':guest,'privateDirectory':private}
  def save():
   with STATE.open('x',encoding='utf-8') as owned:
    self.owns_state=True
    json.dump(state,owned,indent=2)
  def rows(kind):return [row for row in admin.api(BASE+kind+'?limit=-1')['data'] if not row.get('removed')]
  assert admin.api('projects/1a12')['name']=='UI-OPS-LAB'
  host=admin.api(BASE+'hosts/1h1');assert host['state']=='active' and host['agentState']=='active'
  readiness_until=time.monotonic()+45
  while True:
   scheduler=next((row for row in rows('containers') if row.get('name')=='scheduler-scheduler-1' and row.get('system')),None)
   if scheduler and scheduler.get('hostId')=='1h1' and scheduler.get('networkMode')=='managed' and scheduler.get('state')=='running':
    cid=scheduler.get('externalId') or ''
    if re.fullmatch('[a-f0-9]{64}',cid) and scheduler.get('primaryIpAddress'):
     source=ipaddress.IPv4Address(scheduler['primaryIpAddress']);assert source in ipaddress.IPv4Network('10.42.0.0/16') and str(source)!='10.42.0.1'
     meta=run_guest("sudo docker inspect --format 'FIXTURE_STATUS:image={{.Config.Image}} running={{.State.Running}}' "+cid+"; sudo docker exec "+cid+" sh -c 'read mac </sys/class/net/eth0/address; printf \"FIXTURE_STATUS:mac=%s\\n\" \"$mac\"'")
     observed_mac=next((line.split('=',1)[1] for line in meta.get('status',[]) if line.startswith('FIXTURE_STATUS:mac=')),'')
     if meta.get('exitCode')==0 and 'FIXTURE_STATUS:image=rancher/scheduler:v0.8.6 running=true' in meta.get('status',[]) and re.fullmatch(r'(?:[a-f0-9]{2}:){5}[a-f0-9]{2}',observed_mac):
      mac=observed_mac
      break
   if time.monotonic()>=readiness_until:raise AssertionError('Native scheduler readiness did not match its Docker identity.')
   time.sleep(1)
  rule=shlex.join(['-s',str(source)+'/32','-d','172.21.0.4/32','-p','tcp','--dport','8080','-m','mac','--mac-source',mac,'-m','comment','--comment',marker,'-j','DNAT','--to-destination','10.42.0.1:18880'])
  self.rule=rule
  state.update(scheduler=scheduler['id'],schedulerDockerId=cid,source=str(source),sourceMac=mac,rule=rule);save()
  upload="import pathlib,sys;p=pathlib.Path(sys.argv[1]);p.mkdir(mode=0o700);(p/'probe').write_bytes(sys.stdin.buffer.read())"
  diagnostic.command(['docker','exec','-i','rancher16-legacy-test-host','python3','-c',upload,private],input=binary.read_bytes());self.uploaded=True
  diagnostic.command(['docker','exec','-d','rancher16-legacy-test-host','python3','-c',diagnostic.SERVER,private]);time.sleep(.5)
  downloaded=run_guest('wget -qO '+shlex.quote(guest)+' http://10.0.2.2:8877/probe && chmod 700 '+shlex.quote(guest)+' && echo FIXTURE_STATUS:relay-binary-ready')
  assert downloaded.get('exitCode')==0 and 'FIXTURE_STATUS:relay-binary-ready' in downloaded.get('status',[])
  rule_cmd='iptables -w 3 -t nat '
  remove=rule_cmd+'-D PREROUTING '+rule
  checked=rule_cmd+'-C PREROUTING '+rule
  self.checked,self.remove=checked,remove
  listener=shlex.quote(guest)+' relay-window '+str(source)+' 120'
  nested=('set -e; applied=0; relay_pid=0; cleanup() { if [ "$applied" = 1 ]; then '+remove+' && echo FIXTURE_STATUS:own-relay-rule-removed; fi; '
   +'if [ '+shlex.quote(guest)+' -ef "/proc/$relay_pid/exe" ]; then kill "$relay_pid"; fi; }; trap cleanup EXIT; '
   +'if '+checked+' 2>/dev/null; then exit 9; fi; '+listener+' & relay_pid=$!; sleep 1; kill -0 "$relay_pid"; '
   +rule_cmd+'-I PREROUTING 1 '+rule+'; applied=1; echo FIXTURE_STATUS:own-relay-rule-installed; wait "$relay_pid"; '
   +"docker ps --filter label="+self.label_key+"="+self.label_value+" --format 'FIXTURE_STATUS:ownDocker={{.ID}}'; "
   +"docker logs --since 75s "+cid+" 2>&1 | awk '/pong timeout/{count++} END{print \"FIXTURE_STATUS:schedulerPongTimeouts=\" (count+0)}'")
  def drive():
   try:self.output.put(run_guest('sudo bash -c '+shlex.quote(nested),timeout=160))
   except Exception as error:self.output.put({'errorType':type(error).__name__})
  self.thread=threading.Thread(target=drive,daemon=True);self.thread.start()
  print('STAGE: isolated scheduler relay trial launched.',flush=True);time.sleep(7)
  assert self.thread.is_alive(),'Relay trial ended before allocation.'

 def finish(self):
  if self.result is not None:return self.result
  self.result={'ruleRemoved':False,'filesCleaned':False,'allocationRelayAccepted':False}
  result=self.result
  if self.thread:
   while self.thread.is_alive():self.thread.join(timeout=15)
   observed=self.output.get_nowait()
   status=observed.get('status',[])
   result['guestTrial']={key:observed.get(key) for key in ('completed','exitCode','status')}
   result['ruleRemoved']='FIXTURE_STATUS:own-relay-rule-removed' in status
   result['runningDockerIds']=[line.split('=',1)[1] for line in status if re.fullmatch('FIXTURE_STATUS:ownDocker=[a-f0-9]{12,64}',line)]
   counters=next((match for line in status if (match:=re.fullmatch(r'FIXTURE_STATUS:relayForwarded=([0-9]+) relayFailures=([0-9]+)',line))),None)
   result['relayForwardedConnections']=int(counters[1]) if counters else 0
   result['relayFailures']=int(counters[2]) if counters else None
   result['allocationRelayAccepted']=bool(observed.get('exitCode')==0 and result['ruleRemoved'] and result['relayForwardedConnections']>0 and result['relayFailures']==0 and 'FIXTURE_STATUS:schedulerPongTimeouts=0' in status)
  try:
   if self.uploaded:
    if self.thread and not result['ruleRemoved'] and self.rule:
     fallback='if '+self.checked+' 2>/dev/null; then '+self.remove+'; fi; if iptables -w 3 -t nat -S PREROUTING >/dev/null && ! '+self.checked+' 2>/dev/null; then echo FIXTURE_STATUS:own-relay-rule-absent; fi'
     confirmed=run_guest('sudo bash -c '+shlex.quote(fallback))
     result['ruleRemoved']='FIXTURE_STATUS:own-relay-rule-absent' in confirmed.get('status',[])
    cleaned=run_guest('rm -f '+shlex.quote(self.guest)+' && echo FIXTURE_STATUS:own-relay-binary-removed')
    assert cleaned.get('exitCode')==0 and 'FIXTURE_STATUS:own-relay-binary-removed' in cleaned.get('status',[])
    cleanup="import pathlib,sys,os,signal,shutil;p=pathlib.Path(sys.argv[1]);assert p.parent==pathlib.Path('/run') and p.name.startswith('community-heartbeat-community-scheduler-relay-');pid=int((p/'server.pid').read_text());assert str(p).encode() in pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes();os.kill(pid,signal.SIGTERM);shutil.rmtree(p)"
    diagnostic.command(['docker','exec','rancher16-legacy-test-host','python3','-c',cleanup,self.private])
   result['filesCleaned']=True
  except Exception as error:result['cleanupErrorType']=type(error).__name__
  if self.owns_state and result['filesCleaned'] and (not self.thread or result['ruleRemoved']):
   assert json.loads(STATE.read_text(encoding='utf-8'))['name']==self.marker
   STATE.unlink()
  return result
