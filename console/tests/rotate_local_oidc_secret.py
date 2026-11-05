"""Rotate only the local lab OIDC client; never print credentials or tokens."""
import base64,importlib.util,json,subprocess,urllib.request,urllib.parse,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));BASE='http://localhost:18081'
def request(path,body=None,method=None,bearer=None,basic=None,form=False):
 headers={'Accept':'application/json'}
 if bearer:headers['Authorization']='Bearer '+bearer
 if basic:headers['Authorization']='Basic '+base64.b64encode(basic.encode()).decode()
 if body is not None:headers['Content-Type']='application/x-www-form-urlencoded' if form else 'application/json'
 data=None if body is None else (urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode())
 try:r=opener.open(urllib.request.Request(BASE+path,data=data,headers=headers,method=method),timeout=20)
 except urllib.error.HTTPError as e:r=e
 raw=r.read()
 return r.status,json.loads(raw) if raw else None
code,auth=request('/realms/master/protocol/openid-connect/token',{'client_id':'admin-cli','username':'labadmin','password':lab.CONFIG['KEYCLOAK_ADMIN_PASSWORD'],'grant_type':'password'},form=True);assert code==200
bearer=auth['access_token'];code,clients=request('/admin/realms/rancher-lab/clients?clientId=rancher16',bearer=bearer);assert code==200 and len(clients)==1 and clients[0]['clientId']=='rancher16'
client=clients[0];old=lab.CONFIG['OIDC_CLIENT_SECRET'];code,fresh=request('/admin/realms/rancher-lab/clients/'+client['id']+'/client-secret',{},bearer=bearer);assert code==200 and fresh.get('value') and fresh['value']!=old
new=fresh['value']
# Persist immediately in the existing private source of deployment credentials.
p=ROOT/'.env';lines=p.read_text(encoding='utf-8').splitlines();assert sum(v.startswith('OIDC_CLIENT_SECRET=') for v in lines)==1
p.write_text('\n'.join('OIDC_CLIENT_SECRET='+new if v.startswith('OIDC_CLIENT_SECRET=') else v for v in lines)+'\n',encoding='utf-8')
realm_path=ROOT/'keycloak/realm.json';realm=json.loads(realm_path.read_text(encoding='utf-8'));matches=[c for c in realm['clients'] if c['clientId']=='rancher16'];assert len(matches)==1
matches[0]['secret']='${OIDC_CLIENT_SECRET}'
for port in (18080,18090):
 uri='http://localhost:'+str(port)+'/oidc/callback';origin='http://localhost:'+str(port)
 if uri not in matches[0]['redirectUris']:matches[0]['redirectUris'].append(uri)
 if origin not in matches[0]['webOrigins']:matches[0]['webOrigins'].append(origin)
for user in realm.get('users',[]):
 for credential in user.get('credentials',[]):
  if credential.get('type')=='password':credential['value']='${LAB_USER_PASSWORD}'
realm_path.write_text(json.dumps(realm,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
p=ROOT/'compose.yaml';compose=p.read_text(encoding='utf-8');needle='      KC_BOOTSTRAP_ADMIN_USERNAME: labadmin\n';assert needle in compose
if '      OIDC_CLIENT_SECRET: ${OIDC_CLIENT_SECRET}' not in compose:compose=compose.replace(needle,'      OIDC_CLIENT_SECRET: ${OIDC_CLIENT_SECRET}\n      LAB_USER_PASSWORD: ${LAB_USER_PASSWORD}\n'+needle)
p.write_text(compose,encoding='utf-8')
path='/realms/rancher-lab/protocol/openid-connect/token/introspect'
old_code,_=request(path,{'token':'console-invalid-fixture'},basic='rancher16:'+old,form=True)
if old_code!=401:
 code,_=request('/admin/realms/rancher-lab/clients/'+client['id']+'/client-secret/rotated',method='DELETE',bearer=bearer);assert code in (204,404)
 old_code,_=request(path,{'token':'console-invalid-fixture'},basic='rancher16:'+old,form=True)
new_code,response=request(path,{'token':'console-invalid-fixture'},basic='rancher16:'+new,form=True)
assert old_code==401 and new_code==200 and response.get('active') is False
report={'rotatedLocalClientOnly':True,'oldSecretRejected':True,'newSecretAuthenticates':True,'realmUsesEnvironmentPlaceholders':True,'redirectsCoverClassicAndConsole':True,'credentialsPrinted':False,'deploymentRestartPending':True}
(ROOT/'console/oidc-secret-rotation-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
