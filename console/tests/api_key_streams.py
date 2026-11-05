"""Own isolated API key stream baseline; secrets never enter state or reports."""
import base64
import json
import re
import secrets
import sys
import time
import host_stream_revocation as probe
from subscription_identity_fixture import identity_factory

STATE = probe.ROOT / 'console/api-key-stream-fixture.json'

def factory(shared, event="key", *, oidc=False, stale_cookie=False):
    def create(admin):
        assert not STATE.exists()
        identity = identity_factory('deactivate' if event=='account' else 'grant',role='member',oidc=oidc)(admin)
        native = identity['session']
        key = None
        marker = 'console-key-stream-' + secrets.token_hex(6)
        def current(): return admin.api('apikeys/'+key['id'])
        def wait(predicate):
            for _ in range(100):
                value=current()
                if predicate(value): return value
                time.sleep(.3)
            raise AssertionError('Own key did not converge')
        def deactivate():
            value=current()
            assert value['name']==marker and value['description']==marker
            if value['state']=='active':
                assert admin.request(value['actions']['deactivate'],{},'POST')[0] in (200,201,202,204)
                wait(lambda v:v['state']=='inactive')
        def cleanup():
            if key:
                deactivate()
                value=current()
                if not value.get('removed'):
                    admin.api('apikeys/'+key['id'],method='DELETE')
                    wait(lambda v:bool(v.get('removed')))
            native.request('/v2-beta/token/current',None,'DELETE')
            identity['cleanup']()
            STATE.unlink(missing_ok=True)
        try:
            scope='projects/1a12/' if shared else ''
            key=(admin if shared else native).api(scope+'apikeys',{'name':marker,'description':marker,**({'accountId':'1a12'} if shared else {})})
            assert key.get('publicValue') and key.get('secretValue')
            STATE.write_text(json.dumps({'id':key['id'],'name':marker,'accountId':key['accountId'],'shared':shared}),encoding='utf-8')
            wait(lambda v:v['state']=='active')
            basic='Basic '+base64.b64encode((key['publicValue']+':'+key['secretValue']).encode()).decode()
            class BasicSession(probe.shared.lab.Session):
                technical_stream=True
                def request(self,path,body=None,method=None,form=False,extra_headers=None):
                    return super().request(path,body,method,form,{**(extra_headers or {}),'Authorization':basic})
            watched=BasicSession()
            identifier=re.fullmatch(r'1[a-z]+([0-9]+)',key['id']);assert identifier
            watched.credential_id=identifier.group(1)
            watched.credential_owner=key['accountId'].removeprefix('1a')
            if stale_cookie: watched.set_token('stale-session-fixture-no-credential')
            assert watched.api('projects/1a12')['id']=='1a12'
            def before_invalidate():
                identity['invalidate']()
                assert native.api('projects')['data'] == []
                assert watched.api('projects/1a12')['id'] == '1a12'
            def invalidate():
                if event in ('grant','account'): identity['invalidate']()
                elif event=='deadline':
                    limit=admin.request('/oidc/config')[1]['apiKeyStreamMaxSeconds']
                    assert 30<=limit<=60
                    time.sleep(limit+2)
                else: deactivate()
            return {'session':watched,'before_invalidate':before_invalidate if shared else None,'invalidate':invalidate,'cleanup':cleanup,'prepare_cleanup':identity['prepare_cleanup'],
                    'protected':'/v2-beta/projects/1a12','protectedExpectedStatus':(200,) if event=='deadline' else (401,403,404),'scope':'own '+('shared project' if shared else 'personal user')+' API key; '+event+(' with stale cookie' if stale_cookie else '')+(' OIDC identity' if oidc else '')}
        except Exception:
            cleanup();raise
    return create

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('scope',choices=('personal','shared'))
    parser.add_argument('mode',choices=('on','off'),nargs='?',default='off')
    parser.add_argument('--event',choices=('key','grant','account','deadline'),default='key')
    parser.add_argument('--oidc',action='store_true')
    parser.add_argument('--stale-cookie',action='store_true')
    parser.add_argument('--hold-seconds',type=int,default=0)
    parser.add_argument('--service-scale',type=int,default=1)
    parser.add_argument('--scheduler-relay',action='store_true')
    args=parser.parse_args()
    assert args.scope=='personal' or args.event=='key'
    expect_legacy=args.mode=='off'
    suffix=('-'+args.event if args.event!='key' else '')+('-oidc' if args.oidc else '')+('-stale-cookie' if args.stale_cookie else '')+('-lease' if args.hold_seconds else '')+('-payload-scale'+str(args.service_scale) if args.service_scale>1 else '')+('-relay-setup' if args.scheduler_relay else '')
    probe.REPORT=probe.ROOT / ('console/api-key-stream-'+args.scope+suffix+('-baseline' if expect_legacy else '-on')+'-results.json')
    if probe.REPORT.exists():
        (probe.ROOT / 'migration-runs' / ('api-key-stream-'+args.scope+suffix+'-'+str(time.time_ns())+'-results.json')).write_bytes(probe.REPORT.read_bytes())
    status=probe.main(identity_factory=factory(args.scope=='shared',args.event,oidc=args.oidc,stale_cookie=args.stale_cookie),console_proxy=True,hold_seconds=args.hold_seconds,service_metrics=args.service_scale>1,payload_transport=args.service_scale>1,service_scale=args.service_scale,scheduler_relay=args.scheduler_relay)
    result=json.loads(probe.REPORT.read_text(encoding='utf-8'))
    reproduced=result.get('cleanupComplete') and result.get('identityFixtureCleaned') and result.get('protectedHttpAfterRevocation') in (401,403,404) and len(result.get('streams',{}))==(4 if args.service_scale>1 else 3) and all(
        v.get('newHandshake')==101 and not v.get('closed') and v.get('after',0)>0 and v.get('freshControlHealthy') for v in result.get('streams',{}).values())
    if expect_legacy: result['legacyApiKeyStreamLifetimeReproduced']=bool(reproduced)
    probe.REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8')
    accepted = reproduced if expect_legacy else status==0
    print('PASS: expected API key stream baseline reproduced and cleaned.' if expect_legacy and accepted else 'PASS: API key stream guard enforced and cleaned.' if accepted else 'FAIL: acceptance incomplete.')
    raise SystemExit(0 if accepted else 1)
