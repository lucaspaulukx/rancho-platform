import http.cookiejar
import http.server
import importlib.util
from pathlib import Path
import threading
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('loopback_transport', Path(__file__).with_name('loopback_transport.py'))
transport = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(transport)


class LoopbackTransportContract(unittest.TestCase):
    def test_redirect_authority_and_cookie_policy_keep_localhost(self):
        seen = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                seen.append((self.path, self.headers.get('Host'), self.headers.get('Cookie')))
                if self.path == '/start':
                    self.send_response(302)
                    self.send_header('Location', '/done')
                    self.send_header('Set-Cookie', 'probe=synthetic; Path=/')
                    self.end_headers()
                else:
                    self.send_response(200); self.end_headers(); self.wfile.write(b'ok')

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            opener = transport.loopback_opener(http.cookiejar.CookieJar())
            url = 'http://localhost:' + str(server.server_port)
            response = opener.open(url + '/start', timeout=3)
            self.assertEqual(response.read(), b'ok')
            self.assertEqual(response.url, url + '/done')
            self.assertEqual(seen[1], ('/done', 'localhost:' + str(server.server_port), 'probe=synthetic'))
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=3)

    def test_only_localhost_connection_address_changes(self):
        for host in ('localhost', 'LOCALHOST', 'example.invalid', '127.0.0.1'):
            with patch.object(transport.http.client.socket, 'create_connection') as connect:
                connection = transport.LoopbackConnection(host, 8080, timeout=7)
                connection._create_connection((host, 8080), 7)
            self.assertEqual(connect.call_args.args, ((('127.0.0.1' if host.lower() == 'localhost' else host), 8080), 7))
            self.assertEqual(connection.host, host)
            self.assertEqual(connection.timeout, 7)


if __name__ == '__main__':
    unittest.main()
