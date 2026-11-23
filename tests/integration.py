"""Disposable local integration tests; never points at a remote Rancher.
Uses browser-style authorization-code OIDC, including state cookies and PKCE.
"""
import importlib.util
import html
import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_transport_spec = importlib.util.spec_from_file_location('lab_loopback_transport', Path(__file__).with_name('loopback_transport.py'))
_transport = importlib.util.module_from_spec(_transport_spec)
_transport_spec.loader.exec_module(_transport)
loopback_opener = _transport.loopback_opener
CONFIG = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines() if '=' in line)
BASE = 'http://localhost:18080'
RESULTS = []

class LoopbackBrowserPolicy(http.cookiejar.DefaultCookiePolicy):
    def return_ok_secure(self, cookie, request):
        # Chrome treats localhost as trustworthy and sends Keycloak's Secure cookies.
        # Python's default jar does not; mirror that behavior only for this lab host.
        if urllib.parse.urlparse(request.full_url).hostname == 'localhost': return True
        return super().return_ok_secure(cookie, request)

class Session:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar(policy=LoopbackBrowserPolicy())
        self.opener = loopback_opener(self.cookies)

    def request(self, path, body=None, method=None, form=False, extra_headers=None):
        url = path if path.startswith('http') else BASE + path
        data = None if body is None else (urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode())
        headers = {'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' if form else 'application/json'}
        headers.update(extra_headers or {})
        for c in self.cookies:
            if c.name == 'CSRF': headers['X-Api-Csrf'] = c.value
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            response = self.opener.open(req, timeout=20)
        except urllib.error.HTTPError as e:
            response = e
        self.response_metadata = {'cacheControl': ','.join(response.headers.get_all('Cache-Control', [])), 'contentType': response.headers.get('Content-Type')}
        raw = response.read().decode('utf-8')
        try: content = json.loads(raw)
        except ValueError: content = raw
        return response.code, content, response.url

    def api(self, path, body=None, expected=(200, 201, 202, 204), method=None):
        status, data, _ = self.request('/v2-beta/' + path, body, method)
        if status not in expected:
            code = data.get('code', '') if isinstance(data, dict) else 'non-json'
            raise AssertionError(f'{method or ("POST" if body is not None else "GET")} {path}: HTTP {status} {code}')
        return data

    def set_token(self, value):
        self.cookies.set_cookie(http.cookiejar.Cookie(0, 'token', value, None, False, 'localhost.local', False, False, '/', True, False, None, True, None, None, {}))

    def login(self, username, password):
        token = self.api('token', {'code': username + ':' + password})
        self.set_token(token['jwt'])
        return token

    def oidc(self, username):
        status, page, url = self.request('/oidc/login')
        assert status == 200 and isinstance(page, str), 'OIDC login page unavailable'
        action = html.unescape(re.search(r'<form[^>]+action="([^"]+)"', page).group(1))
        status, page, url = self.request(action, {'username': username, 'password': CONFIG['LAB_USER_PASSWORD'], 'credentialId': ''}, form=True)
        ticket = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('oidc_ticket', [None])[0]
        assert status == 200 and ticket, 'OIDC callback did not issue a login ticket: HTTP '+str(status)+' path='+urllib.parse.urlparse(url).path
        token = self.api('token', {'code': 'oidc-ticket:' + ticket})
        self.set_token(token['jwt'])
        return token, ticket

def check(name, condition=True):
    assert condition, name
    RESULTS.append({'check': name, 'status': 'passed'})
    print('PASS:', name, flush=True)

