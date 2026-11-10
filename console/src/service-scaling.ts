import type { Resource, Schema, SchemaField } from './api';
import { ptServiceEditors } from './i18n/domains/service-editors';

type ServiceScaleErrorKey = Extract<
  keyof typeof ptServiceEditors,
  | `serviceEditors.scaleError.${string}`
  | 'serviceEditors.confirmZero'
  | 'serviceEditors.reviewScale'
>;

export class ServiceScaleValidationError extends Error {
  constructor(readonly key: ServiceScaleErrorKey) {
    super(ptServiceEditors[key]);
  }
}

export function canScaleService(resource: Resource, schema: Schema | undefined, enabled: boolean) {
  const labels = (resource.launchConfig as { labels?: Record<string, string> } | undefined)?.labels;
  return (
    enabled &&
    ['service', 'loadBalancerService'].includes(resource.type) &&
    !resource.removed &&
    ['active', 'inactive'].includes(resource.state || '') &&
    schema?.resourceMethods?.includes('PUT') === true &&
    schema.resourceFields.scale?.update === true &&
    Number.isSafeInteger(resource.scale) &&
    labels?.['io.rancher.scheduler.global'] !== 'true'
  );
}
export function scaleValue(value: unknown, field: SchemaField) {
  if (
    !['string', 'number'].includes(typeof value) ||
    (typeof value === 'string' && !/^\d+$/.test(value.trim()))
  )
    throw new ServiceScaleValidationError('serviceEditors.scaleError.integer');
  const next = Number(value);
  if (
    !Number.isSafeInteger(next) ||
    next < Math.max(0, field.min ?? 0) ||
    (field.max !== undefined && next > field.max)
  )
    throw new ServiceScaleValidationError('serviceEditors.scaleError.range');
  return next;
}
export function prepareServiceScale(
  expected: Resource,
  current: Resource,
  schema: Schema,
  value: unknown,
) {
  if (
    !canScaleService(current, schema, true) ||
    current.id !== expected.id ||
    current.type !== expected.type ||
    current.accountId !== expected.accountId
  )
    throw new ServiceScaleValidationError('serviceEditors.scaleError.unavailable');
  if (current.scale !== expected.scale)
    throw new ServiceScaleValidationError('serviceEditors.scaleError.changed');
  const scale = scaleValue(value, schema.resourceFields.scale);
  if (scale === current.scale)
    throw new ServiceScaleValidationError('serviceEditors.scaleError.unchanged');
  return { scale };
}
