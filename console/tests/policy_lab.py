"""Prepare only the named isolated policy lab. Never print agent credentials."""
import argparse
import importlib.util
import ipaddress
import json
import shlex
import subprocess
import urllib.parse
import urllib.request
import traceback
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / 'console/policy-lab-fixture.json'
NAME = 'CONSOLE-POLICY-LAB'
MARKER = 'Isolated network-policy acceptance lab; dedicated emulated host only.'
CONTAINER = 'rancher16-policy-test-host'
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18090'

def session():
    user = lab.Session()
    user.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(user.cookies))
    user.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    return user

def prepare():
    user = session()
    if STATE.exists():
        state = json.loads(STATE.read_text(encoding='utf-8'))
        project = user.api('projects/' + state['environment'])
    else:
        matches = [p for p in user.api('projects')['data'] if p.get('name') == NAME and not p.get('removed')]
        if matches:
            raise RuntimeError('Existing untracked policy environment; inspect it before proceeding.')
        native = next(t for t in user.api('projecttemplates')['data'] if t.get('name') == 'Cattle' and not t.get('removed'))
        project = user.api('projects', {'name': NAME, 'description': MARKER, 'projectTemplateId': native['id']})
        state = {'environment': project['id'], 'name': NAME, 'description': MARKER, 'container': CONTAINER}
        STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    assert project['name'] == NAME and project['description'] == MARKER
    tokens = user.api('projects/' + project['id'] + '/registrationTokens')['data']
    token = next((t for t in tokens if t.get('state') == 'active'), None)
    if token is None:
        token = user.api('projects/' + project['id'] + '/registrationTokens', {})
    for _ in range(90):
        if token and token.get('state') == 'active' and isinstance(token.get('registrationUrl'), str):
            break
        time.sleep(1)
        token = next((t for t in user.api('projects/' + project['id'] + '/registrationTokens')['data']
                      if t.get('state') == 'active' and t.get('registrationUrl')), None)
    assert token and isinstance(token.get('registrationUrl'), str), 'Registration token not ready'
    parsed = urllib.parse.urlparse(token['registrationUrl'])
    assert '/scripts/' in parsed.path and parsed.hostname == 'localhost'
    server = json.loads(subprocess.run(['docker', 'inspect', 'rancher16-rbac-lab'], capture_output=True, text=True, check=True).stdout)[0]
    server_ip = next(iter(server['NetworkSettings']['Networks'].values()))['IPAddress']
    assert ipaddress.ip_address(server_ip).is_private
    url = urllib.parse.urlunparse(('http', server_ip + ':8080', parsed.path, '', parsed.query, ''))
    command = ['docker', 'run', '-d', '--privileged', '--name', 'registration-bootstrap',
        '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', '/var/lib/rancher:/var/lib/rancher',
        token.get('image') or 'rancher/agent:v1.2.11', url]
    script = '#!/bin/bash\nwait-for-docker\ndocker inspect registration-bootstrap >/dev/null 2>&1 || ' + shlex.join(command) + '\n'
    config = {'hostname': 'console-policy-host', 'write_files': [{'path': '/etc/rc.local',
        'permissions': '0700', 'owner': 'root', 'content': script}]}
    writer = "import os,sys; fd=os.open('/run/fixture-cloud-config.yaml',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600); os.write(fd,sys.stdin.buffer.read()); os.close(fd)"
    subprocess.run(['docker', 'exec', '-i', CONTAINER, 'python3', '-c', writer],
        input=('#cloud-config\n' + json.dumps(config)).encode(), capture_output=True, check=True)
    print(json.dumps({'environment': project['id'], 'privateConfigPrepared': True}))

def cache():
    names = ('agent', 'alpine', 'dns', 'healthcheck', 'metadata', 'net-holder', 'net', 'network-manager', 'scheduler')
    for name in names:
        source = subprocess.Popen(['docker', 'exec', 'rancher16-legacy-test-host', 'cat', '/lab-data/images/' + name + '.tar'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        destination = subprocess.Popen(['docker', 'exec', '-i', CONTAINER, 'sh', '-c', 'mkdir -p /lab-data/images && cat > /lab-data/images/' + name + '.tar'], stdin=source.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        source.stdout.close()
        destination.communicate()
        source.wait()
        assert source.returncode == 0 and destination.returncode == 0, 'Image archive copy failed'
    print(json.dumps({'copiedArchives': len(names), 'diskOrIdentityCopied': False}))

def guest(operation):
    from legacy_guest import run_guest
    if operation == 'status':
        command = "sudo docker info --format 'FIXTURE_STATUS:docker={{.ServerVersion}}'; sudo docker ps --format 'FIXTURE_STATUS:{{.Names}} {{.Status}}'"
        result = run_guest(command, container=CONTAINER)
    elif operation == 'load':
        names = ('agent', 'alpine', 'dns', 'healthcheck', 'metadata', 'net-holder', 'net', 'network-manager', 'scheduler', 'network-policy-manager')
        commands = ['wget -qO- http://10.0.2.2:8765/images/' + name + '.tar | docker load' for name in names]
        commands.append("echo FIXTURE_STATUS:official_images_loaded")
        command = 'sudo bash -o pipefail -c ' + shlex.quote(' && '.join(commands))
        result = run_guest(command, timeout=600, container=CONTAINER)
    elif operation == 'register':
        raw = subprocess.run(['docker', 'exec', CONTAINER, 'cat', '/run/fixture-cloud-config.yaml'], capture_output=True, check=True).stdout.decode()
        config = json.loads(raw.split('\n', 1)[1])
        script = config['write_files'][0]['content']
        result = run_guest('sudo bash -c ' + shlex.quote(script), timeout=90, container=CONTAINER)
    elif operation == 'shutdown':
        try:
            run_guest('sudo poweroff', timeout=45, container=CONTAINER)
        except (RuntimeError, json.JSONDecodeError, subprocess.TimeoutExpired):
            pass
        running = subprocess.run(['docker','inspect','--format','{{.State.Running}}',CONTAINER],capture_output=True,text=True,check=True).stdout.strip()
        assert running == 'false', 'Guest did not stop cleanly'
        print(json.dumps({'shutdown':True,'running':False,'volumePreserved':True}))
        return
    print(json.dumps(result))
    if not result.get('ready') or not result.get('completed') or result.get('exitCode') != 0:
        raise SystemExit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['prepare', 'cache', 'status', 'load', 'register', 'shutdown'])
    args = parser.parse_args()
    try:
        if args.operation in ('prepare', 'cache'):
            (prepare if args.operation == 'prepare' else cache)()
        else:
            guest(args.operation)
    except Exception as error:
        locations = [{'file': Path(frame.filename).name, 'line': frame.lineno} for frame in traceback.extract_tb(error.__traceback__)]
        print(json.dumps({'stage': args.operation, 'errorType': type(error).__name__, 'locations': locations, 'details': 'withheld'}))
        raise SystemExit(1)
