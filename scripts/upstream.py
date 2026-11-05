"""Reproduce/export local backend changes without vendoring upstream Git histories."""
import argparse
import difflib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def git(folder, *args, check=True):
    result = subprocess.run(['git', '-C', str(folder), *args], capture_output=True, check=False)
    if check and result.returncode:
        raise RuntimeError('Git operation failed; inspect the checkout locally.')
    return result


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
            content = git(folder, 'diff', '--binary', '--no-ext-diff', 'HEAD').stdout
            for item in git(folder, 'ls-files', '--others', '--exclude-standard', '-z').stdout.decode().split('\0'):
                if not item:
                    continue
                source = folder / item
                if source.suffix not in {'.java', '.json', '.properties', '.xml'}:
                    raise RuntimeError('Unexpected untracked file; review upstream checkout before export.')
                lines = source.read_text(encoding='utf-8').splitlines(keepends=True)
                content += f'diff --git a/{item} b/{item}\nnew file mode 100644\n'.encode()
                diff = ''.join(difflib.unified_diff([], lines, fromfile='/dev/null', tofile='b/' + item))
                if diff and not diff.endswith('\n'):
                    diff += '\n\\ No newline at end of file\n'
                content += diff.encode()
            patch.parent.mkdir(exist_ok=True)
            patch.write_bytes(content)
        elif args.action == 'check':
            git(folder, 'apply', '--reverse', '--check', str(patch))
        elif git(folder, 'apply', '--reverse', '--check', str(patch), check=False).returncode == 0:
            pass  # Already applied; do not reset or discard the checkout.
        else:
            git(folder, 'apply', '--check', str(patch))
            git(folder, 'apply', str(patch))
        print(f'PASS: {name} {args.action} at pinned upstream')


if __name__ == '__main__':
    main()
