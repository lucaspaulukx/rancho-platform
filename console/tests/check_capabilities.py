"""Read Cattle schema capabilities for admin and the synthetic reader."""
import importlib.util
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
def session():
    value = lab.Session()
    value.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(value.cookies))
    return value
admin = session()
admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
reader = session()
reader.oidc('leitor')
result = {}
for name, user in [('admin', admin), ('reader', reader)]:
    result[name] = {}
    for kind in ('stack', 'service', 'container'):
        schema = user.api('projects/1a7/schemas/' + kind)
        result[name][kind] = {'collectionMethods': schema.get('collectionMethods'), 'resourceMethods': schema.get('resourceMethods'), 'actions': list(schema.get('resourceActions', {}))}
(ROOT / 'console/capability-test-results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
