"""Verify classic Ember login and read-only navigation on the named synthetic lab."""

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from migration.test_fresh_install_lab import image_id, inspect, require


BASE = 'http://localhost:18080'
ROOT = Path(__file__).resolve().parents[1]


def rehearse(backend, report):
    report['stage'] = 'verify-lab'
    lab = inspect('container', 'rancher16-rbac-lab')
    require(lab['State']['Running'] and lab['Image'] == backend, 'Verify running lab backend image')
    bindings = lab['NetworkSettings']['Ports'].get('8080/tcp') or []
    require(any(item['HostIp'] == '127.0.0.1' and item['HostPort'] == '18080' for item in bindings),
            'Verify named lab owns the expected loopback port')
    config = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines() if '=' in line)
    check_browser(BASE, 'labadmin', config['RANCHER_ADMIN_PASSWORD'], report)


def check_browser(base, username, secret, report, extra_headers=None):
    from playwright.sync_api import sync_playwright

    origin = urlsplit(base)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(service_workers='block', extra_http_headers=extra_headers)

        def gate(route):
            request = route.request
            url = urlsplit(request.url)
            read = request.method in ('GET', 'HEAD')
            login = request.method == 'POST' and url.path == '/v2-beta/token'
            if url.scheme == origin.scheme and url.netloc == origin.netloc and (read or login):
                route.continue_()
            else:
                route.abort()

        context.route('**/*', gate)
        # A WebSocket route stays local unless it explicitly connects to the server.
        context.route_web_socket('**/*', lambda _: None)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda _: errors.append(True))
        try:
            report['stage'] = 'entry-document'
            document = page.goto(base + '/', wait_until='domcontentloaded')
            require(document and document.ok, 'Classic entry document must load')
            report['stage'] = 'login-form'
            page.locator('input[type=text]').fill(username, timeout=10000)
            password = page.locator('input[type=password]')
            password.fill(secret, timeout=10000)
            report['stage'] = 'login-submit'
            with page.expect_response(lambda response: urlsplit(response.url).path == '/v2-beta/token'
                                      and response.request.method == 'POST') as result:
                password.press('Enter')
            require(result.value.status == 201, 'Classic login must succeed')
            report['stage'] = 'login-navigation'
            page.wait_for_url(lambda url: urlsplit(url).path != '/login')
            report['stage'] = 'environment-list'
            page.goto(base + '/settings/env', wait_until='domcontentloaded')
            page.locator('table tbody a[href^="/settings/env/1a"]').first.wait_for(state='visible', timeout=15000)
            require(urlsplit(page.url).path == '/settings/env', 'Verify classic environment route')
            require(not errors, 'Verify no uncaught browser errors')
        finally:
            cookies = {cookie['name']: cookie['value'] for cookie in context.cookies(base)}
            if cookies.get('token'):
                headers = {'X-Api-Csrf': cookies['CSRF']} if cookies.get('CSRF') else {}
                revoked = context.request.delete(base + '/v2-beta/token/current', headers=headers, max_redirects=0)
                require(revoked.status in (200, 202, 204), 'Revoke owned classic login session')
                report['sessionRevoked'] = True
            page.close()
            context.unroute_all(behavior='wait')
            context.close()
        require(report['sessionRevoked'], 'Verify cleanup of successful login')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-image', required=True)
    args = parser.parse_args()
    report = {'status': 'failed', 'stage': 'resolve-image', 'sessionRevoked': False}
    try:
        report['backendImage'] = image_id(args.backend_image)
        rehearse(report['backendImage'], report)
    except Exception as error:
        report['errorType'] = type(error).__name__
    else:
        report.update(status='passed', stage='complete')
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
