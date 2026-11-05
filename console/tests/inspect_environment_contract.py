"""Inspect public environment/template schema metadata, excluding template answers."""
import importlib.util
import json
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('lab',ROOT/'tests/integration.py')
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE='http://localhost:18090'
admin=lab.Session()
admin.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(admin.cookies))
admin.login('labadmin',lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
result={}
for kind in ('project','projectTemplate','catalogTemplate','projectMember'):
    status,schema,_=admin.request('/v2-beta/schemas/'+kind)
    result[kind]={'status':status}
    if status==200:
        result[kind].update({key:schema.get(key) for key in ('links','collectionMethods','resourceMethods','resourceActions')})
        result[kind]['editableFields']={key:value for key,value in schema.get('resourceFields',{}).items() if value.get('create') or value.get('update')}
        result[kind]['fieldNames']=list(schema.get('resourceFields',{}))
collection=result.get('projectTemplate',{}).get('links',{}).get('collection')
if collection:
    status,values,_=admin.request(collection)
    result['templates']=[{key:value.get(key) for key in ('id','name','state','isPublic')}|{'stacks':[ {key:stack.get(key) for key in ('name','templateId','templateVersionId')} for stack in value.get('stacks',[]) ]} for value in values.get('data',[])] if status==200 else []
(ROOT/'console/environment-contract.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
