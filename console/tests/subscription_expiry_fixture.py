"""Issue one short real local token; restore exact expiry before opening/waiting on a stream."""
import json
from pathlib import Path
import time
import sys

from subscription_identity_fixture import identity_factory
import ws_revocation as probe

STATE = probe.ROOT / 'console/subscription-expiry-fixture.json'


def short_session(admin, issue):
    assert not STATE.exists(), 'Recover the prior owned expiry override first.'
    path = 'settings/api.auth.jwt.token.expiry'
    before = admin.api(path)
    assert before['name'] == 'api.auth.jwt.token.expiry' and int(before['activeValue']) >= 120000
    original = {k: before.get(k) for k in ('name', 'value', 'activeValue', 'inDb')}
    STATE.write_text(json.dumps(original, indent=2), encoding='utf-8')
    def wait(predicate):
        for _ in range(60):
            current = admin.api(path)
            if predicate(current): return current
            time.sleep(.25)
        raise AssertionError('Own expiry setting did not converge.')
    try:
        admin.api(path, {'name': before['name'], 'value': '45000'}, method='PUT')
        wait(lambda v: str(v.get('activeValue')) == '45000')
        watched = issue()
        assert watched.request('/v2-beta/projects')[0] == 200
        return watched
    finally:
        current = admin.api(path)
        if current.get('inDb') and str(current.get('value')) == '45000':
            if original['inDb']:
                admin.api(path, {'name': before['name'], 'value': original['value']}, method='PUT')
            else:
                admin.api(path, method='DELETE')
        else:
            assert all(current.get(k) == original[k] for k in ('value', 'inDb')), 'Concurrent setting change; do not overwrite.'
        wait(lambda v: all(v.get(k) == original[k] for k in ('value', 'activeValue', 'inDb')))
        STATE.unlink()


def expiry_factory(admin, *, oidc=False):
    context = identity_factory('grant', oidc=oidc)(admin)
    try:
        assert context['session'].request('/v2-beta/token/current', None, 'DELETE')[0] in (200, 204)
        watched = short_session(admin, context['renew_session'])
        context['session'] = watched
        def expire():
            assert not STATE.exists(), 'Exact expiry must already be restored before waiting.'
            until = time.monotonic() + 65
            while time.monotonic() < until:
                if watched.request('/v2-beta/projects')[0] == 401: return
                time.sleep(.5)
            raise AssertionError('Real short token did not expire.')
        context.update(invalidate=expire, protected='/v2-beta/projects', scope=('own ordinary OIDC identity' if oidc else 'own ordinary local identity') + '; real45s opaque-token/JWE expiry; subscribe only; prior expiry restored before wait')
        return context
    except Exception:
        context['cleanup']()
        raise


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'local'
    assert mode in ('local', 'oidc')
    status = probe.main(identity_factory=lambda admin: expiry_factory(admin, oidc=mode == 'oidc'))
    if probe.REPORT.exists():
        (probe.ROOT / ('console/ws-revocation-expiry-' + mode + '-results.json')).write_bytes(probe.REPORT.read_bytes())
    raise SystemExit(status)
