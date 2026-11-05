"""Real local Keycloak logout matrix; restores policy/client/provider and owned fixtures."""
import http.cookiejar
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from keycloak_lab import KeycloakLab
from subscription_identity_fixture import identity_factory, OWN_STATE, ACCOUNT_STATE
import ws_revocation as probe

ROOT = probe.ROOT
STATE = ROOT / 'console/federated-logout-fixture.json'
OVERLAY = ROOT / 'console/federated-logout-policy-fixture.yaml'
REPORT = ROOT / 'console/federated-logout-results.json'
RETURNED = 'http://localhost:18090/console/login?oidc_logout=returned'


def docker(*args, timeout=180):
    result = subprocess.run(['docker', *args], cwd=ROOT, capture_output=True, timeout=timeout)
    assert result.returncode == 0, 'Scoped Docker operation failed; private diagnostics withheld.'
    return result.stdout


def main():
    assert not STATE.exists() and not OVERLAY.exists() and not OWN_STATE.exists() and not ACCOUNT_STATE.exists(), 'Recover prior owned fixtures first.'
    control = probe.session()
    context = None
    state = {'client': None, 'originalLogoutAttributePresent': False, 'originalLogoutAttribute': None, 'providerStopped': False, 'policyOverride': False}
    checks = []
    browser_results = []
    success = False
    client_changed = False
    cleanup = False
    def save(): STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')
    def check(name, valid=True):
        assert valid, name
        checks.append({'check': name, 'status': 'passed'})
        print('PASS: ' + name, flush=True)
    def kc(): return KeycloakLab(probe.lab.CONFIG['KEYCLOAK_ADMIN_PASSWORD'])
    def wait_policy(only, auto, logout):
        for _ in range(70):
            try:
                status, body, _ = control.request('/oidc/config')
                effective = body.get('effective', {})
                if status == 200 and all(effective.get(k) is v for k, v in {'OIDC_ONLY': only, 'OIDC_AUTO_LOGIN': auto, 'OIDC_FEDERATED_LOGOUT_ENABLED': logout}.items()): return
            except Exception:
                pass
            time.sleep(1)
        raise AssertionError('Expected public policy did not become effective.')
    def apply(only=False, auto=False):
        OVERLAY.write_bytes(('services:\n  rancher:\n    environment:\n      RANCHER_OIDC_FEDERATED_LOGOUT_ENABLED: "true"\n      RANCHER_OIDC_ONLY: "' + str(only).lower() + '"\n      RANCHER_OIDC_AUTO_LOGIN: "' + str(auto).lower() + '"\n').encode())
        state['policyOverride'] = True; save()
        docker('compose', '-f', 'compose.yaml', '-f', 'compose.console.yaml', '-f', str(OVERLAY), 'up', '-d', '--no-deps', 'rancher')
        wait_policy(only, auto, True)
    def provider_ready():
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(70):
            try:
                with opener.open('http://localhost:18081/realms/rancher-lab/.well-known/openid-configuration', timeout=2) as response:
                    if response.status == 200: return
            except Exception:
                pass
            time.sleep(1)
        raise AssertionError('Local provider did not recover.')
    def post(session, origin='http://localhost:18090', csrf=True, override=None):
        cookies = {c.name: c.value for c in session.cookies}
        headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        if origin is not None: headers['Origin'] = origin
        if csrf: headers['X-Api-Csrf'] = override if override is not None else urllib.parse.unquote(cookies.get('CSRF', ''))
        request = urllib.request.Request('http://localhost:18090/oidc/logout', data=b'{}', method='POST', headers=headers)
        try: response = session.opener.open(request, timeout=20)
        except urllib.error.HTTPError as error: response = error
        raw = response.read()
        try: body = json.loads(raw)
        except ValueError: body = {}
        assert 'no-store' in response.headers.get('Cache-Control', ''), 'Logout responses must not be cached.'
        return response.status, body
    def browser(mode, no_access=False):
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        credentials = context['browser_credentials']
        private = {'root': str(ROOT), 'runtimeModules': str(runtime / 'node_modules'),
                   'browserExecutable': str(Path.home() / 'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'),
                   **credentials, 'adminUsername': 'labadmin', 'adminPassword': probe.lab.CONFIG['RANCHER_ADMIN_PASSWORD'],
                   'mode': mode, 'noAccess': no_access}
        child = subprocess.Popen([str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/e2e/federated-logout.cjs')],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding='utf-8', env=dict(os.environ, DEBUG='', NODE_DEBUG=''))
        events = queue.Queue()
        def reader():
            for line in child.stdout:
                try: events.put(json.loads(line))
                except ValueError: events.put({'type': 'invalid-probe-output'})
        threading.Thread(target=reader, daemon=True).start()
        child.stdin.write(json.dumps(private) + '\n'); child.stdin.flush()
        until = time.monotonic() + 150
        result = None
        try:
            while time.monotonic() < until:
                try: value = events.get(timeout=1)
                except queue.Empty:
                    if child.poll() is not None: break
                    continue
                if value.get('type') == 'stop-provider':
                    assert mode == 'provider-down-exclusive' and not state['providerStopped']
                    docker('stop', 'rancher16-keycloak-lab')
                    state['providerStopped'] = True; save()
                    child.stdin.write('{"command":"provider-stopped"}\n'); child.stdin.flush()
                elif value.get('type') == 'result':
                    result = value
            child.wait(timeout=10)
            if result: browser_results.append(result)
            assert child.returncode == 0 and result and result.get('status') == 'passed', 'Browser logout scenario failed; no private diagnostics persisted.'
            check('isolated browser ' + mode + (' from no-access' if no_access else ' from shared shell'))
        finally:
            if child.poll() is None: child.kill(); child.wait()
            if state['providerStopped']:
                docker('start', 'rancher16-keycloak-lab'); provider_ready()
                state['providerStopped'] = False; save()
    try:
        wait_policy(False, False, False)
        save()
        check('flag off rejects the new POST endpoint', post(control)[0] == 404)
        context = identity_factory('grant', oidc=True)(control)
        service = kc()
        code, clients = service.request('/admin/realms/rancher-lab/clients?clientId=rancher16')
        assert code == 200 and len(clients) == 1
        state['client'] = clients[0]['id']
        code, client = service.request('/admin/realms/rancher-lab/clients/' + state['client'])
        assert code == 200 and client['clientId'] == 'rancher16'
        attributes = dict(client.get('attributes', {}))
        state['originalLogoutAttributePresent'] = 'post.logout.redirect.uris' in attributes
        state['originalLogoutAttribute'] = attributes.get('post.logout.redirect.uris'); save()
        client['attributes'] = {**attributes, 'post.logout.redirect.uris': RETURNED}
        assert service.request('/admin/realms/rancher-lab/clients/' + state['client'], client, 'PUT')[0] == 204
        client_changed = True
        apply()
        for browser_session in (control, context['session']):
            browser_session.opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Local acceptance client)')]
            browser_session.api('projects?limit=1')
            assert any(c.name == 'CSRF' for c in browser_session.cookies)
        check('federated capability enabled independently in hybrid mode')
        for label, origin, csrf, override in [
            ('missing Origin', None, True, None), ('foreign Origin', 'https://outside.example', True, None),
            ('missing CSRF header', 'http://localhost:18090', False, None), ('incorrect CSRF', 'http://localhost:18090', True, 'synthetic-wrong-csrf'),
        ]:
            check(label + ' is rejected', post(control, origin, csrf, override)[0] == 403)
        code, value = post(control)
        check('valid local session prepares only local logout', code == 200 and value == {'federated': False})
        code, value = post(context['session'])
        target = urllib.parse.urlparse(value.get('url', ''))
        parameters = urllib.parse.parse_qs(target.query)
        check('valid OIDC session prepares issuer-bound destination without ID token', code == 200 and value.get('federated') is True and target.scheme == 'http' and target.netloc == 'localhost:18081' and target.path.endswith('/protocol/openid-connect/logout') and parameters.get('client_id') == ['rancher16'] and parameters.get('post_logout_redirect_uri') == [RETURNED] and 'id_token_hint' not in parameters)
        check('GET cannot initiate logout preparation', control.request('/oidc/logout')[0] == 404)
        browser('confirmed-hybrid')
        browser('local-preserves-sso')
        context['invalidate']()  # Remove ONLY this owned group's environment grant.
        browser('confirmed-no-access', no_access=True)
        apply(only=True, auto=True)
        check('exclusive and automatic OIDC policies effective for outage test')
        browser('provider-down-exclusive', no_access=True)
        success = True
    except Exception as error:
        checks.append({'check': 'federated logout matrix', 'status': 'failed', 'errorType': type(error).__name__})
    finally:
        try:
            if state['providerStopped']:
                docker('start', 'rancher16-keycloak-lab'); provider_ready()
                state['providerStopped'] = False; save()
            if state['policyOverride']:
                docker('compose', '-f', 'compose.yaml', '-f', 'compose.console.yaml', 'up', '-d', '--no-deps', 'rancher')
                wait_policy(False, False, False)
                state['policyOverride'] = False; save()
                OVERLAY.unlink(missing_ok=True)
            if client_changed:
                service = kc()
                code, client = service.request('/admin/realms/rancher-lab/clients/' + state['client'])
                assert code == 200 and client['attributes'].get('post.logout.redirect.uris') == RETURNED, 'Concurrent client change; do not overwrite.'
                if state['originalLogoutAttributePresent']: client['attributes']['post.logout.redirect.uris'] = state['originalLogoutAttribute']
                else: client['attributes'].pop('post.logout.redirect.uris', None)
                assert service.request('/admin/realms/rancher-lab/clients/' + state['client'], client, 'PUT')[0] == 204
            if context:
                context['prepare_cleanup']()
                context['session'].request('/v2-beta/token/current', None, 'DELETE')
                assert context['session'].request('/v2-beta/projects')[0] == 401
                context['cleanup']()
            check('exact policy, provider, client registration and owned identity/group restored')
            cleanup = not any(p.exists() for p in (OWN_STATE, ACCOUNT_STATE, OVERLAY))
            assert cleanup
            STATE.unlink(missing_ok=True)
        except Exception as cleanup_error:
            success = False
            checks.append({'check': 'federated logout cleanup', 'status': 'failed', 'errorType': type(cleanup_error).__name__})
        finally:
            try:
                control.request('/v2-beta/token/current', None, 'DELETE')
                assert control.request('/v2-beta/projects')[0] == 401
            except Exception:
                success = False
        report = {'status': 'passed' if success and cleanup else 'failed', 'checks': checks, 'browser': browser_results,
                  'cleanupComplete': cleanup, 'scope': 'local synthetic Keycloak realm and owned Rancher identity; no production or other SSO application tested'}
        REPORT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': report['status'], 'checks': len(checks), 'browserScenarios': len(browser_results), 'cleanupComplete': cleanup}))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
