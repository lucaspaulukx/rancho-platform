import http.client
import json
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

from migration.classic_browser_bridge import browser_bridge


def request(base, method, path, headers):
    endpoint = urlsplit(base)
    connection = http.client.HTTPConnection('127.0.0.1', endpoint.port, timeout=5)
    try:
        connection.request(method, path, headers={'Host': endpoint.netloc, **headers})
        response = connection.getresponse()
        return response.status, response.getheaders(), response.read()
    finally:
        connection.close()


class ClassicBrowserBridgeTest(unittest.TestCase):
    @patch('migration.classic_browser_bridge.subprocess.run')
    def test_requires_ownership_header_and_rejects_mutations(self, docker):
        with browser_bridge('owned-test-anchor') as (base, headers):
            self.assertEqual(request(base, 'GET', '/', {})[0], 403)
            self.assertEqual(request(base, 'GET', '//external.invalid', headers)[0], 403)
            self.assertEqual(request(base, 'POST', '/v2-beta/projects', headers)[0], 405)
        docker.assert_not_called()

    @patch('migration.classic_browser_bridge.subprocess.run')
    def test_preserves_cookie_headers_and_keeps_bridge_key_local(self, docker):
        metadata = {'status': 200, 'headers': {'set-cookie': ['one=a', 'two=b']}}
        docker.return_value = SimpleNamespace(stdout=json.dumps(metadata).encode() + b'\nfixture')
        with browser_bridge('owned-test-anchor') as (base, headers):
            status, response_headers, body = request(base, 'GET', '/settings/env', {**headers, 'User-Agent': 'Mozilla/test'})
        self.assertEqual((status, body), (200, b'fixture'))
        self.assertEqual([value for key, value in response_headers if key == 'set-cookie'], ['one=a', 'two=b'])
        forwarded = json.loads(docker.call_args.kwargs['input'])
        self.assertEqual(forwarded['path'], '/settings/env')
        self.assertEqual(forwarded['headers']['User-Agent'], 'Mozilla/test')
        self.assertNotIn('X-Rancho-Rehearsal', forwarded['headers'])

    @patch('migration.classic_browser_bridge.subprocess.run')
    def test_blocks_cross_origin_redirect(self, docker):
        metadata = {'status': 302, 'headers': {'location': 'https://external.invalid/'}}
        docker.return_value = SimpleNamespace(stdout=json.dumps(metadata).encode() + b'\n')
        with browser_bridge('owned-test-anchor') as (base, headers):
            self.assertEqual(request(base, 'GET', '/', headers)[0], 502)
