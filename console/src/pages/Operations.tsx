import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Layers3,
  ListTree,
  Network,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  ScrollText,
  Square,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import type { Resource, Schema } from '../api';
import { useApp } from '../state';
import { useI18n } from '../i18n/provider';
import { useSchemas, canManageResource } from '../hooks/useSchemas';
import { useWorkloadInventory } from './Workloads';
import { workloadTree, type ServiceNode } from '../workload-tree';
import { imageName, stackContents } from '../workloads';
import { serviceMetricsEnabled } from '../metrics';
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  Tabs,
} from '../components/ui';
import { ActionMenu } from '../components/ActionMenu';
import {
  operationActionLabel,
  operationCommands,
  operationContainers,
  type OperationCommand,
} from '../operation-actions';
import { WorkloadStreams } from '../components/WorkloadStreams';
import { ResourcePanel, type ResourceSelection } from '../components/ResourcePanel';
import {
  ResourceCreator,
  creationLabels,
  getCreationLabel,
  type CreationSelection,
} from '../components/ResourceCreator';
import { commonBulkActions, resourceKey } from '../bulk-actions';
import { BulkOperation, type BulkPlan } from '../components/BulkOperation';

const ServiceTopology = lazy(() => import('../components/ServiceTopology'));

export function OperationsPage({
  initialView = 'stacks',
}: {
  initialView?: 'stacks' | 'services' | 'containers';
}) {
  const app = useApp();
  const { t } = useI18n();
  const query = useWorkloadInventory();
  const schemas = useSchemas(true);
  const [params, setParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [expandedServices, setExpandedServices] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<ResourceSelection | null>(null);
  const [creation, setCreation] = useState<CreationSelection | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [batch, setBatch] = useState<BulkPlan | null>(null);
  const [topology, setTopology] = useState(false);
  const [stream, setStream] = useState<{ parent: Resource; mode: 'logs' | 'execute' } | null>(null);
  useEffect(() => {
    if (query.data) {
      const keys = new Set(
        [...query.data.stacks, ...query.data.services, ...query.data.containers].map(resourceKey),
      );
      setChecked((previous) => {
        const next = new Set([...previous].filter((key) => keys.has(key)));
        return next.size === previous.size ? previous : next;
      });
    }
  }, [query.data]);
  const text = params.get('q') || '';
  const state = params.get('state') || '';
  const includeSystem = params.get('system') === 'true';
  const requestedView = params.get('view') || initialView;
  const view =
    app.config.modules.contextActions &&
    ['stacks', 'services', 'containers'].includes(requestedView)
      ? requestedView
      : 'stacks';
  const tree = useMemo(
    () =>
      query.data ? workloadTree(query.data, { query: text, state, includeSystem }) : undefined,
    [query.data, text, state, includeSystem],
  );
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function toggleStack(id: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleService(id: string) {
    setExpandedServices((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  if (!app.project)
    return (
      <Empty
        title={t('operations.selectEnvironment')}
        description={t('operations.selectEnvironmentHint')}
      />
    );
  if (query.isPending || schemas.isPending) return <Loading />;
  if (query.error || schemas.error)
    return (
      <ErrorState
        error={query.error || schemas.error}
        retry={() => {
          void query.refetch();
          void schemas.refetch();
        }}
      />
    );
  const inventory = query.data!;
  const selected = [...inventory.stacks, ...inventory.services, ...inventory.containers].filter(
    (resource) => checked.has(resourceKey(resource)),
  );
  const actions = commonBulkActions(selected, schemas.data || {});
  const states = [
    ...new Set(
      [...inventory.stacks, ...inventory.services, ...inventory.containers]
        .map((resource) => resource.state)
        .filter(Boolean),
    ),
  ].sort();
  const visibleServices = tree
    ? [...tree.stacks.flatMap((node) => node.services), ...tree.services]
    : [];
  const visibleContainers = tree
    ? [
        ...new Map(
          [
            ...tree.stacks.flatMap((node) => [
              ...node.containers,
              ...node.services.flatMap((service) => service.containers),
            ]),
            ...tree.services.flatMap((node) => node.containers),
            ...tree.containers,
          ].map((value) => [value.id, value]),
        ).values(),
      ]
    : [];
  const noResults =
    !tree ||
    (view === 'services'
      ? !visibleServices.length
      : view === 'containers'
        ? !visibleContainers.length
        : !tree.stacks.length && !tree.services.length && !tree.containers.length);
  const open = (resource: Resource, mode: ResourceSelection['mode'] = 'detail', action?: string) =>
    setSelection({ resource, mode, action });
  const row = (
    resource: Resource,
    kind: 'stack' | 'service' | 'container',
    extra?: React.ReactNode,
  ) => (
    <OperationRow
      key={resource.id}
      resource={resource}
      kind={kind}
      schema={schemas.data?.[resource.type]}
      extra={extra}
      selected={checked.has(resourceKey(resource))}
      selectionDisabled={checked.size >= 100 && !checked.has(resourceKey(resource))}
      onToggleSelection={
        app.config.modules.bulkActions &&
        (checked.has(resourceKey(resource)) ||
          commonBulkActions([resource], schemas.data || {}).length > 0)
          ? () =>
              setChecked((previous) => {
                const next = new Set(previous);
                const key = resourceKey(resource);
                if (next.has(key)) next.delete(key);
                else if (next.size < 100) next.add(key);
                return next;
              })
          : undefined
      }
      onOpen={open}
      onCreateService={
        kind === 'stack' && schemas.data?.service?.collectionMethods?.includes('POST')
          ? () => setCreation({ kind: 'service', stack: resource })
          : undefined
      }
      commands={
        app.config.modules.contextActions
          ? (() => {
              const containers = operationContainers(resource, inventory, app.project!.id);
              const restartable =
                kind === 'stack' && app.config.modules.bulkActions
                  ? stackContents(resource, inventory).services.filter((value) =>
                      commonBulkActions([value], schemas.data || {}).includes('restart'),
                    )
                  : [];
              return operationCommands(
                resource,
                schemas.data?.[resource.type],
                {
                  environment: app.project!.id,
                  observability: app.config.modules.observability,
                  metrics: app.config.modules.metrics,
                  serviceMetrics: serviceMetricsEnabled(app.config.modules),
                  containers,
                  containerWritable: canManageResource(schemas.data?.container),
                  createService: !!schemas.data?.service?.collectionMethods?.includes('POST'),
                  restartServices: restartable.length,
                  scaling: app.config.modules.workloadScaling,
                  serviceLinks: app.config.modules.serviceLinksEditor,
                  balancerRules: app.config.modules.balancerRulesEditor,
                },
                t,
              ).map((command) => ({
                ...command,
                onSelect: () => {
                  if (command.kind === 'logs' || command.kind === 'execute') {
                    if (kind === 'container') open(resource, command.kind);
                    else setStream({ parent: resource, mode: command.kind });
                  } else if (command.kind === 'create')
                    setCreation({ kind: 'service', stack: resource });
                  else if (command.kind === 'restartServices')
                    setBatch({ action: 'restart', resources: restartable });
                  else if (command.kind === 'native') open(resource, 'action', command.action);
                  else open(resource, command.kind);
                },
              }));
            })()
          : undefined
      }
    />
  );
  const service = (node: ServiceNode, indent = true) => {
    const expanded = !!text || expandedServices.has(node.resource.id);
    return (
      <div
        className={indent ? 'operation-service nested' : 'operation-service'}
        key={node.resource.id}
      >
        <div className="operation-expand-row">
          <button
            className="tree-toggle"
            aria-label={t(
              expanded ? 'operations.collapseContainers' : 'operations.expandContainers',
              { name: node.resource.name || node.resource.id },
            )}
            aria-expanded={expanded}
            aria-controls={`service-children-${node.resource.id}`}
            onClick={() => toggleService(node.resource.id)}
          >
            {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>
          {row(
            node.resource,
            'service',
            <span className="operation-count">
              {!indent &&
                `${inventory.stacks.find((stack) => stack.id === node.resource.stackId)?.name || t('operations.noStack')} · `}
              {t('operations.containerCount', {
                count: node.containers.length,
                scale: String(node.resource.scale ?? '—'),
              })}
            </span>,
          )}
        </div>
        {expanded && (
          <div id={`service-children-${node.resource.id}`} className="operation-containers">
            {node.containers.length ? (
              node.containers.map((container) => row(container, 'container'))
            ) : (
              <p className="operation-empty">{t('operations.emptyService')}</p>
            )}
          </div>
        )}
      </div>
    );
  };
  return (
    <>
      <PageHeader
        title={app.project.name}
        eyebrow={t('operations.eyebrow')}
        description={t('operations.description')}
        action={
          <>
            {Object.keys(creationLabels).some((kind) =>
              schemas.data?.[kind]?.collectionMethods?.includes('POST'),
            ) && (
              <details className="creation-menu">
                <summary className="button primary">
                  <Plus size={16} />
                  {t('operations.create')}
                </summary>
                <div className="creation-options">
                  {Object.keys(creationLabels)
                    .filter((kind) => schemas.data?.[kind]?.collectionMethods?.includes('POST'))
                    .map((kind) => (
                      <button
                        key={kind}
                        onClick={(event) => {
                          const menu = event.currentTarget.closest('details');
                          if (menu) menu.open = false;
                          setCreation({ kind });
                        }}
                      >
                        {getCreationLabel(kind, t)}
                      </button>
                    ))}
                </div>
              </details>
            )}
            <Button onClick={() => void query.refetch()} busy={query.isFetching}>
              <RefreshCw size={16} />
              {t('operations.refresh')}
            </Button>
          </>
        }
      />
      <div className="operation-metrics">
        {[
          [Layers3, inventory.stacks.length, t('operations.stackMetric')],
          [Network, inventory.services.length, t('operations.serviceMetric')],
          [Box, inventory.containers.length, t('operations.containerMetric')],
        ].map(([Icon, count, label]) => {
          const Symbol = Icon as typeof Box;
          return (
            <div key={String(label)}>
              <Symbol size={18} />
              <strong>{String(count)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
        <span className="muted">{t('operations.totals')}</span>
      </div>
      <div className="operation-toolbar">
        <Field label={t('operations.search')}>
          {(id) => (
            <input
              id={id}
              type="search"
              value={text}
              onChange={(event) => filter('q', event.target.value)}
              placeholder={t('operations.searchPlaceholder')}
            />
          )}
        </Field>
        <Field label={t('operations.state')}>
          {(id) => (
            <select id={id} value={state} onChange={(event) => filter('state', event.target.value)}>
              <option value="">{t('operations.allStates')}</option>
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
          {t('operations.includeSystem')}
        </label>
      </div>
      {app.config.modules.contextActions && (
        <Tabs
          labels={[t('operations.stacks'), t('operations.services'), t('operations.containers')]}
          selected={['stacks', 'services', 'containers'].indexOf(view)}
          onChange={(index) => filter('view', ['stacks', 'services', 'containers'][index])}
          idPrefix="operation-view"
          panelId="operation-workspace"
          label={t('operations.view')}
        />
      )}
      <div className="operation-tree-tools">
        <span className="muted">
          <ListTree size={16} />
          {view === 'services'
            ? t('operations.visibleServices', { count: visibleServices.length })
            : view === 'containers'
              ? t('operations.visibleContainers', { count: visibleContainers.length })
              : t('operations.visibleStacks', { count: tree?.stacks.length || 0 })}
          {!includeSystem &&
            t('operations.hiddenSystem', {
              count: inventory.stacks.filter((stack) => stack.system).length,
            })}
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setCollapsed(new Set());
            setExpandedServices(new Set(inventory.services.map((resource) => resource.id)));
          }}
        >
          {t('operations.expandAll')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setCollapsed(new Set(inventory.stacks.map((resource) => resource.id)));
            setExpandedServices(new Set());
          }}
        >
          {t('operations.collapseAll')}
        </Button>
        <Button onClick={() => setTopology(true)}>
          <Network size={16} />
          {t('operations.topology')}
        </Button>
      </div>
      {noResults ? (
        <div
          id="operation-workspace"
          role={app.config.modules.contextActions ? 'tabpanel' : undefined}
          aria-labelledby={
            app.config.modules.contextActions
              ? `operation-view-${['stacks', 'services', 'containers'].indexOf(view)}`
              : undefined
          }
        >
          <Empty title={t('operations.empty')} description={t('operations.emptyHint')} />
        </div>
      ) : (
        <div
          className="operation-tree"
          id="operation-workspace"
          role={app.config.modules.contextActions ? 'tabpanel' : undefined}
          aria-labelledby={
            app.config.modules.contextActions
              ? `operation-view-${['stacks', 'services', 'containers'].indexOf(view)}`
              : undefined
          }
        >
          {app.config.modules.bulkActions && !!selected.length && (
            <section className="panel bulk-toolbar" aria-label={t('operations.bulkActions')}>
              <strong>{t('operations.selection', { count: selected.length })}</strong>
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={action === 'remove' ? 'danger' : 'secondary'}
                  onClick={() => setBatch({ action, resources: [...selected] })}
                >
                  {action === 'remove' && <Trash2 size={16} />}
                  {t('operations.selectedAction', { action: operationActionLabel(t, action) })}
                </Button>
              ))}
              {!actions.length && <span className="muted">{t('operations.noCommonAction')}</span>}
              <Button variant="ghost" onClick={() => setChecked(new Set())}>
                {t('operations.clearSelection')}
              </Button>
            </section>
          )}
          {view === 'stacks' &&
            tree!.stacks.map((node) => {
              const expanded = !!text || !collapsed.has(node.resource.id);
              return (
                <section
                  className="operation-stack"
                  key={node.resource.id}
                  aria-label={t('operations.stackName', {
                    name: node.resource.name || node.resource.id,
                  })}
                >
                  <div className="operation-expand-row stack-heading">
                    <button
                      className="tree-toggle"
                      aria-label={t(
                        expanded ? 'operations.collapseStack' : 'operations.expandStack',
                        { name: node.resource.name || node.resource.id },
                      )}
                      aria-expanded={expanded}
                      aria-controls={`stack-children-${node.resource.id}`}
                      onClick={() => toggleStack(node.resource.id)}
                    >
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {row(
                      node.resource,
                      'stack',
                      <span className="operation-count">
                        {t('operations.serviceCount', { count: node.services.length })}
                        {node.resource.system ? t('operations.system') : ''}
                      </span>,
                    )}
                  </div>
                  {expanded && (
                    <div id={`stack-children-${node.resource.id}`} className="operation-stack-body">
                      {node.services.map((node) => service(node))}
                      {node.containers.map((container) => row(container, 'container'))}
                      {!node.services.length && !node.containers.length && (
                        <p className="operation-empty">{t('operations.emptyStack')}</p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          {view === 'stacks' && !!tree!.services.length && (
            <section className="operation-stack">
              <h2 className="operation-section-title">{t('operations.orphanServices')}</h2>
              {tree!.services.map((node) => service(node, false))}
            </section>
          )}
          {view === 'stacks' && !!tree!.containers.length && (
            <section className="operation-stack">
              <h2 className="operation-section-title">
                <Box size={19} />
                {t('operations.orphanContainers')}
              </h2>
              {tree!.containers.map((container) => row(container, 'container'))}
            </section>
          )}
          {view === 'services' && (
            <section className="operation-stack" aria-label={t('operations.environmentServices')}>
              {visibleServices.map((node) => service(node, false))}
            </section>
          )}
          {view === 'containers' && (
            <section className="operation-stack" aria-label={t('operations.environmentContainers')}>
              {visibleContainers.map((container) =>
                row(
                  container,
                  'container',
                  <span className="operation-count">
                    {inventory.stacks.find(
                      (stack) =>
                        stack.id === container.stackId ||
                        stackContents(stack, inventory).containers.some(
                          (value) => value.id === container.id,
                        ),
                    )?.name || t('operations.standaloneContainer')}
                  </span>,
                ),
              )}
            </section>
          )}
        </div>
      )}
      {selection && (
        <ResourcePanel
          key={`${selection.resource.id}-${selection.mode}-${selection.action}`}
          selection={selection}
          onClose={() => setSelection(null)}
        />
      )}
      {creation && (
        <ResourceCreator
          key={`${creation.kind}-${creation.stack?.id}`}
          selection={creation}
          references={{
            stack: inventory.stacks,
            service: inventory.services,
            container: inventory.containers,
          }}
          onClose={() => setCreation(null)}
        />
      )}
      {topology && (
        <Suspense fallback={<Loading />}>
          <ServiceTopology
            key={`${app.identity}:${app.project.id}`}
            services={inventory.services}
            stacks={inventory.stacks}
            schema={schemas.data?.serviceConsumeMap}
            onClose={() => setTopology(false)}
          />
        </Suspense>
      )}
      {batch && (
        <BulkOperation
          plan={batch}
          onClose={() => {
            setBatch(null);
            setChecked(new Set());
          }}
        />
      )}
      {stream && app.config.modules.contextActions && (
        <WorkloadStreams
          key={`${app.identity}:${app.project.id}:${stream.parent.id}:${stream.mode}`}
          parent={stream.parent}
          mode={stream.mode}
          containers={operationContainers(stream.parent, inventory, app.project.id)}
          onClose={() => setStream(null)}
        />
      )}
    </>
  );
}
function OperationRow({
  resource,
  kind,
  schema,
  extra,
  onOpen,
  onCreateService,
  selected,
  onToggleSelection,
  selectionDisabled,
  commands,
}: {
  resource: Resource;
  kind: 'stack' | 'service' | 'container';
  schema?: Schema;
  extra?: React.ReactNode;
  onOpen: (resource: Resource, mode?: ResourceSelection['mode'], action?: string) => void;
  onCreateService?: () => void;
  selected?: boolean;
  onToggleSelection?: () => void;
  selectionDisabled?: boolean;
  commands?: (OperationCommand & { onSelect: () => void })[];
}) {
  const app = useApp();
  const { t } = useI18n();
  const Icon = kind === 'stack' ? Layers3 : kind === 'service' ? Network : Box;
  const quickActions = [
    ['start', Play],
    ['activate', Play],
    ['stop', Square],
    ['deactivate', Square],
    ['restart', RotateCw],
  ] as const;
  return (
    <div
      className={`operation-row ${kind} ${commands ? 'contextual' : ''} ${onToggleSelection && canManageResource(schema) ? 'selectable' : ''}`}
    >
      {onToggleSelection && canManageResource(schema) && (
        <input
          className="operation-selection"
          type="checkbox"
          disabled={selectionDisabled}
          aria-label={t('operations.selectResource', { name: resource.name || resource.id })}
          checked={selected || false}
          onChange={onToggleSelection}
        />
      )}
      <span className="operation-kind">
        <Icon size={kind === 'container' ? 17 : 20} />
      </span>
      <div className="operation-resource-name">
        <button className="resource-name-button" onClick={() => onOpen(resource)}>
          <bdi>{resource.name || resource.id}</bdi>
        </button>
        <span className="muted" title={imageName(resource)}>
          {kind === 'stack' ? (
            <bdi>{resource.description || resource.id}</bdi>
          ) : (
            <bdi dir="ltr">{imageName(resource)}</bdi>
          )}
        </span>
        {extra}
      </div>
      <div className="operation-state">
        <Badge state={resource.state}>{resource.state || '—'}</Badge>
        {typeof resource.healthState === 'string' && (
          <Badge state={resource.healthState}>{resource.healthState}</Badge>
        )}
      </div>
      <div className="operation-row-actions">
        {commands ? (
          <ActionMenu
            label={t('operations.resourceActions', { name: resource.name || resource.id })}
            actions={commands}
          />
        ) : (
          <>
            {canManageResource(schema) &&
              quickActions
                .filter(([name]) => resource.actions?.[name])
                .map(([name, ActionIcon]) => (
                  <Button
                    key={name}
                    variant="ghost"
                    title={operationActionLabel(t, name)}
                    aria-label={t('operations.resourceAction', {
                      action: operationActionLabel(t, name),
                      name: resource.name || resource.id,
                    })}
                    onClick={() => onOpen(resource, 'action', name)}
                  >
                    <ActionIcon size={16} />
                  </Button>
                ))}
            {app.config.modules.observability && resource.actions?.logs && (
              <Button
                variant="ghost"
                title={t('operations.logs')}
                aria-label={t('operations.resourceLogs', { name: resource.name || resource.id })}
                onClick={() => onOpen(resource, 'logs')}
              >
                <ScrollText size={16} />
              </Button>
            )}
            {app.config.modules.observability &&
              canManageResource(schema) &&
              resource.actions?.execute && (
                <Button
                  variant="ghost"
                  title={t('operations.terminal')}
                  aria-label={t('operations.resourceTerminal', {
                    name: resource.name || resource.id,
                  })}
                  onClick={() => onOpen(resource, 'execute')}
                >
                  <TerminalSquare size={16} />
                </Button>
              )}
            {onCreateService && (
              <Button
                variant="ghost"
                title={t('operations.addService')}
                aria-label={t('operations.addServiceToStack', {
                  name: resource.name || resource.id,
                })}
                onClick={onCreateService}
              >
                <Plus size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => onOpen(resource)}
              aria-label={t('operations.manageResource', { name: resource.name || resource.id })}
            >
              {t('operations.manage')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
