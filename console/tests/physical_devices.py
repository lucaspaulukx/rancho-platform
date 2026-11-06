"""One marked, nonprivileged device mapping through the real local creation UI.

The /dev/null fixture proves persistence, Docker mapping and character-device
read access. It does not prove write isolation: Docker/runc defaults already
allow this major/minor. Measure write-open honestly, without chmod or a readonly
root filesystem. Run serially with other legacy-guest/scheduler harnesses.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
import traceback

import ws_revocation as lab
from legacy_guest import run_guest

ROOT = lab.ROOT
STATE = ROOT / 'console/devices-fixture.json'
REPORT = ROOT / 'console/devices-physical-results.json'
BASE = 'projects/1a12/'
LABEL = 'rancher.console.devices-fixture'
MAPPING = '/dev/null:/dev/rancho-null:r'


def main():
    assert not STATE.exists(), 'Recover the owned prior device fixture first.'
    if REPORT.exists():
        archive = ROOT / 'migration-runs'
        archive.mkdir(exist_ok=True)
        (archive / ('devices-physical-' + str(time.time_ns()) + '-results.json')).write_bytes(REPORT.read_bytes())
    admin = None
    relay = None
    identity = None
    marker = 'console-devices-' + secrets.token_hex(6)
    baseline = None
    containers = set()
    volumes = set()
    owns_state = False
    result = {
        'status': 'failed', 'cleanupComplete': False, 'checks': [],
        'scope': 'one UI-OPS-LAB container on original host1h1; no privileged mode, securityOpt, mknod or host-device changes',
        'devicePermissionDenialValidated': False,
        'limitations': ['The /dev/null major/minor is already writable under native Docker/runc defaults; this fixture does not certify device write isolation.'],
    }

    def check(name, condition=True):
        assert condition
        result['checks'].append(name)
        print('PASS: ' + name, flush=True)

    def rows(kind):
        return [row for row in admin.api(BASE + kind + '?limit=-1')['data'] if not row.get('removed')]

    def service_snapshot():
        return {row['id']: hashlib.sha256(json.dumps({key: row.get(key) for key in (
            'name', 'description', 'launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId',
        )}, sort_keys=True).encode()).hexdigest() for row in rows('services') if not row.get('system')}

    try:
        result['stage'] = 'sandbox-preflight'
        admin = lab.session()
        assert admin.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        host = admin.api(BASE + 'hosts/1h1')
        check('original sandbox host and agent are active', host['state'] == 'active' and host['agentState'] == 'active')
        baseline = service_snapshot()
        volumes = {row['id'] for row in rows('volumes')}
        containers = {row['id'] for row in rows('containers') if not row.get('system')}
        with STATE.open('x', encoding='utf-8') as state:
            owns_state = True
            json.dump({'name': marker, 'environment': '1a12', 'label': LABEL,
                       'baseline': baseline, 'containers': sorted(containers), 'volumes': sorted(volumes)}, state)
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        browser = Path.home() / 'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
        assert browser.is_file() and (runtime / 'bin/node.exe').is_file()
        payload = {
            'marker': marker, 'runtimeModules': str(runtime / 'node_modules'), 'browserExecutable': str(browser),
            'cookies': [{'name': cookie.name, 'value': cookie.value} for cookie in admin.cookies
                        if cookie.name in ('token', 'CSRF')],
        }
        from scheduler_relay_window import RelayAllocationWindow
        relay = RelayAllocationWindow(admin, LABEL, marker)
        result['stage'] = 'scheduler-allocation-window'
        relay.start()
        result['stage'] = 'browser-creation'
        child = subprocess.run(
            [str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/e2e/devices-create.cjs')],
            input=json.dumps(payload), text=True, encoding='utf-8', capture_output=True,
            timeout=110, env=dict(os.environ, DEBUG='', NODE_DEBUG=''),
        )
        assert len(child.stdout) < 65536
        result['browser'] = json.loads(child.stdout)
        check('real creation UI passed with one exact scoped mutation',
              child.returncode == 0 and result['browser']['status'] == 'passed' and result['browser']['browserClosed'])
        result['stage'] = 'physical-start'
        until = time.monotonic() + 90
        while time.monotonic() < until:
            own = [row for row in rows('containers') if row.get('name') == marker and row.get('description') == marker
                   and row.get('labels', {}).get(LABEL) == marker]
            if len(own) == 1 and own[0]['state'] == 'running' and re.fullmatch('[a-f0-9]{64}', own[0].get('externalId') or ''):
                break
            time.sleep(1)
        else:
            raise AssertionError('Owned physical device container did not start.')
        current = own[0]
        assert current['hostId'] == '1h1' and current['id'] == result['browser']['containerId'] and current['id'] not in containers
        check('native device mapping persists without privileged mode', current['devices'] == [MAPPING] and current['privileged'] is False)
        result['allocationRelay'] = relay.finish()
        assert result['allocationRelay']['allocationRelayAccepted'] and result['allocationRelay']['filesCleaned']
        check('diagnostic relay removed before Docker/process inspection', result['allocationRelay']['ruleRemoved'])
        docker_id = current['externalId']
        command = (
            "sudo docker inspect --format 'FIXTURE_STATUS:deviceCount={{len .HostConfig.Devices}} privileged={{.HostConfig.Privileged}} "
            "{{range .HostConfig.Devices}}host={{.PathOnHost}} container={{.PathInContainer}} permissions={{.CgroupPermissions}}{{end}}' " + docker_id +
            " && sudo docker exec " + docker_id + " sh -c '"
            "if [ -c /dev/rancho-null ]; then echo FIXTURE_STATUS:characterDevice=1; else echo FIXTURE_STATUS:characterDevice=0; fi; "
            "if dd if=/dev/rancho-null of=/dev/null bs=1 count=1 2>/dev/null; then echo FIXTURE_STATUS:deviceRead=1; else echo FIXTURE_STATUS:deviceRead=0; fi; "
            "if (exec 3>/dev/rancho-null) 2>/dev/null; then echo FIXTURE_STATUS:writeOpenAllowed=1; else echo FIXTURE_STATUS:writeOpenAllowed=0; fi'"
        )
        observed = run_guest(command)
        assert observed.get('exitCode') == 0 and observed.get('completed')
        statuses = observed.get('status', [])
        check('Docker HostConfig has exactly the requested device and remains nonprivileged',
              'FIXTURE_STATUS:deviceCount=1 privileged=false host=/dev/null container=/dev/rancho-null permissions=r' in statuses)
        check('mapped path is an actual character device', 'FIXTURE_STATUS:characterDevice=1' in statuses)
        check('container process reads the mapped device successfully', 'FIXTURE_STATUS:deviceRead=1' in statuses)
        write = [line for line in statuses if line in ('FIXTURE_STATUS:writeOpenAllowed=1', 'FIXTURE_STATUS:writeOpenAllowed=0')]
        assert len(write) == 1
        result['writeOpenAllowed'] = write[0].endswith('=1')
        check('actual write-open result recorded without claiming cgroup isolation')

        result['stage'] = 'authorization-denial'
        from subscription_identity_fixture import identity_factory
        identity = identity_factory('grant', role='member')(admin)
        identity['invalidate']()
        assert identity['session'].api('projects')['data'] == []
        code, _, _ = identity['session'].request('/v2-beta/' + BASE + 'containers', {
            'name': marker + '-denied', 'description': marker, 'labels': {LABEL: marker},
            'imageUuid': 'docker:alpine:3.20', 'startOnCreate': False, 'devices': [MAPPING], 'privileged': False,
        }, 'POST')
        check('revoked identity cannot create a device-mapped container in this environment', code in (401, 403, 404))
        result['status'] = 'passed'
        result['stage'] = 'measured'
    except Exception as error:
        result['errorType'] = type(error).__name__
        result['errorLocations'] = [{'file': Path(frame.filename).name, 'line': frame.lineno}
                                    for frame in traceback.extract_tb(error.__traceback__)]
    finally:
        cleanup_errors = []
        if relay:
            try:
                result['allocationRelay'] = relay.finish()
                assert result['allocationRelay']['filesCleaned'] and result['allocationRelay']['ruleRemoved']
            except Exception as error:
                cleanup_errors.append({'stage': 'relay', 'errorType': type(error).__name__})
        if identity:
            try:
                identity['prepare_cleanup']()
                identity['cleanup']()
                result['identityFixtureCleaned'] = True
            except Exception as error:
                cleanup_errors.append({'stage': 'identity', 'errorType': type(error).__name__})
        if admin is not None and baseline is not None and owns_state:
            try:
                for current in rows('containers'):
                    if current.get('name') in (marker, marker + '-denied') and current.get('description') == marker and current['id'] not in containers:
                        assert current['accountId'] == '1a12' and current.get('labels', {}).get(LABEL) == marker
                        if 'remove' not in current['actions']:
                            assert 'stop' in current['actions']
                            assert admin.request(current['actions']['stop'], {}, 'POST')[0] in (200, 201, 202, 204)
                            for _ in range(60):
                                current = admin.api(BASE + 'containers/' + current['id'])
                                if 'remove' in current['actions']:
                                    break
                                time.sleep(1)
                        assert admin.request(current['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
                for _ in range(100):
                    if not [row for row in rows('containers') if row.get('name') in (marker, marker + '-denied') and row.get('description') == marker]:
                        break
                    time.sleep(1)
                check('owned containers removed and previous services/containers preserved',
                      service_snapshot() == baseline and {row['id'] for row in rows('containers') if not row.get('system')} == containers)
                check('previous volumes preserved without residual volumes', {row['id'] for row in rows('volumes')} == volumes)
            except Exception as error:
                cleanup_errors.append({'stage': 'workload', 'errorType': type(error).__name__})
        if admin is not None:
            try:
                assert admin.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
                result['controlSessionRevoked'] = admin.request('/v2-beta/projects')[0] == 401
                assert result['controlSessionRevoked']
            except Exception as error:
                cleanup_errors.append({'stage': 'session', 'errorType': type(error).__name__})
        if result.get('stage') in ('browser-creation', 'physical-start', 'measured', 'authorization-denial') and not result.get('browser', {}).get('browserClosed'):
            cleanup_errors.append({'stage': 'browser', 'errorType': 'ClosureNotConfirmed'})
        result['cleanupComplete'] = not cleanup_errors
        if result['cleanupComplete'] and owns_state:
            assert json.loads(STATE.read_text(encoding='utf-8'))['name'] == marker
            STATE.unlink()
        if cleanup_errors:
            result['cleanupErrors'] = cleanup_errors
            result['status'] = 'failed'
        REPORT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
