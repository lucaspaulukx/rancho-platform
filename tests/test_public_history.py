"""Exercise publication checks against disposable Git histories, including deleted files."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('publication', Path(__file__).resolve().parents[1] / 'scripts/check_public_history.py')
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


class HistoryChecks(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='rancho-history-test-')
        self.root = Path(self.directory.name)
        self.original = publication.ROOT
        publication.ROOT = self.root
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')

    def tearDown(self):
        publication.ROOT = self.original
        self.directory.cleanup()

    def git(self, *args):
        subprocess.run(['git', *args], cwd=self.root, check=True, capture_output=True)

    def commit(self, path, content, message='Fixture change'):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding='utf-8')
        self.git('add', '--', path)
        self.git('commit', '-qm', message)

    def test_clean_history(self):
        self.commit('README.md', 'Public fixture')
        with contextlib.redirect_stdout(io.StringIO()) as output:
            publication.main()
        self.assertIn('1 reachable commits', output.getvalue())

    def test_deleted_private_path_remains_blocked(self):
        self.commit('backups/private.txt', 'Fixture')
        self.git('rm', 'backups/private.txt')
        self.git('commit', '-qm', 'Remove fixture')
        with self.assertRaisesRegex(RuntimeError, 'historical path'):
            publication.main()

    def test_commit_message_is_scanned(self):
        (self.root / '.git/private-policy.json').write_text(json.dumps({'retiredTerms': ['fixture-retired-name']}))
        self.commit('README.md', 'Fixture', 'Remove fixture-retired-name')
        with self.assertRaisesRegex(RuntimeError, 'historical content'):
            publication.main()

    def test_removed_known_local_secret_is_scanned(self):
        secret = 'fixture-only-' + 'not-a-real-credential'
        self.commit('README.md', secret)
        self.commit('README.md', 'Sanitized')
        (self.root / '.env').write_text('FIXTURE_PASSWORD='+secret)
        with self.assertRaisesRegex(RuntimeError, 'historical content'):
            publication.main()

    def test_token_pattern_is_scanned(self):
        self.commit('README.md', 'gh' + 'p_' + 'X' * 36)
        with self.assertRaisesRegex(RuntimeError, 'historical content'):
            publication.main()


if __name__ == '__main__':
    unittest.main()
