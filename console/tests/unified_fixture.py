"""Disposable UI fixture and backend readback for unified-operation acceptance."""
import importlib.util
import json
import secrets
import sys
import time
import urllib.parse
import urllib.request
import traceback
import subprocess
import re
import shlex
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STATE=ROOT/'console/unified-fixture.json'
RESULT=ROOT/'console/unified-operation-test-results.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
user=lab.Session()
user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12/'
checks=json.loads(RESULT.read_text(encoding='utf-8')) if RESULT.exists() else []
def check(name,condition):
    assert condition,name
    checks[:]=[v for v in checks if v['check']!=name]
    checks.append({'check':name,'status':'passed'})
    RESULT.write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
    print('PASS: '+name,flush=True)
def wait(read,ready):
    deadline=time.monotonic()+180
    while time.monotonic()<deadline:
        value=read()
        if ready(value):return value
        time.sleep(1)
    raise TimeoutError('Synthetic resource did not stabilize')
mode=sys.argv[1]
try:
    if mode=='diagnose-host':
        from legacy_guest import run_guest
        print(json.dumps(run_guest("sudo docker ps -a --format 'FIXTURE_STATUS:{{.Names}} {{.Status}}'")),flush=True)
        server=json.loads(subprocess.run(['docker','inspect','rancher16-rbac-lab'],capture_output=True,text=True,check=True).stdout)[0]
        address=next(iter(server['NetworkSettings']['Networks'].values()))['IPAddress']
        raw=subprocess.run(['docker','exec','rancher16-legacy-test-host','cat','/run/fixture-cloud-config.yaml'],capture_output=True)
        print(json.dumps({'privateConfigPresent':raw.returncode==0,'configUsesCurrentServerAddress':address.encode() in raw.stdout}),flush=True)
    elif mode=='status':
        print(json.dumps([{key:value.get(key) for key in ('id','hostname','state','agentState')} for value in user.api(base+'hosts')['data']]),flush=True)
    elif mode=='seed':
        assert not STATE.exists(),'Existing fixture requires inspection/cleanup'
        assert user.api('projects/1a12')['name']=='UI-OPS-LAB'
        hosts=user.api(base+'hosts')['data']
        assert any(v['id']=='1h1' and v.get('state')=='active' for v in hosts)
        name='console-unified-'+secrets.token_hex(4)
        marker='Disposable unified operation browser fixture '+name
        stack=user.api(base+'stacks',{'name':name,'description':marker})
        state={'environment':'1a12','stack':stack['id'],'name':name,'marker':marker}
        STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        service=user.api(base+'services',{'name':'web','stackId':stack['id'],'scale':2,'startOnCreate':True,
            'launchConfig':{'imageUuid':'docker:alpine:3.20','networkMode':'host','command':['/bin/sh','-c',"while true; do printf 'unified-context-log:%s\\n' \"$HOSTNAME\"; sleep 2; done"]}})
        state['service']=service['id']
        STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        values=wait(lambda:user.api(base+'services/'+service['id']+'/instances')['data'],lambda rows:sum(v.get('state')=='running' and not v.get('removed') for v in rows)==2)
        running=[v for v in values if v.get('state')=='running' and not v.get('removed')]
        check('two synthetic log containers run on the original isolated lab host',len(running)==2 and all(v['accountId']=='1a12' and v['hostId']=='1h1' for v in running))
        state['instances']=[{k:v.get(k) for k in ('id','name','startCount')} for v in running]
        STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(state),flush=True)
    elif mode=='annotate-logs':
        from legacy_guest import run_guest
        state=json.loads(STATE.read_text(encoding='utf-8'))
        stack=user.api(base+'stacks/'+state['stack'])
        assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        for index,original in enumerate(state['instances'],1):
            value=user.api(base+'containers/'+original['id'])
            assert value['accountId']=='1a12' and state['service'] in value['serviceIds'] and value['state']=='running'
            identifier=value['externalId'];assert re.fullmatch(r'[a-f0-9]{64}',identifier)
            marker='unified-container-marker-'+str(index)
            command='sudo docker exec '+shlex.quote(identifier)+' /bin/sh -c '+shlex.quote("printf '"+marker+"\\n' >/proc/1/fd/1")+' && echo FIXTURE_STATUS:marker_written'
            result=run_guest(command)
            assert result.get('completed') and result.get('exitCode')==0
        check('distinct log markers written only to the two disposable containers',True)
    elif mode=='scaling-authorization':
        state=json.loads(STATE.read_text(encoding='utf-8'))
        stack=user.api(base+'stacks/'+state['stack']);assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
        status,_,_=reader.request('/v2-beta/'+base+'services/'+state['service'],{'scale':0},method='PUT')
        check('user without fixture environment cannot PUT the service scale',status in (403,404))
        check('denied scale mutation leaves fixture service unchanged',user.api(base+'services/'+state['service'])['scale']==2)
    elif mode=='set-scale-conflict':
        state=json.loads(STATE.read_text(encoding='utf-8'))
        stack=user.api(base+'stacks/'+state['stack'])
        assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        service=user.api(base+'services/'+state['service'])
        assert service['stackId']==stack['id'] and service['accountId']=='1a12' and service['scale']==2
        user.api(base+'services/'+state['service'],{'scale':1},method='PUT')
        wait(lambda:user.api(base+'services/'+state['service']),lambda value:value.get('scale')==1 and value.get('state')=='active')
        check('independent client changes fixture scale while the UI draft remains open',True)
    elif mode=='verify-scale':
        state=json.loads(STATE.read_text(encoding='utf-8'));expected=int(sys.argv[2]);assert expected in (0,1,2)
        stack=user.api(base+'stacks/'+state['stack'])
        assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        service=wait(lambda:user.api(base+'services/'+state['service']),lambda value:value.get('scale')==expected and value.get('state')=='active')
        assert service['accountId']=='1a12' and service['stackId']==stack['id'] and service['launchConfig']['imageUuid']=='docker:alpine:3.20' and service['launchConfig']['networkMode']=='host'
        rows=wait(lambda:user.api(base+'services/'+state['service']+'/instances')['data'],lambda values:len([v for v in values if not v.get('removed') and v.get('state') not in ('removed','purged')])==expected and all(v.get('removed') or v.get('state') in ('running','removed','purged') for v in values))
        check('contextual scale '+str(expected)+' persists and matches physical running containers',len([v for v in rows if v.get('state')=='running' and not v.get('removed')])==expected)
    elif mode=='prepare-upgrade':
        from legacy_guest import run_guest
        state=json.loads(STATE.read_text(encoding='utf-8'))
        stack=user.api(base+'stacks/'+state['stack'])
        assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        service=user.api(base+'services/'+state['service'])
        assert service['stackId']==stack['id'] and service['state']=='active' and service['scale']==2
        tag=state['name']+':v2'
        assert re.fullmatch(r'console-unified-[a-f0-9]{8}:v2',tag)
        result=run_guest('sudo docker tag alpine:3.20 '+shlex.quote(tag)+' && echo FIXTURE_STATUS:local_upgrade_tag_ready')
        assert result.get('completed') and result.get('exitCode')==0
        state['upgradeImage']='docker:'+tag
        state['upgradeBaseline']=[v['id'] for v in user.api(base+'services/'+service['id']+'/instances')['data'] if v.get('state')=='running' and not v.get('removed')]
        assert len(state['upgradeBaseline'])==2
        STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        check('local upgrade tag reuses cached Alpine without external image download',True)
        print(json.dumps({'image':tag}),flush=True)
    elif mode in ('verify-upgrade','verify-rollback'):
        state=json.loads(STATE.read_text(encoding='utf-8'))
        stack=user.api(base+'stacks/'+state['stack'])
        assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        expected_image=state['upgradeImage'] if mode=='verify-upgrade' else 'docker:alpine:3.20'
        expected_state='upgraded' if mode=='verify-upgrade' else 'active'
        service=wait(lambda:user.api(base+'services/'+state['service']),lambda value:value.get('state')==expected_state and value.get('launchConfig',{}).get('imageUuid')==expected_image)
        assert service['accountId']=='1a12' and service['stackId']==state['stack'] and service['scale']==2
        assert service['launchConfig']['networkMode']=='host' and 'unified-context-log:' in ' '.join(service['launchConfig']['command'])
        rows=wait(lambda:user.api(base+'services/'+state['service']+'/instances')['data'],lambda values:len([v for v in values if v.get('state')=='running' and not v.get('removed')])==2)
        rows=[v for v in rows if v.get('state')=='running' and not v.get('removed')]
        prior=state['upgradeBaseline'] if mode=='verify-upgrade' else state['upgradedInstances']
        assert all(v['id'] not in prior and v['hostId']=='1h1' and v.get('imageUuid')==expected_image for v in rows)
        if mode=='verify-upgrade':
            state['upgradedInstances']=[v['id'] for v in rows]
            STATE.write_text(json.dumps(state,indent=2)+'\n',encoding='utf-8')
        check(mode+' through contextual UI replaces both physical containers and preserves command, network and scale',True)
    elif mode=='verify-restart':
        state=json.loads(STATE.read_text(encoding='utf-8'))
        original={v['id']:int(v.get('startCount') or 0) for v in state['instances']}
        def completed(values):
            rows=[v for v in values if v.get('state')=='running' and not v.get('removed')]
            return len(rows)==2 and any(v['id'] not in original or int(v.get('startCount') or 0)>original[v['id']] for v in rows)
        values=wait(lambda:user.api(base+'services/'+state['service']+'/instances')['data'],completed)
        check('restart requested through the context menu changes physical container lifecycle',completed(values))
    elif mode=='cleanup':
        state=json.loads(STATE.read_text(encoding='utf-8'))
        stack=user.api(base+'stacks/'+state['stack'])
        assert stack['name']==state['name'] and stack['description']==state['marker'] and stack['accountId']=='1a12'
        if not stack.get('removed'):
            parsed=urllib.parse.urlparse(stack['actions']['remove'])
            assert parsed.netloc=='localhost:18090' and parsed.path.startswith('/v2-beta/'+base)
            status,_,_=user.request(stack['actions']['remove'],{})
            assert status in (200,201,202,204)
        wait(lambda:user.api(base+'stacks/'+state['stack']),lambda v:bool(v.get('removed')) or v.get('state')=='removed')
        if state.get('service'):
            wait(lambda:user.api(base+'services/'+state['service']),lambda v:bool(v.get('removed')) or v.get('state')=='removed')
            wait(lambda:user.api(base+'services/'+state['service']+'/instances')['data'],lambda rows:all(v.get('removed') or v.get('state') in ('removed','purged') for v in rows))
        check('only the named disposable unified-operation stack is removed',True)
        if state.get('upgradeImage'):
            from legacy_guest import run_guest
            tag=state['upgradeImage'].removeprefix('docker:')
            assert re.fullmatch(r'console-unified-[a-f0-9]{8}:v2',tag)
            result=run_guest('sudo docker image rm '+shlex.quote(tag)+' && echo FIXTURE_STATUS:local_upgrade_tag_removed')
            assert result.get('completed') and result.get('exitCode')==0
            check('only the disposable local upgrade tag is removed; original Alpine tag preserved',True)
        STATE.unlink()
    else:raise ValueError('Use seed, verify-restart or cleanup')
except Exception as error:
    print(json.dumps({'operation':mode,'errorType':type(error).__name__,'locations':[{'file':Path(frame.filename).name,'line':frame.lineno} for frame in traceback.extract_tb(error.__traceback__)],'details':'withheld'}),flush=True)
    raise SystemExit(1)
