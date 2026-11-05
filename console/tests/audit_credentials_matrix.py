"""Same-artifact audit regression using only the existing local isolated host fixture."""
import sys
import json
import time
import host_stream_revocation as probe

if __name__ == '__main__':
    assert len(sys.argv) == 2 and sys.argv[1] in ('on','off')
    admin = probe.shared.session()
    try:
        enabled = admin.request('/oidc/config')[1]['effective']['AUDIT_CREDENTIAL_REDACTION_ENABLED']
        assert enabled == (sys.argv[1] == 'on')
    finally: admin.request('/v2-beta/token/current',None,'DELETE')
    probe.REPORT = probe.ROOT / ('console/audit-credentials-' + sys.argv[1] + '-results.json')
    if probe.REPORT.exists():
        archive = probe.ROOT / 'migration-runs' / ('audit-credentials-' + sys.argv[1] + '-' + str(time.time_ns()) + '-results.json')
        archive.write_bytes(probe.REPORT.read_bytes())
    status = probe.main(console_proxy=True,audit_probe=True)
    result = json.loads(probe.REPORT.read_text(encoding='utf-8'))
    if sys.argv[1] == 'off':
        audit = result.get('auditCredentials',{})
        reproduced = (status == 0 and result.get('cleanupComplete') and audit.get('readonlyFixtureCleaned') and
            len(audit.get('events',[])) == 2 and all(event.get('databaseContainsIssuedToken') and event.get('environmentReadonlyContainsIssuedToken') for event in audit['events']) and
            any(event.get('readonlyCouldUseAuditedExecCapability') for event in audit['events']))
        result['status'] = 'failed'
        result['legacyCredentialExposureReproduced'] = bool(reproduced)
        probe.REPORT.write_text(json.dumps(result,indent=2),encoding='utf-8')
        print('PASS: expected legacy exposure reproduced and cleaned.' if reproduced else 'FAIL: legacy exposure baseline incomplete.')
        status = 0 if reproduced else 1
    raise SystemExit(status)
