"""Create an isolated environment with the native Cattle template; no hosts attached."""
import importlib.util
import json
import time
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
    user=lab.Session()
    user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
    return user
def check(name,condition):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
try:
    admin=session()
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    template=next(value for value in admin.api('projecttemplates')['data'] if value.get('name')=='Cattle' and value.get('state')=='active' and not value.get('removed'))
    check('native Cattle template contains infrastructure definitions',bool(template.get('stacks')))
    stage='environment creation'
    name='CONSOLE-TEMPLATE-API'
    marker='Synthetic environment template fixture'
    found=next((value for value in admin.api('projects')['data'] if value.get('name')==name and not value.get('removed')),None)
    if found:assert found.get('description') in (marker,marker+' updated')
    project=found or admin.api('projects',{'name':name,'description':marker,'projectTemplateId':template['id'],'members':[]})
    base='projects/'+project['id']
    deadline=time.monotonic()+75
    stacks=[]
    while time.monotonic()<deadline:
        project=admin.api(base)
        stacks=admin.api(base+'/stacks')['data']
        if project.get('state')=='active' and len(stacks)>=len(template['stacks']):break
        if project.get('transitioning')=='error':raise RuntimeError('Synthetic environment provisioning failed')
        time.sleep(1)
    check('environment preserves the selected native template',project.get('projectTemplateId')==template['id'] and project.get('orchestration')=='cattle' and project.get('state')=='active')
    expected={value['name'] for value in template['stacks']}
    check('template infrastructure stacks are created in the new environment',expected.issubset({value.get('name') for value in stacks}) and all(value['accountId']==project['id'] for value in stacks))
    check('synthetic environment has no host or workload container',not admin.api(base+'/hosts')['data'] and not admin.api(base+'/containers')['data'])
    admin.api(base,{'description':marker+' updated'},method='PUT')
    project=admin.api(base)
    check('environment metadata edit preserves its native template',project.get('description')==marker+' updated' and project.get('projectTemplateId')==template['id'])
    stage='authorization'
    reader=session()
    reader.oidc('leitor')
    check('new environment is not automatically granted to a reader',project['id'] not in {value['id'] for value in reader.api('projects')['data']})
    status,_,_=reader.request('/v2-beta/'+base+'/stacks')
    check('reader cannot access the new environment by direct URL',status in (403,404))
    (ROOT/'console/environment-fixture.json').write_text(json.dumps({'environment':project['id'],'template':template['id'],'stacks':[value['id'] for value in stacks]},indent=2)+'\n',encoding='utf-8')
except Exception as error:
    checks.append({'check':stage,'status':'failed','errorType':type(error).__name__})
    print('FAILED: '+stage+' ('+type(error).__name__+'); sensitive output withheld.',flush=True)
finally:
    (ROOT/'console/environment-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(value['status']!='passed' for value in checks):raise SystemExit(1)
