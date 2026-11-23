"""Grant only a temporary readonly on the owned sandbox stack's environment."""
import importlib.util, json, secrets, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sp = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(sp); sp.loader.exec_module(lab); lab.BASE='http://localhost:18090'
def session():
    s=lab.Session();s.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(s.cookies));return s
admin=session();admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
state=json.loads((ROOT/'console/config-upgrade-fixture.json').read_text(encoding='utf-8'))
assert state['name'].startswith('console-config-upgrade-') and state['environment']=='1a12'
base='projects/1a12/'
value=admin.api(base+'services/'+state['service'])
assert value['description']==state['marker'] and value['stackId']==state['stack'] and value['scale']==0 and value['state']=='active'
user=session();token,_=user.oidc('sem-acesso');assert not user.api('projects')['data']
group=None;report={}
try:
    group=admin.api('localGroups',{'name':'health-readonly-'+secrets.token_hex(6),'members':[token['accountId'].removeprefix('1a')],'grants':{'12':'readonly'}})
    access=user.api('localAccessReports?targetAccount=self&targetEnvironment=1a12')['data'][0]
    assert access['complete'] and access['effectiveRole']=='readonly'
    schemas={v['id']:v for v in admin.api(base+'schemas')['data']}
    def payload(schema,data):
        return {k:payload(schemas[schema['resourceFields'][k]['type']],v) if isinstance(v,dict) and schema['resourceFields'][k]['type'] in schemas else v
                for k,v in data.items() if schema['resourceFields'].get(k,{}).get('create')}
    launch=payload(schemas['launchConfig'],value['launchConfig'])
    launch['healthCheck']={'port':8081,'interval':2000,'responseTimeout':2000,'strategy':'none'}
    permission=user.api(base+'schemas/service')
    visible=user.api(base+'services/'+value['id'])
    assert 'upgrade' not in visible.get('actions',{}) and 'upgrade' not in permission.get('resourceActions',{})
    status,denial,_=user.request('/v2-beta/'+base+'services/'+value['id']+'?action=upgrade',{'inServiceStrategy':{'launchConfig':launch,'batchSize':1,'intervalMillis':2000,'startFirst':False}})
    report={'effectiveRole':'readonly','validNativeHealthUpgradeStatus':status,'code':denial.get('code') if isinstance(denial,dict) else None,'upgradeActionExposed':False}
    assert status in (403,404,405) or (status==422 and report['code'] in ('InvalidAction','ActionNotAvailable')), 'Unexpected readonly response: HTTP '+str(status)+' code '+str(report['code'])
    fresh=admin.api(base+'services/'+value['id'])
    assert fresh['launchConfig']==value['launchConfig'] and fresh['state']=='active'
    report.update(status='passed',configurationPreserved=True)
finally:
    if group:
        fresh=next(v for v in admin.api('localGroups')['data'] if v['id']==group['id'])
        admin.api('localGroups',{'id':fresh['id'],'revision':fresh['revision'],'name':fresh['name'],'delete':True})
        assert not user.api('projects')['data'];report['temporaryGrantRemoved']=True
    (ROOT/'console/healthcheck-upgrade-authorization-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
