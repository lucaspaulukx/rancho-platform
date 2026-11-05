import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Box, Layers3, Network } from 'lucide-react';
import { allPages, type Resource } from '../api';
import { useApp, useDataKey } from '../state';
import { publicWorkload } from '../workload-privacy';
import {
  activeResources,
  containerStack,
  containersForService,
  imageName,
  stackContents,
  type WorkloadInventory,
} from '../workloads';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  Empty,
  ErrorState,
  Field,
  Loading,
  Tabs,
} from '../components/ui';

export function useWorkloadInventory() {
  const app = useApp();
  return useQuery({
    queryKey: useDataKey('workload-inventory'),
    queryFn: async ({ signal }): Promise<WorkloadInventory> => {
      const base = `projects/${encodeURIComponent(app.project!.id)}`;
      const [stacks, services, containers] = await Promise.all(
        ['stacks', 'services', 'containers'].map((collection) =>
          allPages<Resource>(`${base}/${collection}?limit=100`, signal),
        ),
      );
      return {
        stacks: activeResources(stacks).map(publicWorkload),
        services: activeResources(services),
        containers: activeResources(containers),
      };
    },
    enabled: !!app.project && app.config.modules.workloads,
    refetchInterval: 15_000,
  });
}
function WorkloadTable({
  kind,
  rows,
  inventory,
}: {
  kind: 'services' | 'containers';
  rows: Resource[];
  inventory: WorkloadInventory;
}) {
  const app = useApp();
  const suffix = `?env=${encodeURIComponent(app.project!.id)}`;
  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      searchText={(row) => `${row.name || ''} ${row.id} ${imageName(row)} ${row.state || ''}`}
      emptyTitle={
        kind === 'services' ? 'Nenhum serviço neste contexto' : 'Nenhum container neste contexto'
      }
      emptyDescription="Confira o environment e os filtros selecionados."
      columns={[
        {
          key: 'name',
          label: kind === 'services' ? 'Serviço' : 'Container',
          sortValue: (row) => row.name || row.id,
          render: (row) => (
            <Link className="row-title" to={`/${kind}/${row.id}${suffix}`}>
              <span className="row-title-icon">
                {kind === 'services' ? <Network size={18} /> : <Box size={18} />}
              </span>
              <div>
                <strong>{row.name || row.id}</strong>
                <small>{row.id}</small>
              </div>
            </Link>
          ),
        },
        {
          key: 'state',
          label: 'Estado',
          sortValue: (row) => row.state || '',
          render: (row) => (
            <div>
              <Badge state={row.state}>{row.state || '—'}</Badge>
              {typeof row.healthState === 'string' && (
                <small className="health-label">Saúde: {row.healthState}</small>
              )}
            </div>
          ),
        },
        {
          key: 'stack',
          label: 'Stack',
          render: (row) => {
            const stack =
              kind === 'services'
                ? inventory.stacks.find((stack) => stack.id === row.stackId)
                : containerStack(row, inventory);
            return stack ? (
              <Link to={`/stacks/${stack.id}${suffix}`}>{stack.name || stack.id}</Link>
            ) : (
              <span className="muted">Sem stack</span>
            );
          },
        },
        {
          key: 'image',
          label: 'Imagem',
          render: (row) => (
            <span className="resource-image" title={imageName(row)}>
              {imageName(row)}
            </span>
          ),
        },
        ...(kind === 'services'
          ? [
              {
                key: 'scale',
                label: 'Containers / escala',
                render: (row: Resource) =>
                  `${containersForService(row, inventory.containers).length} / ${row.scale ?? '—'}`,
              },
            ]
          : [
              {
                key: 'host',
                label: 'Host',
                render: (row: Resource) =>
                  typeof row.hostId === 'string' && app.config.modules.hosts ? (
                    <Link to={`/hosts/${row.hostId}${suffix}`}>{row.hostId}</Link>
                  ) : (
                    String(row.hostId || '—')
                  ),
              },
            ]),
        {
          key: 'open',
          label: 'Detalhes',
          render: (row) => (
            <Link
              className="button ghost"
              aria-label={`Abrir ${row.name || row.id}`}
              to={`/${kind}/${row.id}${suffix}`}
            >
              <ArrowRight size={16} />
            </Link>
          ),
        },
      ]}
    />
  );
}
export function WorkloadList({ kind }: { kind: 'stacks' | 'services' | 'containers' }) {
  const app = useApp();
  const query = useWorkloadInventory();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const stackId = params.get('stack') || '';
  const includeSystem = params.get('system') === 'true';
  const state = params.get('state') || '';
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const inventory = query.data;
  const stacks = inventory.stacks.filter((stack) => includeSystem || !stack.system);
  const allowed = new Set(stacks.map((stack) => stack.id));
  const selectedStack = inventory.stacks.find((stack) => stack.id === stackId);
  const contents = selectedStack ? stackContents(selectedStack, inventory) : inventory;
  let rows =
    kind === 'stacks'
      ? stacks
      : contents[kind].filter((row) => {
          const stack =
            kind === 'services'
              ? inventory.stacks.find((stack) => stack.id === row.stackId)
              : containerStack(row, inventory);
          return !stack || allowed.has(stack.id);
        });
  if (state) rows = rows.filter((row) => row.state === state);
  if (search)
    rows = rows.filter((row) =>
      `${row.name || ''} ${row.description || ''} ${row.id}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
    );
  const states = [...new Set(inventory[kind].map((row) => row.state).filter(Boolean))].sort();
  return (
    <>
      <div className="workload-context">
        <Layers3 size={18} />
        <strong>{app.project!.name}</strong>
        <span className="muted">
          {inventory.stacks.length} stacks · {inventory.services.length} serviços ·{' '}
          {inventory.containers.length} containers
        </span>
        <Button variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}>
          Atualizar inventário
        </Button>
      </div>
      <div className="workload-filters">
        {kind === 'stacks' ? (
          <Field label="Buscar stack">
            {(id) => (
              <input
                id={id}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, descrição ou ID…"
              />
            )}
          </Field>
        ) : (
          <Field label="Stack">
            {(id) => (
              <select
                id={id}
                value={stackId}
                onChange={(event) => filter('stack', event.target.value)}
              >
                <option value="">Todas as stacks</option>
                {stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>
                    {stack.name || stack.id}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Estado">
          {(id) => (
            <select id={id} value={state} onChange={(event) => filter('state', event.target.value)}>
              <option value="">Todos os estados</option>
              {states.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </Field>
        <label className="workload-system">
          <input
            type="checkbox"
            checked={includeSystem}
            onChange={(event) => filter('system', event.target.checked ? 'true' : '')}
          />
          Incluir infraestrutura
        </label>
      </div>
      {stackId && !selectedStack ? (
        <Alert>
          A stack selecionada não existe neste environment ou não está disponível para sua conta.
        </Alert>
      ) : kind === 'stacks' ? (
        <div className="stack-grid">
          {rows.map((stack) => {
            const children = stackContents(stack, inventory);
            return (
              <article className="panel stack-card" key={stack.id}>
                <div className="stack-card-heading">
                  <span className="row-title-icon">
                    <Layers3 size={21} />
                  </span>
                  <Badge state={stack.state}>{stack.state || '—'}</Badge>
                </div>
                <h2>
                  <Link to={`/stacks/${stack.id}?env=${app.project!.id}`}>
                    {stack.name || stack.id}
                  </Link>
                </h2>
                <p className="muted">
                  {stack.description ||
                    (stack.system ? 'Stack de infraestrutura' : 'Stack de aplicação')}
                </p>
                <div className="stack-metrics">
                  <Link
                    to={`/services?env=${app.project!.id}&stack=${stack.id}${includeSystem ? '&system=true' : ''}`}
                  >
                    <strong>{children.services.length}</strong> serviços
                  </Link>
                  <Link
                    to={`/containers?env=${app.project!.id}&stack=${stack.id}${includeSystem ? '&system=true' : ''}`}
                  >
                    <strong>{children.containers.length}</strong> containers
                  </Link>
                </div>
                <div className="stack-card-footer">
                  <span className="muted">
                    Saúde: {String(stack.healthState || 'não informada')}
                  </span>
                  <Link
                    className="button ghost"
                    to={`/stacks/${stack.id}?env=${app.project!.id}`}
                    aria-label={`Abrir stack ${stack.name || stack.id}`}
                  >
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </article>
            );
          })}
          {!rows.length && (
            <Empty
              title="Nenhuma stack neste filtro"
              description="Confira os filtros ou crie uma stack neste environment."
            />
          )}
        </div>
      ) : (
        <WorkloadTable kind={kind} rows={rows} inventory={inventory} />
      )}
    </>
  );
}
export function WorkloadChildren({ resource }: { resource: Resource }) {
  const query = useWorkloadInventory();
  const [tab, setTab] = useState(0);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const inventory = query.data;
  const isStack = resource.type === 'stack';
  const contents = isStack
    ? stackContents(resource, inventory)
    : { services: [], containers: containersForService(resource, inventory.containers) };
  const kind = isStack && tab === 0 ? 'services' : 'containers';
  return (
    <section className="workload-children">
      <h2>{isStack ? 'Recursos da stack' : 'Containers do serviço'}</h2>
      {isStack && (
        <Tabs
          selected={tab}
          onChange={setTab}
          labels={[
            `Serviços (${contents.services.length})`,
            `Containers (${contents.containers.length})`,
          ]}
          idPrefix={`stack-${resource.id}`}
          panelId={`stack-panel-${resource.id}`}
          label="Recursos da stack"
        />
      )}
      <div
        id={`stack-panel-${resource.id}`}
        role={isStack ? 'tabpanel' : undefined}
        aria-labelledby={isStack ? `stack-${resource.id}-${tab}` : undefined}
      >
        <WorkloadTable kind={kind} rows={contents[kind]} inventory={inventory} />
      </div>
    </section>
  );
}
