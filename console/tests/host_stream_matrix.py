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
    parser.add_argument('--frontend-probe', action='store_true')
    parser.add_argument('--payload-transport', action='store_true')
    parser.add_argument('--console-proxy', action='store_true')
    parser.add_argument('--service-scale', type=int, default=1)
    parser.add_argument('--service-metrics', action='store_true')
    parser.add_argument('--hold-seconds', type=int, default=0)
    args = parser.parse_args()
    opener = probe.shared.lab.loopback_opener()
    with opener.open('http://localhost:18080/community/host-stream-guard', timeout=5) as response:
        capability = json.load(response)
    assert capability.get('protocol') == 1 and capability.get('enabled') == (not args.expect_legacy), 'Unexpected actual proxy mode.'
    if args.payload_transport: assert capability.get('metricsPayloadProtocol') == 1, 'Metrics payload proxy protocol missing.'
    request = urllib.request.Request('http://localhost:18080/host-stream-session/check', data=b'{}',
                                     headers={'Content-Type': 'application/json'}, method='POST')
    try: response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error: response = error
    assert response.status == (404 if args.expect_legacy else 403), 'Guard endpoint did not reject an untrusted caller.'
    assert response.headers.get_content_type() == 'application/json' and response.headers.get('Cache-Control') == 'no-store'
    assert json.load(response) == ({} if args.expect_legacy else {'allowed': False})
    assert not args.expect_legacy or args.mode == 'admin-revoke'
    assert not args.hold_seconds or (args.mode == 'admin-revoke' and not args.expect_legacy and 0 < args.hold_seconds <= 600)
    factory = None
    if args.mode != 'admin-revoke':
        mode, kind = args.mode.split('-')
        if mode == 'expire':
            factory = lambda admin: expiry_factory(admin, oidc=kind == 'oidc', role='member')
        else:
            factory = identity_factory(mode, oidc=kind == 'oidc', role='member')
    probe.REPORT = probe.ROOT / ('console/host-stream-' + args.mode + ('-lease' if args.hold_seconds else '') + ('-service' if args.service_metrics else '') + ('-proxy' if args.console_proxy else '') + ('-payload' if args.payload_transport else '') + ('-browser' if args.frontend_probe else '') + ('-scale' + str(args.service_scale) if args.service_scale != 1 else '') + ('-off' if args.expect_legacy else '-on') + '-results.json')
    status = probe.main(identity_factory=factory, hold_seconds=args.hold_seconds, service_metrics=args.service_metrics, console_proxy=args.console_proxy, service_scale=args.service_scale, payload_transport=args.payload_transport, frontend_probe=args.frontend_probe)
    report = json.loads(probe.REPORT.read_text(encoding='utf-8'))
    if args.expect_legacy:
        reproduced = report.get('cleanupComplete') and report.get('watchedSessionRevoked') and report.get('controlSessionRevoked') and report.get('allOwnStreamsReceivedBeforeRevocation') and report.get('protectedHttpAfterRevocation') == 401 and all(
            value.get('newHandshake') == 101 and value.get('freshControlHealthy') and not value.get('closed') and value.get('after', 0) > 0
            for value in report.get('streams', {}).values()) and len(report.get('streams', {})) == (4 if args.service_metrics else 3)
        report['legacyBehaviorReproduced'] = bool(reproduced)
        # Preserve failed enforcement status: this is a baseline, not a security pass.
        probe.REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('PASS: legacy vulnerability reproduced with healthy controls and exact fixture cleanup.' if reproduced
              else 'FAIL: legacy baseline incomplete; inspect sanitized report.')
        return 0 if reproduced else 1
    return status


if __name__ == '__main__':
    raise SystemExit(main())
