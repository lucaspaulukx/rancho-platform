import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { History, RefreshCw } from 'lucide-react';
import { api, rawId, roles, type Account, type Collection, type Group, type Project } from '../api';
import { useI18n } from '../i18n/provider';
import { useApp } from '../state';
import { Alert, Badge, Button, DataTable, Empty, ErrorState, Field, Loading, Modal } from './ui';

interface AccessReport {
  accountId: string;
  projectId: string;
  effectiveRole?: string | null;
  complete: boolean;
  identityScope: string;
  sources: { kind: string; name?: string; groupId?: string; memberId?: string; role: string }[];
}
interface Snapshot {
  id: string;
  name: string;
  revision: number;
  members: string[];
  grants: Record<string, string>;
}
interface AuditEvent {
  id: string;
  actorId: string;
  groupId: string;
  operation: string;
  created: string;
  before?: Snapshot | null;
  after?: Snapshot | null;
}
const roleName = (role: string) => roles.find((value) => value.value === role)?.label || role;
class AccessScopeMismatchError extends Error {}

export function AccessDiagnostics({
  account,
  projects,
  onClose,
}: {
  account: Account;
  projects: Project[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const app = useApp();
  const [environment, setEnvironment] = useState(app.project?.id || projects[0]?.id || '');
  const query = useQuery({
    queryKey: ['data', app.identity, 'access', 'effective', account.id, environment],
    enabled: !!environment,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        targetAccount: account.id,
        targetEnvironment: environment,
      });
      const result = await api<Collection<AccessReport>>(
        `localAccessReports?${params}`,
        undefined,
        undefined,
        signal,
      );
      const report = result.data[0];
      if (
        !report ||
        (account.id === 'self'
          ? !/^[1-9]\d*$/.test(report.accountId)
          : report.accountId !== rawId(account.id)) ||
        report.projectId !== rawId(environment)
      )
        throw new AccessScopeMismatchError();
      return report;
    },
    retry: false,
  });
  return (
    <Modal
      open
      drawer
      title={t('accessDiagnostics.title', { name: account.name || account.id })}
      description={t('accessDiagnostics.description')}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>{t('accessDiagnostics.close')}</Button>}
    >
      <Field label={t('accessDiagnostics.environment')}>
        {(id) => (
          <select
            id={id}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
          >
            {!projects.length && <option value="">{t('accessDiagnostics.noEnvironment')}</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {!!environment && (
        <Button aria-label={t('accessDiagnostics.refresh')} onClick={() => void query.refetch()}>
          <RefreshCw size={15} />
        </Button>
      )}
      {!environment ? (
        <Empty
          title={t('accessDiagnostics.noEnvironment')}
          description={t('accessDiagnostics.noEnvironmentDescription')}
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          error={
            query.error instanceof AccessScopeMismatchError
              ? new Error(t('accessDiagnostics.scopeMismatch'))
              : query.error
          }
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          {!query.data.complete && (
            <Alert tone="warning">{t('accessDiagnostics.partialWarning')}</Alert>
          )}
          <dl className="details-grid">
            <div>
              <dt>{t('accessDiagnostics.effectiveRole')}</dt>
              <dd>
                <Badge>
                  {!query.data.complete
                    ? t('accessDiagnostics.undetermined')
                    : query.data.effectiveRole
                      ? roleName(query.data.effectiveRole)
                      : t('accessDiagnostics.noAccess')}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>{t('accessDiagnostics.identityScope')}</dt>
              <dd>{query.data.identityScope}</dd>
            </div>
          </dl>
          <DataTable
            rows={query.data.sources}
            rowKey={(source) => `${source.kind}:${source.groupId || source.memberId || 'global'}`}
            searchText={(source) => `${source.name || ''} ${source.kind} ${source.role}`}
            emptyTitle={t('accessDiagnostics.noLocalGrant')}
            emptyDescription={t('accessDiagnostics.noLocalGrantDescription')}
            columns={[
              {
                key: 'kind',
                label: t('accessDiagnostics.origin'),
                render: (source) =>
                  source.kind === 'group'
                    ? t('accessDiagnostics.localGroup')
                    : source.kind === 'direct'
                      ? t('accessDiagnostics.directLink')
                      : t('accessDiagnostics.globalAdministrator'),
              },
              {
                key: 'source',
                label: t('accessDiagnostics.source'),
                render: (source) => source.name || source.memberId || account.name || account.id,
              },
              {
                key: 'role',
                label: t('accessDiagnostics.grantedRole'),
                render: (source) => roleName(source.role),
              },
            ]}
          />
        </>
      )}
    </Modal>
  );
}

export function GroupAudit({
  group,
  users,
  projects,
  onClose,
}: {
  group?: Group | null;
  users: Account[];
  projects: Project[];
  onClose: () => void;
}) {
  const { t, formats } = useI18n();
  const app = useApp();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['data', app.identity, 'access', 'audit', group?.id || 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams();
      if (group) params.set('groupId', group.id);
      if (pageParam) params.set('before', pageParam);
      return api<Collection<AuditEvent>>(
        `localGroupAudits?${params}`,
        undefined,
        undefined,
        signal,
      );
    },
    getNextPageParam: (last, pages) => {
      const cursor = last.data.at(-1)?.id;
      return last.data.length === 100 &&
        pages.length < 10 &&
        !pages.slice(0, -1).some((page) => page.data.some((event) => event.id === cursor))
        ? cursor
        : undefined;
    },
    retry: false,
  });
  return (
    <Modal
      open
      drawer
      title={t('accessDiagnostics.auditTitle', {
        name: group?.name || t('accessDiagnostics.localGroups'),
      })}
      description={t('accessDiagnostics.auditDescription')}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>{t('accessDiagnostics.close')}</Button>}
    >
      <Alert tone="info">{t('accessDiagnostics.snapshotsNotice')}</Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            rows={query.data.pages.flatMap((page) => page.data)}
            rowKey={(event) => event.id}
            searchText={(event) => `${event.operation} ${event.actorId} ${event.created}`}
            emptyTitle={t('accessDiagnostics.noChanges')}
            emptyDescription={t('accessDiagnostics.noSnapshots')}
            columns={[
              {
                key: 'group',
                label: t('accessDiagnostics.group'),
                render: (event) => event.after?.name || event.before?.name || event.groupId,
              },
              {
                key: 'created',
                label: t('accessDiagnostics.date'),
                render: (event) =>
                  formats.date(new Date(event.created), {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                  }),
              },
              {
                key: 'actor',
                label: t('accessDiagnostics.actor'),
                render: (event) =>
                  users.find((user) => rawId(user.id) === event.actorId)?.name || event.actorId,
              },
              {
                key: 'operation',
                label: t('accessDiagnostics.operation'),
                render: (event) =>
                  ({
                    create: t('accessDiagnostics.create'),
                    update: t('accessDiagnostics.update'),
                    delete: t('accessDiagnostics.delete'),
                  })[event.operation] || event.operation,
              },
              {
                key: 'details',
                label: t('accessDiagnostics.details'),
                render: (event) => (
                  <Button
                    onClick={() => setSelected(event)}
                    aria-label={t('accessDiagnostics.reviewEvent', { id: event.id })}
                  >
                    <History size={15} />
                    {t('accessDiagnostics.beforeAfter')}
                  </Button>
                ),
              },
            ]}
          />
          {query.hasNextPage && (
            <Button busy={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {t('accessDiagnostics.loadEarlier')}
            </Button>
          )}
          {query.data.pages.length === 10 && query.data.pages.at(-1)?.data.length === 100 && (
            <Alert tone="warning">{t('accessDiagnostics.limitWarning')}</Alert>
          )}
          {selected && (
            <section aria-label={t('accessDiagnostics.auditedChange')}>
              <h2>{t('accessDiagnostics.event', { id: selected.id })}</h2>
              {(['before', 'after'] as const).map((side) => {
                const value = selected[side];
                return (
                  <section key={side}>
                    <h3>
                      {side === 'before'
                        ? t('accessDiagnostics.before')
                        : t('accessDiagnostics.after')}
                    </h3>
                    {!value ? (
                      <p className="muted">{t('accessDiagnostics.nonexistentGroup')}</p>
                    ) : (
                      <dl className="details-grid">
                        <div>
                          <dt>{t('accessDiagnostics.name')}</dt>
                          <dd>{value.name}</dd>
                        </div>
                        <div>
                          <dt>{t('accessDiagnostics.revision')}</dt>
                          <dd>{value.revision}</dd>
                        </div>
                        <div>
                          <dt>{t('accessDiagnostics.members')}</dt>
                          <dd>
                            {value.members
                              .map(
                                (member) =>
                                  users.find((user) => rawId(user.id) === member)?.name || member,
                              )
                              .join(', ') || t('accessDiagnostics.none')}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('accessDiagnostics.grants')}</dt>
                          <dd>
                            {Object.entries(value.grants)
                              .map(
                                ([project, role]) =>
                                  `${projects.find((item) => rawId(item.id) === project)?.name || project}: ${roleName(role)}`,
                              )
                              .join('; ') || t('accessDiagnostics.none')}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </section>
                );
              })}
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
