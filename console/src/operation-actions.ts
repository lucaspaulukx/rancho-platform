import type { Resource, Schema } from './api';
import { createTranslator } from './i18n/messages';
import { enOperations } from './i18n/domains/operations';
import { canManageResource } from './hooks/useSchemas';
import { containersForService, stackContents, type WorkloadInventory } from './workloads';
import { metricsLink } from './metrics';
import { fieldLabel } from './components/SchemaForm';
import { canScaleService } from './service-scaling';
import { canEditServiceLinks } from './service-links';
import { canEditBalancer } from './balancer-rules';

type OperationTranslator = ReturnType<typeof createTranslator>['t'];
type ActionMessageKey = Extract<keyof typeof enOperations, `operations.action.${string}`>;
const defaultTranslator = createTranslator('pt-BR').t;

export function operationActionLabel(t: OperationTranslator, action: string) {
  const key = `operations.action.${action}`;
  return Object.hasOwn(enOperations, key) ? t(key as ActionMessageKey) : fieldLabel(action, t);
}

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
  t: OperationTranslator = defaultTranslator,
) {
  if (resource.accountId !== options.environment || resource.removed) return [];
  const commands: OperationCommand[] = [
    { id: 'detail', label: t('operations.details'), kind: 'detail' },
  ];
  const writable = canManageResource(schema);
  if (options.observability) {
    const logs = options.containers.some((value) => !!value.actions?.logs);
    if (resource.type !== 'container' || logs)
      commands.push({
        id: 'logs',
        label: t('operations.logs'),
        kind: 'logs',
        disabled: !logs,
        reason: logs ? undefined : t('operations.logsUnavailable'),
      });
    if (options.containerWritable) {
      const execute = options.containers.some((value) => !!value.actions?.execute);
      if (resource.type !== 'container' || execute)
        commands.push({
          id: 'execute',
          label: t('operations.terminal'),
          kind: 'execute',
          disabled: !execute,
          reason: execute ? undefined : t('operations.terminalUnavailable'),
        });
    }
    if (options.metrics && metricsLink(resource, options.serviceMetrics))
      commands.push({ id: 'metrics', label: t('operations.metrics'), kind: 'metrics' });
  }
  if (writable && schema?.resourceMethods?.includes('PUT'))
    commands.push({ id: 'edit', label: t('operations.edit'), kind: 'edit' });
  if (canScaleService(resource, schema, !!options.scaling))
    commands.push({ id: 'scale', label: t('operations.scale'), kind: 'scale' });
  if (canEditBalancer(resource, schema, !!options.balancerRules))
    commands.push({ id: 'balancer', label: t('operations.balancer'), kind: 'balancer' });
  if (canEditServiceLinks(resource, schema, !!options.serviceLinks))
    commands.push({
      id: 'setservicelinks',
      label: operationActionLabel(t, 'setservicelinks'),
      kind: 'native',
      action: 'setservicelinks',
    });
  if (options.createService && resource.type === 'stack')
    commands.push({ id: 'create', label: t('operations.createService'), kind: 'create' });
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
              ? t('operations.upgradeStack')
              : operationActionLabel(t, action),
        });
    if (options.restartServices > 0 && resource.type === 'stack')
      commands.push({
        id: 'restart-services',
        kind: 'restartServices',
        label: t('operations.restartServices', { count: options.restartServices }),
        disabled: options.restartServices > 100,
        reason: options.restartServices > 100 ? t('operations.restartLimit') : undefined,
      });
    for (const action of ['remove', 'purge'])
      if (resource.actions?.[action])
        commands.push({
          id: action,
          action,
          kind: 'native',
          label: operationActionLabel(t, action),
          danger: true,
        });
  }
  return commands;
}
