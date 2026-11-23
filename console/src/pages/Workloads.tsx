import { useI18n } from '../i18n/provider';
import { resourceStateLabel } from '../i18n/resource-state';
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
  ResourceStateBadge,
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
  const { t, formats } = useI18n();
  const app = useApp();
  const suffix = `?env=${encodeURIComponent(app.project!.id)}`;
  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      searchText={(row) => `${row.name || ''} ${row.id} ${imageName(row)} ${row.state || ''}`}
      emptyTitle={
        kind === 'services' ? t('workloadsPage.noServices') : t('workloadsPage.noContainers')
      }
      emptyDescription={t('workloadsPage.emptyDescription')}
      columns={[
        {
          key: 'name',
          label: kind === 'services' ? t('workloadsPage.service') : t('workloadsPage.container'),
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
          label: t('workloadsPage.state'),
          sortValue: (row) => row.state || '',
          render: (row) => (
            <div>
              <ResourceStateBadge state={row.state} />
              {typeof row.healthState === 'string' && (
                <small className="health-label">
                  {t('workloadsPage.health', { state: resourceStateLabel(t, row.healthState) })}
                </small>
              )}
            </div>
          ),
        },
        {
          key: 'stack',
          label: t('workloadsPage.stack'),
          render: (row) => {
            const stack =
              kind === 'services'
                ? inventory.stacks.find((stack) => stack.id === row.stackId)
                : containerStack(row, inventory);
            return stack ? (
              <Link to={`/stacks/${stack.id}${suffix}`}>{stack.name || stack.id}</Link>
            ) : (
              <span className="muted">{t('workloadsPage.noStack')}</span>
            );
          },
        },
        {
          key: 'image',
          label: t('workloadsPage.image'),
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
                label: t('workloadsPage.scale'),
                render: (row: Resource) =>
                  `${formats.number(containersForService(row, inventory.containers).length)} / ${typeof row.scale === 'number' ? formats.number(row.scale) : (row.scale ?? '—')}`,
              },
            ]
          : [
              {
                key: 'host',
                label: t('workloadsPage.host'),
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
          label: t('workloadsPage.details'),
          render: (row) => (
            <Link
              className="button ghost"
              aria-label={t('workloadsPage.open', { name: row.name || row.id })}
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
  const { t, locale, formats } = useI18n();
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
        .toLocaleLowerCase(locale)
        .includes(search.toLocaleLowerCase(locale)),
    );
  const states = [...new Set(inventory[kind].map((row) => row.state).filter(Boolean))].sort();
  return (
    <>
      <div className="workload-context">
        <Layers3 size={18} />
        <strong>{app.project!.name}</strong>
        <span className="muted">
          {[
            t('workloadsPage.stackCount', { count: inventory.stacks.length }),
            t('workloadsPage.serviceCount', { count: inventory.services.length }),
            t('workloadsPage.containerCount', { count: inventory.containers.length }),
          ].join(' · ')}
        </span>
        <Button variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}>
          {t('workloadsPage.refresh')}
        </Button>
      </div>
      <div className="workload-filters">
        {kind === 'stacks' ? (
          <Field label={t('workloadsPage.searchStack')}>
            {(id) => (
              <input
                id={id}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('workloadsPage.searchPlaceholder')}
              />
            )}
          </Field>
        ) : (
          <Field label={t('workloadsPage.stack')}>
            {(id) => (
              <select
                id={id}
                value={stackId}
                onChange={(event) => filter('stack', event.target.value)}
              >
                <option value="">{t('workloadsPage.allStacks')}</option>
                {stacks.map((stack) => (
                  <option key={stack.id} value={stack.id}>
                    {stack.name || stack.id}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label={t('workloadsPage.state')}>
          {(id) => (
            <select id={id} value={state} onChange={(event) => filter('state', event.target.value)}>
              <option value="">{t('workloadsPage.allStates')}</option>
              {states.map((value) => (
                <option key={value} value={value}>
                  {resourceStateLabel(t, value)}
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
          {t('workloadsPage.includeInfra')}
        </label>
      </div>
      {stackId && !selectedStack ? (
        <Alert>{t('workloadsPage.unavailableStack')}</Alert>
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
                  <ResourceStateBadge state={stack.state} />
                </div>
                <h2>
                  <Link to={`/stacks/${stack.id}?env=${app.project!.id}`}>
                    {stack.name || stack.id}
                  </Link>
                </h2>
                <p className="muted">
                  {stack.description ||
                    (stack.system ? t('workloadsPage.infraStack') : t('workloadsPage.appStack'))}
                </p>
                <div className="stack-metrics">
                  <Link
                    to={`/services?env=${app.project!.id}&stack=${stack.id}${includeSystem ? '&system=true' : ''}`}
                  >
                    <strong>{formats.number(children.services.length)}</strong>{' '}
                    {t('workloadsPage.services')}
                  </Link>
                  <Link
                    to={`/containers?env=${app.project!.id}&stack=${stack.id}${includeSystem ? '&system=true' : ''}`}
                  >
                    <strong>{formats.number(children.containers.length)}</strong>{' '}
                    {t('workloadsPage.containers')}
                  </Link>
                </div>
                <div className="stack-card-footer">
                  <span className="muted">
                    {t('workloadsPage.health', {
                      state: stack.healthState
                        ? resourceStateLabel(t, String(stack.healthState))
                        : t('workloadsPage.unknownHealth'),
                    })}
                  </span>
                  <Link
                    className="button ghost"
                    to={`/stacks/${stack.id}?env=${app.project!.id}`}
                    aria-label={t('workloadsPage.openStack', { name: stack.name || stack.id })}
                  >
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </article>
            );
          })}
          {!rows.length && (
            <Empty
              title={t('workloadsPage.noStacks')}
              description={t('workloadsPage.noStacksDescription')}
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
  const { t } = useI18n();
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
      <h2>{isStack ? t('workloadsPage.stackResources') : t('workloadsPage.serviceContainers')}</h2>
      {isStack && (
        <Tabs
          selected={tab}
          onChange={setTab}
          labels={[
            t('workloadsPage.servicesTab', { count: contents.services.length }),
            t('workloadsPage.containersTab', { count: contents.containers.length }),
          ]}
          idPrefix={`stack-${resource.id}`}
          panelId={`stack-panel-${resource.id}`}
          label={t('workloadsPage.stackResources')}
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
