"""Reproduce/export local backend changes without vendoring upstream Git histories."""
import argparse
import difflib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def git(folder, *args, check=True):
    # Cattle includes deep Java packages; default Git-for-Windows limits can
    # silently leave a nested checkout incomplete. Apply consistently per call.
    result = subprocess.run(['git', '-c', 'core.longpaths=true', '-C', str(folder), *args], capture_output=True, check=False)
    if check and result.returncode:
        raise RuntimeError('Git operation failed; inspect the checkout locally.')
    return result


def export_patch(folder):
    content = git(folder, 'diff', '--binary', '--no-ext-diff', 'HEAD').stdout
    for item in git(folder, 'ls-files', '--others', '--exclude-standard', '-z').stdout.decode().split('\0'):
        if not item:
            continue
        source = folder / item
        if source.suffix not in {'.java', '.json', '.properties', '.xml', '.go'}:
            raise RuntimeError('Unexpected untracked file; review upstream checkout before export.')
        lines = source.read_text(encoding='utf-8').splitlines(keepends=True)
        content += f'diff --git a/{item} b/{item}\nnew file mode 100644\n'.encode()
        diff = ''.join(difflib.unified_diff([], lines, fromfile='/dev/null', tofile='b/' + item))
        if diff and not diff.endswith('\n'):
            diff += '\n\\ No newline at end of file\n'
        content += diff.encode()
    return content


def normalize_index_abbreviations(patch):
    # Git lengthens abbreviated object IDs as the upstream repository grows.
    # Keep full IDs for binary patches, whose application depends on them.
    return re.sub(
        rb'(?m)^index ([0-9a-f]{7})[0-9a-f]{0,32}\.\.([0-9a-f]{7})[0-9a-f]{0,32}(?= [0-7]{6}$)',
        rb'index \1..\2',
        patch,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['apply', 'export', 'check'])
    args = parser.parse_args()
    sources = json.loads((ROOT / 'upstream.json').read_text(encoding='utf-8'))
    for name, spec in sources.items():
        folder = ROOT / name
        patch = ROOT / spec['patch']
        if not folder.exists():
            if args.action != 'apply':
                raise RuntimeError('Run apply to obtain the pinned upstream first.')
            result = subprocess.run(['git', 'clone', '--no-checkout', spec['url'], str(folder)], capture_output=True)
            if result.returncode:
                raise RuntimeError('Unable to clone public upstream.')
            git(folder, 'checkout', '--detach', spec['commit'])
        if git(folder, 'rev-parse', 'HEAD').stdout.decode().strip() != spec['commit']:
            raise RuntimeError('Upstream HEAD differs from the pinned commit; refusing to continue.')
        if args.action == 'export':
            patch.parent.mkdir(exist_ok=True)
            patch.write_bytes(export_patch(folder))
        elif args.action == 'check':
            git(folder, 'apply', '--reverse', '--check', str(patch))
            actual = normalize_index_abbreviations(export_patch(folder))
            expected = normalize_index_abbreviations(patch.read_bytes())
            if actual != expected:
                raise RuntimeError('Backend checkout contains changes missing from the patch; run export before committing.')
        elif git(folder, 'apply', '--reverse', '--check', str(patch), check=False).returncode == 0:
            pass  # Already applied; do not reset or discard the checkout.
        else:
            git(folder, 'apply', '--check', str(patch))
            git(folder, 'apply', str(patch))
        print(f'PASS: {name} {args.action} at pinned upstream')


if __name__ == '__main__':
    main()
