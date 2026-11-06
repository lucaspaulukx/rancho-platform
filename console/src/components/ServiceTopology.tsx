import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dagre from '@dagrejs/dagre';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { allPages, type Resource, type Schema } from '../api';
import { ptTopology } from '../i18n/domains/topology';
import { useI18n } from '../i18n/provider';
import { useApp } from '../state';
import { Alert, Badge, Button, Empty, ErrorState, Field, Loading, Modal } from './ui';

type ServiceNode = Node<{ label: string; state: string; stack: string }, 'service'>;
class TopologyError extends Error {
  constructor(
    readonly key: 'topology.limit' | 'topology.wrongEnvironment' | 'topology.duplicateServices',
  ) {
    super(ptTopology[key]);
  }
}

export function serviceTopology(
  services: Resource[],
  mappings: Resource[],
  stacks: Resource[],
  environment: string,
  direction: 'LR' | 'TB' = 'LR',
) {
  if (services.length > 500 || mappings.length > 2000) throw new TopologyError('topology.limit');
  if ([...services, ...mappings, ...stacks].some((resource) => resource.accountId !== environment))
    throw new TopologyError('topology.wrongEnvironment');
  const visible = services.filter(
    (service) => !service.removed && !['removed', 'purged'].includes(service.state || ''),
  );
  if (new Set(visible.map((service) => service.id)).size !== visible.length)
    throw new TopologyError('topology.duplicateServices');
  const ids = new Set(visible.map((service) => service.id));
  const edges: Edge[] = [];
  let unresolved = 0;
  for (const mapping of mappings) {
    if (mapping.removed || ['removed', 'purged'].includes(mapping.state || '')) continue;
    if (
      typeof mapping.serviceId !== 'string' ||
      typeof mapping.consumedServiceId !== 'string' ||
      !ids.has(mapping.serviceId) ||
      !ids.has(mapping.consumedServiceId)
    ) {
      unresolved++;
      continue;
    }
    edges.push({
      id: mapping.id,
      source: mapping.serviceId,
      target: mapping.consumedServiceId,
      label: mapping.name || undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: 'smoothstep',
    });
  }
  const layout = new dagre.graphlib.Graph({ multigraph: true })
    .setGraph({ rankdir: direction, nodesep: 40, ranksep: 90 })
    .setDefaultEdgeLabel(() => ({}));
  for (const service of visible) layout.setNode(service.id, { width: 240, height: 110 });
  for (const edge of edges) layout.setEdge(edge.source, edge.target, {}, edge.id);
  dagre.layout(layout);
  const nodes: ServiceNode[] = visible.map((service) => {
    const position = layout.node(service.id);
    return {
      id: service.id,
      type: 'service',
      position: { x: position.x - 120, y: position.y - 55 },
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      data: {
        label: service.name || service.id,
        state: service.state || 'unknown',
        stack:
          stacks.find((stack) => stack.id === service.stackId)?.name ||
          String(service.stackId || ''),
      },
      style: { width: 240, height: 110 },
    };
  });
  return { nodes, edges, unresolved };
}

function ServiceGraphNode({
  data,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}: NodeProps<ServiceNode>) {
  const { t } = useI18n();
  return (
    <div className="service-graph-node">
      <Handle type="target" position={targetPosition} />
      <strong title={data.label}>{data.label}</strong>
      <span title={data.stack}>{data.stack || t('topology.noStack')}</span>
      <Badge state={data.state}>{data.state}</Badge>
      <Handle type="source" position={sourcePosition} />
    </div>
  );
}
const nodeTypes = { service: ServiceGraphNode };
function Graph({ model }: { model: ReturnType<typeof serviceTopology> }) {
  const { t } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
  useEffect(() => setNodes(model.nodes), [model.nodes, setNodes]);
  const edges = useMemo(
    () =>
      model.edges.map((edge) => ({
        ...edge,
        ariaLabel: t('topology.link', { source: edge.source, target: edge.target }),
      })),
    [model.edges, t],
  );
  return (
    <div className="service-topology" role="region" aria-label={t('topology.region')}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2}
        ariaLabelConfig={{
          'controls.ariaLabel': t('topology.controls'),
          'controls.zoomIn.ariaLabel': t('topology.zoomIn'),
          'controls.zoomOut.ariaLabel': t('topology.zoomOut'),
          'controls.fitView.ariaLabel': t('topology.fitView'),
          'node.a11yDescription.default': t('topology.nodeKeyboard'),
          'node.a11yDescription.ariaLiveMessage': ({ x, y }) => t('topology.nodeMoved', { x, y }),
        }}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} fitViewOptions={{ padding: 0.25 }} />
      </ReactFlow>
    </div>
  );
}

export default function ServiceTopology({
  services,
  stacks,
  schema,
  onClose,
}: {
  services: Resource[];
  stacks: Resource[];
  schema?: Schema;
  onClose: () => void;
}) {
  const app = useApp();
  const { t } = useI18n();
  const [scope, setScope] = useState('');
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 600px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const available = !!app.project && !!schema?.collectionMethods?.includes('GET');
  const query = useQuery({
    queryKey: ['data', app.identity, 'project', app.project?.id, 'service-topology'],
    enabled: available && services.length > 0,
    queryFn: ({ signal }) =>
      allPages<Resource>(`projects/${app.project!.id}/${schema!.pluralName}?limit=100`, signal),
    retry: false,
  });
  const graph = useMemo(() => {
    if (!query.data || !app.project) return {};
    const scoped = scope ? services.filter((service) => service.stackId === scope) : services;
    const ids = new Set(scoped.map((service) => service.id));
    const links = scope
      ? query.data.filter(
          (mapping) =>
            ids.has(String(mapping.serviceId)) || ids.has(String(mapping.consumedServiceId)),
        )
      : query.data;
    try {
      return {
        model: serviceTopology(scoped, links, stacks, app.project.id, compact ? 'TB' : 'LR'),
      };
    } catch (error) {
      return { error };
    }
  }, [services, stacks, query.data, app.project?.id, scope, compact]);
  const error = query.error || graph.error;
  return (
    <Modal
      open
      drawer
      title={t('topology.title')}
      description={app.project?.name}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>{t('topology.close')}</Button>}
    >
      {!available ? (
        <Empty
          title={t('topology.unavailableTitle')}
          description={t('topology.unavailableDescription')}
        />
      ) : !services.length ? (
        <Empty title={t('topology.emptyTitle')} description={t('topology.emptyDescription')} />
      ) : query.isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState
          error={error instanceof TopologyError ? new Error(t(error.key)) : error}
          retry={() => void query.refetch()}
        />
      ) : (
        graph.model && (
          <>
            <Field label={t('topology.stack')}>
              {(id) => (
                <select id={id} value={scope} onChange={(event) => setScope(event.target.value)}>
                  <option value="">{t('topology.allStacks')}</option>
                  {stacks.map((stack) => (
                    <option key={stack.id} value={stack.id}>
                      {stack.name || stack.id}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <p className="muted">
              {t('topology.summary', {
                services: graph.model.nodes.length,
                links: graph.model.edges.length,
              })}
            </p>
            {!!graph.model.unresolved && (
              <Alert tone="warning">
                {t('topology.unresolved', { count: graph.model.unresolved })}
              </Alert>
            )}
            <Graph key={`${scope}:${compact}`} model={graph.model} />
          </>
        )
      )}
    </Modal>
  );
}
