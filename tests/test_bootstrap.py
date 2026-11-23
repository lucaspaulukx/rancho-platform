"""Bootstrap safety contracts; no Docker resources or existing credentials are changed."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BootstrapTests(unittest.TestCase):
    def plan(self, classic=False, existing=False):
        with tempfile.TemporaryDirectory(prefix='rancher-bootstrap-plan-') as directory:
            folder = Path(directory)
            shutil.copy2(ROOT / 'Start-Lab.ps1', folder / 'Start-Lab.ps1')
            if existing:
                (folder / 'keycloak').mkdir()
                (folder / '.env').write_text('TEST_ONLY=private-fixture-not-a-real-secret\n', encoding='utf-8')
                (folder / 'keycloak/realm.json').write_text('{"fixture":"preserve"}', encoding='utf-8')
            before = {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*') if p.is_file()}
            command = ['pwsh', '-NoProfile', '-File', str(folder / 'Start-Lab.ps1'), '-PlanOnly']
            if classic:
                command += ['-ClassicOnly']
            result = subprocess.run(command, capture_output=True, timeout=20, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertNotIn('private-fixture-not-a-real-secret', result.stdout)
            after = {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*') if p.is_file()}
            self.assertEqual(before, after)
            report = json.loads(result.stdout)
            self.assertFalse(report['sourceModified'])
            self.assertFalse(report['startsContainers'])
            return report

    def test_fresh_modern_plan_is_read_only(self):
        plan = self.plan()
        self.assertEqual(plan['services'], ['rancher', 'keycloak', 'console'])
        self.assertTrue(plan['createsMissingPrivateEnv'])
        self.assertTrue(plan['createsMissingRealm'])

    def test_existing_secrets_and_realm_are_preserved(self):
        plan = self.plan(existing=True)
        self.assertFalse(plan['createsMissingPrivateEnv'])
        self.assertFalse(plan['createsMissingRealm'])

    def test_classic_only_does_not_start_console(self):
        self.assertEqual(self.plan(classic=True)['services'], ['rancher', 'keycloak'])

    def test_public_realm_has_both_callbacks_and_no_literal_credentials(self):
        realm = json.loads((ROOT / 'keycloak/realm.template.json').read_text(encoding='utf-8'))
        client = realm['clients'][0]
        self.assertEqual(set(client['redirectUris']), {'http://localhost:18080/oidc/callback', 'http://localhost:18090/oidc/callback'})
        self.assertEqual(client['secret'], '${OIDC_CLIENT_SECRET}')
        self.assertTrue(client['standardFlowEnabled'])
        self.assertFalse(client['directAccessGrantsEnabled'])
        self.assertEqual(client['attributes']['pkce.code.challenge.method'], 'S256')
        for user in realm['users']:
            self.assertEqual(user['credentials'][0]['value'], '${LAB_USER_PASSWORD}')
            self.assertTrue(user['email'].endswith('@example.invalid'))


if __name__ == '__main__':
    unittest.main()
