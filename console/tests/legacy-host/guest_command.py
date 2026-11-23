"""Private CLI management channel for the disposable guest only.
Receive command on stdin; never echo it or unfiltered guest output.
"""
import json
import re
import socket
import sys
import time
import uuid

command = sys.stdin.read().rstrip()
marker = 'FIXTURE_' + uuid.uuid4().hex
channel = socket.socket(socket.AF_UNIX)
channel.settimeout(1)
channel.connect('/run/guest-console.sock')
channel.sendall(b'\n')
initial = b''
initial_deadline = time.monotonic() + 4
prompt = False
while time.monotonic() < initial_deadline:
    try:
        initial += channel.recv(65536)
    except socket.timeout:
        continue
    clean = re.sub(rb'\x1b\[[0-?]*[ -/]*[@-~]', b'', initial)
    if re.search(rb'[$#]\s*$', clean):
        prompt = True
        break
if not prompt:
    print(json.dumps({'ready': False, 'shellPrompt': False, 'loginPrompt': b'login:' in initial, 'receivedBytes': len(initial)}))
    raise SystemExit(0)
channel.sendall(("unset HISTFILE; " + command + "; printf '\\n" + marker + "_END:%s\\n' $?\n").encode())
output = b''
deadline = time.monotonic() + max(35, min(600, int(sys.argv[1]) if len(sys.argv) > 1 else 35))
pattern = re.compile(rb'\r?\n' + marker.encode() + rb'_END:(\d+)\r?\n')
while time.monotonic() < deadline:
    try:
        output += channel.recv(65536)
    except socket.timeout:
        continue
    if pattern.search(output):
        break
match = pattern.search(output)
# Only explicit machine status lines are exposed. Commands may contain tokens.
clean_output = re.sub(rb'\x1b\[[0-?]*[ -/]*[@-~]', b'', output).replace(b'\r\n', b'\n').replace(b'\r', b'\n')
status = re.findall(rb'(?m)^FIXTURE_STATUS:[A-Za-z0-9_.:/ =-]+$', clean_output)
diagnostics = []
for line in clean_output.decode('utf-8', errors='replace').splitlines():
    if re.match(r'^(docker: |Error response from daemon: |Cannot connect to the Docker daemon|Unable to find image|ERROR:|time=.*level=(?:fatal|error|warning|warn))', line):
        diagnostics.append(re.sub(r'[A-Za-z0-9_=/+%.-]{16,}', '[redacted]', re.sub(r'https?://\S+', '[url]', line))[:400])
print(json.dumps({'ready': True, 'completed': bool(match), 'exitCode': int(match[1]) if match else None, 'status': [line.decode() for line in status], 'diagnostics': diagnostics[-5:], 'outputBytes': len(output)}))
