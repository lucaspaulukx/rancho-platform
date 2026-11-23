"""Physical container lifecycle and streams against the isolated legacy guest.
Only synthetic UI-OPS-LAB resources are touched. Credentials/stream tokens are
kept in memory and never included in evidence or error output.
"""
import argparse
import base64
import codecs
import importlib.util
import json
import logging
import re
import secrets
import time
import urllib.parse
import urllib.request
from pathlib import Path
from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
logging.getLogger('websockets').setLevel(logging.CRITICAL)
checks = []
stage = 'initialization'
group = None
class ActionFailure(Exception):
    def __init__(self, status, code):
        self.status = status
        self.code = code if isinstance(code, str) and re.fullmatch(r'[A-Za-z_]{1,64}', code) else 'unknown'

def session():
    value = lab.Session()
    value.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(value.cookies))
    return value
def check(name, condition=True):
    assert condition, name
    checks.append({'check': name, 'status': 'passed'})
    print('PASS: ' + name, flush=True)
def action(user, url, body=None, expected=(200, 201, 202)):
    parsed = urllib.parse.urlparse(url)
    assert parsed.netloc == 'localhost:18090' and parsed.path.startswith('/v2-beta/projects/1a12/'), 'Unexpected action scope'
    code, data, _ = user.request(url, {} if body is None else body)
    if code not in expected:
        raise ActionFailure(code, data.get('code') if isinstance(data, dict) else None)
    return data
def socket_url(access):
    parsed = urllib.parse.urlparse(access['url'])
    assert parsed.hostname in ('localhost', '127.0.0.1') and parsed.path.startswith(('/v1/', '/v2-beta/', '/r/')), 'Unexpected stream origin'
    query = dict(urllib.parse.parse_qsl(parsed.query))
    query['token'] = access['token']
    return urllib.parse.urlunparse(('ws', 'localhost:18090', parsed.path, '', urllib.parse.urlencode(query), ''))
def denied_action(user, url, payload=None):
    # Cattle removes actions from the readonly schema and reports attempts as
    # 422 InvalidAction. Other payload-validation errors must not count as denial.
    data = action(user, url, payload, expected=(403, 404, 405, 422))
    if isinstance(data, dict) and data.get('status') == 422:
        assert data.get('code') == 'InvalidAction', 'Unexpected validation error'
    elif isinstance(data, dict) and data.get('code') not in ('InvalidAction', 'PermissionDenied', 'Unauthorized', 'Forbidden', 'NotFound', 'MethodNotAllowed'):
        raise AssertionError('Unexpected authorization error code')
def read_logs(user, resource):
    access = action(user, resource['actions']['logs'], {'follow': True, 'lines': 20, 'timestamps': True})
    with connect(socket_url(access), proxy=None, origin=lab.BASE, compression=None, open_timeout=10, close_timeout=2) as connection:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            frame = connection.recv(timeout=10)
            if isinstance(frame, str) and 'standalone-lab-log' in frame[2:]:
                return True
    return False

