"""Software-emulated legacy Linux, independent from the Docker Desktop kernel.
No host device or socket is mounted. Cloud-config is private to this container.
"""
import http.server
import os
import pathlib
import shutil
import subprocess
import threading
import time

CONFIG = pathlib.Path('/run/fixture-cloud-config.yaml')
while not CONFIG.exists():
    time.sleep(1)

class CloudConfig(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        with open('/run/cloud-requests.txt', 'a', encoding='utf-8') as log:
            log.write(self.path.split('?')[0][:160] + '\n')
        images = {'/images/' + name + '.tar': '/lab-data/images/' + name + '.tar'
              for name in ('agent', 'alpine', 'dns', 'healthcheck', 'metadata', 'net-holder', 'net', 'network-manager', 'scheduler', 'network-policy-manager')}
        if self.path in images:
            archive = pathlib.Path(images[self.path])
            if not archive.exists():
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(archive.stat().st_size))
            self.end_headers()
            with archive.open('rb') as source:
                shutil.copyfileobj(source, self.wfile)
            return
        if self.path not in ('/cloud-config', '/ca-certificates.crt'):
            self.send_error(404)
            return
        data = CONFIG.read_bytes() if self.path == '/cloud-config' else pathlib.Path('/etc/ssl/certs/ca-certificates.crt').read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(data)
    def log_message(self, *args):
        pass

server = http.server.HTTPServer(('127.0.0.1', 8765), CloudConfig)
threading.Thread(target=server.serve_forever, daemon=True).start()
disk = '/lab-data/state.qcow2'
if not os.path.exists(disk):
    subprocess.run(['qemu-img', 'create', '-f', 'qcow2', disk, '8G'], check=True)
# Serial output may contain registration credentials: keep it inside the
# container's private /run directory; never forward it to Docker logs.
with open('/run/legacy-console.log', 'wb') as console:
    os.chmod('/run/legacy-console.log', 0o600)
    command = ['qemu-system-x86_64', '-machine', 'q35,accel=tcg', '-cpu', 'qemu64', '-smp', '2', '-m', '1536', '-display', 'none', '-monitor', 'none', '-chardev', 'socket,id=serial,path=/run/guest-console.sock,server=on,wait=off,logfile=/run/guest-serial.log', '-serial', 'chardev:serial', '-no-reboot', '-kernel', '/boot-lab/vmlinuz', '-initrd', '/boot-lab/initrd', '-drive', f'file={disk},format=qcow2,if=virtio', '-netdev', 'user,id=lab', '-device', 'virtio-net-pci,netdev=lab', '-append', 'console=ttyS0 net.ifnames=0 rancher.autologin=ttyS0 rancher.state.dev=LABEL=RANCHER_STATE rancher.state.autoformat=[/dev/vda] rancher.cloud_init.datasources=[url:http://10.0.2.2:8765/cloud-config]']
    print('Starting isolated RancherOS 1.5.8 fixture; serial output kept private.', flush=True)
    raise SystemExit(subprocess.run(command, stdout=console, stderr=subprocess.STDOUT).returncode)
