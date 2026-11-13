"""Check the loopback Nginx gateway using one disposable administrator session."""
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tests'))
import integration as lab

ORIGIN = 'http://localhost:18090'


def require(label, condition):
    if not condition:
        raise AssertionError(label)
    print('PASS:', label, flush=True)


def fetch(path):
    try:
        return lab.loopback_opener().open(ORIGIN + path, timeout=15)
    except urllib.error.HTTPError as error:
        return error


def no_store(cache_control):
    directives = [directive.strip().lower() for directive in cache_control.split(',')]
    return 'no-store' in directives and 'public' not in directives


def main():
    with fetch('/console/login?oidc_ticket=synthetic-gateway-probe') as response:
        require('Login deep link serves the shell', response.status == 200)
        require('Login route has no referrer and forbids framing',
                response.headers.get('Referrer-Policy') == 'no-referrer'
                and "frame-ancestors 'none'" in response.headers.get('Content-Security-Policy', ''))
        require('SPA shell must revalidate', response.headers.get('Cache-Control') == 'no-cache')
        asset = re.search(r'src="(/console/assets/[^"]+\.js)"', response.read().decode('utf-8'))
        require('The shell references a bundled script', asset is not None)
    with fetch(asset.group(1)) as response:
        require('Versioned script remains cacheable', response.status == 200
                and 'immutable' in response.headers.get('Cache-Control', ''))
    with fetch('/console/console-config.json') as response:
        require('Console configuration forbids caching', response.status == 200
                and no_store(response.headers.get('Cache-Control', '')))

    for path, statuses in [
        ('/v2-beta/projects', (401, 403)),
        ('/v2-beta/localGroups', (401, 403, 404)),
        ('/oidc/callback?state=synthetic-invalid&code=synthetic-invalid', (401,)),
        ('/oidc/config', (200,)),
    ]:
        with fetch(path) as response:
            label = path.partition('?')[0]
            require(label + ' anonymous status', response.status in statuses)
            require(label + ' anonymous response forbids caching',
                    no_store(','.join(response.headers.get_all('Cache-Control', []))))
            require(label + ' API response retains nosniff and frame denial',
                    response.headers.get('X-Content-Type-Options') == 'nosniff'
                    and response.headers.get('X-Frame-Options') == 'DENY')

    lab.BASE = ORIGIN
    admin = lab.Session()
    try:
        admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
        require('Login token response forbids caching',
                no_store(admin.response_metadata['cacheControl']))
        for path in ['projects', 'token', 'localGroups', 'auditLogs?limit=1', 'apikeys?limit=1']:
            status, _, _ = admin.request('/v2-beta/' + path)
            require(path + ' authenticated response succeeds', status == 200)
            require(path + ' authenticated response forbids caching',
                    no_store(admin.response_metadata['cacheControl']))
    finally:
        if any(cookie.name == 'token' for cookie in admin.cookies):
            revoked, _, _ = admin.request('/v2-beta/token/current', method='DELETE')
            denied, _, _ = admin.request('/v2-beta/projects')
            require('Disposable session revoked', revoked in (200, 204) and denied == 401)


if __name__ == '__main__':
    main()