def managed_network_acceptance(wait_seconds=180):
    current = session()
    stack = None
    services = []
    stage = 'managed network readiness'
    allocation_started = None
    allocation_elapsed = None
    try:
        current.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
        project = current.api('projects/1a12')
        assert project['name'] == 'UI-OPS-LAB'
        hosts = current.api('projects/1a12/hosts')['data']
        assert {host['id'] for host in hosts if host.get('state') == 'active'} == {'1h1'}
        infrastructure = current.api('projects/1a12/services?limit=-1')['data']
        native = [item for item in infrastructure if item.get('system') and not item.get('removed')]
        check('all six native infrastructure services are active and healthy',
              len(native) == 6 and all(item.get('state') == 'active' and item.get('healthState') == 'healthy' for item in native))
        stage = 'create disposable managed services'
        stack = current.api('projects/1a12/stacks', {'name': 'console-network-' + secrets.token_hex(4)})
        server_command = "mkdir -p /www; printf 'managed-network-verified\\n' > /www/index.html; exec httpd -f -p 8080 -h /www"
        for name, command in [('server', server_command), ('client', 'exec tail -f /dev/null')]:
            service = current.api('projects/1a12/services', {
                'name': name, 'stackId': stack['id'], 'scale': 1, 'startOnCreate': False,
                'launchConfig': {'imageUuid': 'docker:busybox:1.36.1' if name == 'server' else 'docker:alpine:3.20', 'networkMode': 'managed',
                                 'command': ['/bin/sh', '-c', command]}})
            assert service['accountId'] == '1a12'
            services.append(service)
        server, client = services
        action(current, client['actions']['setservicelinks'], {'serviceLinks': [{'serviceId': server['id'], 'name': 'web'}]})
        mappings = current.api('projects/1a12/serviceConsumeMaps?serviceId=' + client['id'])['data']
        check('managed service link persists native client to server direction and alias',
              any(item.get('serviceId') == client['id'] and item.get('consumedServiceId') == server['id'] and item.get('name') == 'web' for item in mappings))
        for service in services:
            fresh = current.api('projects/1a12/services/' + service['id'])
            action(current, fresh['actions']['activate'])
        stage = 'managed service containers'
        instances = {}
        allocation_started = time.monotonic()
        deadline = allocation_started + wait_seconds
        while time.monotonic() < deadline:
            for service in services:
                rows = current.api('projects/1a12/services/' + service['id'] + '/instances')['data']
                running = [item for item in rows if item.get('state') == 'running' and not item.get('removed')]
                if len(running) == 1:
                    instances[service['id']] = running[0]
            if len(instances) == 2:
                break
            time.sleep(1)
        allocation_elapsed = round(time.monotonic() - allocation_started, 2)
        print('INFO: managed allocation seconds=' + str(allocation_elapsed), flush=True)
        assert len(instances) == 2, 'Managed containers did not reach running'
        server_instance, client_instance = instances[server['id']], instances[client['id']]
        check('both managed containers run on the isolated host with distinct native addresses',
              all(item.get('hostId') == '1h1' and item.get('accountId') == '1a12' and item.get('primaryIpAddress') for item in instances.values())
              and server_instance['primaryIpAddress'] != client_instance['primaryIpAddress'])
        stage = 'managed DNS and HTTP'
        access = action(current, client_instance['actions']['execute'], {'command': ['/bin/sh'], 'tty': True,
                        'attachStdin': True, 'attachStdout': True})
        output = ''
        decoder = codecs.getincrementaldecoder('utf-8')()
        with connect(socket_url(access), proxy=None, origin=lab.BASE, compression=None, open_timeout=10, close_timeout=2) as connection:
            connection.send(base64.b64encode(b'nslookup web; wget -qO- -T 10 http://web:8080\n').decode())
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline and len(output) < 65536:
                output += decoder.decode(base64.b64decode(connection.recv(timeout=15)))
                if 'managed-network-verified' in output:
                    break
            connection.send(base64.b64encode(b'exit\n').decode())
        check('native service DNS resolves the linked server address', server_instance['primaryIpAddress'] in output)
        check('managed peer HTTP returns actual server content through the native DNS alias', 'managed-network-verified' in output)
        stage = 'managed resource isolation'
        outsider = session()
        outsider.oidc('leitor')
        status, _, _ = outsider.request('/v2-beta/projects/1a12/services/' + server['id'])
        check('account without the managed environment grant cannot read its service', status in (403, 404))
    except Exception as error:
        if allocation_started is not None and allocation_elapsed is None:
            allocation_elapsed = round(time.monotonic() - allocation_started, 2)
        checks.append({'check': stage, 'status': 'failed', 'errorType': type(error).__name__})
        print('FAILED: ' + stage + ' (' + type(error).__name__ + '); sensitive output withheld.', flush=True)
    finally:
        try:
            if stack:
                fresh = current.api('projects/1a12/stacks/' + stack['id'])
                action(current, fresh['actions']['remove'])
                deadline = time.monotonic() + 180
                removed = set()
                while time.monotonic() < deadline:
                    for service in services:
                        status, result, _ = current.request('/v2-beta/projects/1a12/services/' + service['id'])
                        if status == 404 or (status == 200 and (result.get('removed') or result.get('state') in ('removed', 'purged'))):
                            removed.add(service['id'])
                    if len(removed) == len(services):
                        break
                    time.sleep(1)
                check('disposable managed services are removed by native stack cleanup', len(removed) == len(services))
        except Exception as error:
            checks.append({'check': 'managed network cleanup', 'status': 'failed', 'errorType': type(error).__name__})
            print('FAILED: managed network cleanup; sensitive output withheld.', flush=True)
        (ROOT / 'console/physical-network-timing.json').write_text(json.dumps({'waitBudgetSeconds':wait_seconds,'allocationObservationSeconds':allocation_elapsed,'totalObservationAndCleanupSeconds':round(time.monotonic()-allocation_started,2) if allocation_started else None,'infrastructureTimeoutsChanged':False},indent=2)+'\n',encoding='utf-8')
        (ROOT / 'console/physical-network-test-results.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')


parser = argparse.ArgumentParser()
parser.add_argument('--managed-network', action='store_true')
parser.add_argument('--managed-wait-seconds', type=int, default=180)
args = parser.parse_args()
if not 30 <= args.managed_wait_seconds <= 600:
    parser.error('Managed observation budget must be between 30 and 600 seconds')
