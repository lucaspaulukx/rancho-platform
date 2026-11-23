import { lazy, Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
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
  const app = useApp(),
    [view, setView] = useState(0),
    pools = app.config.modules.processPools,
    selected = pools ? view : 0;
  if (!app.admin || !app.config.modules.processes)
    return <Alert>Processos indisponíveis neste acesso.</Alert>;
  return (
    <>
      <PageHeader title="Processos" description="Execuções do engine e seus recursos de origem." />
      {pools && (
        <Tabs
          labels={['Execuções', 'Pools do engine']}
          selected={selected}
          onChange={setView}
          idPrefix="process-view"
          panelId="process-view-panel"
          label="Visão dos processos"
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
  const app = useApp(),
    client = useQueryClient(),
    toast = useToast(),
    schemas = useSchemas(false),
    scope = useRequestScope(app.identity + ':processes');
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial),
    [history, setHistory] = useState<string[]>([]),
    [validation, setValidation] = useState('');
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
      if (!Array.isArray(page.data)) throw new Error('Resposta de processos inválida.');
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
        throw new Error('Replay indisponível neste acesso.');
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
      toast('Replay enviado ao engine. Acompanhe o estado retornado pelo servidor.');
    },
  });
  usePageLeaveGuard(run.isPending, app.config.modules.unsavedChangesGuard);
  if (!app.admin || !app.config.modules.processes)
    return <Alert>Processos indisponíveis neste acesso.</Alert>;
  const detail = (selected && query.data?.rows.find((v) => v.id === selected.id)) || selected;
  return (
    <>
      <div className="row-actions audit-filter-actions">
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          Atualizar
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
            setValidation('');
          } catch (error) {
            setValidation(error instanceof Error ? error.message : 'Revise os filtros.');
          }
        }}
      >
        <div className="form-grid">
          <Field label="Situação dos processos">
            {(id) => (
              <select
                id={id}
                value={draft.state}
                onChange={(e) =>
                  setDraft({ ...draft, state: e.target.value as ProcessFilters['state'] })
                }
              >
                <option value="all">Todos</option>
                <option value="running">Em execução</option>
                <option value="waiting">Aguardando execução</option>
                <option value="completed">Concluídos</option>
              </select>
            )}
          </Field>
          <Field label="Nome do processo">
            {(id) => (
              <input
                id={id}
                value={draft.process}
                onChange={(e) => setDraft({ ...draft, process: e.target.value })}
                placeholder="Ex.: credential.update"
              />
            )}
          </Field>
          <Field label="Tipo de recurso">
            {(id) => (
              <input
                id={id}
                value={draft.resource}
                onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
              />
            )}
          </Field>
          <Field label="ID do recurso">
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
          <Button type="submit">Aplicar filtros</Button>
          <Button
            onClick={() => {
              setDraft(initial);
              setFilters(initial);
              setHistory([]);
              setValidation('');
            }}
          >
            Limpar filtros
          </Button>
        </div>
        {validation && <Alert>{validation}</Alert>}
      </form>
      <Alert tone="info">
        Até 100 execuções por página; busca somente na página atual. Dados internos e resultados
        livres do engine são omitidos. O replay pode repetir efeitos no recurso e exige revisão.
      </Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
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
                label: 'Processo',
                render: (v) => (
                  <>
                    <strong>{v.processName || '—'}</strong>
                    <small className="muted"> {v.id}</small>
                  </>
                ),
              },
              {
                key: 'resource',
                label: 'Recurso',
                render: (v) => `${v.resourceType} ${v.resourceId}`,
              },
              { key: 'phase', label: 'Fase', render: (v) => v.phase || '—' },
              { key: 'exit', label: 'Saída', render: (v) => v.exitReason || '—' },
              { key: 'start', label: 'Início', render: (v) => formatResourceDate(v.startTime) },
              {
                key: 'detail',
                label: 'Detalhes',
                render: (v) => (
                  <Button
                    onClick={() => setSelected(v)}
                    aria-label={`Detalhes do processo ${v.id}`}
                  >
                    Ver detalhes
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
              Execuções anteriores
            </Button>
            <span aria-live="polite">Página {history.length + 1}</span>
            <Button
              disabled={!query.data?.next || query.isFetching}
              onClick={() => {
                if (query.data?.next) setHistory((v) => [...v, query.data!.next!]);
              }}
            >
              Mais execuções
            </Button>
          </div>
        </>
      )}
      <Modal
        open={!!detail}
        onOpenChange={(open) => {
          if (!open && !run.isPending) setSelected(null);
        }}
        title="Detalhes do processo"
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
              Reexecutar processo
            </Button>
          ) : undefined
        }
      >
        <dl className="details-grid">
          {detail &&
            Object.entries({
              ID: detail.id,
              Processo: detail.processName,
              Recurso: `${detail.resourceType} ${detail.resourceId}`,
              Conta: detail.accountId,
              Fase: detail.phase,
              'Motivo de saída': detail.exitReason,
              Execuções: detail.executionCount,
              Início: formatResourceDate(detail.startTime),
              Fim: formatResourceDate(detail.endTime),
              'Agendado para': formatResourceDate(detail.runAfter),
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
        title="Reexecutar processo?"
        description={`Processo ${replay?.processName || ''} (${replay?.id || ''}) sobre ${replay?.resourceType || ''} ${replay?.resourceId || ''}. O engine pode repetir efeitos no recurso. A operação não pode ser desfeita pela console.`}
        busy={run.isPending}
        onConfirm={() => run.mutate()}
      >
        {run.error && <Alert>{run.error.message}</Alert>}
      </Confirm>
    </>
  );
}
