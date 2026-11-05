"""Raw host-stream revocation with one own service, no existing grants modified.

Control session proves the same host/container remains usable after invalidation.
No payloads/tokens in reports, subprocess arguments or persisted manifests.
"""
import base64
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
import traceback
import time
import urllib.parse

from legacy_guest import run_guest
import ws_revocation as shared

ROOT = shared.ROOT
STATE = ROOT / 'console/host-stream-fixture.json'
REPORT = ROOT / 'console/host-stream-revocation-results.json'
BASE = 'projects/1a12/'


class Probe:
    def __init__(self, access, session, mode, instance, marker, *, max_duration_ms=120000, proxy_port=18080):
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        url = urllib.parse.urlparse(access['url'])
        assert url.scheme in ('http', 'ws') and url.netloc == 'localhost:18080'
        query = urllib.parse.parse_qs(url.query)
        assert not query and not url.fragment
        url = urllib.parse.urlunparse(('ws', 'localhost:' + str(proxy_port), url.path, '', urllib.parse.urlencode({'token': access['token']}), ''))
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
        self.send({'url': url, 'session': next((c.value for c in session.cookies if c.name == 'token'), ''), 'payload': access.get('payload'),
                   'mode': mode, 'marker': marker, 'dockerId': instance['externalId'], 'instanceId': instance['id'],
                   'instanceUuid': instance['uuid'],
                   'runtimeModules': str(runtime / 'node_modules'), 'maxDurationMs': max_duration_ms, 'expectedPort': proxy_port})

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


