"""Probe environment repository configuration with a closed loopback URL only.

Never refresh global repositories or launch a template. Report metadata only.
"""
import importlib.util
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
admin = lab.Session()
admin.opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(admin.cookies))
admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
project = admin.api('projects/1a417')
assert project['name'] == 'CONSOLE-POLICY-LAB' and not project.get('removed')
name = 'console-contract-' + uuid.uuid4().hex[:12]
path = '/v1-catalog/catalogs'
report = {'environment': project['id'], 'checks': [], 'cleanup': False}


def request(method, endpoint, body=None, user=admin, additional=None):
    assert (endpoint.startswith(path) or endpoint.startswith('/v1/proxy/http://localhost:8088' + path)) and '?' not in endpoint
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json',
               'X-Api-Project-Id': project['id']}
    headers.update({'X-Api-Csrf': cookie.value for cookie in user.cookies if cookie.name == 'CSRF'})
    headers.update(additional or {})
    req = urllib.request.Request(lab.BASE + endpoint, method=method, headers=headers,
                                 data=None if body is None else json.dumps(body).encode())
    try:
        response = user.opener.open(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    try:
        data = json.loads(raw)
    except ValueError:
        data = {}
    return response.status, data


def rows():
    status, data = request('GET', path)
    assert status == 200
    return data.get('data', []) if isinstance(data, dict) else data


def signature(values):
    return json.dumps(sorted(values, key=lambda value: str(value.get('id'))), sort_keys=True)


baseline = rows()
assert not any(value.get('name') == name for value in baseline)
payload = {'name': name, 'url': 'http://127.0.0.1:1/console-contract.git',
           'branch': 'main', 'kind': 'native'}
group = None
try:
    no_access = lab.Session()
    no_access.opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(no_access.cookies))
    no_access.oidc('sem-acesso')
    denied, _ = request('POST', path, payload, no_access)
    report['checks'].append({'actor': 'no-access', 'method': 'POST', 'status': denied})
    assert denied in (403, 404, 405), 'No-access user must not configure repositories'
    status, data = request('POST', path, payload)
    report['checks'].append({'method': 'POST', 'status': status})
    found = [value for value in rows() if value.get('name') == name]
    report['persisted'] = bool(found)
    assert len(found) <= 1
    if found:
        value = found[0]
        assert value.get('environmentId') == project['id'], 'Unexpected repository scope'
        target = path + '/' + urllib.parse.quote(name, safe='')
        status, _ = request('PUT', target, {**payload, 'branch': 'console-contract-test'})
        report['checks'].append({'method': 'PUT', 'status': status})
        operator = lab.Session()
        operator.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(operator.cookies))
        token, _ = operator.oidc('operador')
        for role in ('readonly', 'member', 'owner'):
            body = {'name': name, 'members': [token['accountId'].removeprefix('1a')],
                    'grants': {project['id'].removeprefix('1a'): role}}
            if group:
                body.update(id=group['id'], revision=group['revision'])
            group = admin.api('localGroups', body)
            assert any(v['id'] == project['id'] for v in operator.api('projects')['data'])
            status, _ = request('PUT', target, {**payload, 'branch': 'role-' + role}, operator)
            report['checks'].append({'actor': role, 'method': 'PUT', 'status': status})
            if role == 'readonly':
                assert status in (403, 404, 405), 'Readonly must not configure repositories'
                for verb, endpoint in [('POST', path), ('DELETE', target),
                                       ('PUT', '/v1/proxy/http://localhost:8088' + target)]:
                    denied, _ = request(verb, endpoint, payload, operator, {'X-Api-Roles': 'owner'})
                    report['checks'].append({'actor': role, 'method': verb,
                                             'directProxy': endpoint.startswith('/v1/proxy/'),
                                             'spoofedRoleHeader': True, 'status': denied})
                    assert denied in (403, 404, 405), 'Readonly mutation or proxy bypass allowed'
            else:
                assert status == 200, 'Writer lost native repository update'
    else:
        assert status in (403, 404, 405, 501), 'Unexpected native catalog result'
finally:
    if group:
        current = next(v for v in admin.api('localGroups')['data'] if v['id'] == group['id'])
        admin.api('localGroups', {'id': current['id'], 'revision': current['revision'],
                                 'name': current['name'], 'delete': True})
        report['temporaryGroupRemoved'] = True
    found = [value for value in rows() if value.get('name') == name]
    for value in found:
        assert value.get('environmentId') == project['id']
        assert value.get('url') == payload['url']
        status, _ = request('DELETE', path + '/' + urllib.parse.quote(name, safe=''), payload)
        report['checks'].append({'method': 'DELETE', 'status': status})
        assert status in (200, 202, 204)
    report['cleanup'] = signature(rows()) == signature(baseline)
    (ROOT / 'console/environment-catalog-contract-results.json').write_text(
        json.dumps(report, indent=2), encoding='utf-8')
    assert report['cleanup'], 'Catalog baseline changed'
print(json.dumps(report))
