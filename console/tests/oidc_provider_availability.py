"""Controlled local IdP outage; restore provider and original policy in finally."""
import hashlib,importlib.util,json,subprocess,time,traceback,urllib.request,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/oidc-availability-fixture.json';OVERLAY=ROOT/'console/oidc-availability-policy-fixture.yaml'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
def session():
 u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));return u
u=session();checks=[];audits=[];applied=False;provider_stopped=False;browser=None;outcome='failed';failure_locations=[]
def check(label,ok=True):
 assert ok,label
 checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def docker(*args):return subprocess.run(['docker',*args],capture_output=True,text=True,check=True,timeout=120,cwd=ROOT)
def status():return u.request('/oidc/status')[1]
def policy():return u.request('/oidc/config')[1]['effective']
def wait(read,predicate,attempts=65):
 for _ in range(attempts):
  try:
   result=read()
   if predicate(result):return result
  except Exception:pass
  time.sleep(1)
 raise AssertionError('Local policy/provider did not converge')
def accounts():return {a['id']:{k:a.get(k) for k in ('name','kind','state','description')} for a in u.api('accounts?limit=-1')['data'] if not a.get('removed') and a.get('kind') in ('user','admin')}
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def compose(extra=False):
 args=['compose','-f','compose.yaml','-f','compose.console.yaml','-f','compose.legacy-host.yaml']
 if extra:args+=['-f',str(OVERLAY)]
 docker(*args,'up','-d','--no-deps','rancher')
def configure(only,auto,preflight=True):
 global applied
 OVERLAY.write_text('services:\n  rancher:\n    environment:\n      RANCHER_OIDC_LOGIN_PREFLIGHT_ENABLED: "'+str(preflight).lower()+'"\n      RANCHER_OIDC_ONLY: "'+str(only).lower()+'"\n      RANCHER_OIDC_AUTO_LOGIN: "'+str(auto).lower()+'"\n',encoding='utf-8')
 applied=True;state['overlayApplied']=True;save();compose(True)
 wait(status,lambda s:s.get('preflight') is preflight and s.get('only') is only and s.get('autoLogin') is auto)
def stop_provider():
 global provider_stopped
 provider_stopped=True;state['providerStopped']=True;save();docker('stop','rancher16-keycloak-lab')
def start_provider():
 global provider_stopped
 docker('start','rancher16-keycloak-lab');provider_stopped=False;state['providerStopped']=False;save()
 wait(provider_document,lambda r:r.get('issuer')=='http://localhost:18081/realms/rancher-lab')
 wait(lambda:u.request('/oidc/readiness'),lambda r:r[0]==200 and isinstance(r[1],dict) and r[1].get('ready') is True)
def provider_document():
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
 with opener.open('http://localhost:18081/realms/rancher-lab/.well-known/openid-configuration',timeout=10) as response:return json.load(response)
def context():
 c=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR',color_scheme='dark')
 def route(r):
  req=r.request;url=urllib.parse.urlparse(req.url)
  if url.netloc not in ('localhost:18090','localhost:18081'):return r.abort()
  if req.method not in ('GET','HEAD') and not (url.path=='/v2-beta/token' or (url.netloc=='localhost:18081' and url.path.startswith('/realms/rancher-lab/login-actions/'))):raise AssertionError('Unexpected business mutation in login preview')
  r.continue_()
 c.route('**/*',route);return c
ERROR='Não foi possível acessar o provedor de login. Tente novamente.'
def failed_login(page,auto=False):
 counter=[];page.on('request',lambda r:counter.append(1) if urllib.parse.urlparse(r.url).path=='/oidc/readiness' else None)
 page.goto(lab.BASE+'/console/login')
 if not auto:page.get_by_role('button',name='Entrar com Keycloak',exact=True).click()
 expect(page.get_by_role('alert')).to_contain_text(ERROR,timeout=30000)
 expect(page.get_by_role('button',name='Entrar com Keycloak',exact=True)).to_be_enabled()
 assert urllib.parse.urlparse(page.url).netloc=='localhost:18090'
 page.wait_for_timeout(1500);assert len(counter)==1
 return counter
