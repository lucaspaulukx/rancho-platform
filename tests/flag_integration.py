"""Mode changes and rollback against the disposable loopback Docker lab only."""
import json
import os
import subprocess
import sys
import time
from integration import Session, ROOT, CONFIG

checks = []
def check(name, valid):
    if not valid: raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)

def mode(exclusive, groups, auto):
    env = dict(os.environ, RANCHER_OIDC_ONLY=str(exclusive).lower(),
               RANCHER_LOCAL_RBAC_ENABLED=str(groups).lower(), RANCHER_OIDC_AUTO_LOGIN=str(auto).lower())
    result = subprocess.run(['docker', 'compose', '-f', 'compose.yaml', '-f', 'compose.console.yaml',
                             '-f', 'compose.legacy-host.yaml', 'up', '-d', '--no-deps', 'rancher'],
                            cwd=ROOT, env=env, capture_output=True)
    if result.returncode: raise RuntimeError('Docker lab recreation failed')
    session = Session()
    for _ in range(180):
        try:
            status, config, _ = session.request('/oidc/config')
            flags = config['effective'] if status == 200 else {}
            if flags.get('OIDC_ONLY') == exclusive and flags.get('LOCAL_RBAC_ENABLED') == groups and flags.get('OIDC_AUTO_LOGIN') == auto:
                # Servlet may be ready before the API finishes initialization.
                if session.request('/v2-beta/token')[0] == 200: return
        except Exception: pass
        time.sleep(1)
    raise RuntimeError('Lab configuration did not become ready')

def browser_checks(exclusive, auto):
    from playwright.sync_api import expect, sync_playwright
    base = 'http://localhost:18090'
    prefix = 'exclusive' if exclusive else 'hybrid'
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        page.goto(base + '/console/login?timedOut=1')
        expect(page.get_by_role('button', name='Entrar com Keycloak', exact=True)).to_be_visible()
        expect(page.get_by_label('Senha', exact=True)).to_have_count(0 if exclusive else 1)
        check(prefix + ': real login policy controls available authentication methods', True)
        page.get_by_role('button', name='Entrar com Keycloak', exact=True).click()
        expect(page.locator('#username')).to_be_visible()
        page.locator('#username').fill('sem-acesso')
        page.locator('#password').fill(CONFIG['LAB_USER_PASSWORD'])
        page.locator('#kc-login').click()
        expect(page.get_by_role('heading', name='Seu espaço está quase pronto', exact=True)).to_be_visible(timeout=30000)
        check(prefix + ': OIDC button and real callback finish without refresh or exposed ticket',
              'oidc_ticket' not in page.url)
        page.reload()
        expect(page.get_by_role('heading', name='Seu espaço está quase pronto', exact=True)).to_be_visible()
        check(prefix + ': browser refresh restores authenticated pending-access session', True)
        page.get_by_role('button', name='Sair da conta', exact=True).click()
        expect(page.get_by_role('heading', name='Acesse seu ambiente', exact=True)).to_be_visible()
        page.reload()
        expect(page.get_by_role('heading', name='Acesse seu ambiente', exact=True)).to_be_visible()
        check(prefix + ': explicit logout and refresh do not restart automatic login', True)
        context.close()
        if auto:
            context = browser.new_context()
            page = context.new_page()
            page.goto(base + '/console/login')
            expect(page.locator('#username')).to_be_visible()
            check('exclusive: clean browser automatically navigates to the real IdP', True)
            page.goto(base + '/console/login')
            expect(page.get_by_role('heading', name='Acesse seu ambiente', exact=True)).to_be_visible()
            check('exclusive: returning from interrupted autologin does not loop', True)
            page.goto(base + '/console/login?oidc_ticket=invalid-ticket-for-test')
            expect(page.get_by_role('alert')).to_contain_text('O login expirou ou foi recusado')
            expect(page.get_by_label('Senha', exact=True)).to_have_count(0)
            check('exclusive: rejected callback ticket is cleared and offers no password fallback',
                  'oidc_ticket' not in page.url)
            context.close()
            context = browser.new_context()
            page = context.new_page()
            page.route('http://localhost:18081/**', lambda route: route.fulfill(
                status=503, content_type='text/html', body='<h1>IdP unavailable</h1>'))
            page.goto(base + '/console/login')
            expect(page.locator('#username')).to_be_visible()
            page.reload()
            expect(page.get_by_role('heading', name='IdP unavailable', exact=True)).to_be_visible()
            page.goto(base + '/console/login')
            expect(page.get_by_role('heading', name='Acesse seu ambiente', exact=True)).to_be_visible()
            expect(page.get_by_label('Senha', exact=True)).to_have_count(0)
            check('exclusive: browser-scoped IdP outage does not loop or offer local fallback', True)
            context.close()
        browser.close()


def main():
    local = Session(); local.login('labadmin', CONFIG['RANCHER_ADMIN_PASSWORD'])
    count = len(local.api('localGroups')['data'])
    reader = Session(); reader.oidc('leitor')
    allowed = [p['id'] for p in reader.api('projects')['data']]
    check('Baseline reader has a local group grant', bool(allowed))
    if '--browser' in sys.argv:
        browser_checks(False, False)
    try:
        print('Switching lab to exclusive OIDC, autologin, groups disabled', flush=True)
        mode(True, False, True)
        anonymous = Session()
        status = anonymous.request('/oidc/status')[1]
        check('Server advertises exclusive and automatic login', status['only'] and status['autoLogin'])
        check('Password login refused by backend', anonymous.request('/v2-beta/token', {'code':'labadmin:'+CONFIG['RANCHER_ADMIN_PASSWORD']})[0] == 403)
        check('Existing local session token retrieval refused', local.request('/v2-beta/token')[0] == 401)
        check('Existing local session resource access refused', local.request('/v2-beta/projects')[0] == 401)
        check('Existing OIDC session survives container recreation', reader.request('/v2-beta/token')[0] == 200)
        check('Disabled group grants stop authorizing existing session', reader.api('projects')['data'] == [])
        fresh = Session(); fresh.oidc('sem-acesso')
        check('Fresh OIDC login works in exclusive mode', fresh.api('projects')['data'] == [])
        check('Ordinary user remains unable to manage groups', fresh.request('/v2-beta/localGroups')[0] in (403,404))
        if '--browser' in sys.argv:
            browser_checks(True, True)
    finally:
        print('Restoring hybrid login and enabled local groups', flush=True)
        mode(False, True, False)
    restored = Session(); restored.login('labadmin', CONFIG['RANCHER_ADMIN_PASSWORD'])
    check('Rollback restores local login', restored.request('/v2-beta/projects')[0] == 200)
    check('Group records preserved through disable and rollback', len(restored.api('localGroups')['data']) == count)
    check('Existing OIDC session regains preserved group grant', [p['id'] for p in reader.api('projects')['data']] == allowed)
    if '--browser' in sys.argv:
        browser_checks(False, False)
    (ROOT/'flag-test-results.json').write_text(json.dumps({'checks': checks, 'total': len(checks)}, indent=2))
    print(str(len(checks))+' flag integration checks passed', flush=True)

if __name__ == '__main__': main()
