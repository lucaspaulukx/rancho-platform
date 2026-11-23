"""UI-created workload metadata acceptance, strictly scoped disposable fixture."""
import importlib.util,json,sys,time,secrets,urllib.request,urllib.parse,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/workload-creation-fixture.json';REPORT=ROOT/'console/workload-creation-test-results.json'
sp=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(sp);sp.loader.exec_module(lab);lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies));user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD']);base='projects/1a12/'
checks=json.loads(REPORT.read_text(encoding='utf-8')) if REPORT.exists() else []
def check(name,ok):
    assert ok,name
    checks[:]=[v for v in checks if v['check']!=name];checks.append({'check':name,'status':'passed'});REPORT.write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8');print('PASS: '+name,flush=True)
def wait(read,ready):
    end=time.monotonic()+180
    while time.monotonic()<end:
        value=read()
        if ready(value):return value
        time.sleep(1)
    raise TimeoutError('Workload creation fixture did not stabilize')
def collection(path):
    rows=[]
    while path:
        page=user.api(path);rows+=page['data'];path=page.get('pagination',{}).get('next')
        if path:
            u=urllib.parse.urlparse(path);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
            path=u.path.removeprefix('/v2-beta/')+('?' +u.query if u.query else '')
    return rows
try:
    mode=sys.argv[1]
    if mode=='seed':
        assert not STATE.exists();name='console-form-'+secrets.token_hex(4);marker='Disposable workload creation '+name
        stack=user.api(base+'stacks',{'name':name,'description':marker});wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:v['state']=='active')
        state={'environment':'1a12','name':name,'marker':marker,'stack':stack['id'],'serviceName':name+'-svc','containerName':name+'-container','message':'workload-utf8-á'}
        STATE.write_text(json.dumps(state,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');print(json.dumps(state,ensure_ascii=True),flush=True)
    else:
        state=json.loads(STATE.read_text(encoding='utf-8'));stack=user.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        if mode in ('verify-service','verify-container'):
            kind='service' if mode=='verify-service' else 'container';name=state[kind+'Name']
            rows=[v for v in collection(base+kind+'s?limit=100') if v.get('name')==name and not v.get('removed')];assert len(rows)==1
            value=user.api(base+kind+'s/'+rows[0]['id']);assert value['accountId']=='1a12' and value.get('stackId')==stack['id'] and value.get('description')==state['marker']
            state[kind]=value['id'];STATE.write_text(json.dumps(state,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
            config=value['launchConfig'] if kind=='service' else value
            check(kind+' native payload preserves image, command arguments, UTF-8 environment and memory bytes',config['imageUuid']=='docker:alpine:3.20' and config.get('command')==['sleep','3600'] and config.get('environment',{}).get('MESSAGE')==state['message'] and config.get('memory')==33554432 and config.get('networkMode')=='host' and not config.get('privileged'))
            if kind=='service':check('service remains inactive at configured scale zero',value['state']=='inactive' and value['scale']==0 and not user.api(base+'services/'+value['id']+'/instances')['data'])
            else:
                value=wait(lambda:user.api(base+'containers/'+value['id']),lambda v:v['state'] in ('stopped','running','error'))
                check('unchecked start keeps standalone container stopped',value['state']=='stopped')
        elif mode=='authorization':
            reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
            for kind in ('service','container'):
                payload={'name':state['name']+'-denied-'+kind,'description':state['marker'],'stackId':state['stack'],'startOnCreate':False}
                if kind=='service':payload.update(scale=0,launchConfig={'imageUuid':'docker:alpine:3.20'})
                else:payload.update(imageUuid='docker:alpine:3.20')
                status,_,_=reader.request('/v2-beta/'+base+kind+'s',payload)
                check('user without environment cannot create '+kind,status in (403,404))
        elif mode=='cleanup':
            for kind in ('container','service'):
                assert state.get(kind),'Read back fixture ID before cleanup'
                value=user.api(base+kind+'s/'+state[kind]);assert value.get('name')==state[kind+'Name'] and value['accountId']=='1a12' and value.get('description')==state['marker']
                if not value.get('removed'):
                    u=urllib.parse.urlparse(value['actions']['remove']);assert u.netloc=='localhost:18090' and u.path.startswith('/v2-beta/'+base)
                    status,_,_=user.request(value['actions']['remove'],{});assert status in (200,201,202,204)
                wait(lambda:user.api(base+kind+'s/'+value['id']),lambda v:bool(v.get('removed')))
            status,_,_=user.request(stack['actions']['remove'],{});assert status in (200,201,202,204)
            wait(lambda:user.api(base+'stacks/'+stack['id']),lambda v:bool(v.get('removed')))
            check('only precisely identified service, container and stack removed',True);STATE.unlink()
        else:raise ValueError('Unknown mode')
except Exception as error:
    print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
