"""Read-only catalog contract discovery; outputs public template metadata only."""
import importlib.util
import json
import urllib.parse
import urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT/'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
user = lab.Session()
user.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
def get(path):
    request = urllib.request.Request(lab.BASE+path, headers={'Accept':'application/json','X-Api-Project-Id':'1a12'})
    with user.opener.open(request, timeout=20) as response: return json.load(response)
catalogs = get('/v1-catalog/catalogs')
templates = get('/v1-catalog/templates?rancherVersion=v1.6.30&category_ne=system')
rows = templates if isinstance(templates,list) else templates.get('data',[])
print(json.dumps({'cattleApplications':[{key:value.get(key) for key in ('id','name','defaultVersion')} for value in rows if not value.get('templateBase')][:35]},indent=2))
template = next(value for value in rows if value.get('templateBase') in ('',None))
detail = get('/v1-catalog/templates/'+urllib.parse.quote(template['id'],safe=''))
versions = detail.get('versionLinks',{})
version = get(urllib.parse.urlparse(next(iter(versions.values()))).path) if versions else {}
print(json.dumps({'catalogShape':type(catalogs).__name__,'catalogCount':len(catalogs),'templateShape':type(templates).__name__,'templateCount':len(rows),'sample':{key:detail.get(key) for key in ('id','name','defaultVersion','templateBase','versionLinks','description','category','links')}, 'templateFields':list(detail),'versionFields':list(version),'versionId':version.get('id'),'questions':[{key:value.get(key) for key in ('variable','label','type','required','options','min','max')} for value in version.get('questions',[])],'fileNames':list(version.get('files',{}))},indent=2))
print(json.dumps({'catalogFields':list(catalogs), 'listSample':rows[:1], 'candidates':[{key:value.get(key) for key in ('id','name','defaultVersion','templateBase')} for value in rows if any(term in (value.get('name','')+' '+value.get('id','')).lower() for term in ('hello','nginx','redis'))], 'stackComposeFields':{key:value for key,value in user.api('projects/1a12/schemas/stack')['resourceFields'].items() if key in ('dockerCompose','rancherCompose','externalId','environment','startOnCreate')}},indent=2))
