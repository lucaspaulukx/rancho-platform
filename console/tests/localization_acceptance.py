"""Read-only browser acceptance of opt-in locale preview on the named local lab.

Creates one own admin session, overrides only each browser context's frontend
configuration response, and revokes that session in finally. No workload,
identity, grant, database or deployed configuration changes are performed.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import traceback
import urllib.request

import ws_revocation as lab

ROOT = lab.ROOT
REPORT = ROOT / 'console/localization-results.json'
ORIGIN = 'http://localhost:18090'


def config_digest():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(ORIGIN + '/console/console-config.json', timeout=20) as response:
        assert response.code == 200
        content = response.read(262145)
        assert len(content) <= 262144
        assert isinstance(json.loads(content), dict)
        return hashlib.sha256(content).hexdigest()


def main(*, accessibility=False):
    if REPORT.exists():
        archive = ROOT / 'migration-runs'
        archive.mkdir(exist_ok=True)
        (archive / ('localization-' + str(time.time_ns()) + '-results.json')).write_bytes(REPORT.read_bytes())
    admin = None
    before = None
    browser_started = False
    result = {
        'status': 'failed', 'cleanupComplete': False, 'controlSessionRevoked': False,
        'scope': 'localhost18090, UI-OPS-LAB; ten-locale preview, read-only browser',
    }
    try:
        result['stage'] = 'owned-session'
        admin = lab.session()
        assert admin.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        before = config_digest()
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        browser = Path.home() / 'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
        assert browser.is_file() and (runtime / 'bin/node.exe').is_file()
        payload = {
            'runtimeModules': str(runtime / 'node_modules'), 'browserExecutable': str(browser),
            'accessibility': accessibility,
            'cookies': [{'name': cookie.name, 'value': cookie.value} for cookie in admin.cookies
                        if cookie.name in ('token', 'CSRF')],
        }
        assert any(cookie['name'] == 'token' for cookie in payload['cookies'])
        result['stage'] = 'browser-acceptance'
        browser_started = True
        child = subprocess.run(
            [str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/e2e/localization.cjs')],
            input=json.dumps(payload), text=True, encoding='utf-8', capture_output=True,
            timeout=105, env=dict(os.environ, DEBUG='', NODE_DEBUG=''),
        )
        assert len(child.stdout) < 65536
        measured = json.loads(child.stdout)
        allowed = {
            'status', 'checks', 'browserClosed', 'pageErrors', 'blockedRequests',
            'configurationOverrides', 'contextsClosed', 'stage', 'timedOut',
            'unmetPrecondition', 'errorType', 'errorLines', 'accessibility',
        }
        assert isinstance(measured, dict) and set(measured) <= allowed
        result['browser'] = measured
        assert child.returncode == 0 and measured['status'] == 'passed' and measured['browserClosed']
        assert measured['blockedRequests'] == 0 and measured['pageErrors'] == 0
        result['status'] = 'passed'
        result['stage'] = 'measured'
    except Exception as error:
        result['errorType'] = type(error).__name__
        result['errorLocations'] = [
            {'file': Path(frame.filename).name, 'line': frame.lineno}
            for frame in traceback.extract_tb(error.__traceback__)
        ]
    finally:
        cleanup_errors = []
        if before is not None:
            try:
                result['deployedConfigurationPreserved'] = config_digest() == before
                assert result['deployedConfigurationPreserved']
            except Exception as error:
                cleanup_errors.append({'stage': 'configuration', 'errorType': type(error).__name__})
        if admin is not None:
            try:
                code = admin.request('/v2-beta/token/current', None, 'DELETE')[0]
                assert code in (200, 204, 401)
                result['controlSessionRevoked'] = admin.request('/v2-beta/projects')[0] == 401
                assert result['controlSessionRevoked']
            except Exception as error:
                cleanup_errors.append({'stage': 'session', 'errorType': type(error).__name__})
        if browser_started and not result.get('browser', {}).get('browserClosed'):
            cleanup_errors.append({'stage': 'browser', 'errorType': 'ClosureNotConfirmed'})
        result['cleanupComplete'] = not cleanup_errors and (admin is None or result['controlSessionRevoked'])
        if cleanup_errors:
            result['cleanupErrors'] = cleanup_errors
            result['status'] = 'failed'
        REPORT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--accessibility', action='store_true',
                        help='Also scan six routes with axe at desktop and mobile widths in both themes.')
    raise SystemExit(main(accessibility=parser.parse_args().accessibility))
