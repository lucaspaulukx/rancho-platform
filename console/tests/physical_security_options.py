"""Compare native no-new-privileges with an otherwise identical owned control."""

import hashlib
import json
from pathlib import Path
import re
import secrets
import time
import traceback

import ws_revocation as lab
from legacy_guest import run_guest
from scheduler_relay_window import RelayAllocationWindow

BASE = 'projects/1a12/'
LABEL = 'rancher.console.security-options-fixture'
OPTION = 'no-new-privileges'
STATE = lab.ROOT / 'console/security-options-fixture.json'
REPORT = lab.ROOT / 'console/security-options-physical-results.json'


def main():
    assert not STATE.exists(), 'Recover the prior owned security-options fixture first.'
    if REPORT.exists():
        archive = lab.ROOT / 'migration-runs'
        archive.mkdir(exist_ok=True)
        (archive / f'security-options-{time.time_ns()}-results.json').write_bytes(REPORT.read_bytes())

    admin = None
    relay = None
    owns_state = False
    marker = 'console-security-options-' + secrets.token_hex(6)
    names = {'control': marker + '-control', 'option': marker + '-enabled'}
    report = {'status': 'failed', 'scope': 'two owned nonprivileged containers on UI-OPS-LAB host1h1'}
    cleanup_errors = []

    def rows(kind):
        return [row for row in admin.api(BASE + kind + '?limit=-1')['data'] if not row.get('removed')]

    def inventory():
        fields = ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')
        services = {
            row['id']: hashlib.sha256(json.dumps({field: row.get(field) for field in fields},
                                                sort_keys=True).encode()).hexdigest()
            for row in rows('services') if not row.get('system')
        }
        return {
            'services': services,
            'containers': sorted(row['id'] for row in rows('containers') if not row.get('system')),
            'volumes': sorted(row['id'] for row in rows('volumes')),
        }

    def owned():
        return [row for row in rows('containers')
                if row.get('name') in names.values() and row.get('description') == marker
                and row.get('labels', {}).get(LABEL) == marker]

    def wait_for(fetch, predicate, seconds=90):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            value = fetch()
            if predicate(value):
                return value
            time.sleep(1)
        raise TimeoutError('Owned security fixture did not reach expected state.')

    try:
        report['stage'] = 'sandbox-preflight'
        admin = lab.session()
        assert admin.api('projects/1a12')['name'] == 'UI-OPS-LAB'
        host = admin.api(BASE + 'hosts/1h1')
        assert host['state'] == host['agentState'] == 'active'
        field = admin.api(BASE + 'schemas/container')['resourceFields']['securityOpt']
        assert field['create'] is True and field['type'] == 'array[string]'
        before = inventory()
        with STATE.open('x', encoding='utf-8') as handle:
            owns_state = True
            json.dump({'marker': marker, 'names': names, 'inventory': before}, handle)

        report['stage'] = 'allocate'
        relay = RelayAllocationWindow(admin, LABEL, marker)
        relay.start()
        for role, name in names.items():
            payload = {
                'name': name,
                'description': marker,
                'labels': {LABEL: marker},
                'imageUuid': 'docker:alpine:3.20',
                'requestedHostId': '1h1',
                'networkMode': 'bridge',
                'startOnCreate': True,
                'privileged': False,
                'command': ['/bin/sh', '-c', 'while :; do sleep 5; done'],
            }
            if role == 'option':
                payload['securityOpt'] = [OPTION]
            admin.api(BASE + 'containers', payload)
        instances = wait_for(owned, lambda values: len(values) == 2 and all(
            row.get('state') == 'running' and re.fullmatch('[a-f0-9]{64}', row.get('externalId') or '')
            for row in values
        ))
        report['relay'] = relay.finish()
        assert all(report['relay'][key] for key in ('allocationRelayAccepted', 'filesCleaned', 'ruleRemoved'))

        report['stage'] = 'measure'
        for row in instances:
            option = row['name'] == names['option']
            assert row['id'] not in before['containers'] and row['accountId'] == '1a12'
            assert row['hostId'] == '1h1' and row['privileged'] is False
            assert (row.get('securityOpt') or []) == ([OPTION] if option else [])
            docker_id = row['externalId']
            docker = ("sudo docker inspect --format 'FIXTURE_STATUS:privileged={{.HostConfig.Privileged}} "
                      "options={{len .HostConfig.SecurityOpt}}{{range .HostConfig.SecurityOpt}} {{.}}{{end}}' "
                      + docker_id)
            process = ("sudo docker exec " + docker_id +
                       " awk '/^NoNewPrivs:/ {print \"FIXTURE_STATUS:noNewPrivs=\" $2}' /proc/1/status")
            measured = run_guest(docker + ' && ' + process)
            assert measured.get('exitCode') == 0 and measured.get('completed')
            expected = '1 ' + OPTION if option else '0'
            assert 'FIXTURE_STATUS:privileged=false options=' + expected in measured['status']
            assert f'FIXTURE_STATUS:noNewPrivs={int(option)}' in measured['status']
            report['optionNoNewPrivs' if option else 'controlNoNewPrivs'] = int(option)
        report['stage'] = 'measured'
        report['status'] = 'passed'
    except Exception as error:
        report['errorType'] = type(error).__name__
        report['errorLocations'] = [
            {'file': Path(frame.filename).name, 'line': frame.lineno}
            for frame in traceback.extract_tb(error.__traceback__)
        ]
    finally:
        if relay:
            try:
                report['relay'] = relay.finish()
                assert report['relay']['ruleRemoved'] and report['relay']['filesCleaned']
            except Exception as error:
                cleanup_errors.append({'stage': 'relay', 'errorType': type(error).__name__})
        if owns_state:
            try:
                for instance in owned():
                    assert instance['id'] not in before['containers'] and instance['accountId'] == '1a12'
                    if 'remove' not in instance['actions']:
                        assert admin.request(instance['actions']['stop'], {}, 'POST')[0] in (200, 201, 202, 204)
                        instance = wait_for(lambda: admin.api(BASE + 'containers/' + instance['id']),
                                            lambda row: 'remove' in row['actions'])
                    assert admin.request(instance['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
                wait_for(owned, lambda values: not values)
                assert inventory() == before
                report['previousInventoryPreserved'] = True
            except Exception as error:
                cleanup_errors.append({'stage': 'workload', 'errorType': type(error).__name__})
        if admin:
            try:
                assert admin.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
                assert admin.request('/v2-beta/projects')[0] == 401
                report['controlSessionRevoked'] = True
            except Exception as error:
                cleanup_errors.append({'stage': 'session', 'errorType': type(error).__name__})
        report['cleanupComplete'] = not cleanup_errors
        if cleanup_errors:
            report['status'] = 'failed'
            report['cleanupErrors'] = cleanup_errors
        elif owns_state:
            assert json.loads(STATE.read_text(encoding='utf-8'))['marker'] == marker
            STATE.unlink()
        REPORT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
