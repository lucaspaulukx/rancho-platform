"""Provide private cloud-config to the emulated local legacy-host fixture."""
import importlib.util
import ipaddress
import json
import re
import subprocess
import shlex
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
project = next(p for p in session.api('projects')['data'] if p.get('name') == 'UI-OPS-LAB' and not p.get('removed'))
tokens = session.api('projects/' + project['id'] + '/registrationTokens')['data']
token = next(t for t in tokens if t.get('state') == 'active')
parsed = urllib.parse.urlparse(token['registrationUrl'])
assert re.fullmatch(r'/(?:v1/|v2-beta/)?(?:projects/1a[0-9]+/)?scripts/[^/]+', parsed.path)
server = json.loads(subprocess.run(['docker', 'inspect', 'rancher16-rbac-lab'], capture_output=True, text=True, check=True).stdout)[0]
server_ip = next(iter(server['NetworkSettings']['Networks'].values()))['IPAddress']
assert ipaddress.ip_address(server_ip).is_private
url = urllib.parse.urlunparse(('http', server_ip + ':8080', parsed.path, '', parsed.query, ''))
registration = ['docker', 'run', '-d', '--privileged', '--name', 'registration-bootstrap', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', '/var/lib/rancher:/var/lib/rancher', token.get('image') or 'rancher/agent:v1.2.11', url]
config = {'hostname': 'console-legacy-host', 'write_files': [{'path': '/etc/rc.local', 'permissions': '0700', 'owner': 'root', 'content': '#!/bin/bash\nwait-for-docker\ndocker inspect registration-bootstrap >/dev/null 2>&1 || ' + shlex.join(registration) + '\n'}]}
writer = "import os,sys; fd=os.open('/run/fixture-cloud-config.yaml',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600); os.write(fd,sys.stdin.buffer.read()); os.close(fd)"
result = subprocess.run(['docker', 'exec', '-i', 'rancher16-legacy-test-host', 'python3', '-c', writer], input=('#cloud-config\n' + json.dumps(config)).encode(), capture_output=True)
assert result.returncode == 0, 'Could not provision private fixture configuration'
hosts = session.api('projects/' + project['id'] + '/hosts')['data']
serial = subprocess.run(['docker', 'exec', 'rancher16-legacy-test-host', 'cat', '/run/guest-serial.log'], capture_output=True).stdout.decode('utf-8', errors='replace')
signals = [signal for signal in ('Kernel panic', 'Out of memory', 'Failed to find container id', 'no such host', 'failed to download', 'cloud-init', 'rancher-agent', 'login:') if signal in serial]
print(json.dumps({'environment': project['id'], 'privateCloudConfigProvided': True, 'hosts': [{'id': h['id'], 'state': h.get('state'), 'agentState': h.get('agentState')} for h in hosts], 'bootSignals': signals, 'serialBytes': len(serial)}))
lines = [re.sub(r'[A-Za-z0-9_=/+%.-]{16,}', '[redacted]', re.sub(r'https?://\S+', '[url]', line))[:400] for line in serial.splitlines() if re.search(r'error|fail|cloud-init|runcmd|cloud_init|console-legacy', line, re.I)]
print(json.dumps({'bootDiagnostics': lines[-12:]}))
