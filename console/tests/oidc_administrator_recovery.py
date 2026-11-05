"""Synthetic OIDC administrator; restore hybrid mode before exact fixture cleanup."""
import hashlib,importlib.util,json,secrets,subprocess,time,urllib.parse,urllib.request
from pathlib import Path
from keycloak_lab import KeycloakLab
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/oidc-admin-fixture.json';OVERLAY=ROOT/'console/oidc-admin-policy-fixture.yaml'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
def session():
 u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));return u
u=session();u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);kc=KeycloakLab(lab.CONFIG['KEYCLOAK_ADMIN_PASSWORD']);username='console-oidc-admin-'+secrets.token_hex(6);password=secrets.token_urlsafe(24);marker='Disposable OIDC admin '+username;checks=[];applied=False;outcome='failed'
assert not STATE.exists() and not OVERLAY.exists(),'Recover previous OIDC admin fixture first'
def check(label,ok=True):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def accounts():return {a['id']:{k:a.get(k) for k in ('name','kind','state','description')} for a in u.api('accounts?limit=-1')['data'] if not a.get('removed') and a.get('kind') in ('user','admin')}
def groups():return hashlib.sha256(json.dumps(u.api('localGroups')['data'],sort_keys=True).encode()).hexdigest()
def projects():return {a['id']:a.get('name') for a in u.api('projects?all=true&limit=-1')['data'] if not a.get('removed')}
def mode():return u.request('/oidc/config')[1]['effective']['OIDC_ONLY']
assert mode() is False
before_accounts=accounts();before_groups=groups();before_projects=projects();state={'name':username,'marker':marker,'account':None,'keycloakUser':None,'baselineAccounts':before_accounts,'baselineGroups':before_groups,'baselineProjects':before_projects,'exclusiveOverlayApplied':False}
def save():STATE.write_text(json.dumps(state,indent=2),encoding='utf-8')
def compose(extra=False):
 args=['docker','compose','-f','compose.yaml','-f','compose.console.yaml','-f','compose.legacy-host.yaml']
 if extra:args+=['-f',str(OVERLAY)]
 subprocess.run(args+['up','-d','--no-deps','rancher'],cwd=ROOT,capture_output=True,text=True,check=True,timeout=120)
def wait_mode(expected):
 for _ in range(65):
  try:
   if mode() is expected:return
  except Exception:pass
  time.sleep(1)
 raise AssertionError('OIDC policy did not converge')
def wait_account(predicate):
 for _ in range(65):
  current=u.api('accounts/'+state['account'])
  if predicate(current):return current
  time.sleep(.3)
 raise AssertionError('Own OIDC account did not converge')
def action(current,key):
 target=urllib.parse.urlparse(current['actions'][key]);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/accounts/'+state['account'] and target.query=='action='+key
 code,_,_=u.request(current['actions'][key],{},'POST');assert code in (200,201,202,204)
