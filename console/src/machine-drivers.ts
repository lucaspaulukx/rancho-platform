import { safeApiUrl, type Resource, type Schema } from './api';
import { ptMachineDrivers } from './i18n/domains/machine-drivers';

type DriverValidationKey = Extract<
  keyof typeof ptMachineDrivers,
  `machineDrivers.validation.${string}`
>;

export class DriverValidationError extends Error {
  constructor(readonly key: DriverValidationKey) {
    super(ptMachineDrivers[key]);
  }
}

function driverApiUrl(
  path: string,
  key: 'machineDrivers.validation.reference' | 'machineDrivers.validation.actionLink',
) {
  try {
    return safeApiUrl(path);
  } catch {
    throw new DriverValidationError(key);
  }
}

export type DriverAction = 'activate' | 'reactivate' | 'deactivate' | 'remove';
export interface DriverMetadata {
  id: string;
  name: string;
  state: string;
  builtin: boolean;
  catalog: boolean;
  self: string;
  actions: Partial<Record<DriverAction, string>>;
}
export interface DriverFields {
  url: string;
  uiUrl: string;
  checksum: string;
  description: string;
}
export interface DriverSnapshot extends DriverMetadata, DriverFields {}
export const emptyDriver: DriverFields = { url: '', uiUrl: '', checksum: '', description: '' };
export function driverMetadata(row: Resource): DriverMetadata {
  if (row.type !== 'machineDriver' || !/^1md[0-9]+$/.test(row.id))
    throw new DriverValidationError('machineDrivers.validation.resource');
  const self = '/v2-beta/machinedrivers/' + row.id;
  if (
    row.links?.self &&
    driverApiUrl(row.links.self, 'machineDrivers.validation.reference').replace(/\/$/, '') !== self
  )
    throw new DriverValidationError('machineDrivers.validation.reference');
  const actions: DriverMetadata['actions'] = {};
  for (const kind of ['activate', 'reactivate', 'deactivate', 'remove'] as const) {
    const raw = row.actions?.[kind];
    if (!raw) continue;
    const url = new URL(driverApiUrl(raw, 'machineDrivers.validation.actionLink'), location.origin);
    if (url.pathname.replace(/\/$/, '') !== self || url.search !== '?action=' + kind)
      throw new DriverValidationError('machineDrivers.validation.actionLink');
    actions[kind] = url.pathname + url.search;
  }
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : row.id,
    state: typeof row.state === 'string' ? row.state : '',
    builtin: row.builtin === true,
    catalog: !!row.externalId,
    self,
    actions,
  };
}
export function driverSnapshot(row: Resource): DriverSnapshot {
  const fields = { ...emptyDriver };
  for (const key of Object.keys(fields) as (keyof DriverFields)[]) {
    if (row[key] != null && typeof row[key] !== 'string')
      throw new DriverValidationError('machineDrivers.validation.fields');
    fields[key] = (row[key] as string) ?? '';
  }
  return { ...driverMetadata(row), ...fields };
}
export const customDriver = (row: DriverMetadata) => !row.builtin && !row.catalog;
export function sameDriver(before: DriverSnapshot, fresh: DriverSnapshot) {
  if (JSON.stringify(before) !== JSON.stringify(fresh))
    throw new DriverValidationError('machineDrivers.validation.changed');
}
export function driverPayload(
  schema: Schema,
  fields: DriverFields,
  before?: DriverSnapshot,
  fresh?: DriverSnapshot,
) {
  const operation = before ? 'update' : 'create';
  if (
    schema.id !== 'machineDriver' ||
    !(before ? schema.resourceMethods?.includes('PUT') : schema.collectionMethods?.includes('POST'))
  )
    throw new DriverValidationError('machineDrivers.validation.operation');
  if (before) {
    if (!fresh || !customDriver(fresh))
      throw new DriverValidationError('machineDrivers.validation.custom');
    sameDriver(before, fresh);
    if (!['active', 'inactive', 'error'].includes(fresh.state))
      throw new DriverValidationError('machineDrivers.validation.transition');
  }
  const payload: Record<string, string | boolean> = {};
  for (const key of Object.keys(emptyDriver) as (keyof DriverFields)[]) {
    const field = schema.resourceFields[key],
      value = fields[key];
    if (!field?.[operation] || value.includes('\0') || value.length > (field.maxLength ?? 65535))
      throw new DriverValidationError('machineDrivers.validation.fieldContract');
    if (key === 'url' || (key === 'uiUrl' && value)) {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new DriverValidationError('machineDrivers.validation.url');
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
        throw new DriverValidationError('machineDrivers.validation.urlParts');
    }
    payload[key] = value;
  }
  if (!before) {
    if (!schema.resourceFields.activateOnCreate?.create)
      throw new DriverValidationError('machineDrivers.validation.inactiveCreate');
    payload.activateOnCreate = false;
  }
  return payload;
}
export function driverAction(
  schema: Schema,
  before: DriverSnapshot,
  fresh: DriverSnapshot,
  kind: DriverAction,
) {
  sameDriver(before, fresh);
  if (schema.id !== 'machineDriver' || !schema.resourceActions?.[kind] || !fresh.actions[kind])
    throw new DriverValidationError('machineDrivers.validation.action');
  if (kind === 'remove' && !customDriver(fresh))
    throw new DriverValidationError('machineDrivers.validation.remove');
  return fresh.actions[kind]!;
}