assert not STATE.exists() and not OVERLAY.exists()
assert docker('inspect','--format','{{.State.Running}}','rancher16-keycloak-lab').stdout.strip()=='true'
wait(lambda:u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']),lambda r:bool(r.get('userIdentity')))
before=policy();assert before.get('OIDC_ONLY') is False and before.get('OIDC_AUTO_LOGIN') is False
baseline_accounts=accounts();baseline_groups=digest(u.api('localGroups')['data']);baseline_projects={p['id']:p.get('name') for p in u.api('projects?all=true&limit=-1')['data'] if not p.get('removed')}
state={'overlayApplied':False,'providerStopped':False,'baselineAccounts':baseline_accounts,'baselineGroups':baseline_groups,'baselineProjects':baseline_projects}
def save():STATE.write_text(json.dumps(state,indent=2),encoding='utf-8')
save()
try:
 if before.get('OIDC_LOGIN_PREFLIGHT_ENABLED'):configure(False,False,False)
 stop_provider();code,body,_=u.request('/oidc/readiness');check('feature off skips provider probe without changing login policy',code==200 and body.get('ready') is True and body.get('checked') is False and status().get('preflight') is False);start_provider()
 with sync_playwright() as playwright:
  executable=Path.home()/'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
  browser=playwright.chromium.launch(headless=True,executable_path=str(executable))
  axe=(ROOT/'console/node_modules/axe-core/axe.min.js').read_text(encoding='utf-8')
  for name,only,auto in [('hybrid',False,False),('exclusive',True,False),('automatic',True,True)]:
   configure(only,auto);stop_provider();code,body,_=u.request('/oidc/readiness');check(name+': backend reports provider outage with safe response',code==503 and body=={'ready':False,'checked':True})
   c=context()
   try:
    page=c.new_page();counter=failed_login(page,auto);check(name+': login stays in console with actionable error and no retry loop')
    expect(page.get_by_label('Usuário',exact=True)).to_have_count(0 if only else 1)
    check(name+': exclusive policy never reveals local fallback' if only else name+': hybrid local method remains visible')
    if name=='hybrid':
     for theme in ('dark','light'):
      for width in (1440,390):
       page.set_viewport_size({'width':width,'height':1000})
       toggle=page.get_by_role('button',name='Usar tema escuro' if theme=='dark' else 'Usar tema claro',exact=True)
       if toggle.count():toggle.click()
       page.wait_for_function('mode => document.documentElement.dataset.theme === mode',arg=theme)
       page.evaluate("async () => {await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));}")
       page.evaluate(axe);violations=page.evaluate("async () => (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact}))")
       overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
       audits.append({'theme':theme,'width':width,'violations':violations,'overflow':overflow});assert not violations and not overflow;check('provider error accessibility/layout '+theme+' '+str(width))
       page.screenshot(path=str(ROOT/'evidence/e2e-isolated'/('oidc-outage-'+theme+'-'+str(width)+'.png')),animations='disabled')
     page.set_viewport_size({'width':1440,'height':1000});page.get_by_label('Usuário',exact=True).fill('labadmin');page.get_by_label('Senha',exact=True).fill(lab.CONFIG['RANCHER_ADMIN_PASSWORD']);page.get_by_role('button',name='Entrar com conta local',exact=True).click();expect(page.get_by_label('Navegação principal',exact=True)).to_be_visible();check('hybrid local login works while provider is unavailable')
     c.close();c=context();page=c.new_page();counter=failed_login(page)
    start_provider();check(name+': provider discovery and backend readiness recover');page.get_by_role('button',name='Entrar com Keycloak',exact=True).click();page.wait_for_url(lambda url:urllib.parse.urlparse(url).netloc=='localhost:18081',timeout=30000);expect(page.locator('input[name="username"]')).to_be_visible();page.locator('input[name="username"]').fill('leitor');page.locator('input[name="password"]').fill(lab.CONFIG['LAB_USER_PASSWORD']);page.locator('button[type="submit"],input[type="submit"]').click();expect(page.get_by_label('Navegação principal',exact=True)).to_be_visible(timeout=30000);assert 'oidc_ticket' not in page.url and len(counter)==2;check(name+': explicit retry authenticates after provider recovery without refresh')
   finally:c.close()
   if name=='automatic':
    code,_,_=u.request('/oidc/callback?state=console-invalid-state&code=console-invalid-code');check('invalid callback still rejects JSON API callers',code==401)
    c=context()
    try:
     invalid=c.new_page();attempts=[];invalid.on('request',lambda r:attempts.append(1) if urllib.parse.urlparse(r.url).path in ('/oidc/login','/oidc/readiness') else None)
     invalid.goto(lab.BASE+'/oidc/callback?state=console-invalid-state&code=console-invalid-code')
     expect(invalid.get_by_role('alert')).to_contain_text('Não foi possível concluir sua autenticação. Inicie um novo login.')
     invalid.wait_for_timeout(1500);assert not attempts and 'oidc_error' not in invalid.url and 'code=' not in invalid.url
     check('invalid browser callback returns to coherent login without automatic retry loop')
     check('invalid callback never creates an authenticated session',invalid.request.get(lab.BASE+'/v2-beta/projects?limit=1').status==401)
    finally:c.close()
  browser.close();browser=None
 outcome='passed'
except Exception as error:
 failure_locations=[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]
 checks.append({'check':'provider outage execution','status':'failed','errorType':type(error).__name__})
 print(json.dumps({'failureLocations':failure_locations}),flush=True)
 print('FAILED: provider outage ('+type(error).__name__+'); private details withheld.',flush=True)
finally:
 try:
  if browser:browser.close()
 except Exception:pass
 try:
  if applied:compose(False);wait(policy,lambda p:p.get('OIDC_ONLY') is before['OIDC_ONLY'] and p.get('OIDC_AUTO_LOGIN') is before['OIDC_AUTO_LOGIN'] and p.get('OIDC_LOGIN_PREFLIGHT_ENABLED') is before['OIDC_LOGIN_PREFLIGHT_ENABLED']);state['overlayApplied']=False;save()
 finally:
  if provider_stopped:docker('start','rancher16-keycloak-lab');provider_stopped=False;state['providerStopped']=False;save()
 check('original hybrid policy and running provider restored',docker('inspect','--format','{{.State.Running}}','rancher16-keycloak-lab').stdout.strip()=='true')
 u=session();wait(lambda:u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']),lambda r:bool(r.get('userIdentity')))
 wait(provider_document,lambda r:r.get('issuer')=='http://localhost:18081/realms/rancher-lab')
 restored=session();token,_=restored.oidc('leitor');check('OIDC still authenticates an ordinary user after restoration',token['userType']=='user')
 check('all prior accounts groups and environments preserved',accounts()==baseline_accounts and digest(u.api('localGroups')['data'])==baseline_groups and {p['id']:p.get('name') for p in u.api('projects?all=true&limit=-1')['data'] if not p.get('removed')}==baseline_projects)
 (ROOT/'console/oidc-provider-outage-results.json').write_text(json.dumps({'status':outcome,'checks':checks,'accessibility':audits,'failureLocations':failure_locations},indent=2)+'\n',encoding='utf-8');STATE.unlink();OVERLAY.unlink(missing_ok=True)
if outcome!='passed':raise SystemExit(1)
