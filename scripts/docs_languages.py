"""Track full pt-BR/English document pairs without claiming translation quality automatically."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'docs/translations.json'
PORTALS = {'pt-BR': 'docs/pt-BR/README.md', 'en': 'docs/en/README.md'}
SHARED = {
    'AGENTS.md': 'Bilingual canonical contributor instructions in one file.',
    'docs/README.md': 'Bilingual documentation language selector.',
    'CLAUDE.md': 'Bilingual adapter to the canonical instructions.',
    'GEMINI.md': 'Bilingual adapter to the canonical instructions.',
    '.github/copilot-instructions.md': 'Bilingual adapter to the canonical instructions.',
    '.github/PULL_REQUEST_TEMPLATE.md': 'Bilingual PR template in one file.',
    '.agents/skills/rancho-contribute/SKILL.md': 'Bilingual repository skill in one file.',
    '.cursor/rules/rancho.mdc': 'Bilingual Cursor adapter to the canonical instructions.',
}
ENGLISH = {'README.md': 'docs/pt-BR/overview.md',
           'CONTRIBUTING.md': 'docs/pt-BR/contributing.md',
           'SECURITY.md': 'docs/pt-BR/security.md',
           'console/README.md': 'docs/pt-BR/console.md'}


def path(name):
    if not isinstance(name, str) or '\\' in name:
        raise ValueError('Use repository-relative POSIX paths.')
    value = PurePosixPath(name)
    if value.is_absolute() or ':' in name or '..' in value.parts or not name.endswith(('.md', '.mdc')) or '.git' in value.parts:
        raise ValueError('Invalid documentation path.')
    resolved = (ROOT / name).resolve()
    if not resolved.is_relative_to(ROOT.resolve()):
        raise ValueError('Documentation path escapes the checkout.')
    return resolved


def digest(name):
    return hashlib.sha256(path(name).read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def inventory():
    raw = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'], cwd=ROOT)
    return set(filter(None, raw.decode('utf-8').split('\0')))


def load():
    data = json.loads((ROOT / MANIFEST).read_text(encoding='utf-8'))
    if data.get('version') != 1 or not isinstance(data.get('documents'), list) or not isinstance(data.get('shared'), dict):
        raise ValueError('Unsupported translation manifest.')
    seen, owned = set(), set()
    for entry in data['documents']:
        source = entry['source']
        if source in seen or entry['sourceLanguage'] not in PORTALS or set(entry['paths']) != set(PORTALS):
            raise ValueError('Duplicate or invalid document pair.')
        seen.add(source)
        for name in entry['paths'].values():
            path(name)
            if name in owned or name in PORTALS.values():
                raise ValueError('Document pairs cannot share or overwrite portal paths.')
            owned.add(name)
        if entry['paths'][entry['sourceLanguage']] != source or len(set(entry['paths'].values())) != 2:
            raise ValueError('Canonical language does not match source path.')
    for name in data['shared']:
        path(name)
        if name in owned:
            raise ValueError('A shared document cannot also be a translation pair.')
    return data


def save(data):
    (ROOT / MANIFEST).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def scan():
    data = load() if (ROOT / MANIFEST).exists() else {'version': 1, 'documents': [], 'shared': SHARED}
    data['shared'].update(SHARED)
    known = {name for entry in data['documents'] for name in entry['paths'].values()} | set(data['shared']) | set(PORTALS.values())
    for name in sorted(inventory() - known):
        if name in known:
            continue
        if name.startswith(('docs/en/', 'docs/pt-BR/')):
            raise ValueError('Register localized documents as explicit source/translation pairs first.')
        language = 'en' if name in ENGLISH else 'pt-BR'
        other = ENGLISH[name] if language == 'en' else 'docs/en/catalog.md' if name == 'docs/README.md' else 'docs/en/' + name.removeprefix('docs/')
        data['documents'].append({'source': name, 'sourceLanguage': language,
                                  'paths': {language: name, ('pt-BR' if language == 'en' else 'en'): other},
                                  'reviewedSourceSha256': None, 'reviewedTranslationSha256': None})
        known.update((name, other))
    data['documents'].sort(key=lambda entry: entry['source'])
    save(data)
    return data


def blocks_and_headings(text):
    blocks, headings, current = [], [], None
    marker = None
    for line in text.splitlines():
        fence = re.match(r'^\s*(`{3,}|~{3,})(.*)$', line)
        if current is not None:
            if fence and fence[1][0] == marker[0] and len(fence[1]) >= len(marker) and not fence[2].strip():
                blocks.append('\n'.join(current))
                current, marker = None, None
            else:
                current.append(line)
        elif fence:
            current, marker = [], fence[1]
        else:
            heading = re.match(r'^(#{1,6})\s+', line)
            if heading:
                headings.append(len(heading[1]))
    if current is not None:
        raise ValueError('Unclosed code fence in documentation.')
    return blocks, headings


def links_to(origin, target, text):
    expected = path(target)
    for value in re.findall(r'\[[^\]\n]*\]\(([^\s)]+)\)', text):
        url = urlsplit(value.strip('<>'))
        if not url.scheme and not url.netloc and url.path:
            candidate = (path(origin).parent / unquote(url.path)).resolve()
            if candidate == expected:
                return True
    return False


def navigation(data):
    owned = re.compile(r'<!-- rancho-language-navigation:start -->.*?<!-- rancho-language-navigation:end -->\r?\n?', re.S)
    for entry in data['documents']:
        for name in entry['paths'].values():
            if not path(name).is_file():
                continue
            raw = path(name).read_bytes()
            text = raw.decode('utf-8')
            newline = '\r\n' if b'\r\n' in raw else '\n'
            other = next(value for value in entry['paths'].values() if value != name)
            if not owned.search(text) and links_to(name, other, text):
                if not path(other).is_file():
                    raise ValueError('Manual language selector points to a missing translation.')
                continue  # Preserve a manually authored language selector.
            items = []
            for language in ('pt-BR', 'en'):
                destination = entry['paths'][language]
                label = 'Português (Brasil)' if language == 'pt-BR' else 'English'
                relative = Path(os.path.relpath(path(destination), path(name).parent)).as_posix()
                items.append(f'[{label}]({relative})' if path(destination).is_file() else
                             label + (' — tradução pendente' if language == 'pt-BR' else ' — translation pending'))
            block = '<!-- rancho-language-navigation:start -->\n' + ' | '.join(items) + '\n<!-- rancho-language-navigation:end -->\n'
            block = block.replace('\n', newline)
            if owned.search(text):
                text = owned.sub(lambda _: block, text, count=1)
            else:
                lines, fence, after = text.splitlines(keepends=True), None, 0
                for index, line in enumerate(lines):
                    marker = re.match(r'^\s*(`{3,}|~{3,})(.*)$', line)
                    if marker:
                        if fence is None:
                            fence = marker[1]
                        elif marker[1][0] == fence[0] and len(marker[1]) >= len(fence) and not marker[2].strip():
                            fence = None
                    elif fence is None and re.match(r'^#{1,6}\s+', line.lstrip('\ufeff')):
                        after = index + 1
                        break
                text = ''.join(lines[:after]) + newline + block + newline + ''.join(lines[after:])
            path(name).write_bytes(text.encode('utf-8'))


def pair_structure(entry):
    source = entry['source']
    target = next(name for name in entry['paths'].values() if name != source)
    a, b = path(source).read_text(encoding='utf-8'), path(target).read_text(encoding='utf-8')
    source_blocks, source_headings = blocks_and_headings(a)
    target_blocks, target_headings = blocks_and_headings(b)
    if source_blocks != target_blocks:
        raise ValueError('Translated code blocks differ from the canonical commands/evidence.')
    if source_headings != target_headings:
        raise ValueError('Translated heading hierarchy differs from the source.')
    if re.findall(r'^\|\s*([A-Z][A-Z0-9]*[0-9]{2})\s*\|', a, re.M) != re.findall(r'^\|\s*([A-Z][A-Z0-9]*[0-9]{2})\s*\|', b, re.M):
        raise ValueError('Translated roadmap task IDs differ from the source.')
    if not links_to(source, target, a) or not links_to(target, source, b):
        raise ValueError('Language navigation is not reciprocal.')
    if a == b or (len(a.split()) > 100 and len(b.split()) < len(a.split()) * .6):
        raise ValueError('Translation is identical to the source or suspiciously abridged; review it.')
    return target


def local_link_errors(name):
    errors, fence = [], None
    for line_number, line in enumerate(path(name).read_text(encoding='utf-8').splitlines(), 1):
        marker = re.match(r'^\s*(`{3,}|~{3,})(.*)$', line)
        if marker:
            if fence is None:
                fence = marker[1]
            elif marker[1][0] == fence[0] and len(marker[1]) >= len(fence) and not marker[2].strip():
                fence = None
            continue
        if fence is not None:
            continue
        for value in re.findall(r'\[[^\]\n]*\]\(([^\s)]+)\)', line):
            url = urlsplit(value.strip('<>'))
            if url.scheme or url.netloc or not url.path:
                continue
            decoded = unquote(url.path)
            target = ((ROOT / decoded.lstrip('/')) if decoded.startswith('/') else path(name).parent / decoded).resolve()
            if not target.is_relative_to(ROOT.resolve()) or not target.exists():
                errors.append({'source': name, 'line': line_number, 'reason': 'broken-or-external-local-link'})
    return errors


def review(data, sources):
    by_source = {entry['source']: entry for entry in data['documents']}
    for source in sources:
        entry = by_source[source]
        target = pair_structure(entry)
        if local_link_errors(source) or local_link_errors(target):
            raise ValueError('Repair local links before recording translation review.')
        entry['reviewedSourceSha256'] = digest(source)
        entry['reviewedTranslationSha256'] = digest(target)
    save(data)


def audit(data, names=None):
    errors, complete, pending = [], [], []
    managed = set(data['shared']) | set(PORTALS.values())
    for entry in data['documents']:
        source = entry['source']
        managed.update(entry['paths'].values())
        target = next(name for name in entry['paths'].values() if name != source)
        if not path(source).is_file():
            errors.append({'source': source, 'reason': 'missing-source'})
        elif not path(target).is_file():
            pending.append({'source': source, 'reason': 'missing-translation'})
        else:
            try:
                pair_structure(entry)
                if not entry.get('reviewedSourceSha256') or not entry.get('reviewedTranslationSha256'):
                    pending.append({'source': source, 'reason': 'review-not-recorded'})
                elif digest(source) != entry['reviewedSourceSha256'] or digest(target) != entry['reviewedTranslationSha256']:
                    errors.append({'source': source, 'reason': 'changed-after-review'})
                else:
                    complete.append(source)
                errors.extend(local_link_errors(source))
                errors.extend(local_link_errors(target))
            except ValueError as error:
                errors.append({'source': source, 'reason': str(error)})
    for name in data['shared']:
        if not path(name).is_file():
            errors.append({'source': name, 'reason': 'missing-shared-document'})
        else:
            errors.extend(local_link_errors(name))
    for name in sorted((inventory() if names is None else names) - managed):
        errors.append({'source': name, 'reason': 'document-not-in-manifest'})
    return {'complete': len(complete), 'totalPairs': len(data['documents']),
            'sharedBilingualFiles': len(data['shared']), 'pending': pending, 'errors': errors}


def catalog(data, language):
    portuguese = language == 'pt-BR'
    title = '# Documentação do Rancho Platform' if portuguese else '# Rancho Platform documentation'
    intro = ('Escolha o idioma de cada documento. Traduções pendentes são indicadas; não representam documentação integral em inglês.' if portuguese
             else 'Choose a language for each document. Pending translations are explicit; this is not yet complete English documentation.')
    root = path(PORTALS[language]).parent
    report = audit(data)
    lines = [title, '', '[Português (Brasil)](../pt-BR/README.md) | [English](../en/README.md)', '', intro, '',
             (f"Pares revisados: {report['complete']}/{report['totalPairs']}. Arquivos de instrução/template bilingues: {report['sharedBilingualFiles']}." if portuguese
              else f"Reviewed pairs: {report['complete']}/{report['totalPairs']}. Bilingual instruction/template files: {report['sharedBilingualFiles']}."), '',
             '| Documento | Português (Brasil) | English |' if portuguese else '| Document | Português (Brasil) | English |',
             '|---|---|---|']
    for entry in data['documents']:
        cells = []
        for code in ('pt-BR', 'en'):
            name = entry['paths'][code]
            relative = Path(os.path.relpath(path(name), root)).as_posix()
            cells.append(f'[Abrir]({relative})' if path(name).is_file() and code == 'pt-BR' else
                         f'[Open]({relative})' if path(name).is_file() else 'Pendente' if portuguese else 'Pending')
        localized = path(entry['paths'][language])
        title = re.search(r'^#\s+(.+)$', localized.read_text(encoding='utf-8'), re.M) if localized.is_file() else None
        label = title[1].replace('|', '\\|') if title else entry['source']
        lines.append(f"| {label} | {cells[0]} | {cells[1]} |")
    return '\n'.join(lines) + '\n'


def catalog_errors(data):
    return [{'source': name, 'reason': 'missing-or-stale-language-catalog'}
            for language, name in PORTALS.items()
            if not path(name).is_file() or path(name).read_text(encoding='utf-8') != catalog(data, language)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scan', action='store_true')
    parser.add_argument('--review', nargs='+', metavar='SOURCE')
    parser.add_argument('--catalogs', action='store_true')
    parser.add_argument('--navigation', action='store_true')
    parser.add_argument('--require-complete', action='store_true')
    args = parser.parse_args()
    data = scan() if args.scan else load()
    if args.navigation:
        navigation(data)
    if args.review:
        review(data, args.review)
    if args.catalogs:
        for language, name in PORTALS.items():
            path(name).parent.mkdir(parents=True, exist_ok=True)
            path(name).write_text(catalog(data, language), encoding='utf-8', newline='\n')
    report = audit(data)
    report['errors'].extend(catalog_errors(data))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report['errors'] or (args.require_complete and report['pending']) else 0


if __name__ == '__main__':
    raise SystemExit(main())
