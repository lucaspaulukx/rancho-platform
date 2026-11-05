"""Isolated catalog stack upgrade fixture; original Compose, inactive services."""
import importlib.util,json,secrets,sys,time,urllib.request,urllib.parse,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'console/catalog-upgrade-fixture.json';RESULT=ROOT/'console/catalog-upgrade-test-results.json'
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py');lab=importlib.util.module_from_spec(spec);spec.loader.exec_module(lab);lab.BASE='http://localhost:18090'
user=lab.Session();user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies));user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12/'
def catalog(path):
    parsed=urllib.parse.urlparse(path);assert parsed.path.startswith('/v1-catalog/') and parsed.netloc in ('','localhost:18090')
    request=urllib.request.Request(lab.BASE+parsed.path+('?' + parsed.query if parsed.query else ''),headers={'Accept':'application/json','X-Api-Project-Id':'1a12'})
    with user.opener.open(request,timeout=20) as response:return json.load(response)
def record(name,condition):
    assert condition,name
    rows=json.loads(RESULT.read_text()) if RESULT.exists() else [];rows=[r for r in rows if r['check']!=name]+[{'check':name,'status':'passed'}];RESULT.write_text(json.dumps(rows,indent=2)+'\n');print('PASS: '+name,flush=True)
def wait(read,predicate):
    end=time.monotonic()+150
    while time.monotonic()<end:
        value=read()
        if predicate(value):return value
        time.sleep(1)
    raise TimeoutError('Catalog fixture did not stabilize')
