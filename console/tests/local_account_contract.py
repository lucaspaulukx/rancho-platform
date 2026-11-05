"""Disposable local user/password contract probe. Secrets stay in memory only."""
import hashlib, importlib.util, json, secrets, time, urllib.parse, urllib.request, subprocess, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'console/local-account-contract-fixture.json'
REPORT=ROOT/'console/local-account-contract-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
def session():
    s=lab.Session();s.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(s.cookies));return s
admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
assert not MANIFEST.exists(), 'Recover own prior fixture before probing'
name='console-account-'+secrets.token_hex(6)
marker='Disposable account contract '+name
password=secrets.token_urlsafe(30);replacement=secrets.token_urlsafe(30)
checks=[];account=None;credential=None
def check(label,valid):
    assert valid,label
    checks.append({'check':label,'status':'passed'});print('PASS: '+label,flush=True)
def rows(path): return [v for v in admin.api(path+'?limit=-1')['data'] if not v.get('removed')]
def account_snapshot():
    return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('name','description','kind','state','externalId','externalIdType')},sort_keys=True).encode()).hexdigest() for v in rows('accounts')}
def credential_snapshot():
    return {v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in ('accountId','name','kind','state','publicValue')},sort_keys=True).encode()).hexdigest() for v in rows('passwords')}
before=account_snapshot();before_credentials=credential_snapshot();projects={v['id'] for v in rows('projects')}
report={}
def save():
    MANIFEST.write_text(json.dumps({'name':name,'marker':marker,'account':account and account['id'],'credential':credential and credential['id'],'baselineAccounts':before,'baselineCredentials':before_credentials},indent=2),encoding='utf-8')
def wait(path,state):
    for _ in range(80):
        value=admin.api(path)
        if value.get('state')==state or (state=='removed' and value.get('removed')): return value
        time.sleep(.5)
    raise AssertionError('Own account/credential did not stabilize')
def action(value,name):
    url=urllib.parse.urlparse(value['actions'][name]);assert url.netloc=='localhost:18090' and url.path.rstrip('/') in ('/v2-beta/accounts/'+str(account and account['id']),'/v2-beta/passwords/'+str(credential and credential['id'])) and url.query=='action='+name
    status,_,_=admin.request(value['actions'][name],{},'POST');assert status in (200,201,202,204)
try:
    save()
    account=admin.api('accounts',{'name':name,'description':marker,'kind':'user'});save();account=wait('accounts/'+account['id'],'active')
    credential=admin.api('passwords',{'accountId':account['id'],'publicValue':name,'secretValue':password});save();credential=wait('passwords/'+credential['id'],'active')
    user=session();token=user.login(name,password)
    check('native two-step local account and credential login works',token['accountId']==account['id'] and token['userType']=='user')
    check('new local account sees no environments and creates none',user.api('projects')['data']==[] and {v['id'] for v in rows('projects')}==projects)
    account=admin.api('accounts/'+account['id'],{'name':name+' edited','description':marker},method='PUT')
    check('profile edit preserves ordinary user kind',account['kind']=='user' and account['name']==name+' edited')
    status,_,_=admin.request('/v2-beta/passwords/'+credential['id']+'?action=changesecret',{'oldSecret':'','newSecret':replacement},'POST')
    report['adminPasswordResetStatus']=status
    check('administrator resets local password without old secret',status in (200,201,202,204))
    wrong=session();code,_,_=wrong.request('/v2-beta/token',{'code':name+':'+password})
    newer=session();new_token=newer.login(name,replacement)
    check('old password rejected and new password accepted',code==401 and new_token['accountId']==account['id'])
    old_session=user.api('token')['data'][0]
    report['passwordResetRevokesExistingJwt']=not bool(old_session.get('userIdentity'))
    account=admin.api('accounts/'+account['id']);action(account,'deactivate');account=wait('accounts/'+account['id'],'inactive')
    status,body,_=newer.request('/v2-beta/token')
    report['inactiveSessionStatus']=status
    report['inactiveSessionAuthenticated']=status==200 and bool((body.get('data') or [{}])[0].get('userIdentity'))
    inactive=session();login_status,_,_=inactive.request('/v2-beta/token',{'code':name+':'+replacement})
    report['inactiveLoginStatus']=login_status
    check('deactivation blocks login and existing-session identity',login_status in (401,403) and not report['inactiveSessionAuthenticated'])
    action(account,'activate');account=wait('accounts/'+account['id'],'active')
    restored=session();check('reactivation restores password login',restored.login(name,replacement)['accountId']==account['id'])
    admin.api('accounts/'+account['id'],{'kind':'admin'},method='PUT')
    check('existing session reflects promotion from current account',restored.api('token')['data'][0]['userType']=='admin')
    admin.api('accounts/'+account['id'],{'kind':'user'},method='PUT')
    check('existing session reflects demotion without cached admin claim',restored.api('token')['data'][0]['userType']=='user')
finally:
    report['checks']=checks
    REPORT.write_text(json.dumps(report,indent=2),encoding='utf-8')
    cleanup=subprocess.run([sys.executable,str(ROOT/'console/tests/local_account_fixture_cleanup.py')],text=True,capture_output=True)
    assert cleanup.returncode==0, 'Own fixture cleanup failed; use cleanup helper and inspect sanitized report'
    report['passwordFixtureCleanup']='scoped own soft-remove after native DELETE405'
    check('previous account profiles and password metadata preserved',account_snapshot()==before and credential_snapshot()==before_credentials)
    report.update(checks=checks,cleanup=True)
    REPORT.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='checks'}))
