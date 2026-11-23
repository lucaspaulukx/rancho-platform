"""Private browser transport to a recovered engine in its loopback-only namespace."""

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import secrets
import subprocess
from threading import Thread
from urllib.parse import urljoin, urlsplit


# Read the request from stdin so private headers and credentials stay out of process arguments.
FORWARD = """
const fs = require('node:fs');
const http = require('node:http');
const { path, method, headers, body } = JSON.parse(fs.readFileSync(0, 'utf8'));
const request = http.request({
  hostname: '127.0.0.1', port: 8080, path, method, headers, timeout: 10000
}, response => {
  const forwarded = {};
  for (const key of ['content-type', 'set-cookie', 'location'])
    if (response.headers[key]) forwarded[key] = response.headers[key];
  process.stdout.write(JSON.stringify({ status: response.statusCode, headers: forwarded }) + '\\n');
  response.pipe(process.stdout);
});
request.on('timeout', () => request.destroy());
request.on('error', () => { process.exitCode = 1; });
request.end(body);
"""


@contextmanager
def browser_bridge(anchor):
    token = secrets.token_hex(32)
    auth_header = 'X-Rancho-Rehearsal'

    class Handler(BaseHTTPRequestHandler):
        timeout = 12

        def log_message(self, *_):
            pass

        def handle(self):
            try:
                super().handle()
            except ConnectionError:
                # Chromium cancels outstanding reads when navigating or closing a page.
                pass

        def forward(self):
            if (not secrets.compare_digest(self.headers.get(auth_header, ''), token)
                    or self.headers.get('Host') != f'localhost:{self.server.server_port}'
                    or not self.path.startswith('/') or self.requestline.split()[1].startswith('//')):
                self.send_error(403)
                return
            path = urlsplit(self.path)
            allowed = (self.command in ('GET', 'HEAD')
                       or (self.command == 'POST' and path.path == '/v2-beta/token')
                       or (self.command == 'DELETE' and path.path == '/v2-beta/token/current'))
            if not allowed:
                self.send_error(405)
                return
            length = self.headers.get('Content-Length', '0')
            if not length.isascii() or not length.isdecimal() or len(length) > 4 or int(length) > 4096:
                self.send_error(413)
                return
            try:
                body = self.rfile.read(int(length)).decode('utf-8')
                headers = {key: self.headers[key] for key in ('Host', 'Accept', 'Content-Type', 'Cookie',
                                                             'Origin', 'Referer', 'User-Agent', 'X-Api-Csrf')
                           if key in self.headers}
                headers['Content-Length'] = length
                payload = json.dumps(dict(path=self.path, method=self.command, headers=headers, body=body))
                result = subprocess.run(['docker', 'exec', '-i', anchor, 'node', '-e', FORWARD],
                                        input=payload.encode(), capture_output=True, timeout=18, check=True)
                metadata, content = result.stdout.split(b'\n', 1)
                response = json.loads(metadata)
                location = response['headers'].get('location')
                if location:
                    base = f'http://localhost:{self.server.server_port}'
                    target = urlsplit(urljoin(base + self.path, location))
                    if target.scheme != 'http' or target.netloc != urlsplit(base).netloc:
                        self.send_error(502)
                        return
            except (OSError, ValueError, subprocess.SubprocessError):
                self.send_error(502)
                return
            self.send_response(response['status'])
            for key, value in response['headers'].items():
                for entry in value if isinstance(value, list) else [value]:
                    self.send_header(key, entry)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        do_GET = do_HEAD = do_POST = do_DELETE = forward

    with ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
        server.daemon_threads = False
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://localhost:{server.server_port}', {auth_header: token}
        finally:
            server.shutdown()
            thread.join()
