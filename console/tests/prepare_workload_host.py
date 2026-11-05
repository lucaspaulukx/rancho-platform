"""Create an isolated local fixture environment and register only the nested Docker.
Registration credentials remain in memory and are never written to evidence.
"""
import importlib.util
import json
import re
import ipaddress
import sys
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'
session = lab.Session()
session.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(session.cookies))
session.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
projects = session.api('projects')['data']
project = next((p for p in projects if p.get('name') == 'UI-OPS-LAB' and not p.get('removed')), None)
if project is None:
    project = session.api('projects', {'name': 'UI-OPS-LAB', 'description': 'Synthetic console operations fixture; isolated nested Docker only.', 'orchestration': 'cattle'})
base = 'projects/' + project['id']
tokens = session.api(base + '/registrationTokens')['data']
token = next((t for t in tokens if t.get('state') == 'active'), None)
if token is None:
    token = session.api(base + '/registrationTokens', {})
    # The backend may still be activating the token. A second run reuses it.
url = token.get('registrationUrl')
if not url:
    print(json.dumps({'environment': project['id'], 'registrationState': token.get('state'), 'ready': False}))
    raise SystemExit(0)
parsed = urllib.parse.urlparse(url)
assert re.fullmatch(r'/(?:v1/|v2-beta/)?(?:projects/1a[0-9]+/)?scripts/[^/]+', parsed.path), 'Unexpected registration route'
server = json.loads(subprocess.run(['docker', 'inspect', 'rancher16-rbac-lab'], capture_output=True, text=True, check=True).stdout)[0]
server_ip = next(iter(server['NetworkSettings']['Networks'].values()))['IPAddress']
assert ipaddress.ip_address(server_ip).is_private, 'Expected an isolated Docker network'
internal_url = urllib.parse.urlunparse(('http', server_ip + ':8080', parsed.path, '', parsed.query, ''))
image = token.get('image') or 'rancher/agent:v1.2.11'
assert image.startswith('rancher/agent:'), 'Unexpected agent image'
existing = subprocess.run(['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'ps', '-a', '--filter', 'name=rancher-agent', '--format', '{{.Names}}'], capture_output=True, text=True, check=True).stdout
if '--retry-bootstrap' in sys.argv and 'rancher-agent-bootstrap' in existing:
    assert not session.api(base + '/hosts')['data'], 'Do not replace the bootstrap of an already registered host'
    subprocess.run(['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'rm', '-f', 'rancher-agent-bootstrap'], capture_output=True, check=True)
    existing = ''
if 'rancher-agent' not in existing:
    command = ['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'run', '-d', '--name', 'rancher-agent-bootstrap', '--privileged', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', '/var/lib/rancher:/var/lib/rancher', image, internal_url]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Could not start the isolated registration agent; output withheld because it may contain registration credentials.')
if '--host-cgroup-namespace' in sys.argv:
    inspect = subprocess.run(['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'inspect', 'rancher-agent'], capture_output=True, text=True, check=True)
    agent = json.loads(inspect.stdout)[0]
    assert agent['Config']['Image'].startswith('rancher/agent:'), 'Unexpected fixture agent'
    if agent['HostConfig'].get('CgroupnsMode') != 'host':
        command = ['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'run', '-d', '--name', 'rancher-agent', '--restart', 'unless-stopped', '--privileged', '--cgroupns', 'host', '--network', agent['HostConfig']['NetworkMode']]
        for bind in agent['HostConfig'].get('Binds') or []:
            command += ['-v', bind]
        for variable in agent['Config'].get('Env') or []:
            command += ['-e', variable]
        for key, value in (agent['Config'].get('Labels') or {}).items():
            command += ['--label', key + '=' + value]
        command += [agent['Config']['Image']] + (agent['Config'].get('Cmd') or [])
        subprocess.run(['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'rm', '-f', 'rancher-agent'], capture_output=True, check=True)
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('Could not recreate the fixture agent with host cgroup visibility; sensitive output withheld.')
hosts = session.api(base + '/hosts')['data']
log_text = ''
for name in ('rancher-agent-bootstrap', 'rancher-agent'):
    logs = subprocess.run(['docker', 'exec', 'rancher16-workload-test-host', 'docker', 'logs', '--tail', '30', name], capture_output=True, text=True)
    log_text += logs.stdout + logs.stderr
signals = [word for word in ('cgroup', 'permission denied', 'no such host', 'connection refused', 'client is newer', 'unsupported', 'ERROR', 'error') if word in log_text]
errors = [re.sub(r'[A-Za-z0-9_=/+%.-]{24,}', '[redacted]', re.sub(r'https?://\S+', '[url]', line.replace(str(token.get('token', '')), '[registration-token]')))[:300] for line in log_text.splitlines() if re.search(r'error|fatal|failed', line, re.I)]
print(json.dumps({'environment': project['id'], 'registrationState': token.get('state'), 'agentStarted': True, 'hosts': [{'id': host['id'], 'state': host.get('state'), 'agentState': host.get('agentState')} for host in hosts], 'diagnosticSignals': signals}))
print(json.dumps({'agentErrors': errors[-5:]}))
