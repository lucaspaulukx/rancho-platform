"""Create only a missing lab bridge; validate existing network without changing it."""
import ipaddress,json,os,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
keys={'RANCHER_LAB_NETWORK','RANCHER_LAB_SUBNET','RANCHER_LAB_SERVER_IPV4','RANCHER_LAB_CONSOLE_IPV4'}
values={}
if (root/'.env').exists():
 for line in (root/'.env').read_text(encoding='utf-8').splitlines():
  key,sep,value=line.partition('=')
  if sep and key in keys:values[key]=value.strip().strip('"').strip("'")
values.update({k:os.environ[k] for k in keys if k in os.environ})
name=values.get('RANCHER_LAB_NETWORK','rancher16-rbac-lab_default')
assert re.fullmatch(r'rancher16-[a-z0-9_-]{1,80}',name),'Use a dedicated rancher16 lab network'
network=ipaddress.ip_network(values.get('RANCHER_LAB_SUBNET','172.21.0.0/16'),strict=True)
assert network.version==4 and network.is_private
server=ipaddress.ip_address(values.get('RANCHER_LAB_SERVER_IPV4','172.21.0.4'));console=ipaddress.ip_address(values.get('RANCHER_LAB_CONSOLE_IPV4','172.21.0.6'))
assert server in network and console in network and server!=console
assert all(v not in (network.network_address,network.broadcast_address,network.network_address+1) for v in (server,console))
r=subprocess.run(['docker','network','inspect',name],capture_output=True,text=True)
created=False
if r.returncode:
 inventory=subprocess.run(['docker','network','ls','--format','{{.Name}}'],capture_output=True,text=True,check=True)
 assert name not in inventory.stdout.splitlines(),'Existing network inspection failed'
 subprocess.run(['docker','network','create','--driver','bridge','--subnet',str(network),name],capture_output=True,text=True,check=True);created=True
 r=subprocess.run(['docker','network','inspect',name],capture_output=True,text=True,check=True)
info=json.loads(r.stdout)[0]
assert info['Driver']=='bridge' and any(c.get('Subnet')==str(network) for c in info['IPAM']['Config']),'Existing network subnet/driver differs; refusing to replace it'
assert all(c.get('Name','').startswith('rancher16-') for c in info.get('Containers',{}).values()),'Unrelated endpoint on lab network; refusing to change it'
for c in info.get('Containers',{}).values():
 ip=c.get('IPv4Address','').split('/')[0]
 if ip==str(server):assert c['Name']=='rancher16-rbac-lab','Reserved server address occupied'
 if ip==str(console):assert c['Name']=='rancher16-community-console','Reserved console address occupied'
print(json.dumps({'network':name,'subnet':str(network),'created':created,'existingNetworkPreserved':not created,'reservedAddressesValidated':True}))
