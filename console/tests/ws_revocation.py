"""Measure revocation of ONE own admin session; no grants or existing accounts modified."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import queue
import secrets
import subprocess
import threading
import time
import traceback
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lab', ROOT / 'tests/integration.py')
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
lab.BASE = 'http://localhost:18080'
MANIFEST = ROOT / 'console/ws-revocation-fixture.json'
REPORT = ROOT / 'console/ws-revocation-results.json'


def session():
    value = lab.Session()
    value.opener = lab.loopback_opener(value.cookies)
    value.login('labadmin', lab.CONFIG['RANCHER_ADMIN_PASSWORD'])
    return value


def main(*, identity_factory=None):
    assert not MANIFEST.exists(), 'Recover the owned prior fixture before repeating.'
    control = session()
    try:
        identity = identity_factory(control) if identity_factory else None
    except Exception:
        control.request('/v2-beta/token/current', None, 'DELETE')
        raise
    watched = identity['session'] if identity else session()
    base = 'projects/1a12/'
    name = 'console-stream-' + secrets.token_hex(6)
    stack = None
    process = None
    result = {'scope': identity['scope'] if identity else 'own admin opaque-cookie project subscribe only; not logs/exec or group revocation',
              'status': 'failed', 'preexistingStacksPreserved': False, 'cleanupComplete': False}
    before = {s['id']: hashlib.sha256(json.dumps({k: s.get(k) for k in ('name', 'description', 'state')}, sort_keys=True).encode()).hexdigest()
              for s in control.api(base + 'stacks?limit=-1')['data'] if not s.get('removed')}
    events = queue.Queue()

    def wait_for(kind, timeout=12):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            try:
                item = events.get(timeout=max(.01, until - time.monotonic()))
            except queue.Empty:
                break
            if item.get('type') == kind:
                return item
            if item.get('type') in ('probe-error', 'socket-error'):
                raise AssertionError('Probe transport failed; diagnostics withheld.')
        raise AssertionError('Expected sanitized probe event did not arrive: ' + kind)

    def command(value):
        process.stdin.write(json.dumps(value) + '\n')
        process.stdin.flush()

    try:
        stack = control.api(base + 'stacks', {'name': name, 'description': name})
        MANIFEST.write_text(json.dumps({'name': name, 'stack': stack['id'], 'environment': '1a12', 'baselineStacks': before}), encoding='utf-8')
        for _ in range(50):
            stack = control.api(base + 'stacks/' + stack['id'])
            if stack['state'] == 'active': break
            time.sleep(.2)
        assert stack['state'] == 'active'
        token = next(c.value for c in watched.cookies if c.name == 'token')
        runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
        process = subprocess.Popen([str(runtime / 'bin/node.exe'), str(ROOT / 'console/tests/ws-revocation.cjs')],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                   text=True, encoding='utf-8', env=dict(os.environ, DEBUG='', NODE_DEBUG=''))
        def reader():
            for line in process.stdout:
                try: events.put(json.loads(line))
                except ValueError: events.put({'type': 'probe-error'})
        threading.Thread(target=reader, daemon=True).start()
        command({'url': 'ws://localhost:18080/v2-beta/projects/1a12/subscribe?eventNames=resource.change',
                 'token': token, 'runtimeModules': str(runtime / 'node_modules'), 'stack': stack['id'], 'marker': name})
        result['handshake'] = wait_for('ready')['handshake']
        control.api(base + 'stacks/' + stack['id'], {'description': name + '-before'}, method='PUT')
        wait_for('before')
        result['ownMetadataEventReceivedBeforeRevocation'] = True
        if identity:
            identity['invalidate']()
        else:
            assert watched.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
        protected = identity.get('protected', '/v2-beta/projects') if identity else '/v2-beta/projects'
        result['newProtectedRequestStatus'] = watched.request(protected)[0]
        command({'command': 'new-handshake'})
        result['newHandshakeStatus'] = wait_for('new-handshake', 8)['status']
        command({'command': 'watch-after'})
        wait_for('watching-after')
        # Allow a bounded enforcement window before publishing the second own update.
        time.sleep(6)
        control.api(base + 'stacks/' + stack['id'], {'description': name + '-after'}, method='PUT')
        time.sleep(7)
        command({'command': 'finish'})
        measured = wait_for('result', 5)
        result.update({k: v for k, v in measured.items() if k != 'type'})
        result['revocationEnforced'] = result['newProtectedRequestStatus'] in (401, 403, 404) and result['newHandshakeStatus'] in (401, 403, 404) and measured['closed'] and measured['after'] == 0
        result['status'] = 'passed' if result['revocationEnforced'] else 'failed'
    except Exception as error:
        result['errorType'] = type(error).__name__
    finally:
        if process:
            if process.poll() is None:
                try: command({'command': 'finish'}); process.wait(timeout=5)
                except Exception: process.kill(); process.wait()
        try:
            if stack:
                current = control.api(base + 'stacks/' + stack['id'])
                assert current['name'] == name and current['accountId'] == '1a12' and current['description'].startswith(name)
                if not current.get('removed'):
                    target = urllib.parse.urlparse(current['actions']['remove'])
                    assert target.netloc == 'localhost:18080' and target.path.rstrip('/') == '/v2-beta/' + base + 'stacks/' + stack['id'] and target.query == 'action=remove'
                    assert control.request(current['actions']['remove'], {}, 'POST')[0] in (200, 201, 202, 204)
                for _ in range(180):
                    if control.api(base + 'stacks/' + stack['id']).get('removed'): break
                    time.sleep(1)
                assert control.api(base + 'stacks/' + stack['id']).get('removed')
            after = {s['id']: hashlib.sha256(json.dumps({k: s.get(k) for k in ('name', 'description', 'state')}, sort_keys=True).encode()).hexdigest()
                     for s in control.api(base + 'stacks?limit=-1')['data'] if not s.get('removed')}
            result['preexistingStacksPreserved'] = before == after
            result['cleanupComplete'] = before == after
        except Exception as cleanup_error:
            result['status'] = 'failed'
            result['cleanupErrorType'] = type(cleanup_error).__name__
        finally:
            if identity:
                try: identity['prepare_cleanup']()
                except Exception: result['identityRecoveryError'] = True; result['status'] = 'failed'
            try:
                if watched.request('/v2-beta/projects')[0] != 401:
                    watched.request('/v2-beta/token/current', None, 'DELETE')
                result['watchedSessionRevoked'] = watched.request('/v2-beta/projects')[0] == 401
            except Exception:
                result['watchedSessionRevoked'] = False
            if identity:
                try:
                    identity['cleanup']()
                    result['identityFixtureCleaned'] = True
                except Exception as identity_error:
                    result['identityCleanupErrorType'] = type(identity_error).__name__
                    result['identityCleanupLocations'] = [{'file': Path(f.filename).name, 'line': f.lineno} for f in traceback.extract_tb(identity_error.__traceback__)]
                    result['identityFixtureCleaned'] = False
                    result['status'] = 'failed'
            try:
                result['controlSessionRevoked'] = control.request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
            except Exception:
                result['controlSessionRevoked'] = False
        if result['cleanupComplete']: MANIFEST.unlink(missing_ok=True)
        REPORT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))
    return 0 if result['status'] == 'passed' and result['cleanupComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
