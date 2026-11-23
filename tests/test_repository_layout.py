"""Ensure the distribution gate rejects diaries and private state, not maintained guides."""
import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('repository_gate', Path(__file__).resolve().parents[1] / 'scripts/check_repository.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class RepositoryLayout(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='rancho-layout-test-')
        self.root = Path(self.directory.name)
        self.original = gate.ROOT
        gate.ROOT = self.root
        subprocess.run(['git', 'init', '-q'], cwd=self.root, check=True, capture_output=True)

    def tearDown(self):
        gate.ROOT = self.original
        self.directory.cleanup()

    def stage(self, name):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('Synthetic fixture document.', encoding='utf-8')
        subprocess.run(['git', 'add', '--', name], cwd=self.root, check=True, capture_output=True)

    def test_maintained_bilingual_guides_are_allowed(self):
        for name in ('README.md', 'docs/en/architecture.md', 'docs/pt-BR/architecture.md',
                     'AGENTS.md', '.env.example', 'keycloak/realm.template.json'):
            self.stage(name)
        with contextlib.redirect_stdout(io.StringIO()) as output:
            gate.main()
        self.assertIn('PASS', output.getvalue())

    def test_handoff_and_phase_diaries_are_rejected(self):
        for name in ('HANDOFF-example.md', 'docs/history/old-status.md', 'docs/92-execution-diary.md'):
            self.stage(name)
            with self.assertRaisesRegex(RuntimeError, 'handoffs and phase diaries'):
                gate.main()
            subprocess.run(['git', 'rm', '--cached', '--', name], cwd=self.root, check=True, capture_output=True)

    def test_private_artifacts_are_still_rejected(self):
        for name in ('.env', '.env.private', 'backups/private.txt', 'capture.dump',
                     'keycloak/realm.json', 'console/own-fixture.json', 'console/own-results.json'):
            self.stage(name)
            with self.assertRaisesRegex(RuntimeError, 'Private/generated artifact'):
                gate.main()
            subprocess.run(['git', 'rm', '--cached', '--', name], cwd=self.root, check=True, capture_output=True)


if __name__ == '__main__':
    unittest.main()
