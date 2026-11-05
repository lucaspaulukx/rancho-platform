"""Explicit local-lab integration: no writes to the source, deterministic offline fixture."""
from pathlib import Path
import json
import secrets

from migration import tool


def original_twenty_environments(database):
    if not database.container.startswith('rancher-rehearsal-'):
        raise tool.MigrationError('Fixture setup is restricted to a newly owned restore sandbox.')
    for table in ('community_schema_migration', 'local_rbac_group', 'local_rbac_member',
                  'local_rbac_grant', 'local_rbac_audit', 'local_rbac_audit_detail', 'local_rbac_oidc_user'):
        database.query('DROP TABLE IF EXISTS cattle.' + table + ';')
    count = int(database.query("SELECT COUNT(*) FROM cattle.account WHERE kind='project' AND removed IS NULL;"))
    if count > 20:
        raise tool.MigrationError('Original-schema fixture expects at most20 source environments.')
    for index in range(count, 20):
        # Fixed synthetic values, only in a restored copy. Zero requests to the engine.
        uuid = '6ff40000-0000-4000-8000-' + str(index).zfill(12)
        database.query("INSERT INTO cattle.account(name,uuid,kind,state,created) VALUES('migration-fixture-" + str(index) + "','" + uuid + "','project','active','2026-01-01 00:00:00');")


def main():
    folder = Path('migration-runs') / ('original-twenty-' + secrets.token_hex(6))
    folder.mkdir(mode=0o700, parents=True)
    password = secrets.token_urlsafe(48)
    tool.backup(tool.Database('rancher16-rbac-lab'), folder, password)
    report = tool.rehearse(folder, password, _fixture_setup=original_twenty_environments)
    assert report['restoredInventoryCounts']['environments'] == 20
    assert report['migrationTested'] and report['migrationIdempotent'] and report['rollbackTested'] and report['cleanupComplete']
    print(json.dumps({'test': 'synthetic-original-schema-twenty-environments', **report}))
    # Deliberately discard the ephemeral test passphrase. These are test artifacts,
    # not the operator's production recovery backup.


if __name__ == '__main__':
    main()
