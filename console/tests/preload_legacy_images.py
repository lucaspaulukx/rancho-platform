"""Transfer vendor images already pulled with a current Docker into the private
VM fixture image cache. No daemon socket is mounted in the VM container.
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
modes = parser.add_mutually_exclusive_group()
modes.add_argument('--infrastructure', action='store_true')
modes.add_argument('--network-fixture', action='store_true')
modes.add_argument('--policy-manager', action='store_true')
args = parser.parse_args()
classic = ['docker', 'exec', 'rancher16-workload-test-host', 'docker']
images = [('agent.tar', classic, ['rancher/agent:v1.2.11']), ('alpine.tar', ['docker'], ['alpine:3.20'])]
if args.infrastructure:
    images = [(filename + '.tar', classic, ['rancher/' + name]) for filename, name in [
        ('dns', 'dns:v0.17.4'), ('healthcheck', 'healthcheck:v0.3.8'),
        ('metadata', 'metadata:v0.10.4'), ('net-holder', 'net:holder'),
        ('net', 'net:v0.13.17'), ('network-manager', 'network-manager:v0.7.22'),
        ('scheduler', 'scheduler:v0.8.6')]]
if args.network_fixture:
    images = [('alpine.tar', classic, ['alpine:3.20', 'busybox:1.36.1'])]
if args.policy_manager:
    images = [('network-policy-manager.tar', classic, ['rancher/network-policy-manager:v0.2.8'])]
manifest = ROOT / 'console/legacy-image-manifest.json'
results = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
for filename, prefix, names in images:
    entries = []
    for name in names:
        if args.infrastructure or args.network_fixture or args.policy_manager:
            subprocess.run(prefix + ['pull', name], capture_output=True, text=True, check=True, timeout=300)
        image = subprocess.run(prefix + ['image', 'inspect', '--format', '{{.Id}}', name], capture_output=True, text=True, check=True).stdout.strip()
        entries.append({'image': name, 'imageId': image, 'archive': filename})
    source = subprocess.Popen(prefix + ['image', 'save'] + names, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    target = 'rancher16-policy-test-host' if args.policy_manager else 'rancher16-legacy-test-host'
    destination = subprocess.Popen(['docker', 'exec', '-i', target, 'sh', '-c', 'mkdir -p /lab-data/images && cat > /lab-data/images/' + filename], stdin=source.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    source.stdout.close()
    destination.communicate()
    source.wait()
    assert source.returncode == 0 and destination.returncode == 0, 'Could not transfer vendor image to the private fixture cache'
    results = [entry for entry in results if entry['image'] not in names]
    results.extend(entries)
manifest.write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'cachedImages': results}))