def main(*, identity_factory=None, hold_seconds=0, service_metrics=False, console_proxy=False, service_scale=1, payload_transport=False, frontend_probe=False, audit_probe=False):
    assert isinstance(hold_seconds, int) and 0 <= hold_seconds <= 600
    assert not STATE.exists(), 'Recover previous owned host stream fixture before repeating.'
    assert isinstance(service_scale, int) and 1 <= service_scale <= 5 and (service_scale == 1 or service_metrics)
    proxy_port = 18090 if console_proxy else 18080
    modes = ('logs', 'exec', 'metrics', 'service-metrics') if service_metrics else ('logs', 'exec', 'metrics')
    control = shared.session()
    watched = None
    identity = None
    stack = service = None
    probes = {}
    audit_records = []
    audit_enabled = bool(control.request('/oidc/config')[1]['effective'].get('AUDIT_CREDENTIAL_REDACTION_ENABLED')) if audit_probe else False
    controls = []
    result = {'status': 'failed', 'stage': 'preflight', 'cleanupComplete': False, 'scope': 'own local admin session; raw logs/exec/container metrics; one host', 'serviceMetricsIncluded': service_metrics, 'serviceScale': service_scale, 'proxyPort': proxy_port, 'payloadTransportRequested': payload_transport}
    def stage(value):
        result['stage'] = value
        print('STAGE: ' + value, flush=True)
    marker = 'console-host-stream-' + secrets.token_hex(6)
    def rows(path):
        return [value for value in control.api(BASE + path + '?limit=-1')['data'] if not value.get('removed')]
    def service_snapshot(exclude=()):
        return {v['id']: hashlib.sha256(json.dumps({k: v.get(k) for k in ('launchConfig', 'secondaryLaunchConfigs', 'scale', 'stackId')}, sort_keys=True).encode()).hexdigest()
                for v in rows('services') if v['id'] not in exclude}
    before = service_snapshot()
    initial_containers = rows('containers')
    containers_before = {value['id'] for value in initial_containers}
    user_containers_before = {value['id'] for value in initial_containers if not value.get('system')}
    initial_volumes = rows('volumes')
    volumes_before = {value['id'] for value in initial_volumes}
    system_before = {value['id'] for value in initial_containers if value.get('system')}
    user_volumes_before = {value['id'] for value in initial_volumes if value.get('instanceId') not in system_before}
    record = {'name': marker, 'environment': '1a12', 'baselineServices': before,
              'baselineContainers': sorted(containers_before), 'baselineUserContainers': sorted(user_containers_before), 'baselineVolumes': sorted(volumes_before), 'baselineUserVolumes': sorted(user_volumes_before)}
    def save(): STATE.write_text(json.dumps(record, indent=2), encoding='utf-8')
    def access(session, instance, mode):
        if audit_probe and mode in ('logs','exec') and not result.get('auditCredentials'):
            import audit_credentials
            audit_before = {r['id'] for r in audit_credentials.recent(session,mode)}
        resource = session.api(BASE + ('services/' + service['id'] if mode == 'service-metrics' else 'containers/' + instance['id']))
        if mode in ('metrics', 'service-metrics'):
            link = resource['links'].get('containerStats') if mode == 'service-metrics' else (resource['links'].get('stats') or resource['links'].get('containerStats'))
            assert link
            target = urllib.parse.urlparse(link)
            assert target.netloc == 'localhost:18080' and target.path.startswith('/v2-beta/' + BASE)
            code, value, _ = session.request(link, extra_headers={'X-Rancher-Stats-Payload': '1'} if payload_transport else None)
        else:
            action = resource['actions']['execute' if mode == 'exec' else 'logs']
            target = urllib.parse.urlparse(action)
            assert target.netloc == 'localhost:18080' and target.path.startswith('/v2-beta/' + BASE)
            payload = {'follow': True, 'lines': 5, 'timestamps': True} if mode == 'logs' else {
                'attachStdin': True, 'attachStdout': True, 'tty': False,
                'command': ['/bin/sh', '-c', 'while IFS= read -r value; do printf "%s\\n" "$value"; done']}
            code, value, _ = session.request(action, payload, 'POST')
        assert code in (200, 201, 202) and isinstance(value, dict) and value.get('url') and value.get('token')
        if audit_probe and mode in ('logs','exec') and not result.get('auditCredentials'):
            audit_records.append(audit_credentials.capture(session,mode,audit_before,value,audit_enabled))
        result.setdefault('accessTokenChars', {})[mode] = len(value['token'])
        negotiated = value.get('payload') is not None
        if negotiated:
            assert payload_transport and isinstance(value['payload'], str) and len(value['payload']) <= 16*1024*1024
            result.setdefault('metadataResponses', {})[mode] = session.response_metadata
            assert 'no-store' in {v.strip().lower() for v in session.response_metadata['cacheControl'].split(',')}
            result.setdefault('negotiatedPayloadChars', {})[mode] = len(value['payload'])
        if runtime_guard and getattr(session,'technical_stream',False):
            def technical_decode(raw): return json.loads(base64.urlsafe_b64decode(raw.split('.')[1]+'==='))
            outer = technical_decode(value.get('payload') or value['token'])
            sources = [technical_decode(item['token']) for item in outer['service']] if mode == 'service-metrics' else [outer]
            assert len(sources) == (service_scale if mode=='service-metrics' else 1)
            for source in sources:
                binding = source['rancherStream']
                assert binding['mode'] == ('apikey' if result.get('apiKeyGuardEnabled') else 'technical')
                if result.get('apiKeyGuardEnabled'):
                    assert source.get('rancherStreamProof') and re.fullmatch('[a-f0-9]{64}',binding['sessionHash'])
                    assert binding['tokenId'] == session.credential_id and binding['userId'] == session.credential_owner
                    assert binding['projectId']=='12' and binding['hostId']=='1'
                    result['apiKeyBindingChecked'] = True
                    compact = technical_decode(source['rancherStreamProof'])
                    result.setdefault('originalLeaseSeconds',[]).append(int(compact['exp'])-int(compact['iat']))
        if runtime_guard and not getattr(session,'technical_stream',False):
            def decode(raw): return json.loads(base64.urlsafe_b64decode(raw.split('.')[1] + '==='))
            outer = decode(value['payload'] if negotiated else value['token'])
            if negotiated:
                envelope = decode(value['token'])
                assert envelope.get('payload') is True and 'rancherNegotiation' in envelope and 'hostUuid' not in envelope
            pairs = [(outer, urllib.parse.urlparse(value['url']).path)]
            if mode == 'service-metrics':
                assert isinstance(outer.get('service'), list) and len(outer['service']) == service_scale
                pairs = [(decode(item['token']), urllib.parse.urlparse(item['url']).path) for item in outer['service']]
            key = next(c.value for c in session.cookies if c.name == 'token')
            for claims, signed_path in pairs:
                binding = claims['rancherStream']
                assert binding['mode'] == 'ui' and binding['projectId'] == '12' and binding['hostId'] == '1' and binding['path'] == signed_path
                assert binding['sessionHash'] == hashlib.sha256(key.encode()).hexdigest()
                assert key not in json.dumps(claims)
                compact = claims['rancherStreamProof']; compact_claims = decode(compact)
                assert compact_claims['rancherStream'] == binding and 'hostUuid' not in compact_claims
                assert len(compact) <= 65536
                result['compactSessionClaimsChecked'] = True
                result.setdefault('originalLeaseSeconds', []).append(int(compact_claims['exp']) - int(compact_claims['iat']))
                if hold_seconds: assert int(binding['uiExp']) > time.time() + hold_seconds + 30

        return value
    runtime_guard = False
    try:
        import urllib.request
        opener = shared.lab.loopback_opener()
        capability = json.load(opener.open('http://localhost:18080/community/host-stream-guard', timeout=5))
        runtime_guard = capability['enabled']
        result['apiKeyGuardEnabled'] = capability.get('apiKeyGuardEnabled',False)
        image = subprocess.check_output(['docker', 'inspect', '--format', '{{.Image}}', 'rancher16-rbac-lab'], text=True).strip()
        assert re.fullmatch(r'sha256:[a-f0-9]{64}', image)
        result['runtimeImage'] = image
        result['guardEnabled'] = runtime_guard
        host = control.api(BASE + 'hosts/1h1')
        assert host['state'] == 'active' and host['agentState'] == 'active'
        save()
        stack = control.api(BASE + 'stacks', {'name': marker, 'description': marker})
        record['stack'] = stack['id']; save()
        command = 'printf "%s\\n" ' + shlex.quote(marker + '-before') + ' > /tmp/stream-guard-marker; while true; do cat /tmp/stream-guard-marker; sleep 1; done'
        service = control.api(BASE + 'services', {'name': 'stream-emitter', 'description': marker, 'stackId': stack['id'],
                                                 'scale': service_scale, 'startOnCreate': True, 'launchConfig': {
                                                     'imageUuid': 'docker:alpine:3.20', 'requestedHostId': '1h1', 'networkMode': 'none',
                                                     'command': ['/bin/sh', '-c', command], 'labels': {'rancher.console.stream-fixture': marker}}})
        record['service'] = service['id']; save()
        instance = None
        for attempt in range(240):
            running = [v for v in rows('services/' + service['id'] + '/instances') if v['state'] == 'running' and v.get('externalId')]
            if len(running) == service_scale:
                instance = running[0]; break
            time.sleep(1)
        assert instance and instance['hostId'] == '1h1' and re.fullmatch(r'[a-f0-9]{64}', instance['externalId'])
        record['instance'] = instance['id']; record['instances'] = sorted(v['id'] for v in running); save()
        print('PASS: own physical stream-emitter running on existing host1h1.', flush=True)
        stage('identity-setup')
        identity = identity_factory(control) if identity_factory else None
        watched = identity['session'] if identity else shared.session()
        if identity: result['scope'] = identity['scope'].replace('; subscribe only', '') + '; raw logs/exec/container metrics'
        for mode in modes:
            stage(mode + '-access')
            probe = Probe(access(watched, instance, mode), watched, mode, instance, marker, max_duration_ms=max(120000, (hold_seconds+120)*1000), proxy_port=proxy_port)
            probes[mode] = probe
            stage(mode + '-handshake')
            ready = probe.wait('ready')
            assert ready['handshake'] == 101 and ready['port'] == proxy_port
            stage(mode + '-before-frame')
            probe.wait('before')
        result['allOwnStreamsReceivedBeforeRevocation'] = True
        if runtime_guard and (not getattr(watched,'technical_stream',False) or result.get('apiKeyGuardEnabled')):
            for mode, probe in probes.items():
                for variant in ('signature', 'proof-only', 'scope'):
                    probe.send({'command': 'negative-handshake', 'variant': variant})
                    code = probe.wait('negative-' + variant)['status']
                    assert code in (401, 403, 404)
                    result.setdefault('negativeHandshakes', {}).setdefault(mode, {})[variant] = code
        if audit_probe:
            import audit_credentials
            stage('audit-credentials')
            result['auditCredentials'] = audit_credentials.verify(control,audit_records,instance,audit_enabled,marker)
        if frontend_probe:
            assert payload_transport and service_metrics and console_proxy and service_scale >= 3
            stage('browser-transport')
            runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
            executable = Path.home() / 'AppData/Local/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-win64/chrome-headless-shell.exe'
            assert executable.is_file()
            browser_input = {'runtimeModules': str(runtime / 'node_modules'), 'browserExecutable': str(executable),
                             'instanceId': instance['id'], 'instanceName': instance['name'], 'serviceId': service['id'],
                             'cookies': [{'name': c.name, 'value': c.value} for c in watched.cookies if c.name in ('token','CSRF')]}
            browser = subprocess.run([str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/e2e/metrics-payload.cjs')],
                                     input=json.dumps(browser_input), text=True, encoding='utf-8', capture_output=True,
                                     timeout=80, env=dict(os.environ, DEBUG='', NODE_DEBUG=''))
            browser_result = json.loads(browser.stdout)
            result['browserTransport'] = browser_result
            assert browser.returncode == 0 and browser_result.get('status') == 'passed'
        if hold_seconds:
            assert runtime_guard and hold_seconds > max(result['originalLeaseSeconds']) + 2
            stage('hold-past-original-proof-expiry')
            deadline = time.monotonic() + hold_seconds
            while time.monotonic() < deadline:
                time.sleep(min(15, max(.01, deadline-time.monotonic())))
            for mode, probe in probes.items():
                probe.send({'command': 'watch-lease'})
                probe.wait('watching-lease')
            for mode, probe in probes.items():
                event = probe.wait('after-lease')
                assert event['open'] is True
            result['allThreeStreamsLivePastOriginalProofExpiry'] = True
            result['heldSeconds'] = hold_seconds
        if identity and identity.get('before_invalidate'):
            stage('shared-key-group-control')
            identity['before_invalidate']()
            for mode, active_probe in probes.items():
                active_probe.send({'command':'watch-lease'})
                active_probe.wait('watching-lease')
                assert active_probe.wait('after-lease')['open']
            result['sharedKeyIndependentOfHumanGroupWithLiveStreams'] = True
        stage('invalidate')
        if identity: identity['invalidate']()
        else: assert watched.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
        result['protectedHttpAfterRevocation'] = watched.request(identity['protected'] if identity else '/v2-beta/projects')[0]
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
        for mode in modes:
            current = Probe(access(control, instance, mode), control, mode, instance, marker, proxy_port=proxy_port)
            controls.append(current)
            ready = current.wait('ready')
            assert ready['handshake'] == 101 and ready['port'] == proxy_port
            current.wait('after' if mode == 'logs' else 'before')
            result['streams'][mode]['freshControlHealthy'] = True
        time.sleep(4)
        stage('measure-existing-streams')
        for mode, probe in probes.items():
            result['streams'][mode].update(probe.finish())
        result['revocationEnforced'] = result['protectedHttpAfterRevocation'] in (401, 403, 404) and all(
            value['freshControlHealthy'] and value['newHandshake'] in (401, 403, 404) and value['closed'] and value['closeCode'] == 1008 and value['after'] == 0
            for value in result['streams'].values())
        result['status'] = 'passed' if result['revocationEnforced'] else 'failed'
        result['stage'] = 'measured'
    except Exception as error:
        result['errorType'] = type(error).__name__
        result['errorLocations'] = [{'file': Path(frame.filename).name, 'line': frame.lineno} for frame in traceback.extract_tb(error.__traceback__)]
        result['probeEvent'] = getattr(error, 'probe_event', None)
        result['probeHttpStatus'] = getattr(error, 'http_status', None)
        # No exception message: native errors may contain payloads or private URLs.
    finally:
        print('CLEANUP: own streams and workload', flush=True)
        for probe in [*probes.values(), *controls]:
            probe.close()
        try:
            if stack:
                owned = control.api(BASE + 'stacks/' + stack['id'])
                assert owned['name'] == marker and owned['description'] == marker and owned['accountId'] == '1a12'
                if not owned.get('removed'):
                    assert control.request(owned['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
                for attempt in range(180):
                    if control.api(BASE + 'stacks/' + stack['id']).get('removed') and not any(v['id'] in record.get('instances', [record.get('instance')]) for v in rows('containers')):
                        break
                    time.sleep(1)
                assert control.api(BASE + 'stacks/' + stack['id']).get('removed')
            final_containers = rows('containers')
            final_ids = {v['id'] for v in final_containers}
            final_user_ids = {v['id'] for v in final_containers if not v.get('system')}
            result['systemContainerChurn'] = {
                'removed': sorted((containers_before-final_ids)-user_containers_before),
                'added': sorted((final_ids-containers_before)-final_user_ids)}
            final_volumes = rows('volumes')
            final_volume_ids = {v['id'] for v in final_volumes}
            final_system_ids = {v['id'] for v in final_containers if v.get('system')}
            final_user_volumes = {v['id'] for v in final_volumes if v.get('instanceId') not in (system_before | final_system_ids)}
            result['systemVolumeChurn'] = {
                'removed': sorted((volumes_before-final_volume_ids)-user_volumes_before),
                'added': sorted((final_volume_ids-volumes_before)-final_user_volumes)}
            result['cleanupComplete'] = service_snapshot() == before and final_user_ids == user_containers_before and record.get('instance') not in final_ids and final_user_volumes == user_volumes_before
            if not result['cleanupComplete']: result['status'] = 'failed'
        except Exception as error:
            result['cleanupErrorType'] = type(error).__name__; result['status'] = 'failed'
        finally:
            if identity:
                try: identity['prepare_cleanup']()
                except Exception: result['identityRecoveryError'] = True; result['status'] = 'failed'
            for name, session in [('watched', watched)]:
                if session:
                    try:
                        if getattr(session,'technical_stream',False):
                            result['watchedUsedApiKeyNotUiSession'] = True
                        else:
                            if session.request('/v2-beta/projects')[0] != 401:
                                session.request('/v2-beta/token/current', None, 'DELETE')
                            result[name + 'SessionRevoked'] = session.request('/v2-beta/projects')[0] == 401
                            if not result[name + 'SessionRevoked']: result['status'] = 'failed'
                    except Exception: result[name + 'SessionRevoked'] = False; result['status'] = 'failed'
            if identity:
                try:
                    print('CLEANUP: own identity', flush=True)
                    identity['cleanup']()
                    result['identityFixtureCleaned'] = True
                except Exception as error:
                    result['identityCleanupErrorType'] = type(error).__name__; result['status'] = 'failed'
            try:
                control.request('/v2-beta/token/current', None, 'DELETE')
                result['controlSessionRevoked'] = control.request('/v2-beta/projects')[0] == 401
                if not result['controlSessionRevoked']: result['status'] = 'failed'
            except Exception: result['controlSessionRevoked'] = False; result['status'] = 'failed'
        if result['cleanupComplete']: STATE.unlink(missing_ok=True)
        REPORT.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2), flush=True)
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
