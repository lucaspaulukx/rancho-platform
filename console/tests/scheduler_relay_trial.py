"""Opt-in, 120s isolated-guest scheduling experiment; no persistent network or service edits."""
import hashlib,ipaddress,json,queue,re,secrets,shlex,threading,time
from pathlib import Path
import scheduler_heartbeat as diagnostic
from legacy_guest import run_guest

ROOT=diagnostic.ROOT
STATE=ROOT/'console/scheduler-relay-trial-fixture.json'
REPORT=ROOT/'console/scheduler-relay-trial-results.json'
BASE='projects/1a12/'

def main():
 assert not any((ROOT/'console'/name).exists() for name in ('scheduler-relay-trial-fixture.json','scheduler-heartbeat-fixture.json','host-stream-fixture.json'))
 binary=ROOT/'migration-runs/scheduler-probe-build/scheduler-heartbeat-probe';assert binary.is_file()
 admin=diagnostic.lab.session()
 marker='community-scheduler-relay-'+secrets.token_hex(6);private='/run/community-heartbeat-'+marker;guest='/tmp/'+marker
 state={'name':marker,'environment':'1a12','guestBinary':guest,'privateDirectory':private,'stack':None,'service':None,'instances':[]}
 result={'status':'failed','allocationBudgetSeconds':90,'relayWindowSeconds':120,'schedulerPongWindowSeconds':75,'cleanupComplete':False,'scope':'isolated guest; temporary exact scheduler source to local Rancher relay; own 3-replica service'}
 uploaded=False;thread=None;output=queue.Queue();rule=None;rows_before=None
 def rows(kind):return [row for row in admin.api(BASE+kind+'?limit=-1')['data'] if not row.get('removed')]
 def workloads():
  return {row['id']:hashlib.sha256(json.dumps({k:row.get(k) for k in ('launchConfig','secondaryLaunchConfigs','scale','stackId')},sort_keys=True).encode()).hexdigest() for row in rows('services') if row['id']!=state['service']}
 def save():STATE.write_text(json.dumps(state,indent=2),encoding='utf-8')
 try:
  assert admin.api('projects/1a12')['name']=='UI-OPS-LAB'
  host=admin.api(BASE+'hosts/1h1');assert host['state']=='active' and host['agentState']=='active'
  scheduler=next(row for row in rows('containers') if row.get('name')=='scheduler-scheduler-1' and row.get('system'))
  assert scheduler['hostId']=='1h1' and scheduler['networkMode']=='managed' and scheduler['state']=='running'
  cid=scheduler['externalId'];assert re.fullmatch('[a-f0-9]{64}',cid)
  source=ipaddress.IPv4Address(scheduler['primaryIpAddress']);assert source in ipaddress.IPv4Network('10.42.0.0/16') and str(source)!='10.42.0.1'
  meta=run_guest("sudo docker inspect --format 'FIXTURE_STATUS:image={{.Config.Image}} running={{.State.Running}}' "+cid+"; sudo docker exec "+cid+" sh -c 'read mac </sys/class/net/eth0/address; printf \"FIXTURE_STATUS:mac=%s\\n\" \"$mac\"'")
  assert meta.get('exitCode')==0 and 'FIXTURE_STATUS:image=rancher/scheduler:v0.8.6 running=true' in meta.get('status',[])
  mac=next(line.split('=',1)[1] for line in meta['status'] if line.startswith('FIXTURE_STATUS:mac='));assert re.fullmatch(r'(?:[a-f0-9]{2}:){5}[a-f0-9]{2}',mac)
  rule=shlex.join(['-s',str(source)+'/32','-d','172.21.0.4/32','-p','tcp','--dport','8080','-m','mac','--mac-source',mac,'-m','comment','--comment',marker,'-j','DNAT','--to-destination','10.42.0.1:18880'])
  state.update(scheduler=scheduler['id'],schedulerDockerId=cid,source=str(source),sourceMac=mac,rule=rule);save()
  rows_before=(workloads(),{r['id'] for r in rows('containers') if not r.get('system')})
  upload="import pathlib,sys;p=pathlib.Path(sys.argv[1]);p.mkdir(mode=0o700);(p/'probe').write_bytes(sys.stdin.buffer.read())"
  diagnostic.command(['docker','exec','-i','rancher16-legacy-test-host','python3','-c',upload,private],input=binary.read_bytes());uploaded=True
  diagnostic.command(['docker','exec','-d','rancher16-legacy-test-host','python3','-c',diagnostic.SERVER,private]);time.sleep(.5)
  downloaded=run_guest('wget -qO '+shlex.quote(guest)+' http://10.0.2.2:8877/probe && chmod 700 '+shlex.quote(guest)+' && echo FIXTURE_STATUS:relay-binary-ready')
  assert downloaded.get('exitCode')==0 and 'FIXTURE_STATUS:relay-binary-ready' in downloaded.get('status',[])
  rule_cmd='iptables -w 3 -t nat '
  remove=rule_cmd+'-D PREROUTING '+rule
  checked=rule_cmd+'-C PREROUTING '+rule
  listener=shlex.quote(guest)+' relay-window '+str(source)+' 120'
  nested=('set -e; applied=0; relay_pid=0; cleanup() { if [ "$applied" = 1 ]; then '+remove+' && echo FIXTURE_STATUS:own-relay-rule-removed; fi; '
   +'if [ '+shlex.quote(guest)+' -ef "/proc/$relay_pid/exe" ]; then kill "$relay_pid"; fi; }; trap cleanup EXIT; '
   +'if '+checked+' 2>/dev/null; then exit 9; fi; '+listener+' & relay_pid=$!; sleep 1; kill -0 "$relay_pid"; '
   +rule_cmd+'-I PREROUTING 1 '+rule+'; applied=1; echo FIXTURE_STATUS:own-relay-rule-installed; wait "$relay_pid"; '
   +"docker ps --filter label=rancher.console.scheduler-relay="+marker+" --format 'FIXTURE_STATUS:ownDocker={{.ID}}'; "
   +"docker logs --since 75s "+cid+" 2>&1 | awk '/pong timeout/{count++} END{print \"FIXTURE_STATUS:schedulerPongTimeouts=\" (count+0)}'")
  def drive():
   try:output.put(run_guest('sudo bash -c '+shlex.quote(nested),timeout=160))
   except Exception as error:output.put({'errorType':type(error).__name__})
  thread=threading.Thread(target=drive,daemon=True);thread.start()
  print('STAGE: isolated scheduler relay trial launched.',flush=True);time.sleep(7)
  assert thread.is_alive(),'Relay trial ended before allocation.'
  start=time.monotonic()
  stack=admin.api(BASE+'stacks',{'name':marker,'description':marker});state['stack']=stack['id'];save()
  service=admin.api(BASE+'services',{'name':'allocation-check','description':marker,'stackId':stack['id'],'scale':3,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','requestedHostId':'1h1','networkMode':'none','command':['/bin/sh','-c','exec sleep 300'],'labels':{'rancher.console.scheduler-relay':marker}}})
  state['service']=service['id'];save();running=[]
  while time.monotonic()-start<90:
   instances=rows('services/'+service['id']+'/instances')
   identifiers=sorted({*state['instances'],*(row['id'] for row in instances)})
   if identifiers!=state['instances']:state['instances']=identifiers;save()
   running=[row for row in instances if row.get('state')=='running' and row.get('hostId')=='1h1' and re.fullmatch('[a-f0-9]{64}',row.get('externalId') or '')]
   if len(running)==3:break
   time.sleep(1)
  result['allocatedReplicas']=len(running);result['allocationElapsedSeconds']=round(time.monotonic()-start,2)
  print('STAGE: allocation observation complete; waiting for relay window and native Docker check.',flush=True)
  while thread.is_alive():thread.join(timeout=15)
  observed=output.get_nowait();status=observed.get('status',[])
  result['guestTrial']={key:observed.get(key) for key in ('completed','exitCode','status')}
  result['ruleRemoved']='FIXTURE_STATUS:own-relay-rule-removed' in status
  physical={line.split('=',1)[1] for line in status if line.startswith('FIXTURE_STATUS:ownDocker=')}
  result['dockerReplicasMatched']=len(physical)==3 and physical=={row['externalId'][:12] for row in running}
  counters=next((match for line in status if (match:=re.fullmatch(r'FIXTURE_STATUS:relayForwarded=([0-9]+) relayFailures=([0-9]+)',line))),None)
  result['relayForwardedConnections']=int(counters[1]) if counters else 0
  result['relayFailures']=int(counters[2]) if counters else None
  assert observed.get('exitCode')==0 and result['ruleRemoved'] and result['relayForwardedConnections']>0 and result['relayFailures']==0
  assert 'FIXTURE_STATUS:schedulerPongTimeouts=0' in status
  assert result['allocatedReplicas']==3 and result['allocationElapsedSeconds']<=90 and result['dockerReplicasMatched']
  result['status']='passed'
 except Exception as error:result['errorType']=type(error).__name__
 finally:
  if thread:
   while thread.is_alive():thread.join(timeout=15)
   if not output.empty():
    observed=output.get_nowait()
    result['guestTrial']={key:observed.get(key) for key in ('completed','exitCode','status')}
    result['ruleRemoved']='FIXTURE_STATUS:own-relay-rule-removed' in observed.get('status',[])
  try:
   if state['stack']:
    resource=admin.api(BASE+'stacks/'+state['stack']);assert resource['name']==marker and resource['description']==marker
    if not resource.get('removed'):assert admin.request(resource['actions']['remove'],{},'POST')[0] in (200,201,202,204)
    for _ in range(180):
     if admin.api(BASE+'stacks/'+state['stack']).get('removed') and not ({r['id'] for r in rows('containers')} & set(state['instances'])):break
     time.sleep(1)
    else:raise AssertionError('Own stack/instances still cleaning up')
   result['workloadsPreserved']=rows_before is None or rows_before==(workloads(),{r['id'] for r in rows('containers') if not r.get('system')})
  except Exception as error:result['workloadCleanupErrorType']=type(error).__name__
  try:
   if uploaded:
    if thread and not result.get('ruleRemoved') and rule:
     fallback='if '+checked+' 2>/dev/null; then '+remove+'; fi; if ! '+checked+' 2>/dev/null; then echo FIXTURE_STATUS:own-relay-rule-absent; fi'
     confirmed=run_guest('sudo bash -c '+shlex.quote(fallback))
     result['ruleRemoved']='FIXTURE_STATUS:own-relay-rule-absent' in confirmed.get('status',[])
    cleaned=run_guest('rm -f '+shlex.quote(guest)+' && echo FIXTURE_STATUS:own-relay-binary-removed')
    assert cleaned.get('exitCode')==0
    cleanup="import pathlib,sys,os,signal,shutil;p=pathlib.Path(sys.argv[1]);assert p.parent==pathlib.Path('/run') and p.name.startswith('community-heartbeat-community-scheduler-relay-');pid=int((p/'server.pid').read_text());assert str(p).encode() in pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes();os.kill(pid,signal.SIGTERM);shutil.rmtree(p)"
    diagnostic.command(['docker','exec','rancher16-legacy-test-host','python3','-c',cleanup,private])
   result['filesCleaned']=True
  except Exception as error:result['fileCleanupErrorType']=type(error).__name__
  result['ownSessionRevoked']=admin.request('/v2-beta/token/current',None,'DELETE')[0] in (200,204)
  result['cleanupComplete']=bool(result.get('workloadsPreserved') and result.get('filesCleaned') and result['ownSessionRevoked'] and (thread is None or result.get('ruleRemoved')))
  if result['cleanupComplete']:STATE.unlink(missing_ok=True)
  REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps(result,indent=2),flush=True)
 return 0 if result['status']=='passed' and result['cleanupComplete'] else 1
if __name__=='__main__':raise SystemExit(main())
