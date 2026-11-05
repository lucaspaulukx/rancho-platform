"""Read native catalog policy-manager requirements; never print credentials."""
import importlib.util
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
user = lab.Session()
user.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(user.cookies))
user.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])

def catalog(path):
    parsed = urllib.parse.urlparse(path)
    assert not parsed.netloc or parsed.netloc == 'localhost:18090'
    assert parsed.path.startswith('/v1-catalog/')
    request = urllib.request.Request(lab.BASE + parsed.path + ('?' + parsed.query if parsed.query else ''),
        headers={'Accept': 'application/json', 'X-Api-Project-Id': '1a12'})
    with user.opener.open(request, timeout=20) as response:
        return json.load(response)

templates = catalog('/v1-catalog/templates?rancherVersion=v1.6.30')['data']
matches = [item for item in templates if 'network-policy' in item.get('id', '')]
result = []
for item in matches:
    detail = catalog(item['links']['self'])
    version = catalog(detail['versionLinks'][detail['defaultVersion']])
    result.append({key: version.get(key) for key in ('id', 'templateId', 'questions', 'files')})
(ROOT / 'console/policy-catalog-contract.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
