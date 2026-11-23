"""Scoped native fixture for contextual service-link configuration acceptance, no containers."""
import importlib.util,json,sys,time,secrets,urllib.request,urllib.parse,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STATE=ROOT/'console/service-links-fixture.json'
REPORT=ROOT/'console/service-links-test-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies));user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12/'
checks=json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else []
def check(name,ok):
    assert ok,name
    checks[:]=[v for v in checks if v['check']!=name];checks.append({'check':name,'status':'passed'})
    REPORT.write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8');print('PASS: '+name,flush=True)
def wait(read,ready):
    end=time.monotonic()+180
    while time.monotonic()<end:
        value=read()
        if ready(value):return value
        time.sleep(1)
    raise TimeoutError('Native service-link fixture did not stabilize')
def mappings():
    result=[];path=base+'serviceConsumeMaps?limit=100'
    while path:
        page=user.api(path);result+=page['data'];path=page.get('pagination',{}).get('next')
        if path:
            u=urllib.parse.urlparse(path);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
            path=u.path.removeprefix('/v2-beta/')+('?' +u.query if u.query else '')
    return [v for v in result if not v.get('removed') and v['state'] not in ('removed','purged')]
def snapshot(rows):return sorted([[v['id'],v.get('serviceId'),v.get('consumedServiceId'),v.get('name'),v.get('state')] for v in rows])
def validate(state):
    stack=user.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
    source=user.api(base+'services/'+state['source']);assert source['name']=='consumer' and source['stackId']==stack['id'] and source['accountId']=='1a12'
    return stack,source
try:
    mode=sys.argv[1]
    if mode=='seed':
        assert not STATE.exists()
        name='console-links-'+secrets.token_hex(4);marker='Disposable service links acceptance '+name
        baseline=snapshot(mappings())
        stack=user.api(base+'stacks',{'name':name,'description':marker})
        state={'environment':'1a12','name':name,'marker':marker,'stack':stack['id'],'baseline':baseline,'services':[]}
        STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        for service_name in ['consumer','backend']:
            service=user.api(base+'services',{'name':service_name,'stackId':stack['id'],'scale':0,'startOnCreate':False,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'host','command':['sleep','3600']}})
            state['services'].append(service['id']);state['source' if service_name=='consumer' else 'target']=service['id']
            STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
            wait(lambda:user.api(base+'services/'+service['id']),lambda v:v['state']=='inactive')
        print(json.dumps({k:v for k,v in state.items() if k!='baseline'}),flush=True)
    else:
        state=json.loads(STATE.read_text(encoding='utf-8'));stack,source=validate(state)
        def own():return [v for v in mappings() if v.get('serviceId')==source['id']]
        if mode in ('verify-linked','verify-conflict','verify-empty'):
            alias={'verify-linked':'api','verify-conflict':'external-client','verify-empty':None}[mode]
            rows=wait(own,lambda rows:(not rows) if alias is None else (len(rows)==1 and rows[0]['state']=='active' and rows[0]['consumedServiceId']==state['target'] and rows[0].get('name')==alias))
            check({'verify-linked':'UI persists target and alias through native setservicelinks','verify-conflict':'external alias survives refused stale UI save','verify-empty':'explicit remove-all removes outgoing native mapping'}[mode],True)
            check('unrelated native mappings remain unchanged',snapshot([v for v in mappings() if v.get('serviceId')!=source['id']])==state['baseline'])
            check('configuration-only fixture does not start containers',all(not user.api(base+'services/'+sid+'/instances')['data'] for sid in state['services']))
        elif mode=='conflict':
            u=urllib.parse.urlparse(source['actions']['setservicelinks']);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
            status,_,_=user.request(source['actions']['setservicelinks'],{'serviceLinks':[{'serviceId':state['target'],'name':'external-client'}]});assert status in (200,201,202)
            wait(own,lambda rows:len(rows)==1 and rows[0]['state']=='active' and rows[0].get('name')=='external-client')
            print('External client changed only the fixture alias.',flush=True)
        elif mode=='authorization':
            reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
            status,_,_=reader.request(source['actions']['setservicelinks'],{'serviceLinks':[]})
            check('user without environment cannot call native setservicelinks',status in (403,404))
        elif mode=='cleanup':
            if not stack.get('removed'):
                u=urllib.parse.urlparse(stack['actions']['remove']);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
                status,_,_=user.request(stack['actions']['remove'],{});assert status in (200,201,202,204)
            wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:bool(v.get('removed')))
            for sid in state['services']:wait(lambda:user.api(base+'services/'+sid),lambda v:bool(v.get('removed')))
            check('fixture stack and both zero-scale services removed',True)
            check('unrelated native mappings remain unchanged after cleanup',snapshot(mappings())==state['baseline'])
            STATE.unlink()
        else:raise ValueError('Unknown mode')
except Exception as error:
    print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
