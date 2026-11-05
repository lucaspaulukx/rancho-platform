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
import { useSchemas, canManageResource } from '../hooks/useSchemas';
import { useWorkloadInventory } from './Workloads';
import { workloadTree, type ServiceNode } from '../workload-tree';
import { imageName, stackContents } from '../workloads';
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
  operationCommands,
  operationContainers,
  type OperationCommand,
} from '../operation-actions';
import { WorkloadStreams } from '../components/WorkloadStreams';
import { ResourcePanel, type ResourceSelection } from '../components/ResourcePanel';
import {
  ResourceCreator,
  creationLabels,
  type CreationSelection,
} from '../components/ResourceCreator';
import { fieldLabel } from '../components/SchemaForm';
import { commonBulkActions, resourceKey } from '../bulk-actions';
import { BulkOperation, type BulkPlan } from '../components/BulkOperation';
const ServiceTopology = lazy(() => import('../components/ServiceTopology'));

export function OperationsPage({
  initialView = 'stacks',
}: {
  initialView?: 'stacks' | 'services' | 'containers';
}) {
  const app = useApp();
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
        title="Selecione um environment"
        description="Escolha um environment autorizado na barra superior para operar seus recursos."
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
              return operationCommands(resource, schemas.data?.[resource.type], {
                environment: app.project!.id,
                observability: app.config.modules.observability,
                metrics: app.config.modules.metrics,
                containers,
                containerWritable: canManageResource(schemas.data?.container),
                createService: !!schemas.data?.service?.collectionMethods?.includes('POST'),
                restartServices: restartable.length,
                scaling: app.config.modules.workloadScaling,
                serviceLinks: app.config.modules.serviceLinksEditor,
                balancerRules: app.config.modules.balancerRulesEditor,
              }).map((command) => ({
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
            aria-label={`${expanded ? 'Recolher' : 'Expandir'} containers de ${node.resource.name || node.resource.id}`}
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
                `${inventory.stacks.find((stack) => stack.id === node.resource.stackId)?.name || 'Sem stack'} · `}
              {node.containers.length} containers · escala {String(node.resource.scale ?? '—')}
            </span>,
          )}
        </div>
        {expanded && (
          <div id={`service-children-${node.resource.id}`} className="operation-containers">
            {node.containers.length ? (
              node.containers.map((container) => row(container, 'container'))
            ) : (
              <p className="operation-empty">
                Nenhum container neste serviço com os filtros atuais.
              </p>
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
        eyebrow="OPERAÇÃO DO ENVIRONMENT"
        description="Stacks, serviços e containers em uma única tela. Abra ações e detalhes sem sair do seu ambiente."
        action={
          <>
            {Object.keys(creationLabels).some((kind) =>
              schemas.data?.[kind]?.collectionMethods?.includes('POST'),
            ) && (
              <details className="creation-menu">
                <summary className="button primary">
                  <Plus size={16} />
                  Criar
                </summary>
                <div className="creation-options">
                  {Object.entries(creationLabels)
                    .filter(([kind]) => schemas.data?.[kind]?.collectionMethods?.includes('POST'))
                    .map(([kind, label]) => (
                      <button
                        key={kind}
                        onClick={(event) => {
                          const menu = event.currentTarget.closest('details');
                          if (menu) menu.open = false;
                          setCreation({ kind });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                </div>
              </details>
            )}
            <Button onClick={() => void query.refetch()} busy={query.isFetching}>
              <RefreshCw size={16} />
              Atualizar
            </Button>
          </>
        }
      />
      <div className="operation-metrics">
        {[
          [Layers3, inventory.stacks.length, 'stacks'],
          [Network, inventory.services.length, 'serviços'],
          [Box, inventory.containers.length, 'containers'],
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
        <span className="muted">Totais do environment · atualizados a cada 15s</span>
      </div>
      <div className="operation-toolbar">
        <Field label="Buscar na operação">
          {(id) => (
            <input
              id={id}
              type="search"
              value={text}
              onChange={(event) => filter('q', event.target.value)}
              placeholder="Stack, serviço, container, imagem ou ID…"
            />
          )}
        </Field>
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
      {app.config.modules.contextActions && (
        <Tabs
          labels={['Stacks', 'Serviços', 'Containers']}
          selected={['stacks', 'services', 'containers'].indexOf(view)}
          onChange={(index) => filter('view', ['stacks', 'services', 'containers'][index])}
          idPrefix="operation-view"
          panelId="operation-workspace"
          label="Visão da operação"
        />
      )}
      <div className="operation-tree-tools">
        <span className="muted">
          <ListTree size={16} />
          {view === 'services'
            ? `${visibleServices.length} serviços visíveis`
            : view === 'containers'
              ? `${visibleContainers.length} containers visíveis`
              : `${tree?.stacks.length || 0} stacks visíveis`}
          {!includeSystem &&
            ` · ${inventory.stacks.filter((stack) => stack.system).length} de infraestrutura ocultas`}
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setCollapsed(new Set());
            setExpandedServices(new Set(inventory.services.map((resource) => resource.id)));
          }}
        >
          Expandir tudo
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setCollapsed(new Set(inventory.stacks.map((resource) => resource.id)));
            setExpandedServices(new Set());
          }}
        >
          Recolher tudo
        </Button>
        <Button onClick={() => setTopology(true)}>
          <Network size={16} />
          Topologia
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
          <Empty
            title="Nenhum recurso neste filtro"
            description="Revise a busca, o estado ou a opção de infraestrutura. Os recursos continuam restritos ao environment selecionado."
          />
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
            <section className="panel bulk-toolbar" aria-label="Ações em lote">
              <strong>{selected.length} recursos selecionados · limite 100</strong>
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={action === 'remove' ? 'danger' : 'secondary'}
                  onClick={() => setBatch({ action, resources: [...selected] })}
                >
                  {action === 'remove' && <Trash2 size={16} />}
                  {fieldLabel(action)} selecionados
                </Button>
              ))}
              {!actions.length && (
                <span className="muted">
                  Os recursos selecionados não têm uma ação em comum disponível.
                </span>
              )}
              <Button variant="ghost" onClick={() => setChecked(new Set())}>
                Limpar seleção
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
                  aria-label={`Stack ${node.resource.name || node.resource.id}`}
                >
                  <div className="operation-expand-row stack-heading">
                    <button
                      className="tree-toggle"
                      aria-label={`${expanded ? 'Recolher' : 'Expandir'} stack ${node.resource.name || node.resource.id}`}
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
                        {node.services.length} serviços
                        {node.resource.system ? ' · infraestrutura' : ''}
                      </span>,
                    )}
                  </div>
                  {expanded && (
                    <div id={`stack-children-${node.resource.id}`} className="operation-stack-body">
                      {node.services.map((node) => service(node))}
                      {node.containers.map((container) => row(container, 'container'))}
                      {!node.services.length && !node.containers.length && (
                        <p className="operation-empty">
                          Nenhum serviço ou container nesta stack com os filtros atuais.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          {view === 'stacks' && !!tree!.services.length && (
            <section className="operation-stack">
              <h2 className="operation-section-title">Serviços sem stack disponível</h2>
              {tree!.services.map((node) => service(node, false))}
            </section>
          )}
          {view === 'stacks' && !!tree!.containers.length && (
            <section className="operation-stack">
              <h2 className="operation-section-title">
                <Box size={19} />
                Containers avulsos e outros vínculos
              </h2>
              {tree!.containers.map((container) => row(container, 'container'))}
            </section>
          )}
          {view === 'services' && (
            <section className="operation-stack" aria-label="Serviços do environment">
              {visibleServices.map((node) => service(node, false))}
            </section>
          )}
          {view === 'containers' && (
            <section className="operation-stack" aria-label="Containers do environment">
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
                    )?.name || 'Container avulso'}
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
          aria-label={`Selecionar ${resource.name || resource.id}`}
          checked={selected || false}
          onChange={onToggleSelection}
        />
      )}
      <span className="operation-kind">
        <Icon size={kind === 'container' ? 17 : 20} />
      </span>
      <div className="operation-resource-name">
        <button className="resource-name-button" onClick={() => onOpen(resource)}>
          {resource.name || resource.id}
        </button>
        <span className="muted" title={imageName(resource)}>
          {kind === 'stack' ? resource.description || resource.id : imageName(resource)}
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
          <ActionMenu label={`Ações de ${resource.name || resource.id}`} actions={commands} />
        ) : (
          <>
            {canManageResource(schema) &&
              quickActions
                .filter(([name]) => resource.actions?.[name])
                .map(([name, ActionIcon]) => (
                  <Button
                    key={name}
                    variant="ghost"
                    title={fieldLabel(name)}
                    aria-label={`${fieldLabel(name)} ${resource.name || resource.id}`}
                    onClick={() => onOpen(resource, 'action', name)}
                  >
                    <ActionIcon size={16} />
                  </Button>
                ))}
            {app.config.modules.observability && resource.actions?.logs && (
              <Button
                variant="ghost"
                title="Ver logs"
                aria-label={`Ver logs de ${resource.name || resource.id}`}
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
                  title="Abrir terminal"
                  aria-label={`Abrir terminal de ${resource.name || resource.id}`}
                  onClick={() => onOpen(resource, 'execute')}
                >
                  <TerminalSquare size={16} />
                </Button>
              )}
            {onCreateService && (
              <Button
                variant="ghost"
                title="Adicionar serviço nesta stack"
                aria-label={`Adicionar serviço em ${resource.name || resource.id}`}
                onClick={onCreateService}
              >
                <Plus size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => onOpen(resource)}
              aria-label={`Gerenciar ${resource.name || resource.id}`}
            >
              Gerenciar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
