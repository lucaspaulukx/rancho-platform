import type { Resource, Schema } from './api';
import { canManageResource } from './hooks/useSchemas';
import { containersForService, stackContents, type WorkloadInventory } from './workloads';
import { metricsLink } from './metrics';
import { fieldLabel } from './components/SchemaForm';
import { canScaleService } from './service-scaling';
import { canEditServiceLinks } from './service-links';
import { canEditBalancer } from './balancer-rules';

export function operationContainers(
  resource: Resource,
  inventory: WorkloadInventory,
  environment: string,
) {
  if (resource.accountId !== environment) return [];
  const candidates =
    resource.type === 'container'
      ? [resource]
      : resource.type === 'stack'
        ? stackContents(resource, inventory).containers
        : containersForService(resource, inventory.containers);
  return candidates.filter(
    (value) =>
      value.accountId === environment &&
      !value.removed &&
      !['removed', 'purged'].includes(value.state || ''),
  );
}
export type OperationCommandKind =
  | 'detail'
  | 'edit'
  | 'scale'
  | 'balancer'
  | 'native'
  | 'logs'
  | 'execute'
  | 'metrics'
  | 'create'
  | 'restartServices';
export interface OperationCommand {
  id: string;
  label: string;
  kind: OperationCommandKind;
  action?: string;
  disabled?: boolean;
  reason?: string;
  danger?: boolean;
}
export function operationCommands(
  resource: Resource,
  schema: Schema | undefined,
  options: {
    environment: string;
    observability: boolean;
    metrics: boolean;
    serviceMetrics?: boolean;
    containers: Resource[];
    containerWritable: boolean;
    createService: boolean;
    restartServices: number;
    scaling?: boolean;
    serviceLinks?: boolean;
    balancerRules?: boolean;
  },
) {
  if (resource.accountId !== options.environment || resource.removed) return [];
  const commands: OperationCommand[] = [{ id: 'detail', label: 'Ver detalhes', kind: 'detail' }];
  const writable = canManageResource(schema);
  if (options.observability) {
    const logs = options.containers.some((value) => !!value.actions?.logs);
    if (resource.type !== 'container' || logs)
      commands.push({
        id: 'logs',
        label: 'Ver logs',
        kind: 'logs',
        disabled: !logs,
        reason: logs ? undefined : 'Nenhum container com logs disponível neste recurso.',
      });
    if (options.containerWritable) {
      const execute = options.containers.some((value) => !!value.actions?.execute);
      if (resource.type !== 'container' || execute)
        commands.push({
          id: 'execute',
          label: 'Abrir terminal',
          kind: 'execute',
          disabled: !execute,
          reason: execute ? undefined : 'Nenhum container com terminal disponível neste recurso.',
        });
    }
    if (options.metrics && metricsLink(resource, options.serviceMetrics))
      commands.push({ id: 'metrics', label: 'Métricas', kind: 'metrics' });
  }
  if (writable && schema?.resourceMethods?.includes('PUT'))
    commands.push({ id: 'edit', label: 'Editar configuração', kind: 'edit' });
  if (canScaleService(resource, schema, !!options.scaling))
    commands.push({ id: 'scale', label: 'Escalar serviço', kind: 'scale' });
  if (canEditBalancer(resource, schema, !!options.balancerRules))
    commands.push({ id: 'balancer', label: 'Configurar balanceador', kind: 'balancer' });
  if (canEditServiceLinks(resource, schema, !!options.serviceLinks))
    commands.push({
      id: 'setservicelinks',
      label: 'Gerenciar vínculos de serviços',
      kind: 'native',
      action: 'setservicelinks',
    });
  if (options.createService && resource.type === 'stack')
    commands.push({ id: 'create', label: 'Adicionar serviço', kind: 'create' });
  if (writable) {
    const priority = [
      'start',
      'activate',
      'stop',
      'deactivate',
      'restart',
      'activateservices',
      'deactivateservices',
      'upgrade',
      'rollback',
      'finishupgrade',
      'cancelupgrade',
      'cancelrollback',
      'exportconfig',
    ];
    for (const action of priority)
      if (resource.actions?.[action])
        commands.push({
          id: action,
          action,
          kind: 'native',
          label:
            action === 'upgrade' && resource.type === 'stack'
              ? 'Atualizar stack'
              : fieldLabel(action),
        });
    if (options.restartServices > 0 && resource.type === 'stack')
      commands.push({
        id: 'restart-services',
        kind: 'restartServices',
        label: `Reiniciar serviços (${options.restartServices})`,
        disabled: options.restartServices > 100,
        reason:
          options.restartServices > 100
            ? 'Selecione até 100 serviços para esta operação.'
            : undefined,
      });
    for (const action of ['remove', 'purge'])
      if (resource.actions?.[action])
        commands.push({
          id: action,
          action,
          kind: 'native',
          label: fieldLabel(action),
          danger: true,
        });
  }
  return commands;
}
