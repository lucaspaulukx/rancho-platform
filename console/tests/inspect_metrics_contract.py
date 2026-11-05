"""Read-only metadata and frame shape from synthetic host/container metrics."""
import importlib.util
import json
import logging
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
user=lab.Session()
user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
result=[]
for kind,identifier in [('containers','1i1'),('hosts','1h1')]:
    entry={'kind':kind}
    try:
        resource=user.api('projects/1a12/'+kind+'/'+identifier)
        assert resource.get('name')=='console-standalone' or resource.get('hostname')=='console-legacy-host'
        entry['links']=list(resource['links'])
        name='stats' if 'stats' in resource['links'] else 'hostStats' if kind=='hosts' else 'containerStats'
        status,access,_=user.request(resource['links'][name])
        entry['accessStatus']=status
        entry['accessKeys']=list(access)
        if status==200 and access.get('token') and access.get('url'):
            parsed=urllib.parse.urlparse(access['url'])
            assert parsed.hostname in ('localhost','127.0.0.1') and parsed.path.startswith(('/v1/','/v2-beta/','/r/'))
            query=dict(urllib.parse.parse_qsl(parsed.query));query['token']=access['token']
            url=urllib.parse.urlunparse(('ws','localhost:18090',parsed.path,'',urllib.parse.urlencode(query),''))
            with connect(url,proxy=None,origin=lab.BASE,compression=None,open_timeout=10,close_timeout=2) as connection:
                for attempt in range(4):
                    frame=json.loads(connection.recv(timeout=15))
                    if frame:
                        row=frame[0]
                        entry['sample']= {key:row.get(key) for key in ('id','resourceType','timestamp','cpu','memory','network','diskio')}
                        break
    except Exception as error:entry['errorType']=type(error).__name__
    result.append(entry)
(ROOT/'console/metrics-contract.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
