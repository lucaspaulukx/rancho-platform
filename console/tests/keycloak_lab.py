"""Private admin client restricted to the local synthetic realm."""
import json,urllib.request,urllib.parse,urllib.error
class KeycloakLab:
 def __init__(self,password,*,opener=None):
  self.opener=opener or urllib.request.build_opener(urllib.request.ProxyHandler({}));self.bearer=None
  code,body=self.request('/realms/master/protocol/openid-connect/token',{'client_id':'admin-cli','username':'labadmin','password':password,'grant_type':'password'},form=True)
  assert code==200;self.bearer=body['access_token']
 def request(self,path,body=None,method=None,form=False):
  assert path.startswith('/admin/realms/rancher-lab/') or path=='/realms/master/protocol/openid-connect/token'
  headers={'Accept':'application/json'}
  if self.bearer:headers['Authorization']='Bearer '+self.bearer
  if body is not None:headers['Content-Type']='application/x-www-form-urlencoded' if form else 'application/json'
  data=None if body is None else (urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode())
  try:r=self.opener.open(urllib.request.Request('http://localhost:18081'+path,data=data,headers=headers,method=method),timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read();return r.status,json.loads(raw) if raw else None
