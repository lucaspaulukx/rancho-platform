import { lazy, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useI18n } from '../i18n/provider';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  ProcessError,
  processMetadata,
  processNext,
  processQuery,
  processReplayTarget,
  prepareReplay,
  type ProcessRecord,
  type ProcessFilters,
} from '../processes';
import {
  Alert,
  Button,
  Confirm,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  useToast,
  Tabs,
} from '../components/ui';
import { formatResourceDate } from '../resource-format';
const Pools = lazy(() =>
  import('./EngineMonitoring').then((module) => ({ default: module.ProcessPools })),
);
const initial: ProcessFilters = { state: 'all', process: '', resource: '', id: '' };
export function Processes() {
  const app = useApp();
  return <ProcessViews key={app.identity} />;
}
function ProcessViews() {
  const { t } = useI18n();
  const app = useApp(),
    [view, setView] = useState(0),
    pools = app.config.modules.processPools,
    selected = pools ? view : 0;
  if (!app.admin || !app.config.modules.processes)
    return <Alert>{t('processes.unavailable')}</Alert>;
  return (
    <>
      <PageHeader title={t('processes.title')} description={t('processes.description')} />
      {pools && (
        <Tabs
          labels={[t('processes.executions'), t('processes.pools')]}
          selected={selected}
          onChange={setView}
          idPrefix="process-view"
          panelId="process-view-panel"
          label={t('processes.view')}
        />
      )}
      <div
        {...(pools
          ? {
              id: 'process-view-panel',
              role: 'tabpanel',
              'aria-labelledby': `process-view-${selected}`,
            }
          : {})}
      >
        <div hidden={selected !== 0}>
          <ProcessesScope active={selected === 0} />
        </div>
        {pools && (
          <div hidden={selected !== 1}>
            <Suspense fallback={<Loading />}>
              <Pools active={selected === 1} />
            </Suspense>
          </div>
        )}
      </div>
    </>
  );
}
function ProcessesScope({ active }: { active: boolean }) {
  const { t, locale } = useI18n();
  const errorText = (error: Error) =>
    error instanceof ProcessError ? t(error.key) : error.message;
  const app = useApp(),
    client = useQueryClient(),
    toast = useToast(),
    schemas = useSchemas(false),
    scope = useRequestScope(app.identity + ':processes');
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial),
    [history, setHistory] = useState<string[]>([]),
    [validation, setValidation] = useState<Error | null>(null);
  const [selected, setSelected] = useState<ProcessRecord | null>(null),
    [replay, setReplay] = useState<ProcessRecord | null>(null);
  const path = history.at(-1) || processQuery(filters);
  const query = useQuery({
    queryKey: ['data', app.identity, 'processes', path],
    enabled: active && app.admin && app.config.modules.processes,
    gcTime: 0,
    refetchInterval: active ? 10000 : false,
    queryFn: async ({ signal }) => {
      const page = await api<{ data: Resource[]; pagination?: { next?: string } }>(
        path,
        undefined,
        undefined,
        signal,
      );
      if (!Array.isArray(page.data)) throw new ProcessError('processes.invalidResponse');
      return { rows: page.data.map(processMetadata), next: processNext(page.pagination?.next) };
    },
  });
  const run = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (
        !app.admin ||
        !app.config.modules.processes ||
        !app.config.modules.processReplay ||
        !replay
      )
        throw new ProcessError('processes.replayUnavailable');
      const signal = scope.signal();
      const contract = await api<Schema>('schemas/processInstance', undefined, undefined, signal);
      scope.assertCurrent();
      const fresh = processMetadata(
        await api<Resource>('processinstances/' + replay.id, undefined, undefined, signal),
      );
      scope.assertCurrent();
      const target = prepareReplay(contract, replay, fresh);
      await api<unknown>(target, {}, 'POST', signal);
      scope.assertCurrent();
    },
    onSuccess: () => {
      setReplay(null);
      setSelected(null);
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'processes'] });
      toast(t('processes.sent'));
    },
  });
  usePageLeaveGuard(run.isPending, app.config.modules.unsavedChangesGuard);
  if (!app.admin || !app.config.modules.processes)
    return <Alert>{t('processes.unavailable')}</Alert>;
  const detail = (selected && query.data?.rows.find((v) => v.id === selected.id)) || selected;
  return (
    <>
      <div className="row-actions audit-filter-actions">
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          {t('processes.refresh')}
        </Button>
      </div>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            processQuery(draft);
            setFilters({ ...draft });
            setHistory([]);
            setValidation(null);
          } catch (error) {
            setValidation(
              error instanceof Error ? error : new ProcessError('processes.reviewFilters'),
            );
          }
        }}
      >
        <div className="form-grid">
          <Field label={t('processes.status')}>
            {(id) => (
              <select
                id={id}
                value={draft.state}
                onChange={(e) =>
                  setDraft({ ...draft, state: e.target.value as ProcessFilters['state'] })
                }
              >
                <option value="all">{t('processes.all')}</option>
                <option value="running">{t('processes.running')}</option>
                <option value="waiting">{t('processes.waiting')}</option>
                <option value="completed">{t('processes.completed')}</option>
              </select>
            )}
          </Field>
          <Field label={t('processes.name')}>
            {(id) => (
              <input
                id={id}
                value={draft.process}
                onChange={(e) => setDraft({ ...draft, process: e.target.value })}
                placeholder={t('processes.example')}
              />
            )}
          </Field>
          <Field label={t('processes.resourceType')}>
            {(id) => (
              <input
                id={id}
                value={draft.resource}
                onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
              />
            )}
          </Field>
          <Field label={t('processes.resourceId')}>
            {(id) => (
              <input
                id={id}
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              />
            )}
          </Field>
        </div>
        <div className="row-actions audit-filter-actions">
          <Button type="submit">{t('processes.apply')}</Button>
          <Button
            onClick={() => {
              setDraft(initial);
              setFilters(initial);
              setHistory([]);
              setValidation(null);
            }}
          >
            {t('processes.clear')}
          </Button>
        </div>
        {validation && <Alert>{errorText(validation)}</Alert>}
      </form>
      <Alert tone="info">{t('processes.listInfo')}</Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState
          error={
            query.error instanceof ProcessError ? new Error(errorText(query.error)) : query.error
          }
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <DataTable
            paginate={false}
            rows={query.data?.rows || []}
            rowKey={(v) => v.id}
            searchText={(v) =>
              `${v.id} ${v.processName} ${v.resourceType} ${v.resourceId} ${v.phase} ${v.exitReason}`
            }
            columns={[
              {
                key: 'process',
                label: t('processes.process'),
                render: (v) => (
                  <>
                    <strong>{v.processName || '—'}</strong>
                    <small className="muted"> {v.id}</small>
                  </>
                ),
              },
              {
                key: 'resource',
                label: t('processes.resource'),
                render: (v) => `${v.resourceType} ${v.resourceId}`,
              },
              { key: 'phase', label: t('processes.phase'), render: (v) => v.phase || '—' },
              { key: 'exit', label: t('processes.exit'), render: (v) => v.exitReason || '—' },
              {
                key: 'start',
                label: t('processes.start'),
                render: (v) => formatResourceDate(v.startTime, locale),
              },
              {
                key: 'detail',
                label: t('processes.details'),
                render: (v) => (
                  <Button
                    onClick={() => setSelected(v)}
                    aria-label={t('processes.detailLabel', { id: v.id })}
                  >
                    {t('processes.viewDetails')}
                  </Button>
                ),
              },
            ]}
          />
          <div className="row-actions audit-pagination">
            <Button
              disabled={!history.length || query.isFetching}
              onClick={() => setHistory((v) => v.slice(0, -1))}
            >
              {t('processes.previous')}
            </Button>
            <span aria-live="polite">{t('processes.page', { page: history.length + 1 })}</span>
            <Button
              disabled={!query.data?.next || query.isFetching}
              onClick={() => {
                if (query.data?.next) setHistory((v) => [...v, query.data!.next!]);
              }}
            >
              {t('processes.more')}
            </Button>
          </div>
        </>
      )}
      <Modal
        open={!!detail}
        onOpenChange={(open) => {
          if (!open && !run.isPending) setSelected(null);
        }}
        title={t('processes.detailTitle')}
        footer={
          detail &&
          app.config.modules.processReplay &&
          processReplayTarget(schemas.data?.processInstance, detail) ? (
            <Button
              onClick={() => {
                run.reset();
                setReplay(detail);
              }}
            >
              {t('processes.rerun')}
            </Button>
          ) : undefined
        }
      >
        <dl className="details-grid">
          {detail &&
            Object.entries({
              [t('processes.id')]: detail.id,
              [t('processes.process')]: detail.processName,
              [t('processes.resource')]: `${detail.resourceType} ${detail.resourceId}`,
              [t('processes.account')]: detail.accountId,
              [t('processes.phase')]: detail.phase,
              [t('processes.exitReason')]: detail.exitReason,
              [t('processes.executions')]: detail.executionCount,
              [t('processes.start')]: formatResourceDate(detail.startTime, locale),
              [t('processes.end')]: formatResourceDate(detail.endTime, locale),
              [t('processes.scheduled')]: formatResourceDate(detail.runAfter, locale),
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v ?? '—'}</dd>
              </div>
            ))}
        </dl>
      </Modal>
      <Confirm
        open={!!replay}
        onOpenChange={(open) => {
          if (!open && !run.isPending) setReplay(null);
        }}
        title={t('processes.rerunTitle')}
        description={t('processes.replayDescription', {
          name: replay?.processName || '',
          id: replay?.id || '',
          type: replay?.resourceType || '',
          resource: replay?.resourceId || '',
        })}
        busy={run.isPending}
        onConfirm={() => run.mutate()}
      >
        {run.error && <Alert>{errorText(run.error)}</Alert>}
      </Confirm>
    </>
  );
}
