"""Expose schema metadata only; never stored credentials or secret values."""
import importlib.util
import json
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
def session():
    value=lab.Session()
    value.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(value.cookies))
    return value
user=session()
user.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
result={}
for kind in ('registry','registryCredential','certificate','secret','volume','storagePool','backup','backupTarget'):
    status,schema,_=user.request('/v2-beta/projects/1a12/schemas/'+kind)
    result[kind]={'status':status}
    if status==200:
        result[kind].update({key:schema.get(key) for key in ('links','collectionMethods','resourceMethods','resourceActions')})
        result[kind]['editableFields']={key:value for key,value in schema.get('resourceFields',{}).items() if value.get('create') or value.get('update')}
        result[kind]['fieldNames']=list(schema.get('resourceFields',{}))
(ROOT/'console/data-contract.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
