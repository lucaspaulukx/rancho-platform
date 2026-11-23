"""Own empty bridge only; never stops endpoints or changes existing networks."""
import ipaddress,json,os,secrets,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];name='rancher16-network-test-'+secrets.token_hex(6);created_id=None;checks=[]
def inspect(target):
 r=subprocess.run(['docker','network','inspect',target],capture_output=True,text=True)
 return json.loads(r.stdout)[0] if r.returncode==0 else None
def check(label,ok=True):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
ids=subprocess.run(['docker','network','ls','-q'],capture_output=True,text=True,check=True).stdout.split()
existing=json.loads(subprocess.run(['docker','network','inspect',*ids],capture_output=True,text=True,check=True).stdout)
subnets=[ipaddress.ip_network(c['Subnet']) for n in existing for c in (n['IPAM'].get('Config') or []) if c.get('Subnet')]
candidates=(ipaddress.ip_network('172.31.'+str(i)+'.0/24') for i in range(128,255))
network=next(candidate for candidate in candidates if not any(candidate.overlaps(v) for v in subnets if v.version==4))
env={**os.environ,'RANCHER_LAB_NETWORK':name,'RANCHER_LAB_SUBNET':str(network),'RANCHER_LAB_SERVER_IPV4':str(network.network_address+4),'RANCHER_LAB_CONSOLE_IPV4':str(network.network_address+6)}
def run(patch=None):return subprocess.run([sys.executable,str(ROOT/'ensure-lab-network.py')],env={**env,**(patch or {})},capture_output=True,text=True,timeout=30)
assert inspect(name) is None
try:
 r=run();check('missing dedicated bridge is created',r.returncode==0 and json.loads(r.stdout)['created'])
 current=inspect(name);created_id=current['Id'];assert not current['Containers']
 r=run();check('second run preserves exact bridge ID',r.returncode==0 and not json.loads(r.stdout)['created'] and inspect(name)['Id']==created_id)
 cases=[{'RANCHER_LAB_NETWORK':'corporate-network'},{'RANCHER_LAB_SERVER_IPV4':str(network.network_address+1)},{'RANCHER_LAB_CONSOLE_IPV4':env['RANCHER_LAB_SERVER_IPV4']},{'RANCHER_LAB_SUBNET':'10.255.254.0/24','RANCHER_LAB_SERVER_IPV4':'10.255.254.4','RANCHER_LAB_CONSOLE_IPV4':'10.255.254.6'}]
 for index,patch in enumerate(cases):check('invalid network configuration '+str(index+1)+' refuses mutation',run(patch).returncode!=0 and inspect(name)['Id']==created_id)
finally:
 current=inspect(name)
 if current is not None:
  assert created_id and current['Id']==created_id and not current['Containers'] and name.startswith('rancher16-network-test-')
  subprocess.run(['docker','network','rm',name],capture_output=True,text=True,check=True)
check('only own empty bridge removed',inspect(name) is None)
for n in existing:
 current=inspect(n['Name']);assert current and current['Id']==n['Id']
check('all previously existing network IDs preserved')
(ROOT/'console/lab-network-preflight-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
