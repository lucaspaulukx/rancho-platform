"""Recover only the exact disposable local account/credential identified by manifest."""
import hashlib, importlib.util, json, re, subprocess, time, urllib.request, urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];MANIFEST=ROOT/'console/local-account-contract-fixture.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
u=lab.Session();u.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(u.cookies));u.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
try:
    s=json.loads(MANIFEST.read_text(encoding='utf-8'))
    assert re.fullmatch(r'console-account-[0-9a-f]{12}',s['name']) and s['marker']=='Disposable account contract '+s['name']
    assert s['account'] not in s['baselineAccounts'] and s['credential'] not in s['baselineCredentials']
    def wait(path,predicate):
        for _ in range(80):
            v=u.api(path)
            if predicate(v):return v
            time.sleep(.5)
        raise AssertionError('Own fixture cleanup state timeout')
    def action(v,name,path):
        target=urllib.parse.urlparse(v['actions'][name]);assert target.netloc=='localhost:18090' and target.path.rstrip('/')=='/v2-beta/'+path and target.query=='action='+name
        code,_,_=u.request(v['actions'][name],{},'POST');assert code in (200,201,202,204)
    if s['account']:
        path='accounts/'+s['account'];a=u.api(path);assert a['description']==s['marker'] and a['kind'] in ('user','admin')
        if a['kind']=='admin':a=u.api(path,{'kind':'user'},method='PUT')
        if not a.get('removed'):
            if a['state']=='active':action(a,'deactivate',path);a=wait(path,lambda v:v['state']=='inactive')
            assert a['state']=='inactive';action(a,'remove',path);wait(path,lambda v:bool(v.get('removed')))
    if s['credential']:
        path='passwords/'+s['credential'];c=u.api(path)
        assert c['accountId']==s['account'] and c['publicValue']==s['name']
        if not c.get('removed'):
            if c['state']=='active':action(c,'deactivate',path);c=wait(path,lambda v:v['state']=='inactive')
            assert c['state']=='inactive'
            aid=s['account'].removeprefix('1a');cid=s['credential'].removeprefix('1c');assert aid.isdigit() and cid.isdigit()
            sql="START TRANSACTION; UPDATE credential c JOIN account a ON a.id=c.account_id SET c.state='removed',c.removed=NOW() WHERE c.id="+cid+" AND a.id="+aid+" AND c.kind='password' AND c.public_value='"+s['name']+"' AND c.state='inactive' AND c.removed IS NULL AND a.state='removed' AND a.removed IS NOT NULL AND a.description='"+s['marker']+"'; SELECT ROW_COUNT(); COMMIT;"
            r=subprocess.run(['docker','exec','-i','rancher16-rbac-lab','mysql','--user=root','--batch','--skip-column-names','cattle'],input=sql,text=True,capture_output=True)
            assert r.returncode==0 and r.stdout.strip()=='1','Scoped credential cleanup failed; output withheld'
            wait(path,lambda v:bool(v.get('removed')))
    for path,key,fields in [('accounts','baselineAccounts',('name','description','kind','state','externalId','externalIdType')),('passwords','baselineCredentials',('accountId','name','kind','state','publicValue'))]:
        rows=[v for v in u.api(path+'?limit=-1')['data'] if not v.get('removed')]
        actual={v['id']:hashlib.sha256(json.dumps({k:v.get(k) for k in fields},sort_keys=True).encode()).hexdigest() for v in rows}
        assert actual==s[key],'Prior '+path+' metadata changed'
    report={'status':'passed','account':s['account'],'credential':s['credential'],'previousAccountAndPasswordMetadataPreserved':True,'passwordCleanup':'own inactive credential soft-removed with scoped SQL; native DELETE405'}
    (ROOT/'console/local-account-contract-cleanup-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8');MANIFEST.unlink()
    print('PASS: exact disposable account/credential removed and all previous metadata preserved')

finally:
    assert u.request("/v2-beta/token/current",None,"DELETE")[0] in (200,204), "Own cleanup session revocation failed"
