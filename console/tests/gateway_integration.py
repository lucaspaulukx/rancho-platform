"""Integration checks against the independently packaged local console gateway."""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests'))
import integration as lab
lab.BASE='http://localhost:18090'
checks=[]
def check(name,valid=True):
    if not valid:raise AssertionError(name)
    checks.append(name)
    print('PASS:',name,flush=True)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None
def probe(path):
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    try:return opener.open(lab.BASE+path,timeout=15)
    except urllib.error.HTTPError as error:return error
def session():
    value=lab.Session()
    value.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(value.cookies))
    return value
def main():
    for path in ['/','/console','/console?env=1a7','/login?oidc_ticket=redirect-probe']:
        with probe(path) as response:
            location=response.headers.get('Location','')
            check('Gateway redirect preserves public origin: '+path.split('?')[0],response.code==302 and location.startswith('/console') and ':8080' not in location)
    for path in ['/console/login','/console/groups','/console/no-access','/console/environments/1a7']:
        with probe(path) as response:
            html=response.read().decode()
            check('SPA deep link served: '+path,response.code==200 and 'id="root"' in html)
            check('HTML security headers present: '+path,response.headers.get('X-Content-Type-Options')=='nosniff' and response.headers.get('X-Frame-Options')=='DENY' and "frame-ancestors 'none'" in response.headers.get('Content-Security-Policy',''))
    with probe('/console/console-config.json') as response:
        config=json.load(response)
        check('Runtime configuration is uncached and defaults to dark',response.headers.get('Cache-Control')=='no-store' and config['themeDefault']=='dark')
    anonymous=session()
    public=anonymous.request('/oidc/config')[1]
    check('Backend capability configuration reachable through gateway','effective' in public and 'secret' not in json.dumps(public).lower())
    admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    check('Local login and authorized API work through gateway',bool(admin.api('projects')['data']))
    group=admin.api('localGroups',{'name':'UI gateway contract','members':[],'grants':{}})
    try:
        check('Group created and persisted through gateway',any(g['id']==group['id'] for g in admin.api('localGroups')['data']))
        updated=admin.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'members':[],'grants':{}})
        check('Group revision advances after save',updated['revision']>group['revision'])
        admin.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'members':[],'grants':{}},expected=(409,))
        check('Concurrent stale edit rejected through gateway')
        group=updated
    finally:
        admin.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'delete':True})
    user=session();user.oidc('sem-acesso')
    check('Authorization-code OIDC completes through independent callback',bool(user.api('token')['data'][0]['userIdentity']))
    check('OIDC user retains zero environments',user.api('projects')['data']==[])
    check('Ordinary user cannot create environment through gateway',user.request('/v2-beta/projects',{'name':'forbidden-ui-contract'})[0]==403)
    check('Ordinary user cannot manage groups through gateway',user.request('/v2-beta/localGroups')[0] in (403,404))
    reader=session();reader.oidc('leitor')
    projects=reader.api('projects')['data']
    check('Reader sees only locally granted environment',[p['name'] for p in projects]==['RBAC-DEV'])
    if projects:
        reader.api('projects/'+projects[0]['id']+'/stacks',{'name':'forbidden-reader-contract'},expected=(403,405))
        check('Read-only resource mutation denied through gateway')
    output=ROOT/'console/gateway-test-results.json'
    output.write_text(json.dumps({'checks':checks,'total':len(checks)},ensure_ascii=False,indent=2),encoding='utf-8')
    print(str(len(checks))+' independent gateway checks passed.',flush=True)
if __name__=='__main__':main()
