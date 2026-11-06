import { ptServiceEditors } from './i18n/domains/service-editors';
import type { Resource, Schema } from './api';
import { canManageResource } from './hooks/useSchemas';
type ServiceLinkErrorKey = Extract<
  keyof typeof ptServiceEditors,
  `serviceEditors.linkError.${string}`
>;
export class ServiceLinkValidationError extends Error {
  constructor(readonly key: ServiceLinkErrorKey) {
    super(ptServiceEditors[key]);
  }
}
export interface ServiceLinkDraft {
  key: number;
  serviceId: string;
  name: string;
}
export function canEditServiceLinks(resource: Resource, schema?: Schema, enabled = false) {
  return (
    enabled &&
    resource.type === 'service' &&
    !resource.removed &&
    ['active', 'inactive'].includes(resource.state || '') &&
    canManageResource(schema) &&
    !!resource.actions?.setservicelinks &&
    schema?.resourceActions?.setservicelinks?.input === 'setServiceLinksInput'
  );
}
export function activeServiceLinks(mappings: Resource[], source: Resource, environment: string) {
  if (source.accountId !== environment)
    throw new ServiceLinkValidationError('serviceEditors.linkError.environment');
  const rows = mappings.filter(
    (v) =>
      v.serviceId === source.id && !v.removed && !['removed', 'purged'].includes(v.state || ''),
  );
  if (rows.some((v) => v.accountId !== environment))
    throw new ServiceLinkValidationError('serviceEditors.linkError.foreign');
  return rows;
}
export function serviceLinksSnapshot(rows: Resource[]) {
  return JSON.stringify(
    rows
      .map((v) => [
        v.id,
        v.serviceId,
        v.consumedServiceId || null,
        v.consumedService || null,
        v.name || '',
        v.ports || null,
        v.state,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}
export function assertServiceLinksUnchanged(before: Resource[], after: Resource[]) {
  if (serviceLinksSnapshot(before) !== serviceLinksSnapshot(after))
    throw new ServiceLinkValidationError('serviceEditors.linkError.changed');
}
export function editableServiceLinks(rows: Resource[], services: Resource[], environment: string) {
  if (
    rows.some(
      (v) =>
        v.accountId !== environment ||
        v.state !== 'active' ||
        typeof v.consumedServiceId !== 'string' ||
        !!v.consumedService ||
        (Array.isArray(v.ports) ? v.ports.length > 0 : v.ports != null) ||
        !services.some(
          (s) =>
            s.id === v.consumedServiceId &&
            s.accountId === environment &&
            !s.removed &&
            s.type === 'service',
        ),
    )
  )
    throw new ServiceLinkValidationError('serviceEditors.linkError.advanced');
  return rows.map((v, index) => ({
    key: index,
    serviceId: String(v.consumedServiceId),
    name: String(v.name || ''),
  }));
}
export function prepareServiceLinks(
  source: Resource,
  schema: Schema,
  linkSchema: Schema,
  rows: ServiceLinkDraft[],
  services: Resource[],
  stacks: Resource[],
  environment: string,
) {
  if (!canEditServiceLinks(source, schema, true) || source.accountId !== environment)
    throw new ServiceLinkValidationError('serviceEditors.linkError.unavailable');
  if (rows.length > 100) throw new ServiceLinkValidationError('serviceEditors.linkError.limit');
  if (!linkSchema.resourceFields.serviceId?.create || !linkSchema.resourceFields.name?.create)
    throw new ServiceLinkValidationError('serviceEditors.linkError.contract');
  if (
    !stacks.some(
      (s) => s.id === source.stackId && s.accountId === environment && !s.removed && !s.system,
    )
  )
    throw new ServiceLinkValidationError('serviceEditors.linkError.stack');
  const targets = new Set<string>();
  const aliases = new Set<string>();
  return {
    serviceLinks: rows.map((row) => {
      const service = services.find((s) => s.id === row.serviceId);
      if (
        !service ||
        service.accountId !== environment ||
        service.removed ||
        service.type !== 'service' ||
        !['active', 'inactive'].includes(service.state || '') ||
        service.id === source.id ||
        !stacks.some(
          (s) => s.id === service.stackId && s.accountId === environment && !s.removed && !s.system,
        )
      )
        throw new ServiceLinkValidationError('serviceEditors.linkError.target');
      const name = row.name.trim();
      const field = linkSchema.resourceFields.name;
      if (
        name.length > (field.maxLength ?? 255) ||
        (name && !new RegExp(`^[${field.validChars || 'a-zA-Z0-9-._'}]+$`).test(name))
      )
        throw new ServiceLinkValidationError('serviceEditors.linkError.alias');
      const alias = (name || service.name || service.id).toLocaleLowerCase();
      if (targets.has(service.id) || aliases.has(alias))
        throw new ServiceLinkValidationError('serviceEditors.linkError.duplicate');
      targets.add(service.id);
      aliases.add(alias);
      return { serviceId: service.id, ...(name ? { name } : {}) };
    }),
  };
}
