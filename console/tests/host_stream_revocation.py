"""Raw host-stream revocation with one own service, no existing grants modified.

Control session proves the same host/container remains usable after invalidation.
No payloads/tokens in reports, subprocess arguments or persisted manifests.
"""
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import secrets
import shlex
import subprocess
import threading
import time
import urllib.parse

from legacy_guest import run_guest
import ws_revocation as shared

ROOT = shared.ROOT
STATE = ROOT / 'console/host-stream-fixture.json'
REPORT = ROOT / 'console/host-stream-revocation-results.json'
BASE = 'projects/1a12/'


class Probe:
    def __init__(self, access, session, mode, instance, marker):
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        url = urllib.parse.urlparse(access['url'])
        assert url.scheme in ('http', 'ws') and url.netloc == 'localhost:18080'
        query = urllib.parse.parse_qs(url.query)
        assert not query and not url.fragment
        url = urllib.parse.urlunparse(('ws', url.netloc, url.path, '', urllib.parse.urlencode({'token': access['token']}), ''))
        self.process = subprocess.Popen([str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/host-stream-probe.cjs')],
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                        text=True, encoding='utf-8', env=dict(os.environ, DEBUG='', NODE_DEBUG=''))
        self.events = queue.Queue()
        self.pending = []
        def reader():
            for line in self.process.stdout:
                try: self.events.put(json.loads(line))
                except ValueError: self.events.put({'type': 'probe-error'})
        threading.Thread(target=reader, daemon=True).start()
        self.send({'url': url, 'session': next(c.value for c in session.cookies if c.name == 'token'),
                   'mode': mode, 'marker': marker, 'dockerId': instance['externalId'], 'instanceId': instance['id'],
                   'instanceUuid': instance['uuid'],
                   'runtimeModules': str(runtime / 'node_modules')})

    def send(self, value):
        self.process.stdin.write(json.dumps(value) + '\n'); self.process.stdin.flush()

    def wait(self, kind, timeout=20):
        for index, item in enumerate(self.pending):
            if item.get('type') == kind:
                return self.pending.pop(index)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try: item = self.events.get(timeout=max(.01, deadline - time.monotonic()))
            except queue.Empty: break
            if item.get('type') == kind: return item
            if item.get('type') in ('probe-error', 'socket-error', 'handshake-rejected'):
                error = AssertionError('Host probe failed before expected safe event: ' + kind)
                error.probe_event = item.get('type')
                error.http_status = item.get('status')
                raise error
            self.pending.append(item)
        raise AssertionError('Host probe event timeout: ' + kind)

    def finish(self):
        if self.process.poll() is None:
            self.send({'command': 'finish'})
            self.process.stdin.close()
        result = self.wait('result', timeout=8)
        self.process.wait(timeout=5)
        return {key: value for key, value in result.items() if key != 'type'}

    def close(self):
        if self.process.poll() is None:
            try:
                self.send({'command': 'finish'}); self.process.stdin.close(); self.process.wait(timeout=5)
            except Exception: self.process.kill(); self.process.wait()


def main():
    assert not STATE.exists(), 'Recover previous owned host stream fixture before repeating.'
    control = shared.session()
    watched = None
    stack = service = None
    probes = {}
    controls = []
    result = {'status': 'failed', 'stage': 'preflight', 'cleanupComplete': False, 'scope': 'own local admin session; raw logs/exec/container metrics; one host'}
    marker = 'console-host-stream-' + secrets.token_hex(6)
    def rows(path):
        return [value for value in control.api(BASE + path + '?limit=-1')['data'] if not value.get('removed')]
    def service_snapshot(exclude=()):
        return {v['id']: hashlib.sha256(json.dumps({k: v.get(k) for k in ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')}, sort_keys=True).encode()).hexdigest()
                for v in rows('services') if v['id'] not in exclude}
    before = service_snapshot()
    containers_before = {value['id'] for value in rows('containers')}
    volumes_before = {value['id'] for value in rows('volumes')}
    record = {'name': marker, 'environment': '1a12', 'baselineServices': before,
              'baselineContainers': sorted(containers_before), 'baselineVolumes': sorted(volumes_before)}
    def save(): STATE.write_text(json.dumps(record, indent=2), encoding='utf-8')
    def access(session, instance, mode):
        resource = session.api(BASE + 'containers/' + instance['id'])
        if mode == 'metrics':
            link = resource['links'].get('stats') or resource['links'].get('containerStats')
            assert link
            target = urllib.parse.urlparse(link)
            assert target.netloc == 'localhost:18080' and target.path.startswith('/v2-beta/' + BASE)
            code, value, _ = session.request(link)
        else:
            action = resource['actions']['execute' if mode == 'exec' else 'logs']
            target = urllib.parse.urlparse(action)
            assert target.netloc == 'localhost:18080' and target.path.startswith('/v2-beta/' + BASE)
            payload = {'follow': True, 'lines': 5, 'timestamps': True} if mode == 'logs' else {
                'attachStdin': True, 'attachStdout': True, 'tty': False,
                'command': ['/bin/sh', '-c', 'while IFS= read -r value; do printf "%s\\n" "$value"; done']}
            code, value, _ = session.request(action, payload, 'POST')
        assert code in (200, 201, 202) and isinstance(value, dict) and value.get('url') and value.get('token')
        return value
    try:
        host = control.api(BASE + 'hosts/1h1')
        assert host['state'] == 'active' and host['agentState'] == 'active'
        save()
        stack = control.api(BASE + 'stacks', {'name': marker, 'description': marker})
        record['stack'] = stack['id']; save()
        command = 'printf "%s\\n" ' + shlex.quote(marker + '-before') + ' > /tmp/stream-guard-marker; while true; do cat /tmp/stream-guard-marker; sleep 1; done'
        service = control.api(BASE + 'services', {'name': 'stream-emitter', 'description': marker, 'stackId': stack['id'],
                                                 'scale': 1, 'startOnCreate': True, 'launchConfig': {
                                                     'imageUuid': 'docker:alpine:3.20', 'requestedHostId': '1h1', 'networkMode': 'none',
                                                     'command': ['/bin/sh', '-c', command], 'labels': {'rancher.console.stream-fixture': marker}}})
        record['service'] = service['id']; save()
        instance = None
        for attempt in range(240):
            running = [v for v in rows('services/' + service['id'] + '/instances') if v['state'] == 'running' and v.get('externalId')]
            if len(running) == 1:
                instance = running[0]; break
            time.sleep(1)
        assert instance and instance['hostId'] == '1h1' and re.fullmatch(r'[a-f0-9]{64}', instance['externalId'])
        record['instance'] = instance['id']; save()
        print('PASS: own physical stream-emitter running on existing host1h1.', flush=True)
        watched = shared.session()
        for mode in ('logs', 'exec', 'metrics'):
            result['stage'] = mode + '-access'
            probe = Probe(access(watched, instance, mode), watched, mode, instance, marker)
            probes[mode] = probe
            result['stage'] = mode + '-handshake'
            assert probe.wait('ready')['handshake'] == 101
            result['stage'] = mode + '-before-frame'
            probe.wait('before')
        result['allOwnStreamsReceivedBeforeRevocation'] = True
        assert watched.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
        result['protectedHttpAfterRevocation'] = watched.request('/v2-beta/projects')[0]
        for mode, probe in probes.items():
            probe.send({'command': 'new-handshake'})
            result.setdefault('streams', {})[mode] = {'newHandshake': probe.wait('new-handshake')['status']}
            probe.send({'command': 'watch-after'}); probe.wait('watching-after')
        time.sleep(6)
        # Change only the own emitter's private file; subsequent log markers cannot
        # have been queued before revocation. Never execute in preexisting workloads.
        docker_id = instance['externalId']
        update = 'printf "%s\\n" ' + shlex.quote(marker + '-after') + ' > /tmp/stream-guard-marker'
        guest = run_guest('sudo docker exec ' + docker_id + ' /bin/sh -c ' + shlex.quote(update) + ' && echo FIXTURE_STATUS:own-marker-updated')
        assert guest.get('exitCode') == 0 and 'FIXTURE_STATUS:own-marker-updated' in guest.get('status', [])
        probes['exec'].send({'command': 'send-after'}); probes['exec'].wait('after-input-attempted')
        # Independent current-session control for each transport; a host outage
        # must never be mistaken for successful enforcement of revocation.
        for mode in ('logs', 'exec', 'metrics'):
            current = Probe(access(control, instance, mode), control, mode, instance, marker)
            controls.append(current)
            assert current.wait('ready')['handshake'] == 101
            current.wait('after' if mode == 'logs' else 'before')
            result['streams'][mode]['freshControlHealthy'] = True
        time.sleep(4)
        result['stage'] = 'measure-existing-streams'
        for mode, probe in probes.items():
            result['streams'][mode].update(probe.finish())
        result['revocationEnforced'] = result['protectedHttpAfterRevocation'] == 401 and all(
            value['freshControlHealthy'] and value['newHandshake'] in (401, 403, 404) and value['closed'] and value['after'] == 0
            for value in result['streams'].values())
        result['status'] = 'passed' if result['revocationEnforced'] else 'failed'
        result['stage'] = 'measured'
    except Exception as error:
        result['errorType'] = type(error).__name__
        result['probeEvent'] = getattr(error, 'probe_event', None)
        result['probeHttpStatus'] = getattr(error, 'http_status', None)
        # No exception message: native errors may contain payloads or private URLs.
    finally:
        for probe in [*probes.values(), *controls]:
            probe.close()
        try:
            if stack:
                owned = control.api(BASE + 'stacks/' + stack['id'])
                assert owned['name'] == marker and owned['description'] == marker and owned['accountId'] == '1a12'
                if not owned.get('removed'):
                    assert control.request(owned['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
                for attempt in range(180):
                    if control.api(BASE + 'stacks/' + stack['id']).get('removed') and {v['id'] for v in rows('containers')} == containers_before:
                        break
                    time.sleep(1)
                assert control.api(BASE + 'stacks/' + stack['id']).get('removed')
            result['cleanupComplete'] = service_snapshot() == before and {v['id'] for v in rows('containers')} == containers_before and {v['id'] for v in rows('volumes')} == volumes_before
            if not result['cleanupComplete']: result['status'] = 'failed'
        except Exception as error:
            result['cleanupErrorType'] = type(error).__name__; result['status'] = 'failed'
        finally:
            for name, session in [('watched', watched), ('control', control)]:
                if session:
                    try:
                        if session.request('/v2-beta/projects')[0] != 401:
                            session.request('/v2-beta/token/current', None, 'DELETE')
                        result[name + 'SessionRevoked'] = session.request('/v2-beta/projects')[0] == 401
                        if not result[name + 'SessionRevoked']: result['status'] = 'failed'
                    except Exception: result[name + 'SessionRevoked'] = False; result['status'] = 'failed'
        if result['cleanupComplete']: STATE.unlink(missing_ok=True)
        REPORT.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2), flush=True)
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
