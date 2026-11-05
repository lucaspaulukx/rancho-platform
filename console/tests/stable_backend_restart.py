"""Restart only the named lab backend; preserve address, volumes and access state."""
import hashlib,importlib.util,json,subprocess,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);checks=[]
def check(label,ok=True):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def inspect(kind,name):return json.loads(subprocess.run(['docker',kind,'inspect',name],capture_output=True,text=True,check=True).stdout)[0]
def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def projects():return {v['id']:v.get('name') for v in u.api('projects?all=true&limit=-1')['data'] if not v.get('removed')}
def groups():return digest(u.api('localGroups')['data'])
before=inspect('container','rancher16-rbac-lab');network=inspect('network','rancher16-rbac-lab_default');endpoint=before['NetworkSettings']['Networks']['rancher16-rbac-lab_default'];ip=endpoint['IPAddress'];assert ip=='172.21.0.4' and endpoint['IPAMConfig']['IPv4Address']==ip
mounts=sorted((v['Destination'],v.get('Name')) for v in before['Mounts']);prior_projects=projects();prior_groups=groups()
assert inspect('container','rancher16-rbac-baseline')['State']['Running'] is False
subprocess.run(['docker','restart','rancher16-rbac-lab'],capture_output=True,text=True,check=True,timeout=90)
start=time.monotonic();ready=False
for _ in range(90):
 try:
  code,token,_=u.request('/v2-beta/token')
  if code==200 and isinstance(token,dict) and token.get('data',[{}])[0].get('userIdentity'):ready=True;break
 except Exception:pass
 time.sleep(1)
check('same preexisting session authenticates after backend restart',ready)
after=inspect('container','rancher16-rbac-lab');current=after['NetworkSettings']['Networks']['rancher16-rbac-lab_default']
check('reserved backend address and IPAM setting survive restart',current['IPAddress']==ip and current['IPAMConfig']['IPv4Address']==ip)
check('same persistent volumes retained',sorted((v['Destination'],v.get('Name')) for v in after['Mounts'])==mounts)
check('existing network ID preserved',inspect('network','rancher16-rbac-lab_default')['Id']==network['Id'])
check('environment identities and local groups preserved',projects()==prior_projects and groups()==prior_groups)
ready=False
for _ in range(70):
 host=u.api('projects/1a12/hosts/1h1');infra=[v for v in u.api('projects/1a12/services?limit=-1')['data'] if v.get('system') and not v.get('removed')]
 if host['state']=='active' and host.get('agentState')=='active' and len(infra)==6 and all(v['state']=='active' and v.get('healthState')=='healthy' for v in infra):ready=True;break
 time.sleep(1)
check('original agent and six native services recover without re-registration',ready)
check('shared-database baseline remains stopped',not inspect('container','rancher16-rbac-baseline')['State']['Running'])
(ROOT/'console/stable-backend-restart-results.json').write_text(json.dumps({'checks':checks,'scope':'named backend container only; no Docker Desktop restart','observationSeconds':round(time.monotonic()-start,2)},indent=2)+'\n',encoding='utf-8')
