"""Allow the independent console callback in the existing disposable Keycloak client."""
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
secrets=dict(line.split('=',1) for line in (ROOT/'.env').read_text().splitlines() if '=' in line)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def request(path,body=None,method=None,token=None,form=False):
    data=None if body is None else (urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode())
    headers={'Content-Type':'application/x-www-form-urlencoded' if form else 'application/json'}
    if token:headers['Authorization']='Bearer '+token
    with opener.open(urllib.request.Request('http://localhost:18081'+path,data=data,headers=headers,method=method),timeout=15) as response:
        raw=response.read()
        return json.loads(raw) if raw else None

auth=request('/realms/master/protocol/openid-connect/token',{'grant_type':'password','client_id':'admin-cli','username':'labadmin','password':secrets['KEYCLOAK_ADMIN_PASSWORD']},form=True)['access_token']
clients=request('/admin/realms/rancher-lab/clients?clientId=rancher16',token=auth)
if len(clients)!=1:raise RuntimeError('Expected exactly one laboratory Rancher client')
client=request('/admin/realms/rancher-lab/clients/'+clients[0]['id'],token=auth)
callback='http://localhost:18090/oidc/callback'
client['redirectUris']=list(dict.fromkeys(client.get('redirectUris',[])+[callback]))
request('/admin/realms/rancher-lab/clients/'+client['id'],client,'PUT',auth)
print('Independent console callback registered; existing callback preserved.')
