"""Manage the synthetic legacy guest through its container-private console."""
import json
import shlex
import subprocess
import sys
from pathlib import Path

SOURCE = (Path(__file__).parent / 'legacy-host/guest_command.py').read_text(encoding='utf-8')
def run_guest(command, timeout=45, container='rancher16-legacy-test-host'):
    if container not in ('rancher16-legacy-test-host', 'rancher16-policy-test-host'):
        raise ValueError('Unknown isolated guest')
    result = subprocess.run(['docker', 'exec', '-i', container, 'python3', '-c', SOURCE, str(max(35, min(600, timeout - 10)))], input=command.encode(), capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Private guest management command failed; output withheld.')
    return json.loads(result.stdout)

if __name__ == '__main__':
    operation = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if operation == 'status':
        command = "sudo docker info --format 'FIXTURE_STATUS:docker={{.ServerVersion}} driver={{.CgroupDriver}}'"
    elif operation == 'shutdown':
        command = 'sudo poweroff'
    elif operation == 'trust':
        command = "sudo sh -c '(curl -fsS http://10.0.2.2:8765/ca-certificates.crt -o /tmp/fixture-ca.crt || wget -qO /tmp/fixture-ca.crt http://10.0.2.2:8765/ca-certificates.crt) && system-docker cp /tmp/fixture-ca.crt docker:/etc/ssl/certs/ca-certificates.crt && system-docker restart docker && echo FIXTURE_STATUS:vendor_CA_bundle_updated'"
    elif operation == 'inspect-trust':
        script = 'for p in /etc/ssl/certs/ca-certificates.crt /etc/ssl/cert.pem; do if [ -f "$p" ]; then printf "FIXTURE_STATUS:%s " "$p"; sha256sum "$p" | cut -d" " -f1; fi; done; env | grep "^SSL_CERT_" | sed "s/^/FIXTURE_STATUS:/"'
        command = "sudo sha256sum /tmp/fixture-ca.crt | sed 's/^/FIXTURE_STATUS:source /'; sudo system-docker exec docker sh -c " + shlex.quote(script)
    elif operation == 'load-images':
        command = 'sudo bash -o pipefail -c ' + shlex.quote("wget -qO- http://10.0.2.2:8765/images/agent.tar | docker load && wget -qO- http://10.0.2.2:8765/images/alpine.tar | docker load && docker images --no-trunc --format 'FIXTURE_STATUS:{{.Repository}}:{{.Tag}} {{.ID}}'")
    elif operation == 'load-infrastructure':
        archives = ['dns', 'healthcheck', 'metadata', 'net-holder', 'net', 'network-manager', 'scheduler']
        commands = ['wget -qO- http://10.0.2.2:8765/images/' + name + '.tar | docker load' for name in archives]
        commands.append("docker images --no-trunc --format 'FIXTURE_STATUS:{{.Repository}}:{{.Tag}} {{.ID}}'")
        command = 'sudo bash -o pipefail -c ' + shlex.quote(' && '.join(commands))
    elif operation == 'load-network-fixture':
        command = 'sudo bash -o pipefail -c ' + shlex.quote("wget -qO- http://10.0.2.2:8765/images/alpine.tar | docker load && docker images --no-trunc --format 'FIXTURE_STATUS:{{.Repository}}:{{.Tag}} {{.ID}}'")
    elif operation == 'agent-status':
        command = "sudo docker ps -a --format 'FIXTURE_STATUS:{{.Names}} {{.State}}'; sudo docker logs --tail 25 registration-bootstrap; sudo docker logs --tail 25 rancher-agent"
    elif operation == 'register':
        raw = subprocess.run(['docker', 'exec', 'rancher16-legacy-test-host', 'cat', '/run/fixture-cloud-config.yaml'], capture_output=True, check=True).stdout.decode()
        config = json.loads(raw.split('\n', 1)[1])
        script = config['write_files'][0]['content']
        command = 'sudo bash -c ' + shlex.quote(script)
    else:
        raise SystemExit('Supported operations: status, trust, register')
    try:
        result = run_guest(command, timeout=360 if operation == 'load-infrastructure' else 45)
    except RuntimeError:
        if operation != 'shutdown':
            raise
        result = {'channelClosed': True}
    if operation == 'shutdown':
        state = subprocess.run(['docker', 'inspect', '--format', '{{.State.Running}}', 'rancher16-legacy-test-host'], capture_output=True, text=True, check=True).stdout.strip()
        if state != 'false':
            raise RuntimeError('Private guest shutdown did not stop the fixture; recreation refused.')
        result = {'shutdown': True, 'running': False}
    print(json.dumps(result))
