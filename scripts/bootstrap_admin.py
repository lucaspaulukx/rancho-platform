"""Initialize local authentication on a fresh loopback-only Rancho installation."""

import argparse
import getpass
import http.cookiejar
import ipaddress
import json
import re
import urllib.parse
import urllib.request


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirects are not allowed during administrator initialization')


def local_origin(value):
    url = urllib.parse.urlsplit(value)
    try:
        local = url.hostname == 'localhost' or ipaddress.ip_address(url.hostname or '').is_loopback
    except ValueError:
        local = False
    if (not local or url.scheme not in ('http', 'https') or url.username or url.password
            or url.path not in ('', '/') or url.query or url.fragment):
        raise ValueError('Administrator initialization requires a loopback origin')
    _ = url.port
    return value.rstrip('/')


def configure(origin, username, password):
    origin = local_origin(origin)
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,63}', username):
        raise ValueError('Use a simple local account name without spaces or colons')
    if len(password) < 20 or len(password.encode('utf-8')) > 72:
        raise ValueError('Use at least 20 characters and at most 72 UTF-8 bytes')
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), NoRedirects(), urllib.request.HTTPCookieProcessor(jar))

    def request(path, body=None):
        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        for cookie in jar:
            if cookie.name == 'CSRF':
                headers['X-Api-Csrf'] = cookie.value
        payload = None if body is None else json.dumps(body).encode('utf-8')
        req = urllib.request.Request(origin + '/v2-beta/' + path, data=payload, headers=headers)
        with opener.open(req, timeout=20) as response:
            return json.loads(response.read(1024 * 1024))

    data = request('token').get('data', [])
    if len(data) != 1 or data[0].get('security') is not False:
        raise ValueError('Authentication is already configured or the installation is not fresh')
    result = request('localAuthConfig', {
        'enabled': True, 'username': username, 'password': password,
        'name': username, 'accessMode': 'unrestricted',
    })
    if result.get('enabled') is not True:
        raise ValueError('Local authentication was not confirmed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', default='http://localhost:18090')
    parser.add_argument('--username', default='admin')
    args = parser.parse_args()
    try:
        local_origin(args.origin)
        password = getpass.getpass('New local administrator password: ')
        if password != getpass.getpass('Confirm password: '):
            raise ValueError('Passwords differ')
        configure(args.origin, args.username, password)
    except Exception as error:
        print('Administrator initialization failed: ' + type(error).__name__)
        return 1
    print('Local authentication configured. Sign in with the administrator account you selected.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
