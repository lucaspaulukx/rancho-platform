"""Owned zero-scale sidecar device upgrade; no physical allocation or identity grants."""
import hashlib
import json
import os
import re
import secrets
import subprocess
import time
import traceback
import urllib.parse
from pathlib import Path

import ws_revocation as lab

ROOT = lab.ROOT
STATE = ROOT / 'console/sidecar-device-upgrade-fixture.json'
REPORT = ROOT / 'console/sidecar-device-upgrade-results.json'
BASE = 'projects/1a12/'


def main():
    assert not STATE.exists(), 'Recover the prior owned fixture before repeating.'
    if REPORT.exists():
        archive = ROOT / 'migration-runs'
        archive.mkdir(exist_ok=True)
        (archive / ('sidecar-device-upgrade-' + str(time.time_ns()) + '-results.json')).write_bytes(REPORT.read_bytes())
    marker = 'console-devices-' + secrets.token_hex(6)
    state = {'name': marker, 'environment': '1a12'}
    with STATE.open('x', encoding='utf-8') as file:
        json.dump(state, file)
    admin = stack = service = baseline = None
    result = {'status': 'failed', 'cleanupComplete': False, 'scope': 'owned zero-scale primary and helper service; no physical-device claim'}

    def save():
        STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')

    def rows(kind):
        return [v for v in admin.api(BASE + kind + '?limit=-1')['data'] if not v.get('removed')]

    def snapshot():
        return {v['id']: hashlib.sha256(json.dumps({k: v.get(k) for k in ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')}, sort_keys=True).encode()).hexdigest() for v in rows('services') if not v.get('system') and (not service or v['id'] != service['id'])}

    def wait(kind, resource_id, predicate):
        for _ in range(120):
            value = admin.api(BASE + kind + '/' + resource_id)
            if predicate(value):
                return value
            time.sleep(.5)
        raise AssertionError('Owned native transition timeout.')

    try:
        admin = lab.session()
        assert admin.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        baseline = snapshot()
        stacks = {v['id'] for v in rows('stacks')}
        volumes = {v['id'] for v in rows('volumes')}
        containers = {v['id'] for v in rows('containers') if not v.get('system')}
        state.update(baseline=baseline, stacks=sorted(stacks), volumes=sorted(volumes), containers=sorted(containers))
        save()
        stack = admin.api(BASE + 'stacks', {'name': marker, 'description': marker})
        state['stack'] = stack['id']
        save()
        wait('stacks', stack['id'], lambda v: v['state'] == 'active')
        launch = {'imageUuid': 'docker:alpine:3.20', 'networkMode': 'bridge', 'command': ['/bin/sh', '-c', 'sleep 86400'], 'memory': 67108864, 'environment': {'DEVICE_FIXTURE': 'preserved'}, 'devices': ['/dev/null:/dev/primary:r']}
        helper = {**launch, 'name': 'helper', 'environment': {'SIDECAR_DEVICE_FIXTURE': 'preserved'}, 'devices': ['/dev/null:/dev/helper-base:r']}
        service = admin.api(BASE + 'services', {'name': 'device-web', 'description': marker, 'stackId': stack['id'], 'scale': 0, 'startOnCreate': True, 'launchConfig': launch, 'secondaryLaunchConfigs': [helper]})
        state['service'] = service['id']
        save()
        wait('services', service['id'], lambda v: v['state'] == 'active')
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        browser = Path.home() / 'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
        payload = {'marker': marker, 'serviceId': service['id'], 'runtimeModules': str(runtime / 'node_modules'), 'browserExecutable': str(browser), 'cookies': [{'name': c.name, 'value': c.value} for c in admin.cookies if c.name in ('token', 'CSRF')]}
        result['stage'] = 'real-browser'
        child = subprocess.run([str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/e2e/sidecar-device-upgrades.cjs')], input=json.dumps(payload), text=True, encoding='utf-8', capture_output=True, timeout=240, env=dict(os.environ, DEBUG='', NODE_DEBUG=''))
        result['childExitCode'] = child.returncode
        result['childErrorCategories'] = re.findall(r'([A-Za-z]+Error):', child.stderr)
        result['browser'] = json.loads(child.stdout)
        assert child.returncode == 0 and result['browser']['status'] == 'passed' and result['browser']['browserClosed']
        assert not rows('services/' + service['id'] + '/instances')
        result['noPhysicalInstancesScheduled'] = True
        result['status'] = 'passed'
        result['stage'] = 'measured'
    except Exception as error:
        result['errorType'] = type(error).__name__
        result['errorLocations'] = [{'file': Path(v.filename).name, 'line': v.lineno} for v in traceback.extract_tb(error.__traceback__)]
    finally:
        errors = []
        if admin:
            try:
                if stack:
                    current = admin.api(BASE + 'stacks/' + stack['id'])
                    assert current['name'] == marker and current['description'] == marker and current['accountId'] == '1a12'
                    if service:
                        owned = admin.api(BASE + 'services/' + service['id'])
                        assert owned['scale'] == 0 and owned['stackId'] == stack['id'] and owned['description'] == marker
                        assert not rows('services/' + service['id'] + '/instances')
                    if not current.get('removed'):
                        target = urllib.parse.urlparse(current['actions']['remove'])
                        assert target.netloc == 'localhost:18080' and target.path.rstrip('/') == '/v2-beta/' + BASE + 'stacks/' + stack['id'] and target.query == 'action=remove'
                        assert admin.request(current['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
                    wait('stacks', stack['id'], lambda v: bool(v.get('removed')))
                    if service:
                        wait('services', service['id'], lambda v: bool(v.get('removed')))
                if baseline is not None:
                    assert snapshot() == baseline and {v['id'] for v in rows('stacks')} == stacks and {v['id'] for v in rows('volumes')} == volumes and {v['id'] for v in rows('containers') if not v.get('system')} == containers
                    result['preexistingWorkloadsPreserved'] = True
            except Exception as error:
                errors.append({'stage': 'workload', 'errorType': type(error).__name__})
            finally:
                try:
                    # DELETE expires the jar cookie. Replay only this own revoked value
                    # against a protected endpoint to verify server-side invalidation.
                    own_cookie = 'token=' + next(c.value for c in admin.cookies if c.name == 'token')
                    assert admin.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
                    result['controlSessionPostRevocationStatus'] = admin.request('/v2-beta/projects', extra_headers={'Cookie': own_cookie})[0]
                    assert result['controlSessionPostRevocationStatus'] == 401
                    result['controlSessionRevoked'] = True
                except Exception as error:
                    errors.append({'stage': 'session', 'errorType': type(error).__name__})
        result['cleanupComplete'] = not errors
        if errors:
            result['cleanupErrors'] = errors
            result['status'] = 'failed'
        else:
            assert json.loads(STATE.read_text(encoding='utf-8'))['name'] == marker
            STATE.unlink()
        REPORT.write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
