"""Read-only direct-grant migration planner. No apply/cutover/source write API."""
import argparse
from collections import Counter, defaultdict
import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import re

from migration import crypto_stream
from migration.tool import Database, MigrationError, write_new

ROLES = {'owner', 'member', 'restricted', 'readonly'}
LOCAL_IDENTITIES = {None, '', 'rancher_id', 'oidc_subject'}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def snapshot(database):
    # One MySQL connection/consistent InnoDB snapshot, not separate client queries.
    if database.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle' AND table_name IN ('account','project_member','local_rbac_group','local_rbac_member','local_rbac_grant') AND ENGINE<>'InnoDB';") != '0':
        raise MigrationError('Planning requires InnoDB for a consistent permission snapshot.')
    count = int(database.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='cattle' AND table_name IN ('local_rbac_group','local_rbac_member','local_rbac_grant');"))
    if count not in (0, 3):
        raise MigrationError('Partial local group schema: repair/restore before planning.')
    query = """SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION WITH CONSISTENT SNAPSHOT;
SELECT 'section:accounts';
SELECT id,HEX(kind),HEX(state),HEX(COALESCE(external_id_type,'')),removed IS NOT NULL FROM cattle.account WHERE kind IN ('user','admin','project') ORDER BY id;
SELECT 'section:members';
SELECT id,project_id,HEX(external_id_type),HEX(external_id),HEX(role),HEX(state),removed IS NOT NULL FROM cattle.project_member ORDER BY id;
SELECT 'section:groups';
"""
    if count:
        query += "SELECT HEX(id),HEX(name),revision FROM cattle.local_rbac_group ORDER BY id;\n"
    query += "SELECT 'section:groupMembers';\n"
    if count:
        query += "SELECT HEX(group_id),account_id FROM cattle.local_rbac_member ORDER BY group_id,account_id;\n"
    query += "SELECT 'section:groupGrants';\n"
    if count:
        query += "SELECT HEX(group_id),project_id,HEX(role) FROM cattle.local_rbac_grant ORDER BY group_id,project_id;\n"
    query += 'COMMIT;'
    sections = {name: [] for name in ('accounts', 'members', 'groups', 'groupMembers', 'groupGrants')}
    current = None
    for line in database.query(query).splitlines():
        if line.startswith('section:'):
            current = line.removeprefix('section:')
            if current not in sections:
                raise MigrationError('Unexpected snapshot section.')
        elif current:
            sections[current].append(line.split('\t'))
        else:
            raise MigrationError('Unexpected snapshot output.')
    def text(value):
        return bytes.fromhex(value).decode('utf-8')
    result = {'accounts': [], 'members': [], 'groups': [], 'groupMembers': [], 'groupGrants': []}
    for row in sections['accounts']:
        account_id, kind, state, provider, removed = row
        result['accounts'].append({'id': int(account_id), 'kind': text(kind), 'state': text(state),
                                   'externalIdType': text(provider), 'removed': removed == '1'})
    for row in sections['members']:
        member_id, project_id, provider, identity, role, state, removed = row
        result['members'].append({'id': int(member_id), 'projectId': int(project_id), 'externalIdType': text(provider),
                                  'externalId': text(identity), 'role': text(role), 'state': text(state), 'removed': removed == '1'})
    result['groups'] = [{'id': text(gid), 'name': text(name), 'revision': int(revision)} for gid, name, revision in sections['groups']]
    result['groupMembers'] = [{'groupId': text(gid), 'accountId': int(account)} for gid, account in sections['groupMembers']]
    result['groupGrants'] = [{'groupId': text(gid), 'projectId': int(project), 'role': text(role)} for gid, project, role in sections['groupGrants']]
    return result


def plan(source):
    accounts = {a['id']: a for a in source['accounts']}
    if len(accounts) != len(source['accounts']) or any(not isinstance(i, int) or isinstance(i, bool) or i <= 0 for i in accounts):
        raise MigrationError('Duplicate/invalid account identity in snapshot.')
    reasons = Counter()
    vectors = defaultdict(lambda: defaultdict(set))
    native_ids = defaultdict(set)
    names = {g['name'].casefold() for g in source.get('groups', [])}
    for member in source['members']:
        if member['removed'] or member['state'] != 'active':
            reasons['inactiveMembershipPreserved'] += 1
            continue
        if member['externalIdType'] != 'rancher_id' or not re.fullmatch(r'[1-9][0-9]*', member['externalId']):
            reasons['externalOrNonCanonicalIdentityPreserved'] += 1
            continue
        account = accounts.get(int(member['externalId']))
        project = accounts.get(member['projectId'])
        if not account or account['kind'] != 'user' or account['removed'] or account['state'] != 'active':
            reasons['inactiveMissingOrGlobalAccountPreserved'] += 1
            continue
        if account.get('externalIdType', '') not in LOCAL_IDENTITIES:
            reasons['dynamicAccountProviderPreserved'] += 1
            continue
        if not project or project['kind'] != 'project' or project['removed'] or project['state'] != 'active':
            reasons['inactiveMissingEnvironmentPreserved'] += 1
            continue
        if member['role'] not in ROLES:
            reasons['unknownRolePreserved'] += 1
            continue
        vectors[account['id']][project['id']].add(member['role'])
        native_ids[account['id']].add(member['id'])
    identical = defaultdict(list)
    for account_id, permissions in sorted(vectors.items()):
        if any(len(roles) != 1 for roles in permissions.values()):
            reasons['conflictingRoleAccountNeedsReview'] += 1
            continue
        vector = tuple(sorted((project, next(iter(roles))) for project, roles in permissions.items()))
        identical[vector].append(account_id)
    proposals = []
    for vector, members in sorted(identical.items()):
        name = 'Imported access ' + digest(vector)[:12]
        if name.casefold() in names:
            reasons['existingGroupNameNeedsReview'] += 1
            continue
        proposals.append({'name': name, 'members': [str(m) for m in members],
                          'grants': {str(project): role for project, role in vector},
                          'nativeMemberIds': sorted({mid for member in members for mid in native_ids[member]})})
        names.add(name.casefold())
    return {'format': 1, 'mode': 'coexist', 'baselineSha256': digest(source), 'groups': proposals,
            'preservedReasons': dict(sorted(reasons.items())), 'directGrantsUnchanged': True,
            'existingGroupsUnchanged': True, 'cutoverAccepted': False, 'completeMigrationAccepted': False}


def summary(proposal):
    return {'mode': proposal['mode'], 'proposedGroups': len(proposal['groups']),
            'proposedMembers': sum(len(g['members']) for g in proposal['groups']),
            'proposedEnvironmentRoleBindings': sum(len(g['grants']) for g in proposal['groups']),
            'preservedReasons': proposal['preservedReasons'], 'sourceModified': False,
            'cutoverAccepted': False, 'completeMigrationAccepted': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-container', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--defaults-file')
    args = parser.parse_args()
    try:
        password = os.environ.get('RANCHER_MIGRATION_BACKUP_PASSWORD') or getpass.getpass('Private plan passphrase: ')
        if len(password) < 20 or args.output.is_symlink():
            raise MigrationError('Use a new private output directory and passphrase of at least20 characters.')
        source = snapshot(Database(args.source_container, args.defaults_file))
        proposal = plan(source)
        args.output.mkdir(parents=True, exist_ok=False)
        with (args.output / 'groups-plan.enc').open('xb') as destination:
            crypto_stream.encrypt(io.BytesIO(canonical({'snapshot': source, 'plan': proposal})), destination, password,
                                  max_bytes=64 * 1024 * 1024)
        report = summary(proposal)
        write_new(args.output / 'summary.json', json.dumps(report, indent=2).encode())
        print(json.dumps(report, indent=2))
    except (MigrationError, OSError, ValueError, KeyError):
        print('Group planning failed; no source changes performed. Private diagnostics withheld.', file=__import__('sys').stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