def main():
    initial = Session()
    for _ in range(60):
        try:
            if initial.request('/ping')[0] == 200: break
        except Exception: pass
        time.sleep(1)
    if not initial.api('token')['data'][0]['security']:
        initial.api('localAuthConfig', {'enabled': True, 'username': 'labadmin', 'password': CONFIG['RANCHER_ADMIN_PASSWORD'], 'name': 'Administrador do laboratorio', 'accessMode': 'unrestricted'})
    admin = Session()
    admin.login('labadmin', CONFIG['RANCHER_ADMIN_PASSWORD'])
    check('Local administrator login')
    admin.api('localGroups')
    check('Native localGroups API registered')
    projects = admin.api('projects?all=true&limit=-1')['data']
    for name in ['RBAC-DEV', 'RBAC-PROD']:
        if not any(p['name'] == name for p in projects):
            admin.api('projects', {'name': name, 'orchestration': 'cattle'})
    projects = admin.api('projects?all=true&limit=-1')['data']
    dev = next(p for p in projects if p['name'] == 'RBAC-DEV')
    prod = next(p for p in projects if p['name'] == 'RBAC-PROD')
    for fixture in admin.api('localGroups')['data']:
        if fixture['name'] == 'Suporte - laboratorio':
            admin.api('localGroups', {'id': fixture['id'], 'revision': fixture['revision'], 'name': fixture['name'], 'members': [], 'grants': fixture['grants']})
        elif fixture['name'] == 'Grupo temporario':
            admin.api('localGroups', {'id': fixture['id'], 'revision': fixture['revision'], 'name': fixture['name'], 'delete': True})
    baseline = {p['id'] for p in projects}
    user = Session()
    token, ticket = user.oidc('sem-acesso')
    user_id = token['accountId'].removeprefix('1a')
    check('Keycloak authorization-code OIDC login')
    check('OIDC user created as ordinary user', token['userType'] == 'user')
    check('New user sees zero environments', user.api('projects')['data'] == [])
    after = admin.api('projects?all=true&limit=-1')['data']
    check('First login creates no environment', {p['id'] for p in after} == baseline)
    user.api('projects/' + dev['id'] + '/stacks', expected=(403, 404))
    check('Direct environment API denied without grant')
    user.api('projects', {'name': 'must-not-exist'}, expected=(403,))
    check('User cannot create own environment')
    user.api('localGroups', expected=(403, 404))
    user.api('localGroups', {'name': 'escalation', 'members': [user_id], 'grants': {}}, expected=(403, 404))
    check('Ordinary user cannot read or administer groups')
    user.api('token', {'code': 'oidc-ticket:' + ticket}, expected=(401,))
    check('OIDC login ticket cannot be replayed')
    attacker = Session()
    attacker.request('/oidc/callback?state=forged&code=forged')
    check('Forged OIDC state rejected', attacker.request('/oidc/callback?state=forged&code=forged')[0] == 401)
    existing = admin.api('localGroups')['data']
    group = next((g for g in existing if g['name'] == 'Suporte - laboratorio'), None)
    body = {'name': 'Suporte - laboratorio', 'members': [user_id], 'grants': {dev['id'].removeprefix('1a'): 'readonly'}}
    if group: body.update(id=group['id'], revision=group['revision'])
    group = admin.api('localGroups', body)
    check('Administrator creates group, members and environment grants')
    check('Existing session gains only selected environment', [p['id'] for p in user.api('projects')['data']] == [dev['id']])
    user.api('projects/' + dev['id'] + '/stacks')
    user.api('projects/' + prod['id'] + '/stacks', expected=(403, 404))
    check('Environment isolation enforced by backend')
    user.api('projects/' + dev['id'] + '/stacks', {'name': 'forbidden-stack'}, expected=(403, 405))
    check('Read Only role cannot create stack')
    old = dict(group)
    group = admin.api('localGroups', {'id': group['id'], 'revision': group['revision'], 'name': group['name'], 'members': [], 'grants': body['grants']})
    check('Removing member revokes existing session', user.api('projects')['data'] == [])
    user.api('projects/' + dev['id'] + '/stacks', expected=(403, 404))
    check('Direct API revoked without new login')
    admin.api('localGroups', {'id': old['id'], 'revision': old['revision'], 'name': old['name'], 'members': [user_id], 'grants': body['grants']}, expected=(409,))
    check('Concurrent stale group edits rejected')
    # Leave demonstrable fixtures: reader gets DEV read-only; operator gets DEV member.
    for username, role in [('leitor', 'readonly'), ('operador', 'member')]:
        other = Session(); other_token, _ = other.oidc(username)
        name = 'Leitores - laboratorio' if role == 'readonly' else 'Operadores - laboratorio'
        previous = next((g for g in admin.api('localGroups')['data'] if g['name'] == name), None)
        payload = {'name': name, 'members': [other_token['accountId'].removeprefix('1a')], 'grants': {dev['id'].removeprefix('1a'): role}}
        if previous: payload.update(id=previous['id'], revision=previous['revision'])
        admin.api('localGroups', payload)
        other.api('projects/' + dev['id'] + '/stacks')
        check(username + ': login and local group authorization')
    # Prove create/update/delete atomically changes authorization.
    temporary = admin.api('localGroups', {'name': 'Grupo temporario', 'members': [user_id], 'grants': {prod['id'].removeprefix('1a'): 'readonly'}})
    check('Second environment can be granted independently', [p['id'] for p in user.api('projects')['data']] == [prod['id']])
    admin.api('localGroups', {'id': temporary['id'], 'revision': temporary['revision'], 'name': temporary['name'], 'delete': True})
    check('Deleting group revokes access', user.api('projects')['data'] == [])
    check('Pending-access page served', user.request('/no-access.html')[0] == 200)
    check('Group management page served', admin.request('/local-groups.html')[0] == 200)
    (ROOT / 'test-results.json').write_text(json.dumps({'checks': RESULTS, 'total': len(RESULTS)}, indent=2, ensure_ascii=False))
    print(f'{len(RESULTS)} checks passed. Synthetic fixtures retained for manual review.')

if __name__ == '__main__':
    main()
