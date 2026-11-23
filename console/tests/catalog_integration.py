"""Real catalog -> Compose import with services kept stopped in UI-OPS-LAB.
No external integration credentials or production resources are used.
"""
import importlib.util
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
checks=[]
stage='initialization'
def session():
    value=lab.Session()
    value.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(value.cookies))
    return value
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
def catalog(user,path,project):
    parsed=urllib.parse.urlparse(path)
    assert not parsed.netloc or parsed.netloc=='localhost:18090'
    assert parsed.path.startswith('/v1-catalog/')
    request=urllib.request.Request(lab.BASE+parsed.path+('?' + parsed.query if parsed.query else ''),headers={'Accept':'application/json','X-Api-Project-Id':project})
    with user.opener.open(request,timeout=20) as response:return json.load(response)
admin=session()
try:
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    project=next(value for value in admin.api('projects')['data'] if value.get('name')=='UI-OPS-LAB' and not value.get('removed'))
    assert project['id']=='1a12'
    base='projects/'+project['id']
    stage='catalog browsing'
    catalogs=catalog(admin,'/v1-catalog/catalogs',project['id'])['data']
    templates=catalog(admin,'/v1-catalog/templates?rancherVersion=v1.6.30',project['id'])['data']
    check('catalog collections are served through the console origin',bool(catalogs) and bool(templates))
    template=catalog(admin,'/v1-catalog/templates/community:influxdb?rancherVersion=v1.6.30',project['id'])
    assert template['id']=='community:influxdb' and not template.get('templateBase')
    version=catalog(admin,template['versionLinks'][template['defaultVersion']],project['id'])
    check('selected version belongs to the selected template',version['templateId']==template['id'] and version['id'].startswith('community:influxdb:'))
    files=version['files']
    docker_compose=files.get('docker-compose.yml.tpl') or files.get('docker-compose.yml')
    rancher_compose=files.get('rancher-compose.yml.tpl') or files.get('rancher-compose.yml')
    check('version provides native Compose files and typed questions',isinstance(docker_compose,str) and bool(docker_compose) and isinstance(version.get('questions'),list))
    answers={}
    for question in version.get('questions',[]):
        assert question['type'] not in ('service','certificate','secret'), 'Fixture must not depend on other resources'
        value=question.get('default')
        if question['type']=='boolean':value=value is True or value=='true'
        if question.get('required') and question['type']!='boolean':assert value is not None and value!='', 'Missing fixture default'
        if value is not None:answers[question['variable']]=value
    payload={'name':'console-catalog-api','description':'Catalog integration fixture','startOnCreate':False,'dockerCompose':docker_compose,'rancherCompose':rancher_compose,'externalId':'catalog://'+version['id'],'environment':answers}
    stage='native Compose import'
    found=next((value for value in admin.api(base+'/stacks')['data'] if value.get('name')==payload['name'] and not value.get('removed')),None)
    if found:assert found.get('description')==payload['description'] and found['accountId']==project['id']
    stack=found or admin.api(base+'/stacks',payload)
    deadline=time.monotonic()+60
    services=[]
    while time.monotonic()<deadline:
        stack=admin.api(base+'/stacks/'+stack['id'])
        services=[value for value in admin.api(base+'/services')['data'] if value.get('stackId')==stack['id'] and not value.get('removed')]
        if services and all(value.get('state') not in ('creating','requested','registering') for value in services):break
        if stack.get('transitioning')=='error':raise AssertionError('Fixture Compose import failed')
        time.sleep(1)
    check('catalog stack persists version reference and environment scope',stack['accountId']==project['id'] and stack.get('externalId')=='catalog://'+version['id'])
    check('Rancher imports services from the original catalog Compose',bool(services) and all(value['accountId']==project['id'] for value in services))
    check('create without start keeps imported services inactive',all(value.get('state')=='inactive' for value in services))
    containers=admin.api(base+'/containers')['data']
    service_ids={value['id'] for value in services}
    check('stopped catalog import creates no running containers',not any(value.get('state')=='running' and (value.get('stackId')==stack['id'] or service_ids.intersection(value.get('serviceIds') or [])) for value in containers))
    stage='readonly authorization'
    reader=session()
    reader.oidc('leitor')
    readable=catalog(reader,'/v1-catalog/templates?rancherVersion=v1.6.30','1a7')
    check('readonly user can browse available templates',isinstance(readable.get('data'),list))
    schema=reader.api('projects/1a7/schemas/stack')
    status,data,_=reader.request('/v2-beta/projects/1a7/stacks',payload)
    check('readonly profile cannot launch a catalog stack', 'POST' not in schema.get('collectionMethods',[]) and (status in (403,404,405) or (status==422 and data.get('code') in ('InvalidAction','PermissionDenied'))))
    status,_,_=reader.request('/v2-beta/'+base+'/stacks/'+stack['id'])
    check('catalog-created stack remains isolated from unauthorized environments',status in (403,404))
    (ROOT/'console/catalog-fixture.json').write_text(json.dumps({'environment':project['id'],'stack':stack['id'],'template':template['id'],'version':version['id'],'services':[{'id':value['id'],'name':value.get('name'),'state':value.get('state')} for value in services]},indent=2)+'\n',encoding='utf-8')
except Exception as error:
    checks.append({'check':stage,'status':'failed','errorType':type(error).__name__})
    print('FAILED: '+stage+' ('+type(error).__name__+'); sensitive output withheld.',flush=True)
finally:
    (ROOT/'console/catalog-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(value['status']!='passed' for value in checks):raise SystemExit(1)
print(str(len(checks))+' catalog checks passed.',flush=True)