if args.managed_network:
    managed_network_acceptance(args.managed_wait_seconds)
    raise SystemExit(1 if any(item['status'] != 'passed' for item in checks) else 0)


admin = session()
try:
    admin.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    fixture = json.loads((ROOT / 'console/workload-fixture.json').read_text(encoding='utf-8'))
    assert fixture['environment'] == '1a12'
    path = 'projects/1a12/containers/' + fixture['standalone']
    resource = admin.api(path)
    assert resource['name'] == 'console-standalone' and resource['accountId'] == '1a12'
    hosts = admin.api('projects/1a12/hosts')['data']
    check('compatible isolated host is active', any(host.get('state') == 'active' for host in hosts))
    def wait_state(state, count=None):
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            current = admin.api(path)
            if current.get('state') == state and (count is None or int(current.get('startCount') or 0) >= count):
                return current
            if current.get('state') == 'error' or current.get('transitioning') == 'error':
                raise RuntimeError('Synthetic container entered an error state')
            time.sleep(1)
        raise TimeoutError('Timed out waiting for the synthetic container state')
    stage = 'start'
    if resource['state'] != 'running':
        action(admin, resource['actions']['start'])
    resource = wait_state('running')
    check('physical standalone container starts', bool(resource.get('hostId')) and bool(resource.get('externalId')))
    stage = 'logs'
    check('logs stream carries output from the physical container', read_logs(admin, resource))
    stage = 'execute'
    access = action(admin, resource['actions']['execute'], {'command': ['/bin/sh'], 'tty': True, 'attachStdin': True, 'attachStdout': True})
    with connect(socket_url(access), proxy=None, origin=lab.BASE, compression=None, open_timeout=10, close_timeout=2) as connection:
        connection.send(':resizeTTY:100,30')
        connection.send(base64.b64encode(b"printf 'console-exec-%s\\n' 'verified'\n").decode())
        decoder = codecs.getincrementaldecoder('utf-8')()
        output = ''
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            frame = connection.recv(timeout=10)
            output += decoder.decode(base64.b64decode(frame))
            if 'console-exec-verified' in output:
                break
        check('terminal executes a command in the physical container', 'console-exec-verified' in output)
        connection.send(base64.b64encode(b'exit\n').decode())
    stage = 'read-only authorization'
    group = admin.api('localGroups', {'name': 'UI-OPS temporary stream reader', 'members': ['10'], 'grants': {'12': 'readonly'}})
    reader = session()
    reader.oidc('leitor')
    readable = reader.api(path)
    check('read-only user can read physical container logs', read_logs(reader, readable))
    assert 'execute' not in readable.get('actions', {}), 'Readonly resource exposed execute action'
    denied_action(reader, resource['actions']['execute'], {'command': ['/bin/sh']})
    check('read-only user cannot execute in the container')
    assert 'stop' not in readable.get('actions', {}), 'Readonly resource exposed stop action'
    denied_action(reader, resource['actions']['stop'])
    check('read-only user cannot stop the physical container')
    stage = 'restart'
    before = int(resource.get('startCount') or 0)
    action(admin, resource['actions']['restart'])
    resource = wait_state('running', before + 1)
    check('container restart completes with a new start count')
    stage = 'stop'
    action(admin, resource['actions']['stop'])
    resource = wait_state('stopped')
    check('physical container stops')
    stage = 'leave running for browser acceptance'
    action(admin, resource['actions']['start'])
    resource = wait_state('running')
    check('synthetic container is running for browser acceptance')
    fixture['hosts'] = [{'id': host['id'], 'state': host.get('state')} for host in hosts]
    (ROOT / 'console/workload-fixture.json').write_text(json.dumps(fixture, indent=2) + '\n', encoding='utf-8')
except Exception as error:
    checks.append({'check': stage, 'status': 'failed', 'errorType': type(error).__name__, 'httpStatus': getattr(error, 'status', None), 'code': getattr(error, 'code', None)})
    print('FAILED: ' + stage + ' (' + type(error).__name__ + ', HTTP ' + str(getattr(error, 'status', None)) + ', code=' + str(getattr(error, 'code', None)) + '); sensitive output withheld.', flush=True)
finally:
    if group:
        admin.api('localGroups', {'id': group['id'], 'name': group['name'], 'revision': group['revision'], 'delete': True})
    (ROOT / 'console/physical-workload-test-results.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
if any(item['status'] != 'passed' for item in checks):
    raise SystemExit(1)
print(str(len(checks)) + ' physical workload checks passed.', flush=True)
