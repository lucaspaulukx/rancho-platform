"""Real metric streams and temporary readonly access in the isolated laboratory.
Connection tokens stay in memory and evidence contains only check outcomes.
"""
import importlib.util
import json
import logging
import math
import secrets
import time
import urllib.parse
import urllib.request
from pathlib import Path
from websockets.sync.client import connect
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
logging.getLogger('websockets').setLevel(logging.CRITICAL)
checks=[];group=None;stage='initialization'
def session():
    user=lab.Session()
    user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
    return user
def check(name,condition=True):
    assert condition,name
    checks.append({'check':name,'status':'passed'})
    print('PASS: '+name,flush=True)
def socket_url(access):
    parsed=urllib.parse.urlparse(access['url'])
    assert parsed.hostname in ('localhost','127.0.0.1') and parsed.path.startswith(('/v1/','/v2-beta/','/r/'))
    query=dict(urllib.parse.parse_qsl(parsed.query));query['token']=access['token']
    return urllib.parse.urlunparse(('ws','localhost:18090',parsed.path,'',urllib.parse.urlencode(query),''))
def samples(user,resource):
    link=resource['links']['hostStats' if resource['type']=='host' else 'stats']
    status,access,_=user.request(link)
    assert status==200 and access.get('token') and access.get('url')
    values=[]
    with connect(socket_url(access),proxy=None,origin=lab.BASE,compression=None,open_timeout=10,close_timeout=2) as connection:
        deadline=time.monotonic()+30
        while len(values)<2 and time.monotonic()<deadline:
            frame=connection.recv(timeout=15)
            assert isinstance(frame,str) and len(frame)<=1_048_576
            rows=json.loads(frame)
            assert isinstance(rows,list) and len(rows)<=32
            for row in rows:
                if row.get('resourceType')!=resource['type']:continue
                assert resource['type']=='host' or row.get('id')==resource['externalId']
                assert isinstance(row.get('timestamp'),str)
                usage=row.get('memory',{}).get('usage')
                assert isinstance(usage,(float,int)) and math.isfinite(usage) and usage>=0
                cpu=row.get('cpu',{}).get('usage',{})
                assert all(isinstance(cpu.get(key),(float,int)) and cpu[key]>=0 for key in ('user','system'))
                if values and row['timestamp']<=values[-1]['timestamp']:continue
                values.append(row)
    assert len(values)>=2
    return values
admin=session()
try:
    admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    container=admin.api('projects/1a12/containers/1i1');host=admin.api('projects/1a12/hosts/1h1')
    assert container.get('name')=='console-standalone' and host.get('hostname')=='console-legacy-host'
    stage='administrator metric streams'
    for resource in (container,host):
        values=samples(admin,resource)
        check('administrator receives ordered native '+resource['type']+' metrics',len(values)>=2)
        check(resource['type']+' CPU counters support finite rates',all(values[-1]['cpu']['usage'][key]>=values[0]['cpu']['usage'][key] for key in ('user','system')))
    stage='readonly metric streams'
    group=admin.api('localGroups',{'name':'Console metrics test '+secrets.token_hex(4),'members':['10'],'grants':{'12':'readonly'}})
    reader=session();reader.oidc('leitor')
    for collection,resource in [('containers',container),('hosts',host)]:
        readable=reader.api('projects/1a12/'+collection+'/'+resource['id'])
        check('readonly user receives '+resource['type']+' metrics',len(samples(reader,readable))>=2)
    status,_,_=reader.request('/v2-beta/projects/1a7/containers/1i1/stats')
    check('metric access cannot cross environment scope',status in (403,404))
    stage='revocation revalidation'
    admin.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'delete':True});group=None
    for collection,resource in [('containers',container),('hosts',host)]:
        status,_,_=reader.request('/v2-beta/projects/1a12/'+collection+'/'+resource['id'])
        check('resource revalidation denies revoked '+resource['type']+' grant',status in (403,404))
except Exception as error:
    checks.append({'check':stage,'status':'failed','errorType':type(error).__name__})
    print('FAILED: '+stage+' ('+type(error).__name__+'); sensitive output withheld.',flush=True)
finally:
    if group:
        try:admin.api('localGroups',{'id':group['id'],'name':group['name'],'revision':group['revision'],'delete':True})
        except Exception:checks.append({'check':'temporary grant cleanup','status':'failed'})
    (ROOT/'console/metrics-test-results.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
if any(item['status']!='passed' for item in checks):raise SystemExit(1)
print(str(len(checks))+' metric integration checks passed.',flush=True)
