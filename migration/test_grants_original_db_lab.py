"""Nonempty grant-plan proof in a repeatably restored original20 MySQL copy."""
import json
from pathlib import Path
import secrets

from migration import grants, tool
from migration.test_original_rehearsal import original_twenty_environments


def seeded_grants(database, *, reset_original=True):
    if not database.container.startswith('rancher-rehearsal-'):
        raise tool.MigrationError('Synthetic grants require an owned rehearsal container.')
    if reset_original:
        original_twenty_environments(database)
    else:
        assert database.query("SELECT COUNT(*) FROM cattle.account WHERE kind='project' AND removed IS NULL;") == '20'
    users = []
    for index in range(3):
        uid = '7ff40000-0000-4000-8000-' + str(index).zfill(12)
        value = database.query("INSERT INTO cattle.account(name,uuid,kind,state,created,external_id_type) VALUES('migration-group-user-" + str(index) + "','" + uid + "','user','active','2026-01-01 00:00:00','rancher_id'); SELECT LAST_INSERT_ID();")
        users.append(int(value))
    projects = [int(v) for v in database.query("SELECT id FROM cattle.account WHERE kind='project' AND removed IS NULL ORDER BY id LIMIT 2;").splitlines()]
    rows = [(users[0], projects[0], 'readonly'), (users[0], projects[1], 'member'),
            (users[1], projects[0], 'readonly'), (users[1], projects[1], 'member'),
            (users[2], projects[0], 'restricted')]
    for index, (user, project, role) in enumerate(rows):
        uid = '8ff40000-0000-4000-8000-' + str(index).zfill(12)
        database.query("INSERT INTO cattle.project_member(account_id,project_id,kind,uuid,state,created,external_id_type,external_id,role) VALUES(" + str(project) + ',' + str(project) + ",'projectMember','" + uid + "','active','2026-01-01 00:00:00','rancher_id','" + str(user) + "','" + role + "');")
    source = grants.snapshot(database)
    proposal = grants.plan(source)
    assert len(proposal['groups']) == 2
    actual = {(int(u), int(p), role) for g in proposal['groups'] for u in g['members'] for p, role in g['grants'].items()}
    assert actual == set(rows), 'Grant proposal changed the permission tuples.'
    assert grants.snapshot(database) == source, 'Planner changed its source.'
    return {'groups': 2, 'users': 3, 'environments': 20, 'nativeGrantRows': 5,
            'exactPermissionTuplesPreserved': True, 'sourceModifiedByPlanner': False}


def main():
    directory = Path(__file__).resolve().parents[1] / 'migration-runs' / ('grants-original20-' + secrets.token_hex(6))
    directory.mkdir(parents=True)
    password = secrets.token_urlsafe(48)
    tool.backup(tool.Database('rancher16-rbac-lab'), directory, password)
    observations = []
    def fixture(database):
        observations.append(seeded_grants(database))
    result = tool.rehearse(directory, password, _fixture_setup=fixture)
    assert result['cleanupComplete'] and all(row == observations[0] for row in observations)
    report = {'status': 'passed', 'fixture': observations[0], 'repeatedRestores': len(observations),
              'restoreSchemaAndRollbackAccepted': result['migrationTested'] and result['migrationIdempotent'] and result['rollbackTested'],
              'cutoverAccepted': False, 'realGroupApplyAccepted': False}
    (directory / 'grants-original20-results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
