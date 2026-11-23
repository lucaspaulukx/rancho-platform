"""Local-only physical host-stream matrix; sequential, own fixtures, sanitized reports."""
import argparse
import json
import urllib.request
import urllib.error

import host_stream_revocation as probe
from subscription_identity_fixture import identity_factory
from subscription_expiry_fixture import expiry_factory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('admin-revoke', 'grant-local', 'grant-oidc',
                                      'deactivate-local', 'deactivate-oidc', 'expire-local', 'expire-oidc'))
    parser.add_argument('--expect-legacy', action='store_true')
    args = parser.parse_args()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open('http://localhost:18080/community/host-stream-guard', timeout=5) as response:
        capability = json.load(response)
    assert capability == {'protocol': 1, 'enabled': not args.expect_legacy}, 'Unexpected actual proxy mode.'
    request = urllib.request.Request('http://localhost:18080/host-stream-session/check', data=b'{}',
                                     headers={'Content-Type': 'application/json'}, method='POST')
    try: response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error: response = error
    assert response.status == (404 if args.expect_legacy else 403), 'Guard endpoint did not reject an untrusted caller.'
    assert response.headers.get_content_type() == 'application/json' and response.headers.get('Cache-Control') == 'no-store'
    assert json.load(response) == ({} if args.expect_legacy else {'allowed': False})
    assert not args.expect_legacy or args.mode == 'admin-revoke'
    factory = None
    if args.mode != 'admin-revoke':
        mode, kind = args.mode.split('-')
        if mode == 'expire':
            factory = lambda admin: expiry_factory(admin, oidc=kind == 'oidc', role='member')
        else:
            factory = identity_factory(mode, oidc=kind == 'oidc', role='member')
    probe.REPORT = probe.ROOT / ('console/host-stream-' + args.mode + ('-off' if args.expect_legacy else '-on') + '-results.json')
    status = probe.main(identity_factory=factory)
    report = json.loads(probe.REPORT.read_text(encoding='utf-8'))
    if args.expect_legacy:
        reproduced = report.get('cleanupComplete') and report.get('watchedSessionRevoked') and report.get('controlSessionRevoked') and report.get('allOwnStreamsReceivedBeforeRevocation') and report.get('protectedHttpAfterRevocation') == 401 and all(
            value.get('newHandshake') == 101 and value.get('freshControlHealthy') and not value.get('closed') and value.get('after', 0) > 0
            for value in report.get('streams', {}).values()) and len(report.get('streams', {})) == 3
        report['legacyBehaviorReproduced'] = bool(reproduced)
        # Preserve failed enforcement status: this is a baseline, not a security pass.
        probe.REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('PASS: legacy vulnerability reproduced with healthy controls and exact fixture cleanup.' if reproduced
              else 'FAIL: legacy baseline incomplete; inspect sanitized report.')
        return 0 if reproduced else 1
    return status


if __name__ == '__main__':
    raise SystemExit(main())
