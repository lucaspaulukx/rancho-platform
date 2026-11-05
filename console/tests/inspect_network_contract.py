"""Read only: record native network-policy schemas and lab capabilities, never credentials."""
import importlib.util
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
session = lab.Session()
session.opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(session.cookies)
)
session.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
base = '/v2-beta/projects/1a12/'
result = {'environment': '1a12', 'schemas': {}}
for kind in ('network', 'networkPolicyRule', 'networkPolicyRuleMember',
             'networkPolicyRuleWithin', 'networkPolicyRuleBetween'):
    status, schema, _ = session.request(base + 'schemas/' + kind)
    result['schemas'][kind] = {'status': status}
    if status == 200:
        result['schemas'][kind].update({key: schema.get(key) for key in (
            'id', 'collectionMethods', 'resourceMethods', 'resourceFields'
        )})
for collection, fields in (
    ('networks', ('id', 'name', 'accountId', 'state', 'defaultPolicyAction', 'policy')),
    ('stacks', ('id', 'name', 'accountId', 'state', 'healthState', 'externalId')),
):
    status, response, _ = session.request(base + collection + '?limit=100')
    result[collection] = {
        'status': status,
        'data': [{key: value.get(key) for key in fields}
                 for value in response.get('data', [])] if status == 200 else [],
    }
(ROOT / 'console/network-contract.json').write_text(
    json.dumps(result, indent=2) + '\n', encoding='utf-8'
)
print(json.dumps(result, indent=2))
