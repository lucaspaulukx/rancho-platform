"""Native configuration acceptance for an exact zero-scale LB fixture. No traffic claim."""
import importlib.util,json,sys,time,secrets,urllib.request,urllib.parse,traceback,subprocess,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/balancer-rules-fixture.json';REPORT=ROOT/'console/balancer-rules-test-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies));user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);base='projects/1a12/'
checks=json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else []
def check(name,ok):
    assert ok,name
    checks[:]=[v for v in checks if v['check']!=name];checks.append({'check':name,'status':'passed'});REPORT.write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8');print('PASS: '+name,flush=True)
def wait(read,ready):
    end=time.monotonic()+90
    while time.monotonic()<end:
        value=read()
        if ready(value):return value
        time.sleep(1)
    raise TimeoutError('LB fixture did not stabilize')
def collection(path):
    rows=[]
    while path:
        page=user.api(path);rows+=page['data'];path=(page.get('pagination') or {}).get('next')
        if path:
            u=urllib.parse.urlparse(path);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
            path=u.path.removeprefix('/v2-beta/')+('?' +u.query if u.query else '')
    return rows
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def baseline():return {v['id']:digest({k:v.get(k) for k in ['lbConfig','launchConfig']}) for v in collection(base+'loadBalancerServices?limit=100') if not v.get('removed')}
def read(state):
    stack=user.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
    source=user.api(base+'loadBalancerServices/'+state['source']);assert source['name']=='balancer' and source['stackId']==stack['id'] and source['accountId']=='1a12' and source['description']==state['marker']
    target=user.api(base+'services/'+state['target']);assert target['name']=='backend' and target['stackId']==stack['id'] and target['accountId']=='1a12'
    return stack,source,target
def payload(state,mode,source,stack,target,before=None):
    schemas={s['id']:s for s in collection(base+'schemas')}
    data={'source':source,'schemas':schemas,'services':[target],'stacks':[stack],'environment':'1a12','mode':mode,'baseline':before}
    result=subprocess.run(['node',str(ROOT/'console/tests/balancer_rules_payload.cjs')],input=json.dumps(data),capture_output=True,text=True,encoding='utf-8')
    return result
try:
    mode=sys.argv[1]
    if mode=='seed':
        assert not STATE.exists();name='console-lb-'+secrets.token_hex(4);marker='Disposable LB rules '+name
        previous=baseline();stack=user.api(base+'stacks',{'name':name,'description':marker})
        state={'environment':'1a12','name':name,'marker':marker,'stack':stack['id'],'baseline':previous}
        STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:v['state']=='active')
        target=user.api(base+'services',{'name':'backend','description':marker,'stackId':stack['id'],'scale':0,'startOnCreate':False,'launchConfig':{'imageUuid':'docker:alpine:3.20'}})
        state['target']=target['id'];STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        source=user.api(base+'loadBalancerServices',{'name':'balancer','description':marker,'stackId':stack['id'],'scale':0,'startOnCreate':False,'launchConfig':{'imageUuid':'docker:rancher/lb-service-haproxy:v0.6.2','ports':['8088:8088/tcp'],'environment':{'FIXTURE':'synthetic-preserved'},'labels':{'console.fixture':name}},'lbConfig':{'config':'# synthetic configuration preserved','portRules':[{'protocol':'http','sourcePort':8088,'targetPort':80,'serviceId':target['id'],'priority':1}]}})
        state['source']=source['id'];STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        wait(lambda:user.api(base+'loadBalancerServices/'+source['id']),lambda v:v['state']=='inactive')
        print(json.dumps({k:v for k,v in state.items() if k!='baseline'}),flush=True)
    else:
        state=json.loads(STATE.read_text(encoding='utf-8'));stack,source,target=read(state)
        if mode in ('update','tcp'):
            result=payload(state,mode,source,stack,target);assert result.returncode==0,result.stderr
            before={k:source['launchConfig'].get(k) for k in ['imageUuid','environment','labels']}
            value=user.api(base+'loadBalancerServices/'+source['id'],json.loads(result.stdout),method='PUT')
            value=wait(lambda:user.api(base+'loadBalancerServices/'+source['id']),lambda v:v['state']=='inactive')
            rule=value['lbConfig']['portRules'][0]
            if mode=='update':check('domain payload persists HTTP route and internal binding',rule['targetPort']==8081 and rule['hostname']=='fixture.example' and rule['path']=='/api' and not value['launchConfig'].get('ports') and value['launchConfig'].get('expose')==['8088:8088/tcp'])
            else:check('domain payload persists TCP route and published binding',rule['protocol']=='tcp' and rule['targetPort']==9090 and not rule.get('hostname') and not rule.get('path') and value['launchConfig'].get('ports')==['8099:8099/tcp'] and not value['launchConfig'].get('expose'))
            check('custom configuration image environment and labels preserved',value['lbConfig']['config']=='# synthetic configuration preserved' and before=={k:value['launchConfig'].get(k) for k in before})
            check('inactive zero-scale fixture starts no containers',value['scale']==0 and not user.api(base+'services/'+source['id']+'/instances')['data'] and not user.api(base+'services/'+target['id']+'/instances')['data'])
        elif mode=='conflict':
            before=source;config=dict(source['lbConfig']);config['config']='# external client synthetic change'
            user.api(base+'loadBalancerServices/'+source['id'],{'lbConfig':config},method='PUT')
            current=wait(lambda:user.api(base+'loadBalancerServices/'+source['id']),lambda v:v['state']=='inactive')
            result=payload(state,'update',current,stack,target,before)
            check('same UI domain refuses native concurrent configuration change',result.returncode==2 and 'outro cliente' in result.stderr)
            check('external configuration survives conflict refusal',user.api(base+'loadBalancerServices/'+source['id'])['lbConfig']['config']==config['config'])
        elif mode=='authorization':
            result=payload(state,'noop',source,stack,target);assert result.returncode==0,result.stderr
            reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
            status,_,_=reader.request('/v2-beta/'+base+'loadBalancerServices/'+source['id'],json.loads(result.stdout),method='PUT')
            check('user without environment cannot PUT native balancer',status in (403,404))
        elif mode=='cleanup':
            for sid in state.get('uiServices',[]):
                extra=user.api(base+'services/'+sid);assert extra['name']==state['name']+'-ui-service' and extra['description']==state['marker'] and extra['stackId']==state['stack'] and extra['accountId']=='1a12'
            if not stack.get('removed'):
                u=urllib.parse.urlparse(stack['actions']['remove']);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
                status,_,_=user.request(stack['actions']['remove'],{});assert status in (200,201,202,204)
            wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:bool(v.get('removed')))
            for sid in [state['source'],state['target'],*state.get('uiServices',[])]:wait(lambda:user.api(base+'services/'+sid),lambda v:bool(v.get('removed')))
            check('exact fixture stack and both zero-scale services removed',True)
            check('unrelated native balancers preserve original configuration',baseline()==state['baseline'])
            if state.get('uiServices'):
                (ROOT/'console/context-editors-cleanup-results.json').write_text(json.dumps({'fixture':state['name'],'environment':state['environment'],'stack':state['stack'],'services':[state['source'],state['target'],*state['uiServices']],'status':'passed','baselineBalancersPreserved':True},indent=2)+'\n',encoding='utf-8')
            STATE.unlink()
        else:raise ValueError('Unknown mode')
except Exception as error:
    print(str(error)[:500],flush=True) if isinstance(error,AssertionError) else None
    print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
