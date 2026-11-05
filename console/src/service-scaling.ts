import type { Resource, Schema, SchemaField } from './api';

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
    throw new Error('Informe uma quantidade inteira de containers.');
  const next = Number(value);
  if (
    !Number.isSafeInteger(next) ||
    next < Math.max(0, field.min ?? 0) ||
    (field.max !== undefined && next > field.max)
  )
    throw new Error('A escala está fora dos limites permitidos pelo Rancher.');
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
    throw new Error('A escala não está disponível para este recurso.');
  if (current.scale !== expected.scale)
    throw new Error('A escala foi alterada por outro cliente. Reabra o painel para atualizar.');
  const scale = scaleValue(value, schema.resourceFields.scale);
  if (scale === current.scale) throw new Error('Informe uma escala diferente da atual.');
  return { scale };
}
