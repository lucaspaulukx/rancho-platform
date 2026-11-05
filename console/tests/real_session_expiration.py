"""New tokens only; restore exact expiry setting before browser wait. No JWT artifacts."""
import importlib.util,json,subprocess,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; MANIFEST=ROOT/'console/real-expiration-fixture.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
def session():
 u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));return u
checks=[]
def check(label,ok=True):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);name='api.auth.jwt.token.expiry';path='settings/'+name
assert not MANIFEST.exists(),'Recover own expiry setting before next run'
before=admin.api(path);assert before['name']==name and str(before['activeValue']).isdigit() and int(before['activeValue'])>=120000
original={k:before.get(k) for k in ('name','value','activeValue','inDb')}; MANIFEST.write_text(json.dumps(original,indent=2),encoding='utf-8')
def wait(predicate):
 for _ in range(40):
  current=admin.api(path)
  if predicate(current):return current
  time.sleep(.25)
 raise AssertionError('Expiry configuration did not converge')
sessions=[]
try:
 admin.api(path,{'name':name,'value':'45000'},method='PUT')
 wait(lambda c:str(c.get('activeValue'))=='45000');check('short lifetime effective for newly issued sessions')
 local=session();token=local.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);assert token.get('jwt');sessions.append({'kind':'local','token':token['jwt']})
 oidc=session();token,_=oidc.oidc('leitor');assert token.get('jwt');sessions.append({'kind':'oidc','token':token['jwt']})
 check('native local and OIDC tokens issued without changing users or grants')
finally:
 current=admin.api(path);assert current['name']==name
 if current.get('inDb') and str(current.get('value'))=='45000':
  if original['inDb']:admin.api(path,{'name':name,'value':original['value']},method='PUT')
  else:admin.api(path,method='DELETE')
 else:assert all(current.get(k)==original[k] for k in ('value','inDb')),'Concurrent setting change; do not overwrite it'
 wait(lambda c:all(c.get(k)==original[k] for k in ('value','activeValue','inDb')))
 check('exact original expiry override/default restored before waiting');MANIFEST.unlink()
runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
private={'sessions':sessions,'root':str(ROOT),'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe')}
r=subprocess.run([str(runtime/'bin/node.exe'),str(ROOT/'console/tests/e2e/real-expiration.cjs')],input=json.dumps(private),text=True,encoding='utf-8',timeout=150)
check('isolated browser authenticates then rejects both genuinely expired sessions',r.returncode==0)
code,current,_=admin.request('/v2-beta/token');check('preexisting administrator session remains authenticated',code==200 and bool(current.get('data',[{}])[0].get('userIdentity')))
current=admin.api(path);check('expiry setting still equals original state',all(current.get(k)==original[k] for k in ('value','activeValue','inDb')))
(ROOT/'console/real-expiration-native-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
