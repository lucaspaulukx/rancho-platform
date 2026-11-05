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
logged_in = False
try:
    session.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    logged_in = True
    project = next(p for p in session.api('projects')['data'] if p.get('name') == 'UI-OPS-LAB' and not p.get('removed'))
    assert project['id'] == '1a12'
    fixture = json.loads(subprocess.check_output(['docker', 'inspect', 'rancher16-legacy-test-host']))[0]
    assert fixture['Config']['Image'] == 'rancher16-legacy-test-host:dev'
    assert any(m.get('Name') == 'rancher16-rbac-lab_legacy-test-state' and m['Destination'] == '/lab-data' for m in fixture['Mounts'])
    tokens = session.api('projects/' + project['id'] + '/registrationTokens')['data']
    token = next(t for t in tokens if t.get('state') == 'active')
    assert token.get('image', 'rancher/agent:v1.2.11') == 'rancher/agent:v1.2.11'
    parsed = urllib.parse.urlparse(token['registrationUrl'])
    assert re.fullmatch(r'/(?:v1/|v2-beta/)?(?:projects/1a[0-9]+/)?scripts/[^/]+', parsed.path)
    server = json.loads(subprocess.run(['docker', 'inspect', 'rancher16-rbac-lab'], capture_output=True, text=True, check=True).stdout)[0]
    server_ip = next(iter(server['NetworkSettings']['Networks'].values()))['IPAddress']
    assert ipaddress.ip_address(server_ip).is_private
    url = urllib.parse.urlunparse(('http', server_ip + ':8080', parsed.path, '', parsed.query, ''))
    registration = ['docker', 'run', '-d', '--privileged', '--name', 'registration-bootstrap', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', '/var/lib/rancher:/var/lib/rancher', token.get('image') or 'rancher/agent:v1.2.11', url]
    config = {'hostname': 'console-legacy-host', 'write_files': [{'path': '/etc/rc.local', 'permissions': '0700', 'owner': 'root', 'content': '#!/bin/bash\nwait-for-docker\ndocker inspect registration-bootstrap >/dev/null 2>&1 || ' + shlex.join(registration) + '\n'}]}
    writer = "import os,sys; fd=os.open('/run/fixture-cloud-config.yaml',os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600); os.fchmod(fd,0o600); os.write(fd,sys.stdin.buffer.read()); os.close(fd)"
    result = subprocess.run(['docker', 'exec', '-i', 'rancher16-legacy-test-host', 'python3', '-c', writer], input=('#cloud-config\n' + json.dumps(config)).encode(), capture_output=True)
    assert result.returncode == 0, 'Could not provision private fixture configuration'
    hosts = session.api('projects/' + project['id'] + '/hosts')['data']
    serial = subprocess.run(['docker', 'exec', 'rancher16-legacy-test-host', 'cat', '/run/guest-serial.log'], capture_output=True).stdout.decode('utf-8', errors='replace')
    signals = [signal for signal in ('Kernel panic', 'Out of memory', 'Failed to find container id', 'no such host', 'failed to download', 'cloud-init', 'rancher-agent', 'login:') if signal in serial]
    print(json.dumps({'environment': project['id'], 'privateCloudConfigProvided': True, 'hosts': [{'id': h['id'], 'state': h.get('state'), 'agentState': h.get('agentState')} for h in hosts], 'bootSignals': signals, 'serialBytes': len(serial)}))
finally:
    if logged_in:
        status, _, _ = session.request('/v2-beta/token/current', method='DELETE')
        if status not in (200, 202, 204, 401):
            raise RuntimeError('Legacy fixture controller session cleanup failed.')
