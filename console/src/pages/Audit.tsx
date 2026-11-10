import { useI18n } from '../i18n/provider';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Resource } from '../api';
import {
  AuditError,
  auditMetadata,
  auditNext,
  auditQuery,
  type AuditEvent,
  type AuditFilters,
} from '../audit';
import { useApp } from '../state';
import {
  Alert,
  Button,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
} from '../components/ui';
import { formatResourceDate } from '../resource-format';
const initial: AuditFilters = { event: '', resource: '', account: '' };
export function Audit() {
  const app = useApp();
  return <AuditScope key={app.identity} />;
}
function AuditScope() {
  const { t, locale } = useI18n();
  const app = useApp();
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial);
  const [history, setHistory] = useState<string[]>([]),
    [selected, setSelected] = useState<AuditEvent | null>(null),
    [validation, setValidation] = useState<Error | null>(null);
  const path = history.at(-1) || auditQuery(filters);
  const query = useQuery({
    queryKey: ['data', app.identity, 'administrative-audit', path],
    enabled: app.admin && app.config.modules.audit,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const result = await api<{ data: Resource[]; pagination?: { next?: string } }>(
        path,
        undefined,
        undefined,
        signal,
      );
      if (!Array.isArray(result.data)) throw new AuditError('auditPage.invalidResponse');
      return { rows: result.data.map(auditMetadata), next: auditNext(result.pagination?.next) };
    },
  });
  function apply(e: React.FormEvent) {
    e.preventDefault();
    try {
      auditQuery(draft);
      setFilters({ ...draft });
      setHistory([]);
      setSelected(null);
      setValidation(null);
    } catch (e) {
      setValidation(e instanceof Error ? e : new AuditError('auditPage.reviewFilters'));
    }
  }
  if (!app.admin || !app.config.modules.audit) return <Alert>{t('auditPage.unavailable')}</Alert>;
  return (
    <>
      <PageHeader
        title={t('auditPage.title')}
        description={t('auditPage.description')}
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            {t('auditPage.refresh')}
          </Button>
        }
      />
      <form className="panel" onSubmit={apply}>
        <div className="form-grid">
          <Field label={t('auditPage.resourceType')}>
            {(id) => (
              <input
                id={id}
                value={draft.resource}
                onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
                placeholder={t('auditPage.resourceExample')}
              />
            )}
          </Field>
          <Field label={t('auditPage.eventType')}>
            {(id) => (
              <input
                id={id}
                value={draft.event}
                onChange={(e) => setDraft({ ...draft, event: e.target.value })}
                placeholder={t('auditPage.nativeIdentifier')}
              />
            )}
          </Field>
          <Field label={t('auditPage.filterAccount')}>
            {(id) => (
              <input
                id={id}
                value={draft.account}
                onChange={(e) => setDraft({ ...draft, account: e.target.value })}

                placeholder={t('auditPage.accountExample')}
              />
            )}
          </Field>
        </div>
        <div className="row-actions audit-filter-actions">
          <Button type="submit">{t('auditPage.apply')}</Button>
          <Button
            onClick={() => {
              setDraft(initial);
              setFilters(initial);
              setHistory([]);
              setValidation(null);
            }}
          >
            {t('auditPage.clear')}
          </Button>
        </div>
        {validation && (
          <Alert>{validation instanceof AuditError ? t(validation.key) : validation.message}</Alert>
        )}
      </form>
      <Alert tone="info">{t('auditPage.privacy')}</Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          error={query.error instanceof AuditError ? new Error(t(query.error.key)) : query.error}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <DataTable
            paginate={false}
            rows={query.data?.rows || []}
            rowKey={(v) => v.id}
            searchText={(v) =>
              `${v.id} ${v.eventType} ${v.resourceType} ${v.resourceId} ${v.accountId} ${v.authenticatedAsAccountId} ${v.responseCode ?? ''}`
            }
            columns={[
              {
                key: 'created',
                label: t('auditPage.date'),
                render: (v) => formatResourceDate(v.created, locale),
              },
              { key: 'event', label: t('auditPage.event'), render: (v) => v.eventType || '—' },
              {
                key: 'resource',
                label: t('auditPage.resource'),
                render: (v) => `${v.resourceType || '—'} ${v.resourceId}`,
              },
              {
                key: 'actor',
                label: t('auditPage.authenticatedAccount'),
                render: (v) => v.authenticatedAsAccountId || '—',
              },
              { key: 'status', label: t('auditPage.http'), render: (v) => v.responseCode ?? '—' },
              {
                key: 'detail',
                label: t('auditPage.details'),
                render: (v) => (
                  <Button
                    onClick={() => setSelected(v)}
                    aria-label={t('auditPage.eventDetailsLabel', { event: v.id })}
                  >
                    {t('auditPage.viewDetails')}
                  </Button>
                ),
              },
            ]}
          />
          <nav className="row-actions audit-pagination" aria-label={t('auditPage.pagination')}>
            <Button
              disabled={!history.length || query.isFetching}
              onClick={() => setHistory((v) => v.slice(0, -1))}
            >
              {t('auditPage.previous')}
            </Button>
            <span aria-live="polite">{t('auditPage.page', { page: history.length + 1 })}</span>
            <Button
              disabled={!query.data?.next || query.isFetching}
              onClick={() => {
                if (query.data?.next) setHistory((v) => [...v, query.data!.next!]);
              }}
            >
              {t('auditPage.more')}
            </Button>
          </nav>
        </>
      )}
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={t('auditPage.eventDetails')}
      >
        <dl className="details-grid">
          {selected &&
            Object.entries({
              ID: selected.id,
              [t('auditPage.date')]: formatResourceDate(selected.created, locale),
              [t('auditPage.event')]: selected.eventType,
              [t('auditPage.resourceType')]: selected.resourceType,
              [t('auditPage.resourceId')]: selected.resourceId,
              [t('auditPage.recordAccount')]: selected.accountId,
              [t('auditPage.authenticatedAccount')]: selected.authenticatedAsAccountId,
              [t('auditPage.identity')]: selected.authenticatedAsIdentityId,
              [t('auditPage.authentication')]: selected.authType,
              [t('auditPage.httpCode')]: selected.responseCode,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
        </dl>
      </Modal>
    </>
  );
}
