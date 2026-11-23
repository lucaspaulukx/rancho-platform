"""One owned synthetic container; verify selected Docker HostConfig fields only."""
import importlib.util, json, re, secrets, time, urllib.request
from pathlib import Path
from legacy_guest import run_guest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12/'; resource=None; checks=[]
name='console-security-physical-'+secrets.token_hex(6)
def check(label,condition):
 assert condition,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def rows(path):return [v for v in u.api(base+path+'?limit=-1')['data'] if not v.get('removed')]
before={v['id'] for v in rows('containers')};volumes={v['id'] for v in rows('volumes')}
def wait(resource,predicate):
 for _ in range(120):
  value=u.api(base+'containers/'+resource['id'])
  if predicate(value):return value
  time.sleep(.5)
 raise AssertionError('Owned physical container did not stabilize')
report={}
try:
 host=u.api(base+'hosts/1h1');check('original sandbox host and agent active',host['state']=='active' and host['agentState']=='active')
 resource=u.api(base+'containers',{'name':name,'description':name,'imageUuid':'docker:alpine:3.20','requestedHostId':'1h1','networkMode':'none','command':['/bin/sh','-c','exec sleep 86400'],'memory':134217728,'memoryReservation':67108864,'privileged':False,'readOnly':True,'capAdd':['NET_BIND_SERVICE'],'capDrop':['ALL'],'startOnCreate':True})
 resource=wait(resource,lambda v:v['state']=='running' and v.get('externalId'))
 check('owned standalone container runs on original host',resource['hostId']=='1h1')
 docker_id=resource['externalId'];assert re.fullmatch('[a-f0-9]{12,64}',docker_id)
 fmt='FIXTURE_STATUS:memory={{.HostConfig.Memory}} reservation={{.HostConfig.MemoryReservation}} readonly={{.HostConfig.ReadonlyRootfs}} privileged={{.HostConfig.Privileged}} add={{range .HostConfig.CapAdd}}{{.}} {{end}} drop={{range .HostConfig.CapDrop}}{{.}} {{end}}'
 result=run_guest("sudo docker inspect --format '"+fmt+"' "+docker_id)
 raw=' '.join(result.get('status',[]))
 check('private guest inspection completed',result.get('exitCode')==0 and result.get('completed'))
 for field in ['memory=134217728','reservation=67108864','readonly=true','privileged=false','add=NET_BIND_SERVICE','drop=ALL']:
  check('Docker applies '+field,field in raw)
 report['status']='passed'
finally:
 if resource:
  current=u.api(base+'containers/'+resource['id']);assert current['name']==name and current['description']==name and current['accountId']=='1a12' and current['id'] not in before
  if current['state']=='running':
   u.request(current['actions']['stop'],{},'POST');current=wait(resource,lambda v:v['state']=='stopped')
  if not current.get('removed'):u.request(current['actions']['remove'],{},'POST')
  wait(resource,lambda v:bool(v.get('removed')))
 check('previous containers and volumes preserved after cleanup',{v['id'] for v in rows('containers')}==before and {v['id'] for v in rows('volumes')}==volumes)
 report['checks']=checks;report['scope']='one original host; no multi-host/OOM/privileged execution'
 (ROOT/'console/physical-resource-security-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