try:
    mode=sys.argv[1];assert user.api('projects/1a12')['name']=='UI-OPS-LAB'
    if mode=='cleanup-audit':
        for stack_id,service_id,name in [('1st76','1s102','console-catalog-upgrade-1dfc3ef8'),('1st77','1s103','console-catalog-upgrade-0053e1c9')]:
            old=user.api(base+'stacks/'+stack_id);service=user.api(base+'services/'+service_id)
            assert old['name']==name and old.get('removed') and service['stackId']==stack_id and service.get('removed')
            rows=wait(lambda:user.api(base+'services/'+service_id+'/instances')['data'],lambda values:all(v.get('removed') or v.get('state') in ('removed','purged') for v in values))
        record('prior acceptance fixtures and all attempted containers are removed',True)
        raise SystemExit(0)
    template_id=(json.loads(STATE.read_text())['template'] if STATE.exists() else (sys.argv[2] if len(sys.argv)>2 else 'community:influxdb'))
    assert template_id in ('community:influxdb','community:consul','community:zookeeper')
    template=catalog('/v1-catalog/templates/'+template_id+'?rancherVersion=v1.6.30')
    if mode=='inspect-candidates':
        values=catalog('/v1-catalog/templates?rancherVersion=v1.6.30&limit=-1')['data']
        print(json.dumps([{'id':v['id'],'versions':list(v.get('versionLinks',{}))} for v in values if len(v.get('versionLinks',{}))>1 and not v.get('templateBase')][:15]),flush=True)
    elif mode=='inspect-compose':
        release=catalog(template['versionLinks']['3.4.8-rancher1'])
        print(json.dumps({k:v for k,v in release['files'].items() if k=='rancher-compose.yml'}),flush=True)
    elif mode=='inspect':
        version=catalog(template['versionLinks'][list(template['versionLinks'])[0]])
        print(json.dumps({'template':template['id'],'versions':list(template['versionLinks']),'defaultVersion':template['defaultVersion'],'questions':[{k:q.get(k) for k in ('variable','label','type')} for q in version.get('questions',[])]}),flush=True)
    elif mode=='seed':
        assert not STATE.exists();choices=list(template['versionLinks']);choice='3.4.6-rancher1' if template['id']=='community:zookeeper' else choices[0];version=catalog(template['versionLinks'][choice])
        answers={q['variable']:q.get('default') for q in version.get('questions',[]) if q.get('default') is not None}
        for q in version.get('questions',[]):
            assert q['type'] not in ('service','certificate','secret')
            if q['type']=='boolean':answers[q['variable']]=answers.get(q['variable']) in (True,'true')
        if template['id']=='community:influxdb':answers['EXPOSE_SERVICE']='false'
        name='console-catalog-upgrade-'+secrets.token_hex(4);marker='Disposable catalog upgrade fixture '+name
        files=version['files'];payload={'name':name,'description':marker,'startOnCreate':False,'externalId':'catalog://'+version['id'],'environment':answers,'dockerCompose':files.get('docker-compose.yml.tpl') or files['docker-compose.yml'],'rancherCompose':files.get('rancher-compose.yml.tpl') or files.get('rancher-compose.yml','')}
        stack=user.api(base+'stacks',payload);state={'stack':stack['id'],'name':name,'marker':marker,'template':template['id'],'initialVersion':version['id'],'choices':choices,'targetChoice':('3.4.8-rancher1' if template['id']=='community:zookeeper' else next((v for v in choices if v!=choice),choice)),'answerKey':('zk_mem' if template['id']=='community:zookeeper' else 'influxdb_port'),'answerValue':('384' if template['id']=='community:zookeeper' else '18086')};STATE.write_text(json.dumps(state,indent=2)+'\n')
        rows=wait(lambda:[v for v in user.api(base+'services')['data'] if v.get('stackId')==stack['id'] and not v.get('removed')],lambda values:bool(values) and all(v.get('state')=='inactive' for v in values))
        record('exclusive catalog fixture imported with services inactive',bool(rows))
        if template['id']=='community:zookeeper':
            for service in rows:user.api(base+'services/'+service['id'],{'scale':0},method='PUT')
            wait(lambda:[v for v in user.api(base+'services')['data'] if v.get('stackId')==stack['id'] and not v.get('removed')],lambda values:bool(values) and all(v.get('state')=='inactive' and v.get('scale')==0 for v in values))
            record('fixture service scale explicitly set to zero before catalog upgrade',True)
        print(json.dumps(state),flush=True)
    else:
        state=json.loads(STATE.read_text());stack=user.api(base+'stacks/'+state['stack']);assert stack['accountId']=='1a12' and stack['name']==state['name'] and stack['description']==state['marker']
        if mode=='status':
            services=[v for v in user.api(base+'services')['data'] if v.get('stackId')==stack['id'] and not v.get('removed')]
            ids={v['id'] for v in services};containers=[v for v in user.api(base+'containers')['data'] if not v.get('removed') and (v.get('stackId')==stack['id'] or ids.intersection(v.get('serviceIds') or []))]
            print(json.dumps({'stackState':stack['state'],'services':[{k:v.get(k) for k in ('id','name','state','scale')} for v in services],'containers':[{k:v.get(k) for k in ('id','state')} for v in containers]}),flush=True)
        elif mode=='verify':
            target=catalog(template['versionLinks'][state['targetChoice']])
            stack=wait(lambda:user.api(base+'stacks/'+state['stack']),lambda value:value.get('externalId')=='catalog://'+target['id'] and value.get('environment',{}).get(state['answerKey'])==state['answerValue'] and value.get('environment',{}).get('zk_scale')=='0' and value.get('state') in ('active','upgraded'))
            record('UI upgrades the existing stack ID, preserving name and environment',stack['accountId']=='1a12' and stack['name']==state['name'])
            record('UI persists a different real catalog version reference',stack['externalId']=='catalog://'+target['id'] and target['id']!=state['initialVersion'])
            record('UI parameter update persists without changing unrelated answers',stack['environment'].get(state['answerKey'])==state['answerValue'] and (state['template']!='community:influxdb' or stack['environment'].get('EXPOSE_SERVICE')=='false'))
            services=[v for v in user.api(base+'services')['data'] if v.get('stackId')==stack['id'] and not v.get('removed')]
            record('upgrade honors explicitly requested zero scale in the lab',bool(services) and all(v.get('scale')==0 for v in services))
            ids={v['id'] for v in services};containers=[v for v in user.api(base+'containers')['data'] if not v.get('removed') and (v.get('stackId')==stack['id'] or ids.intersection(v.get('serviceIds') or []))]
            record('catalog upgrade schedules no containers for a fixture already scaled to zero',not containers)
        elif mode=='authorization':
            reader=lab.Session();reader.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(reader.cookies));reader.oidc('leitor')
            status,_,_=reader.request('/v2-beta/'+base+'stacks/'+stack['id'])
            record('user without the fixture environment cannot read its stack',status in (403,404))
            status,_,_=reader.request('/v2-beta/'+base+'stacks/'+stack['id']+'?action=upgrade',{'externalId':stack['externalId'],'environment':{}})
            record('user without the fixture environment cannot submit its catalog upgrade',status in (403,404))
        elif mode=='cleanup':
            dependencies=[v['id'] for v in user.api(base+'services')['data'] if v.get('stackId')==stack['id'] and not v.get('removed')]
            if not stack.get('removed'):
                url=urllib.parse.urlparse(stack['actions']['remove']);assert url.netloc=='localhost:18090' and url.path.startswith('/v2-beta/'+base)
                status,_,_=user.request(stack['actions']['remove'],{});assert status in (200,201,202,204)
            wait(lambda:user.api(base+'stacks/'+state['stack']),lambda value:bool(value.get('removed')) or value.get('state')=='removed')
            for service_id in dependencies:
                wait(lambda:user.api(base+'services/'+service_id),lambda value:bool(value.get('removed')) or value.get('state')=='removed')
                wait(lambda:user.api(base+'services/'+service_id+'/instances')['data'],lambda values:all(v.get('removed') or v.get('state') in ('removed','purged') for v in values))
            record('only the exclusive catalog-upgrade fixture and dependent resources removed',True);STATE.unlink()
        else:raise ValueError('Unknown operation')
except Exception as error:
    print(json.dumps({'operation':sys.argv[1],'errorType':type(error).__name__,'locations':[{'file':Path(f.filename).name,'line':f.lineno} for f in traceback.extract_tb(error.__traceback__)]}),flush=True);raise SystemExit(1)
