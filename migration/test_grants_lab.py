"""Real read-only planner, encrypted artifact and unchanged source permissions."""
import io
import json
import os
from pathlib import Path
import secrets
import sys

from migration import crypto_stream, grants
from migration.tool import Database


def main():
    root = Path(__file__).resolve().parents[1]
    directory = root / 'migration-runs' / ('grants-plan-' + secrets.token_hex(6))
    database = Database('rancher16-rbac-lab')
    before = grants.snapshot(database)
    password = secrets.token_urlsafe(48)
    previous_argv = sys.argv
    previous_password = os.environ.get('RANCHER_MIGRATION_BACKUP_PASSWORD')
    try:
        os.environ['RANCHER_MIGRATION_BACKUP_PASSWORD'] = password
        sys.argv = ['grants', '--source-container', database.container, '--output', str(directory)]
        assert grants.main() == 0
    finally:
        sys.argv = previous_argv
        if previous_password is None:
            os.environ.pop('RANCHER_MIGRATION_BACKUP_PASSWORD', None)
        else:
            os.environ['RANCHER_MIGRATION_BACKUP_PASSWORD'] = previous_password
    private = io.BytesIO()
    crypto_stream.decrypt_to(directory / 'groups-plan.enc', private, password, max_bytes=64 * 1024 * 1024)
    restored = json.loads(private.getvalue())
    assert restored['snapshot'] == before
    assert restored['plan'] == grants.plan(before)
    assert grants.snapshot(database) == before
    report = {'status': 'passed', 'consistentSnapshotRead': True, 'encryptedPlanRoundtrip': True,
              'sourceAccountsDirectAndGroupGrantsUnchanged': True, 'cutoverAccepted': False}
    (directory / 'grants-plan-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
