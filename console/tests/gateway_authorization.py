"""Check the beta gateway with the named local RBAC fixtures and owned sessions."""
from contextlib import ExitStack
import json
import urllib.error
import urllib.request

from gateway_security import ORIGIN, lab, no_store, require


def close_session(session):
    if any(cookie.name == 'token' for cookie in session.cookies):
        status, _, _ = session.request('/v2-beta/token/current', method='DELETE')
        denied, _, _ = session.request('/v2-beta/projects')
        require('Owned session is no longer authorized', status in (200, 204, 401) and denied == 401)


def raw(session, path, method, headers):
    request = urllib.request.Request(ORIGIN + path, method=method, headers=headers)
    try:
        response = session.opener.open(request, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, ','.join(response.headers.get_all('Cache-Control', []))


def main():
    lab.BASE = ORIGIN
    with ExitStack() as cleanup:
        admin, reader, unassigned = (lab.Session() for _ in range(3))
        for session in (admin, reader, unassigned):
            cleanup.callback(close_session, session)
        admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
        reader.oidc('leitor')
        _, ticket = unassigned.oidc('sem-acesso')
        replay = lab.Session()
        status, result, _ = replay.request('/v2-beta/token', {'code': 'oidc-ticket:' + ticket})
        require('Consumed OIDC ticket cannot issue a new session',
                status == 401 and isinstance(result, dict) and not result.get('jwt'))
        status, configuration, _ = replay.request('/oidc/config')
        require('Public OIDC configuration contains no credential fields',
                status == 200 and isinstance(configuration, dict)
                and not any(field in json.dumps(configuration).lower()
                            for field in ('clientsecret', 'client_secret', 'password', 'privatekey')))

        accessible = reader.api('projects')['data']
        require('Read-only account has only the RBAC-DEV fixture',
                len(accessible) == 1 and accessible[0]['name'] == 'RBAC-DEV')
        allowed = accessible[0]['id']
        foreign = next(project['id'] for project in admin.api('projects')['data']
                       if project['name'] == 'RBAC-PROD')
        allowed_path = '/v2-beta/projects/' + allowed + '/stacks'
        foreign_path = '/v2-beta/projects/' + foreign + '/stacks'
        require('Admin can read both scoped routes',
                all(admin.request(path)[0] == 200 for path in (allowed_path, foreign_path)))
        require('Read-only account can read its own stacks', reader.request(allowed_path)[0] == 200)
        require('Read-only account cannot read foreign stacks',
                reader.request(foreign_path)[0] in (403, 404))
        require('Forged project header does not override route scope',
                reader.request(foreign_path, extra_headers={'X-Api-Project-Id': allowed})[0] in (403, 404))
        require('Read-only stack creation is denied',
                reader.request(allowed_path, {'name': 'beta-security-probe'}, 'POST')[0] in (403, 405))
        require('Unassigned OIDC account has no projects', unassigned.api('projects')['data'] == [])
        require('Unassigned OIDC account cannot read a direct project route',
                unassigned.request(allowed_path)[0] in (403, 404))
        for path in ('/v2-beta/localGroups', '/v2-beta/localGroupAudits'):
            require(path + ' rejects the unassigned account',
                    unassigned.request(path)[0] in (403, 404))

        agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
        require('Browser-style request receives a CSRF cookie',
                admin.request('/v2-beta/projects', extra_headers={'User-Agent': agent})[0] == 200
                and any(cookie.name == 'CSRF' for cookie in admin.cookies))
        for token in (None, 'synthetic-wrong-csrf'):
            headers = {'User-Agent': agent, 'Origin': ORIGIN, 'Sec-Fetch-Site': 'same-origin'}
            if token is not None:
                headers['X-Api-Csrf'] = token
            status, cache_control = raw(admin, '/v2-beta/token/current', 'DELETE', headers)
            require('Native CSRF check rejects missing or wrong header',
                    status == 403 and no_store(cache_control))
        csrf_cookie = next(cookie for cookie in admin.cookies if cookie.name == 'CSRF')
        admin.cookies.clear(csrf_cookie.domain, csrf_cookie.path, csrf_cookie.name)
        for method, path, context in [
            ('DELETE', '/v2-beta/token/current', {'Origin': 'https://foreign.invalid'}),
            ('POST', '/v2-beta/token/current?_method=DELETE', {'Origin': 'http://localhost:9999'}),
            ('DELETE', '/v2-beta/token/current', {'Origin': 'null'}),
            ('GET', '/v2-beta/projects', {'Sec-Fetch-Site': 'same-site'}),
            ('GET', '/v2-beta/projects', {'Sec-Fetch-Site': 'cross-site'}),
        ]:
            status, cache_control = raw(admin, path, method, {'User-Agent': agent, **context})
            require('Gateway rejects foreign cookie request ' + method + ' ' + path,
                    status == 403 and no_store(cache_control))
        require('Denied requests preserve the owned session', admin.request('/v2-beta/projects')[0] == 200)
        status, cache_control = raw(admin, '/v2-beta/projects', 'GET',
                                    {'Origin': ORIGIN, 'Sec-Fetch-Site': 'same-origin'})
        require('Same-origin cookie request remains authorized', status == 200 and no_store(cache_control))


if __name__ == '__main__':
    main()
