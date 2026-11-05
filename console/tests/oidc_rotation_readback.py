"""Verify local OIDC after secret rotation; never writes session credentials to artifacts."""
import importlib.util,json,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
def session():
 u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));return u
ready=False
for _ in range(45):
 try:
  admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);reader=session();token,_=reader.oidc('leitor');assert token['userType']=='user';assert reader.api('projects')['data'] is not None;ready=True;break
 except Exception:time.sleep(1)
assert ready,'Local authentication/OIDC did not recover after rotation'
sem=session();token,_=sem.oidc('sem-acesso');assert token['userType']=='user' and sem.api('projects')['data']==[]
path=ROOT/'console/oidc-secret-rotation-results.json';report=json.loads(path.read_text(encoding='utf-8'));report.update({'deploymentRestartPending':False,'localLoginVerified':True,'oidcAuthorizationCodeVerified':True,'ordinaryUsersNotPromoted':True,'zeroAccessUserStillHasNoEnvironments':True});path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if isinstance(v,bool)}))