def browser(label,exclusive):
 runtime=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
 private={'root':str(ROOT),'runtimeModules':str(runtime/'node_modules'),'browserExecutable':str(Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'),'username':username,'password':password,'exclusive':exclusive,'mode':label}
 r=subprocess.run([str(runtime/'bin/node.exe'),str(ROOT/'console/tests/e2e/oidc-administrator.cjs')],input=json.dumps(private),text=True,encoding='utf-8',timeout=90);assert r.returncode==0
save()
try:
 code,_=kc.request('/admin/realms/rancher-lab/users',{'username':username,'enabled':True,'firstName':'Console Fixture','lastName':username,'email':username+'@example.invalid','emailVerified':True,'attributes':{'consoleFixtureMarker':[marker]},'credentials':[{'type':'password','value':password,'temporary':False}]});assert code==201
 code,found=kc.request('/admin/realms/rancher-lab/users?username='+username+'&exact=true');assert code==200 and len(found)==1 and found[0]['username']==username;state['keycloakUser']=found[0]['id'];save()
 lab.CONFIG['LAB_USER_PASSWORD']=password;identity=session();token,_=identity.oidc(username);state['account']=token['accountId'];save();check('first synthetic OIDC login is ordinary with zero environments',token['userType']=='user' and identity.api('projects')['data']==[])
 check('ordinary identity cannot read group administration',identity.request('/v2-beta/localGroups')[0] in (403,404))
 current=u.api('accounts/'+state['account']);assert current['name']==username and current['id'] not in before_accounts and current['kind']=='user' and current['state']=='active'
 u.api('accounts/'+state['account'],{'name':username,'description':marker,'kind':'admin'},method='PUT');identity=session();token,_=identity.oidc(username);check('explicit Rancher promotion grants application administrator',token['userType']=='admin' and isinstance(identity.api('localGroups')['data'],list));browser('hybrid',False)
 OVERLAY.write_text('services:\n  rancher:\n    environment:\n      RANCHER_OIDC_ONLY: "true"\n      RANCHER_OIDC_AUTO_LOGIN: "false"\n',encoding='utf-8');applied=True;state['exclusiveOverlayApplied']=True;save();compose(True);wait_mode(True);check('exclusive OIDC policy becomes effective')
 anonymous=session();code,_,_=anonymous.request('/v2-beta/token',{'code':'labadmin:'+lab.CONFIG['RANCHER_ADMIN_PASSWORD']});check('exclusive mode rejects fresh local credential login',code in (401,403));check('exclusive mode rejects previous local session',u.request('/v2-beta/projects?limit=1')[0]==401)
 exclusive=session();token,_=exclusive.oidc(username);check('OIDC administrator retains native administration in exclusive mode',token['userType']=='admin' and isinstance(exclusive.api('localGroups')['data'],list));browser('exclusive',True)
 outcome='passed'
except Exception as error:
 checks.append({'check':'OIDC administrator execution','status':'failed','errorType':type(error).__name__});raise
finally:
 if applied:
  compose(False);wait_mode(False);state['exclusiveOverlayApplied']=False;save()
  check('base hybrid policy restored without editing persistent deployment configuration')
 u=session();u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);check('local administrative recovery works after exclusive mode')
 if state['account'] is None:
  candidates=[a for a in u.api('accounts?limit=-1')['data'] if a.get('name')==username and a['id'] not in before_accounts and not a.get('removed')]
  assert len(candidates)<=1
  if candidates:state['account']=candidates[0]['id'];save()
 if state['account']:
  current=u.api('accounts/'+state['account']);assert current['name']==username and current['id'] not in before_accounts and current.get('description') in (None,marker)
  if current['kind']=='admin':u.api('accounts/'+state['account'],{'kind':'user','description':marker},method='PUT');current=u.api('accounts/'+state['account'])
  if not current.get('removed'):
   if current['state']=='active':action(current,'deactivate');current=wait_account(lambda a:a['state']=='inactive')
   action(current,'remove');wait_account(lambda a:bool(a.get('removed')))
  check('only own synthetic Rancher account demoted and removed')
 if state['keycloakUser']:
  kc=KeycloakLab(lab.CONFIG['KEYCLOAK_ADMIN_PASSWORD'])
  code,current=kc.request('/admin/realms/rancher-lab/users/'+state['keycloakUser']);assert code==200 and current['username']==username and current['id']==state['keycloakUser'] and current.get('lastName') in (None,username)
  code,_=kc.request('/admin/realms/rancher-lab/users/'+state['keycloakUser'],method='DELETE');assert code==204
  check('only own Keycloak test identity removed')
 check('previous accounts groups and environments preserved',accounts()==before_accounts and groups()==before_groups and projects()==before_projects)
 (ROOT/'console/oidc-administrator-native-results.json').write_text(json.dumps({'status':outcome,'checks':checks},indent=2)+'\n',encoding='utf-8');STATE.unlink();OVERLAY.unlink(missing_ok=True)
