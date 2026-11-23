"""Read native upgrade schemas and lifecycle capabilities, without launch secrets."""
import importlib.util
import json
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
user=lab.Session()
user.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base='projects/1a12/'
schemas=user.api(base+'schemas?limit=-1')['data']
result={'schemas':{s['id']:{k:s.get(k) for k in ('resourceFields','resourceActions','resourceMethods','collectionMethods')}
    for s in schemas if 'upgrade' in s['id'].lower() or s['id'] in ('stack','service','loadBalancerService','serviceRestart','rollingRestartStrategy')},'resources':[]}
for kind in ('stacks','services'):
    rows=user.api(base+kind+'?limit=-1')['data']
    result['resources'].extend([{key:v.get(key) for key in ('id','type','name','state','externalId')}|
        {'actions':list(v.get('actions',{})), 'launchFields':list((v.get('launchConfig') or {}).keys())}
        for v in rows if not v.get('removed') and not v.get('system')])
(ROOT/'console/upgrade-contract.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'schemas':{key:{'fields':value['resourceFields'],'actions':value['resourceActions']} for key,value in result['schemas'].items() if key in ('serviceRestart','rollingRestartStrategy')},'resourceCount':len(result['resources'])},indent=2))
