import unittest
from unittest.mock import patch

from scripts.bootstrap_admin import configure, local_origin


class BootstrapAdminTests(unittest.TestCase):
    def test_credentials_cannot_be_sent_to_external_or_redirect_origins(self):
        for origin in ('https://example.invalid', 'http://localhost@example.invalid',
                       'http://localhost/?next=remote', 'http://localhost/private',
                       'http://127.0.0.1#remote', 'file:///private'):
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                local_origin(origin)
        self.assertEqual(local_origin('http://127.0.0.1:18090/'), 'http://127.0.0.1:18090')

    def test_short_password_and_colon_username_fail_before_network(self):
        with patch('urllib.request.build_opener') as opener:
            for username, password in (('admin', 'short'), ('account:code', 'x' * 24)):
                with self.assertRaises(ValueError):
                    configure('http://localhost:18090', username, password)
            opener.assert_not_called()

    def test_existing_authentication_is_not_overwritten(self):
        with patch('urllib.request.build_opener') as factory:
            response = factory.return_value.open.return_value.__enter__.return_value
            response.read.return_value = b'{"data":[{"security":true}]}'
            with self.assertRaisesRegex(ValueError, 'already configured'):
                configure('http://localhost:18090', 'admin', 'synthetic-fixture-password-012345')
            self.assertEqual(factory.return_value.open.call_count, 1)


if __name__ == '__main__':
    unittest.main()
