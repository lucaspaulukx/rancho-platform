import copy
import json
import random
import unittest

from migration.grants import plan, summary
from migration.tool import MigrationError


def account(number, kind='user', **kwargs):
    return {'id': number, 'kind': kind, 'state': 'active', 'removed': False, 'externalIdType': '', **kwargs}


def member(number, user, project, role='readonly', **kwargs):
    return {'id': number, 'projectId': project, 'externalIdType': 'rancher_id', 'externalId': str(user),
            'role': role, 'state': 'active', 'removed': False, **kwargs}


class GrantPlanTests(unittest.TestCase):
    def source(self):
        return {'accounts': [account(1), account(2), account(10, 'project'), account(20, 'project')],
                'members': [], 'groups': [], 'groupMembers': [], 'groupGrants': []}

    def test_identical_vectors_share_one_group_without_changing_directs(self):
        source = self.source()
        source['members'] = [member(1, 1, 10), member(2, 2, 10), member(3, 1, 20, 'member'), member(4, 2, 20, 'member')]
        before = copy.deepcopy(source)
        proposal = plan(source)
        self.assertEqual(len(proposal['groups']), 1)
        self.assertEqual(proposal['groups'][0]['members'], ['1', '2'])
        self.assertEqual(proposal['groups'][0]['grants'], {'10': 'readonly', '20': 'member'})
        self.assertEqual(source, before)
        self.assertTrue(proposal['directGrantsUnchanged'])
        self.assertFalse(proposal['cutoverAccepted'])

    def test_different_environments_never_become_a_cross_product(self):
        source = self.source(); source['members'] = [member(1, 1, 10), member(2, 2, 20)]
        groups = plan(source)['groups']
        self.assertEqual(len(groups), 2)
        actual = {(u, p, role) for g in groups for u in g['members'] for p, role in g['grants'].items()}
        self.assertEqual(actual, {('1', '10', 'readonly'), ('2', '20', 'readonly')})

    def test_different_roles_do_not_merge(self):
        source = self.source(); source['members'] = [member(1, 1, 10, 'readonly'), member(2, 2, 10, 'owner')]
        self.assertEqual(len(plan(source)['groups']), 2)

    def test_conflicting_roles_require_review_without_guessing_priority(self):
        source = self.source(); source['members'] = [member(1, 1, 10, 'readonly'), member(2, 1, 10, 'member')]
        proposal = plan(source)
        self.assertEqual(proposal['groups'], [])
        self.assertEqual(proposal['preservedReasons']['conflictingRoleAccountNeedsReview'], 1)

    def test_duplicate_same_role_coalesces_but_preserves_all_source_references(self):
        source = self.source(); source['members'] = [member(1, 1, 10), member(2, 1, 10)]
        group = plan(source)['groups'][0]
        self.assertEqual(group['nativeMemberIds'], [1, 2])
        self.assertEqual(group['grants'], {'10': 'readonly'})

    def test_cannot_infer_provider_email_or_noncanonical_internal_identity(self):
        for provider, identity in [('ldap_user', '1'), ('rancher_id', '001'), ('rancher_id', 'person@example.invalid')]:
            source = self.source(); source['members'] = [member(1, 1, 10, externalIdType=provider, externalId=identity)]
            self.assertEqual(plan(source)['groups'], [])

    def test_unknown_dynamic_account_provider_keeps_native_identity(self):
        source = self.source(); source['accounts'][0]['externalIdType'] = 'github_user'
        source['members'] = [member(1, 1, 10)]
        self.assertEqual(plan(source)['groups'], [])

    def test_inactive_removed_global_missing_resources_are_not_granted(self):
        for change in ('user-inactive', 'user-removed', 'admin', 'project-inactive', 'project-removed', 'user-missing', 'member-removed', 'member-inactive'):
            source = self.source(); source['members'] = [member(1, 1, 10)]
            if change == 'user-inactive': source['accounts'][0]['state'] = 'inactive'
            if change == 'user-removed': source['accounts'][0]['removed'] = True
            if change == 'admin': source['accounts'][0]['kind'] = 'admin'
            if change == 'project-inactive': source['accounts'][2]['state'] = 'inactive'
            if change == 'project-removed': source['accounts'][2]['removed'] = True
            if change == 'user-missing': source['accounts'].pop(0)
            if change == 'member-removed': source['members'][0]['removed'] = True
            if change == 'member-inactive': source['members'][0]['state'] = 'inactive'
            with self.subTest(change=change): self.assertEqual(plan(source)['groups'], [])

    def test_unknown_roles_are_preserved_without_becoming_group_roles(self):
        source = self.source(); source['members'] = [member(1, 1, 10, 'custom-future-role')]
        self.assertEqual(plan(source)['groups'], [])

    def test_existing_name_collision_requires_review_never_overwrites(self):
        source = self.source(); source['members'] = [member(1, 1, 10)]
        name = plan(source)['groups'][0]['name']
        source['groups'] = [{'id': 'existing', 'name': name.upper(), 'revision': 7}]
        proposal = plan(source)
        self.assertEqual(proposal['groups'], [])
        self.assertEqual(proposal['preservedReasons']['existingGroupNameNeedsReview'], 1)

    def test_duplicate_accounts_refused(self):
        source = self.source(); source['accounts'].append(account(1))
        with self.assertRaises(MigrationError): plan(source)

    def test_deterministic_and_public_summary_excludes_identity_rows(self):
        source = self.source(); source['accounts'][0]['id'] = 999999
        source['members'] = [member(1234567, 999999, 10)]
        first = plan(source)
        self.assertEqual(first, plan(copy.deepcopy(source)))
        self.assertNotIn('999999', json.dumps(summary(first)))
        self.assertNotIn('1234567', json.dumps(summary(first)))

    def test_random_twenty_environment_graph_has_exact_same_permission_tuples(self):
        randomizer = random.Random(73)
        users = list(range(1, 51)); projects = list(range(100, 120))
        source = {'accounts': [account(u) for u in users] + [account(p, 'project') for p in projects],
                  'members': [], 'groups': []}
        expected = set()
        for user in users:
            for project in projects:
                if randomizer.random() < .4:
                    role = randomizer.choice(['owner', 'member', 'restricted', 'readonly'])
                    source['members'].append(member(len(source['members']) + 1, user, project, role))
                    expected.add((str(user), str(project), role))
        actual = {(u, p, role) for g in plan(source)['groups'] for u in g['members'] for p, role in g['grants'].items()}
        self.assertEqual(actual, expected)


if __name__ == '__main__':
    unittest.main()
