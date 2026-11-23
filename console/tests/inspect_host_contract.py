"""Print only field names and capabilities; never registration credentials."""
import importlib.util
import json
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
result = {}
for kind in ('host', 'registrationToken'):
    schema = user.api('projects/1a12/schemas/' + kind)
    result[kind] = {key: schema.get(key) for key in ('collectionMethods', 'resourceMethods', 'resourceActions', 'resourceFields')}
hosts = user.api('projects/1a12/hosts')['data']
result['hostFieldNames'] = list(hosts[0]) if hosts else []
result['hostInfoKeys'] = {key: list(value) for key, value in (hosts[0].get('info', {}) if hosts else {}).items() if isinstance(value, dict)}
result['hostCapacity'] = {key: hosts[0].get(key) for key in ('memory','milliCpu','computeTotal','agentState')} if hosts else {}
result['memoryInfo'] = hosts[0].get('info',{}).get('memoryInfo',{}) if hosts else {}
tokens = user.api('projects/1a12/registrationTokens')['data']
result['registrationFieldNames'] = list(tokens[0]) if tokens else []
print(json.dumps(result, indent=2))
