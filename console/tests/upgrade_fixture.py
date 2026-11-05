"""Scale-zero native upgrade contract fixture; never claims physical deployment acceptance."""
import importlib.util,json,secrets,sys,time,urllib.request,urllib.parse,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STATE=ROOT/'console/upgrade-fixture.json'
RESULT=ROOT/'console/upgrade-test-results.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12/'

def wait(path,predicate):
    deadline=time.monotonic()+90
    while time.monotonic()<deadline:
        value=user.api(base+path)
        if predicate(value):return value
        time.sleep(1)
    raise TimeoutError('Scale-zero fixture did not stabilize')
def record(name):
    rows=json.loads(RESULT.read_text()) if RESULT.exists() else []
    rows=[v for v in rows if v['check']!=name]+[{'check':name,'status':'passed','scope':'native API state, scale zero'}]
    RESULT.write_text(json.dumps(rows,indent=2)+'\n');print('PASS: '+name,flush=True)
try:
    mode=sys.argv[1]
    assert user.api('projects/1a12')['name']=='UI-OPS-LAB'
    if mode=='seed':
        assert not STATE.exists()
        name='console-upgrade-'+secrets.token_hex(4);marker='Disposable scale-zero upgrade acceptance '+name
        stack=user.api(base+'stacks',{'name':name,'description':marker})
        state={'stack':stack['id'],'name':name,'marker':marker}
        STATE.write_text(json.dumps(state,indent=2)+'\n')
        service=user.api(base+'services',{'name':'upgrade-web','stackId':stack['id'],'scale':0,'startOnCreate':True,'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'host','environment':{'UPGRADE_FIXTURE':'preserve-me'},'command':['/bin/sh','-c','sleep 86400']}})
        state['service']=service['id'];STATE.write_text(json.dumps(state,indent=2)+'\n')
        wait('services/'+service['id'],lambda v:v['state']=='active')
        record('synthetic service active with scale zero and no workload scheduled')
        print(json.dumps(state),flush=True)
    else:
        state=json.loads(STATE.read_text())
        stack=user.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        service=user.api(base+'services/'+state['service']);assert service['stackId']==state['stack'] and service['accountId']=='1a12'
        if mode=='status':
            print(json.dumps({'name':state['name'],'service':service['id'],'state':service['state'],'image':service.get('launchConfig',{}).get('imageUuid'),'actions':list(service.get('actions',{}))}),flush=True)
        elif mode in ('verify-upgrade','verify-rollback','verify-finish'):
            expected_image='docker:alpine:3.20' if mode=='verify-rollback' else 'docker:alpine:3.21'
            expected_state='active' if mode!='verify-upgrade' else 'upgraded'
            value=wait('services/'+service['id'],lambda v:v['state']==expected_state and v.get('launchConfig',{}).get('imageUuid')==expected_image)
            assert value['scale']==0 and value['launchConfig']['environment']=={'UPGRADE_FIXTURE':'preserve-me'}
            assert value['launchConfig']['command']==['/bin/sh','-c','sleep 86400'] and value['launchConfig']['networkMode']=='host'
            assert not [v for v in user.api(base+'services/'+service['id']+'/instances')['data'] if not v.get('removed')]
            record(mode+' via UI preserves environment, command, networking and scale')
        elif mode=='cleanup':
            if not stack.get('removed'):
                parsed=urllib.parse.urlparse(stack['actions']['remove']);assert parsed.netloc=='localhost:18090' and parsed.path.startswith('/v2-beta/'+base)
                status,_,_=user.request(stack['actions']['remove'],{});assert status in (200,201,202,204)
            wait('stacks/'+state['stack'],lambda v:bool(v.get('removed')) or v.get('state')=='removed')
            wait('services/'+state['service'],lambda v:bool(v.get('removed')) or v.get('state')=='removed')
            record('only disposable scale-zero upgrade fixture removed');STATE.unlink()
        else:raise ValueError('Unknown operation')
except Exception as error:
    print(json.dumps({'errorType':type(error).__name__,'operation':sys.argv[1],'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True)
    raise SystemExit(1)
