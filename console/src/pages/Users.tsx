import { useState } from 'react';
import { useI18n } from '../i18n/provider';
import { roleLabel } from '../i18n/role-label';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ShieldCheck, UsersRound } from 'lucide-react';
import { rawId, type Group, type Account } from '../api';
import { useApp } from '../state';
import { useLocalAccessData } from '../hooks/useLocalAccessData';
import {
  Alert,
  Badge,
  ResourceStateBadge,
  Button,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  PageHeader,
} from '../components/ui';
import { GroupEditor } from './Groups';
import { AccessDiagnostics } from '../components/AccessDiagnostics';
import { ActionMenu } from '../components/ActionMenu';
import { LocalAccountPanel, type AccountSelection } from '../components/LocalAccountPanel';
import { sessionAccountId } from '../local-accounts';

export function Users() {
  const { t } = useI18n();
  const app = useApp();
  const client = useQueryClient();
  const { id } = useParams();
  const query = useLocalAccessData();
  const [editing, setEditing] = useState<Group | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [management, setManagement] = useState<AccountSelection | null>(null);
  const accountAdministration = app.admin && app.config.modules.localAccountAdministration;
  const ownAccount = sessionAccountId(app.token);
  function actions(account: Account) {
    return (
      <ActionMenu
        label={t('users.accountActions', { account: account.name || account.id })}
        actions={[
          {
            id: 'profile',
            label: t('users.profile'),
            onSelect: () => setManagement({ mode: 'profile', account }),
          },
          {
            id: 'password',
            label: t('users.password'),
            onSelect: () => setManagement({ mode: 'password', account }),
          },
          ...(account.state === 'inactive'
            ? [
                {
                  id: 'activate',
                  label: t('users.activate'),
                  onSelect: () => setManagement({ mode: 'activate', account }),
                },
              ]
            : []),
          ...(account.state === 'active'
            ? [
                {
                  id: 'deactivate',
                  label: t('users.deactivate'),
                  danger: true,
                  disabled: !ownAccount || account.id === ownAccount,
                  reason: t('users.deactivateReason'),
                  onSelect: () => setManagement({ mode: 'deactivate', account }),
                },
              ]
            : []),
          {
            id: 'remove',
            label: t('users.remove'),
            danger: true,
            disabled: account.state !== 'inactive' || !ownAccount || account.id === ownAccount,
            reason: t('users.removeReason'),
            onSelect: () => setManagement({ mode: 'remove', account }),
          },
        ]}
      />
    );
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const { users, groups, projects, groupsEnabled } = query.data;
  const user = id ? users.find((user) => user.id === id) : undefined;
  if (id && !user)
    return <Empty title={t('users.notFound')} description={t('users.notFoundDescription')} />;
  const memberships = user ? groups.filter((group) => group.members.includes(rawId(user.id))) : [];
  return (
    <>
      <PageHeader
        title={user?.name || (user ? user.id : t('users.title'))}
        description={user ? t('users.detailDescription') : t('users.description')}
        eyebrow={t('users.eyebrow')}
        action={
          user ? (
            <Link className="button secondary" to="/users">
              <ArrowLeft size={16} />
              {t('users.back')}
            </Link>
          ) : accountAdministration ? (
            <Button onClick={() => setManagement({ mode: 'create' })}>{t('users.create')}</Button>
          ) : undefined
        }
      />
      {user ? (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>{t('users.accountData')}</h2>
              {groupsEnabled && (
                <Button onClick={() => setDiagnosing(true)}>
                  <ShieldCheck size={15} />
                  {t('users.effectiveAccess')}
                </Button>
              )}
              <ResourceStateBadge state={user.state} />
              {accountAdministration && actions(user)}
            </div>
            <dl className="details-grid">
              <div>
                <dt>{t('users.identification')}</dt>
                <dd>{user.id}</dd>
              </div>
              <div>
                <dt>{t('users.globalRole')}</dt>
                <dd>{user.kind === 'admin' ? t('users.administrator') : t('users.user')}</dd>
              </div>
              <div>
                <dt>{t('users.name')}</dt>
                <dd>{user.name || t('users.notProvided')}</dd>
              </div>
              <div>
                <dt>{t('users.localGroups')}</dt>
                <dd>{groupsEnabled ? memberships.length : t('users.managementDisabled')}</dd>
              </div>
            </dl>
            {user.kind === 'admin' && <Alert tone="info">{t('users.adminNotice')}</Alert>}
          </section>
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel-heading">
              <h2>{t('users.membership')}</h2>
            </div>
            {!groupsEnabled ? (
              <Alert tone="info">{t('users.groupsDisabled')}</Alert>
            ) : (
              <DataTable
                rows={groups}
                rowKey={(group) => group.id}
                searchText={(group) => group.name}
                emptyTitle={t('users.emptyGroups')}
                emptyDescription={t('users.emptyGroupsDescription')}
                columns={[
                  {
                    key: 'name',
                    label: t('users.group'),
                    sortValue: (group) => group.name,
                    render: (group) => (
                      <div className="row-title">
                        <span className="row-title-icon">
                          <ShieldCheck size={18} />
                        </span>
                        <strong>{group.name}</strong>
                      </div>
                    ),
                  },
                  {
                    key: 'member',
                    label: t('users.participation'),
                    render: (group) => (
                      <Badge state={group.members.includes(rawId(user.id)) ? 'active' : undefined}>
                        {group.members.includes(rawId(user.id))
                          ? t('users.member')
                          : t('users.notMember')}
                      </Badge>
                    ),
                  },
                  {
                    key: 'grants',
                    label: t('users.environments'),
                    render: (group) => Object.keys(group.grants).length,
                  },
                  {
                    key: 'edit',
                    label: t('users.management'),
                    render: (group) => (
                      <Button variant="ghost" onClick={() => setEditing(group)}>
                        {t('users.editGroup')}
                        <ArrowRight size={15} />
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </section>
          {groupsEnabled && memberships.length > 0 && (
            <section className="panel" style={{ marginTop: 20 }}>
              <h2>{t('users.grants')}</h2>
              <p className="muted" style={{ fontSize: 12 }}>
                {t('users.grantsDescription')}
              </p>
              <div className="selection-list">
                {memberships.flatMap((group) =>
                  Object.entries(group.grants).map(([project, role]) => (
                    <div className="selection-item" key={`${group.id}-${project}`}>
                      <ShieldCheck size={18} />
                      <div>
                        <strong>
                          {projects.find((p) => rawId(p.id) === project)?.name || project}
                        </strong>
                        <small>{group.name}</small>
                      </div>
                      <Badge>{roleLabel(t, role)}</Badge>
                    </div>
                  )),
                )}
              </div>
            </section>
          )}
        </>
      ) : (
        <DataTable
          rows={users}
          rowKey={(user) => user.id}
          searchText={(user) => `${user.name || ''} ${user.id} ${user.kind}`}
          columns={[
            {
              key: 'name',
              label: t('users.user'),
              sortValue: (user) => user.name || user.id,
              render: (user) => (
                <Link className="row-title" to={`/users/${user.id}`}>
                  <span className="row-title-icon">
                    <UsersRound size={18} />
                  </span>
                  <div>
                    <strong>{user.name || user.id}</strong>
                    <small>{user.id}</small>
                  </div>
                </Link>
              ),
            },
            {
              key: 'kind',
              label: t('users.globalRole'),
              render: (user) => (
                <Badge>{user.kind === 'admin' ? t('users.administrator') : t('users.user')}</Badge>
              ),
            },
            {
              key: 'state',
              label: t('users.state'),
              sortValue: (user) => user.state,
              render: (user) => <ResourceStateBadge state={user.state} />,
            },
            {
              key: 'groups',
              label: t('users.localGroups'),
              render: (user) =>
                groupsEnabled
                  ? groups.filter((group) => group.members.includes(rawId(user.id))).length
                  : t('users.disabled'),
            },
            {
              key: 'open',
              label: t('users.details'),
              render: (user) => (
                <Link
                  className="button ghost"
                  to={`/users/${user.id}`}
                  aria-label={t('users.open', { account: user.name || user.id })}
                >
                  <ArrowRight size={16} />
                </Link>
              ),
            },
            ...(accountAdministration
              ? [
                  {
                    key: 'actions',
                    label: t('users.actions'),
                    render: (account: Account) => actions(account),
                  },
                ]
              : []),
          ]}
        />
      )}
      {diagnosing && user && (
        <AccessDiagnostics
          key={user.id}
          account={user}
          projects={projects}
          onClose={() => setDiagnosing(false)}
        />
      )}
      {editing && (
        <GroupEditor
          group={editing}
          users={users}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void client.invalidateQueries({ queryKey: ['data', app.identity, 'access'] });
            void app.refresh();
          }}
        />
      )}
      {management && accountAdministration && (
        <LocalAccountPanel
          key={`${app.identity}:${management.account?.id || 'new'}:${management.mode}`}
          selection={management}
          onClose={() => setManagement(null)}
        />
      )}
    </>
  );
}
