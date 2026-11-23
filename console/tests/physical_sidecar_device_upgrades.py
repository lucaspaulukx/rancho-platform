"""Native Docker evidence for sidecar device upgrades on the isolated legacy host."""
from copy import copy
import hashlib
import json
from pathlib import Path
import re
import secrets
import shlex
import time
import traceback
from urllib.parse import urlsplit

from legacy_guest import run_guest
from scheduler_relay_window import RelayAllocationWindow
import ws_revocation as lab

ROOT = lab.ROOT
STATE = ROOT / 'console/physical-sidecar-device-upgrade-fixture.json'
REPORT = ROOT / 'console/physical-sidecar-device-upgrade-results.json'
PROJECT = '1a12'
BASE = f'projects/{PROJECT}/'
LABEL = 'rancher.console.devices-fixture'
SERVICE = 'sidecar-device-physical'
PRIMARY = '/dev/null:/dev/rancho-primary-null:r'
ORIGINAL = '/dev/null:/dev/rancho-helper-original:r'
UPDATED = '/dev/null:/dev/rancho-helper-updated:r'
ALIASES = tuple(mapping.split(':')[1] for mapping in (PRIMARY, ORIGINAL, UPDATED))


def main():
    assert not STATE.exists(), 'Recover the previous owned device fixture first.'
    if REPORT.exists():
        archive = ROOT / 'migration-runs'
        archive.mkdir(exist_ok=True)
        (archive / f'physical-sidecar-device-upgrade-{time.time_ns()}-results.json').write_bytes(REPORT.read_bytes())

    admin = relay = stack_id = service_id = None
    marker = 'console-devices-' + secrets.token_hex(6)
    state = {'name': marker, 'environment': PROJECT, 'label': LABEL}
    owns_state = False
    result = {
        'status': 'failed', 'cleanupComplete': False, 'checks': [], 'phases': {},
        'scope': 'One scale-1 service with independent primary and helper aliases on legacy host 1h1.',
        'devicePermissionDenialValidated': False,
        'limitations': ['The /dev/null major/minor is already allowed by default on this runtime. '
                        'The fixture verifies requested permissions and readable aliases.'],
    }

    def check(name, condition=True):
        assert condition, name
        result['checks'].append(name)
        print('PASS: ' + name, flush=True)

    def rows(path):
        return [row for row in admin.api(BASE + path + '?limit=-1')['data'] if not row.get('removed')]

    def fingerprints(kind, fields):
        return {row['id']: hashlib.sha256(json.dumps({key: row.get(key) for key in fields},
                                                     sort_keys=True).encode()).hexdigest()
                for row in rows(kind)}

    def inventory():
        return {
            'stacks': fingerprints('stacks', ('name', 'description', 'system')),
            'services': fingerprints('services', ('name', 'description', 'launchConfig',
                                                  'secondaryLaunchConfigs', 'scale', 'stackId')),
            'containers': sorted(row['id'] for row in rows('containers')),
            'volumes': sorted(row['id'] for row in rows('volumes')),
        }

    def save():
        STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')

    def wait(kind, resource_id, predicate, seconds=90):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            current = admin.api(BASE + kind + '/' + resource_id)
            if predicate(current):
                return current
            time.sleep(1)
        raise AssertionError('Owned native transition timeout.')

    def action(kind, current, name, payload=None):
        target = urlsplit(current['actions'][name])
        assert current['accountId'] == PROJECT
        assert target.scheme == 'http' and target.netloc == 'localhost:18080'
        assert target.path.rstrip('/') == f'/v2-beta/{BASE}{kind}/{current["id"]}'
        assert target.query == 'action=' + name and not target.fragment
        assert admin.request(current['actions'][name], payload or {}, 'POST')[0] in (200, 201, 202, 204)

    def own_service():
        current = admin.api(BASE + 'services/' + service_id)
        assert current['accountId'] == PROJECT and current['stackId'] == stack_id
        assert current['name'] == SERVICE and current['description'] == marker and current['scale'] == 1
        assert current['launchConfig']['labels'][LABEL] == marker
        assert [config['name'] for config in current['secondaryLaunchConfigs']] == ['helper']
        assert current['secondaryLaunchConfigs'][0]['labels'][LABEL] == marker
        return current

    def start_relay():
        nonlocal relay
        relay = RelayAllocationWindow(admin, LABEL, marker)
        relay.start()

    def writable(config, fields):
        return {key: value for key, value in config.items()
                if value is not None and fields.get(key, {}).get('create')}

    def primary_config(config):
        return {key: value for key, value in config.items() if key != 'version'}

    def upgrade(devices):
        current = own_service()
        assert current['state'] == 'active'
        fields = admin.api(BASE + 'schemas/launchConfig')['resourceFields']
        secondary_fields = admin.api(BASE + 'schemas/secondaryLaunchConfig')['resourceFields']
        assert secondary_fields['devices']['create'] and secondary_fields['devices']['type'] == 'array[string]'
        primary = writable(current['launchConfig'], fields)
        assert primary['devices'] == [PRIMARY]
        helper = writable(current['secondaryLaunchConfigs'][0], secondary_fields)
        helper['devices'] = devices
        # Match the console strategy, which includes the preserved primary config.
        action('services', current, 'upgrade', {'inServiceStrategy': {
            'batchSize': 1, 'intervalMillis': 100, 'startFirst': False,
            'launchConfig': primary, 'secondaryLaunchConfigs': [helper],
        }})

    def finish():
        current = own_service()
        assert current['state'] == 'upgraded'
        action('services', current, 'finishupgrade')

    def measure_instance(phase, role, instance, expected):
        assert instance['hostId'] == '1h1' and instance['accountId'] == PROJECT
        assert instance['labels'][LABEL] == marker
        check(f'{phase} {role} native devices match',
              (instance.get('devices') or []) == expected and instance.get('privileged') is False)
        docker_id = instance['externalId']
        inspect = ("sudo docker inspect --format 'FIXTURE_STATUS:privileged={{.HostConfig.Privileged}} "
                   "devices={{len .HostConfig.Devices}}{{range .HostConfig.Devices}} "
                   "{{.PathOnHost}}:{{.PathInContainer}}:{{.CgroupPermissions}}{{end}}' " + docker_id)
        active = {mapping.split(':')[1] for mapping in expected}
        probes = [f'test -c {alias} && dd if={alias} of=/dev/null bs=1 count=1 2>/dev/null'
                  if alias in active else f'test ! -e {alias} && test ! -L {alias}' for alias in ALIASES]
        probe = ' && '.join([*probes, 'echo FIXTURE_STATUS:aliases-verified'])
        measured = run_guest(inspect + ' && sudo docker exec ' + docker_id + ' sh -c ' + shlex.quote(probe))
        assert measured.get('completed') and measured.get('exitCode') == 0
        host_config = ' '.join([f'FIXTURE_STATUS:privileged=false devices={len(expected)}', *expected])
        check(f'{phase} {role} exact Docker HostConfig and process aliases match',
              host_config in measured['status'] and 'FIXTURE_STATUS:aliases-verified' in measured['status'])

    def measure(phase, expected_state, helper_devices, previous=None, replacing=False):
        nonlocal relay
        result['stage'] = phase
        wait('services', service_id, lambda value: value['state'] == expected_state)
        until = time.monotonic() + 90
        while time.monotonic() < until:
            running = [row for row in rows(f'services/{service_id}/instances')
                       if row['state'] == 'running' and re.fullmatch('[a-f0-9]{64}', row.get('externalId') or '')]
            if len(running) == 2:
                helpers = [row for row in running if row.get('labels', {}).get('io.rancher.service.launch.config') == 'helper']
                if len(helpers) == 1:
                    helper = helpers[0]
                    primary = next(row for row in running if row['id'] != helper['id'])
                    ids = (primary['externalId'], helper['externalId'])
                    if previous is None or (ids[1] != previous[1] if replacing else ids == previous):
                        break
            time.sleep(1)
        else:
            raise AssertionError('Owned primary and helper did not reach the expected running state.')

        evidence = result['phases'][phase] = {}
        if previous:
            evidence['primaryReplaced'] = ids[0] != previous[0]
            evidence['helperReplaced'] = ids[1] != previous[1]
        if relay:
            allocation = relay.finish()
            evidence['allocationRelay'] = {key: allocation[key] for key in (
                'allocationRelayAccepted', 'filesCleaned', 'ruleRemoved',
            )}
            check(phase + ' bounded allocation relay removed before Docker probes', all(evidence['allocationRelay'].values()))
            relay = None
        current = own_service()
        check(phase + ' primary launch configuration preserved',
              primary_config(current['launchConfig']) == baseline_primary)
        check(phase + ' helper launch mapping matches',
              (current['secondaryLaunchConfigs'][0].get('devices') or []) == helper_devices)
        measure_instance(phase, 'primary', primary, [PRIMARY])
        measure_instance(phase, 'helper', helper, helper_devices)
        return ids

    try:
        result['stage'] = 'sandbox-preflight'
        admin = lab.session()
        assert admin.api('projects/' + PROJECT)['name'] == 'UI-OPS-LAB'
        host = admin.api(BASE + 'hosts/1h1')
        check('original sandbox host and agent are active', host['state'] == 'active' and host['agentState'] == 'active')
        baseline = inventory()
        state['baseline'] = baseline
        with STATE.open('x', encoding='utf-8') as file:
            owns_state = True
            json.dump(state, file)

        result['stage'] = 'fixture-create'
        stack_id = admin.api(BASE + 'stacks', {'name': marker, 'description': marker})['id']
        state['stack'] = stack_id
        save()
        wait('stacks', stack_id, lambda value: value['state'] == 'active')
        start_relay()
        common = {
            'imageUuid': 'docker:alpine:3.20', 'networkMode': 'none', 'requestedHostId': '1h1',
            'command': ['/bin/sh', '-c', 'while :; do sleep 5; done'], 'privileged': False,
            'labels': {LABEL: marker},
        }
        service_id = admin.api(BASE + 'services', {
            'name': SERVICE, 'description': marker, 'stackId': stack_id, 'scale': 1, 'startOnCreate': True,
            'launchConfig': {**common, 'devices': [PRIMARY]},
            'secondaryLaunchConfigs': [{**common, 'name': 'helper', 'devices': [ORIGINAL]}],
        })['id']
        state['service'] = service_id
        save()
        baseline_primary = primary_config(own_service()['launchConfig'])
        previous = measure('baseline', 'active', [ORIGINAL])
        start_relay()
        upgrade([UPDATED])
        previous = measure('upgrade', 'upgraded', [UPDATED], previous, replacing=True)
        start_relay()
        action('services', own_service(), 'rollback')
        previous = measure('rollback', 'active', [ORIGINAL], previous, replacing=True)
        start_relay()
        upgrade([UPDATED])
        previous = measure('upgrade-before-finish', 'upgraded', [UPDATED], previous, replacing=True)
        finish()
        previous = measure('finish', 'active', [UPDATED], previous)
        start_relay()
        upgrade([])
        previous = measure('reset-before-finish', 'upgraded', [], previous, replacing=True)
        finish()
        measure('reset-finish', 'active', [], previous)
        result['stage'] = 'measured'
        result['status'] = 'passed'
    except Exception as error:
        result['errorType'] = type(error).__name__
        result['errorLocations'] = [{'file': Path(frame.filename).name, 'line': frame.lineno}
                                    for frame in traceback.extract_tb(error.__traceback__)]
    finally:
        errors = []
        if relay:
            try:
                tail = relay.finish()
                assert tail['filesCleaned'] and tail['ruleRemoved']
            except Exception as error:
                errors.append({'stage': 'relay', 'errorType': type(error).__name__})
        if owns_state:
            try:
                owned = [row for row in rows('stacks') if row.get('name') == marker and row.get('description') == marker]
                assert len(owned) <= 1
                if owned:
                    current = owned[0]
                    assert current['id'] not in baseline['stacks'] and stack_id in (None, current['id'])
                    action('stacks', current, 'remove')
                until = time.monotonic() + 100
                while time.monotonic() < until:
                    if inventory() == baseline:
                        break
                    time.sleep(1)
                else:
                    raise AssertionError('Owned workload cleanup did not restore the baseline inventory.')
                check('owned stack removed and baseline stacks, services, containers and volumes restored')
            except Exception as error:
                errors.append({'stage': 'workload', 'errorType': type(error).__name__})
        if admin is not None:
            try:
                replay = lab.lab.Session()
                for cookie in admin.cookies:
                    if cookie.name in ('token', 'CSRF'):
                        replay.cookies.set_cookie(copy(cookie))
                protected = '/v2-beta/' + BASE.rstrip('/')
                accepted = replay.request(protected)[0] == 200
                assert admin.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
                result['revokedSessionReplayStatus'] = replay.request(protected)[0]
                check('copied session accepted before revocation and rejected with 401 afterward',
                      accepted and result['revokedSessionReplayStatus'] == 401)
                result['controlSessionRevoked'] = True
            except Exception as error:
                errors.append({'stage': 'session', 'errorType': type(error).__name__})
        if owns_state and not errors:
            try:
                assert json.loads(STATE.read_text(encoding='utf-8')) == state
                STATE.unlink()
            except Exception as error:
                errors.append({'stage': 'fixture-manifest', 'errorType': type(error).__name__})
        result['cleanupComplete'] = not errors
        if errors:
            result['status'] = 'failed'
            result['cleanupErrors'] = errors
        REPORT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
