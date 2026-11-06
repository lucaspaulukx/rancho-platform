"""Translation freshness and structural gates in an isolated document tree."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('languages', Path(__file__).resolve().parents[1] / 'scripts/docs_languages.py')
languages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(languages)


class LanguageChecks(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='rancho-doc-language-test-')
        self.root = Path(self.directory.name)
        self.original = languages.ROOT
        languages.ROOT = self.root
        self.source = 'docs/plan.md'
        self.target = 'docs/en/plan.md'
        self.write(self.source, '# Plano\n\n[English](en/plan.md)\n\n## Executar\n\nDescrição do procedimento.\n\n```sh\npython scripts/check_repository.py\n```\n')
        self.write(self.target, '# Plan\n\n[Português](../plan.md)\n\n## Run\n\nProcedure description.\n\n```sh\npython scripts/check_repository.py\n```\n')
        self.data = {'version': 1, 'shared': {}, 'documents': [{'source': self.source, 'sourceLanguage': 'pt-BR',
                     'paths': {'pt-BR': self.source, 'en': self.target}, 'reviewedSourceSha256': None, 'reviewedTranslationSha256': None}]}
        languages.save(self.data)

    def tearDown(self):
        languages.ROOT = self.original
        self.directory.cleanup()

    def write(self, name, text):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding='utf-8')

    def test_reviewed_pair_is_complete(self):
        languages.review(self.data, [self.source])
        report = languages.audit(languages.load(), {self.source, self.target})
        self.assertEqual((report['complete'], report['errors'], report['pending']), (1, [], []))

    def test_missing_translation_is_explicit_and_blocks_complete_gate(self):
        (self.root / self.target).unlink()
        with patch.object(languages, 'inventory', return_value={self.source}), patch('sys.argv', ['docs_languages.py', '--require-complete']), contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(languages.main(), 1)
        self.assertEqual(json.loads(out.getvalue())['pending'][0]['reason'], 'missing-translation')

    def test_source_and_translation_edits_invalidate_review(self):
        languages.review(self.data, [self.source])
        for name in (self.source, self.target):
            file = self.root / name
            before = file.read_text(encoding='utf-8')
            file.write_text(before+'\nAdditional information.\n', encoding='utf-8')
            self.assertEqual(languages.audit(self.data, {self.source, self.target})['errors'][0]['reason'], 'changed-after-review')
            file.write_text(before, encoding='utf-8')

    def test_translated_commands_cannot_be_changed(self):
        file = self.root / self.target
        file.write_text(file.read_text(encoding='utf-8').replace('check_repository.py', 'different_command.py'), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'code blocks'):
            languages.review(self.data, [self.source])
        self.assertIsNone(languages.load()['documents'][0]['reviewedSourceSha256'])

    def test_missing_section_and_reciprocal_link_are_detected(self):
        file = self.root / self.target
        original = file.read_text(encoding='utf-8')
        for broken, reason in [(original.replace('## Run\n', ''), 'hierarchy'), (original.replace('../plan.md', '../missing.md'), 'reciprocal')]:
            file.write_text(broken, encoding='utf-8')
            with self.assertRaisesRegex(ValueError, reason):
                languages.review(self.data, [self.source])

    def test_unregistered_document_cannot_disappear_from_coverage(self):
        report = languages.audit(self.data, {self.source, self.target, 'forgotten.md'})
        self.assertIn({'source': 'forgotten.md', 'reason': 'document-not-in-manifest'}, report['errors'])

    def test_path_traversal_and_duplicate_destinations_are_rejected(self):
        for name in ('../outside.md', '/outside.md', 'C:/outside.md', '.git/private.md'):
            with self.assertRaises(ValueError):
                languages.path(name)
        other = {'source': 'other.md', 'sourceLanguage': 'pt-BR', 'paths': {'pt-BR': 'other.md', 'en': self.target}}
        self.data['documents'].append(other)
        languages.save(self.data)
        with self.assertRaisesRegex(ValueError, 'share'):
            languages.load()

    def test_catalog_does_not_offer_a_missing_translation_link(self):
        (self.root / self.target).unlink()
        with patch.object(languages, 'inventory', return_value={self.source}):
            catalog = languages.catalog(self.data, 'en')
        self.assertIn('Pending', catalog)
        self.assertNotIn('[Open](plan.md)', catalog)

    def test_navigation_preserves_manual_selectors_and_commands(self):
        before = {name: (self.root / name).read_bytes() for name in (self.source, self.target)}
        languages.navigation(self.data)
        for name, content in before.items():
            self.assertEqual((self.root / name).read_bytes(), content)

    def test_pending_navigation_is_replaced_when_translation_arrives(self):
        file = self.root / self.target
        translated = file.read_text(encoding='utf-8')
        file.unlink()
        source_file = self.root / self.source
        source_file.write_text(source_file.read_text(encoding='utf-8').replace('[English](en/plan.md)\n', ''), encoding='utf-8')
        languages.navigation(self.data)
        source = (self.root / self.source).read_text(encoding='utf-8')
        self.assertIn('English — translation pending', source)
        self.assertNotIn('[English](en/plan.md)', source)
        file.write_text(translated, encoding='utf-8')
        languages.navigation(self.data)
        updated = (self.root / self.source).read_text(encoding='utf-8')
        self.assertNotIn('translation pending', updated)
        self.assertIn('[English](en/plan.md)', updated)
        self.assertEqual(languages.blocks_and_headings(source), languages.blocks_and_headings(updated))

    def test_navigation_never_enters_a_code_fence(self):
        text = '```sh\n# a command comment\necho fixture\n```\n\nPlain document.\n'
        self.write(self.source, text)
        (self.root / self.target).unlink()
        languages.navigation(self.data)
        updated = (self.root / self.source).read_text(encoding='utf-8')
        self.assertEqual(languages.blocks_and_headings(text), languages.blocks_and_headings(updated))

    def test_broken_manual_selector_requires_repair(self):
        (self.root / self.target).unlink()
        with self.assertRaisesRegex(ValueError, 'missing translation'):
            languages.navigation(self.data)

    def test_navigation_preserves_crlf_body_and_is_idempotent(self):
        original = b'# Plan\r\n\r\n```sh\r\necho fixture\r\n```\r\n'
        (self.root / self.source).write_bytes(original)
        (self.root / self.target).unlink()
        languages.navigation(self.data)
        updated = (self.root / self.source).read_bytes()
        self.assertTrue(updated.endswith(b'```sh\r\necho fixture\r\n```\r\n'))
        languages.navigation(self.data)
        self.assertEqual((self.root / self.source).read_bytes(), updated)

    def test_broken_body_links_block_review_but_code_examples_are_literal(self):
        file = self.root / self.target
        original = file.read_text(encoding='utf-8')
        file.write_text(original+'\n[Missing](missing.md)\n', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'local links'):
            languages.review(self.data, [self.source])
        file.write_text(original+'\n```markdown\n[Example](missing.md)\n```\n', encoding='utf-8')
        self.assertEqual(languages.local_link_errors(self.target), [])

    def test_catalog_freshness_detects_missing_or_edited_portal(self):
        with patch.object(languages, 'inventory', return_value={self.source, self.target}):
            self.assertEqual(len(languages.catalog_errors(self.data)), 2)
            for locale, name in languages.PORTALS.items():
                self.write(name, languages.catalog(self.data, locale))
            self.assertEqual(languages.catalog_errors(self.data), [])
            self.write(languages.PORTALS['en'], '# Obsolete catalog\n')
            self.assertEqual(languages.catalog_errors(self.data)[0]['source'], languages.PORTALS['en'])

    def test_translated_roadmap_cannot_drop_a_task(self):
        for name, row in [(self.source, '| UX01 | Tarefa |\n'), (self.target, '| UX02 | Task |\n')]:
            file = self.root / name
            file.write_text(file.read_text(encoding='utf-8')+'\n'+row, encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'task IDs'):
            languages.review(self.data, [self.source])

    def test_line_endings_do_not_create_a_false_stale_translation(self):
        languages.review(self.data, [self.source])
        file = self.root / self.source
        file.write_bytes(file.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
        self.assertEqual(languages.audit(self.data, {self.source, self.target})['errors'], [])

    def test_alphanumeric_task_prefixes_cannot_be_dropped_or_renumbered(self):
        originals = {name: (self.root / name).read_text(encoding='utf-8') for name in (self.source, self.target)}
        for target_row in ('', '| I18N02 | Task |\n'):
            with self.subTest(target_row=target_row):
                self.write(self.source, originals[self.source]+'\n| I18N01 | Tarefa |\n')
                self.write(self.target, originals[self.target]+'\n'+target_row)
                with self.assertRaisesRegex(ValueError, 'task IDs'):
                    languages.review(self.data, [self.source])
        self.write(self.target, originals[self.target]+'\n| I18N01 | Task |\n')
        languages.review(self.data, [self.source])
        self.assertEqual(languages.audit(self.data, {self.source, self.target})['errors'], [])


if __name__ == '__main__':
    unittest.main()
