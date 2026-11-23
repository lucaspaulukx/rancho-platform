"""Exercise frontend upgrade and rollback on an owned loopback proxy."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import secrets
import subprocess
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright

from frontend_rollback_browser import check_old_tabs

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'http://localhost:18091'
LABEL = 'community.console.frontend-rollback'
ENTRY = re.compile(rb'src="(/console/assets/index-[A-Za-z0-9_-]+\.js)"')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def docker(*args):
    return subprocess.run(
        ['docker', *args], capture_output=True, text=True, timeout=60, check=True,
    ).stdout.strip()


def image_id(name):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}', name):
        raise ValueError('Invalid local image reference.')
    digest = docker('image', 'inspect', '--format', '{{.Id}}', name)
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', digest):
        raise RuntimeError('Expected one immutable local image.')
    return digest


class ProxyFixture:
    def __init__(self, images):
        self.images = images
        self.owner = secrets.token_hex(12)
        self.name = 'rancho-ui-rollback-' + self.owner
        self.volume = self.name + '-assets'
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        self.entries = {}
        self.config_digest = None

    def owned(self, kind):
        field = '.Config.Labels' if kind == 'container' else '.Labels'
        name = self.name if kind == 'container' else self.volume
        return docker(kind, 'inspect', '--format', '{{index ' + field + ' "' + LABEL + '"}}',
                      name) == self.owner

    def listed(self, kind):
        if kind == 'container':
            output = docker('container', 'ls', '-a', '--filter', 'name=^/' + self.name + '$',
                            '--format', '{{.Names}}')
            return self.name in output.splitlines()
        output = docker('volume', 'ls', '--filter', 'name=^' + self.volume + '$',
                        '--format', '{{.Name}}')
        return self.volume in output.splitlines()

    def remove_proxy(self):
        if self.listed('container'):
            if not self.owned('container'):
                raise RuntimeError('Proxy ownership verification failed.')
            docker('container', 'rm', '--force', self.name)

    def allocate(self):
        if self.listed('container') or self.listed('volume'):
            raise RuntimeError('Fixture identity already exists.')
        docker('volume', 'create', '--label', LABEL + '=' + self.owner, self.volume)
        if not self.owned('volume'):
            raise RuntimeError('Asset volume ownership verification failed.')

    def cleanup(self):
        self.remove_proxy()
        if self.listed('volume'):
            if not self.owned('volume'):
                raise RuntimeError('Asset volume ownership verification failed.')
            docker('volume', 'rm', self.volume)
        return not self.listed('container') and not self.listed('volume')

    def read(self, path):
        with self.opener.open(ORIGIN + path, timeout=3) as response:
            if response.status != 200 or response.url != ORIGIN + path:
                raise RuntimeError('Unexpected static response.')
            data = response.read(1024 * 1024 + 1)
            if len(data) > 1024 * 1024:
                raise RuntimeError('Oversized static response.')
            return data, response.headers.get('Cache-Control', '')

    def switch(self, artifact):
        self.remove_proxy()
        if not self.owned('volume'):
            raise RuntimeError('Asset volume ownership verification failed.')
        config = (ROOT / 'console/public/console-config.json').resolve(strict=True)
        docker(
            'run', '-d', '--pull=never', '--name', self.name, '--label', LABEL + '=' + self.owner,
            '--add-host', 'rancher:127.0.0.1', '-p', '127.0.0.1:18091:8080',
            '-e', 'CONSOLE_ASSET_RETENTION=true',
            '--mount', 'type=volume,source=' + self.volume + ',target=/var/cache/console-runtime',
            '--mount', 'type=bind,source=' + str(config) +
            ',target=/usr/share/nginx/html/console/console-config.json,readonly',
            self.images[artifact],
        )
        if not self.owned('container'):
            raise RuntimeError('Proxy ownership verification failed.')
        actual = docker('container', 'inspect', '--format', '{{.Image}}', self.name)
        if actual != self.images[artifact]:
            raise RuntimeError('Unexpected running image.')
        deadline = time.monotonic() + 20
        while True:
            try:
                html, policy = self.read('/console/')
                break
            except (OSError, urllib.error.URLError):
                if time.monotonic() >= deadline:
                    raise
                time.sleep(.25)
        entry = ENTRY.search(html)
        if entry is None or 'no-cache' not in policy:
            raise RuntimeError('Invalid entry document or cache policy.')
        entry = entry[1].decode('ascii')
        _, asset_policy = self.read(entry)
        config_bytes, config_policy = self.read('/console/console-config.json')
        if 'immutable' not in asset_policy or 'no-store' not in config_policy:
            raise RuntimeError('Unexpected asset or configuration cache policy.')
        digest = hashlib.sha256(config_bytes).hexdigest()
        if self.config_digest is not None and digest != self.config_digest:
            raise RuntimeError('Configuration changed during the trial.')
        self.config_digest = digest
        if artifact in self.entries and entry != self.entries[artifact]:
            raise RuntimeError('Entry changed for the same image.')
        if entry in self.entries.values() and artifact not in self.entries:
            raise RuntimeError('Trial requires distinct frontend entry assets.')
        self.entries[artifact] = entry
        return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous-image', required=True)
    parser.add_argument('--candidate-image', required=True)
    parser.add_argument('--chromium-executable')
    args = parser.parse_args()
    result = {'status': 'failed', 'stage': 'image preflight', 'cleanupComplete': False}
    fixture = None
    try:
        images = {
            'previous': image_id(args.previous_image),
            'candidate': image_id(args.candidate_image),
        }
        if images['previous'] == images['candidate']:
            raise ValueError('Trial requires distinct frontend images.')
        result['images'] = images
        fixture = ProxyFixture(images)
        result['stage'] = 'owned proxy allocation'
        fixture.allocate()
        fixture.switch('previous')
        result['stage'] = 'browser upgrade and rollback'
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, executable_path=args.chromium_executable,
            )
            try:
                result['browser'] = check_old_tabs(browser, fixture.switch)
            finally:
                browser.close()
        result['entries'] = fixture.entries
        result['configurationSha256'] = fixture.config_digest
        result['stage'] = 'measured'
        result['status'] = 'passed'
    except Exception as error:
        result['errorType'] = type(error).__name__
        trace = error.__traceback__
        while trace.tb_next:
            trace = trace.tb_next
        result['errorLocation'] = {
            'file': Path(trace.tb_frame.f_code.co_filename).name, 'line': trace.tb_lineno,
        }
    finally:
        if fixture:
            try:
                result['cleanupComplete'] = fixture.cleanup()
            except Exception as error:
                result['cleanupErrorType'] = type(error).__name__
        if not result['cleanupComplete']:
            result['status'] = 'failed'
        print(json.dumps(result, indent=2))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
