import { safeApiUrl, type Resource, type Schema } from './api';
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
    throw new Error('Driver inválido.');
  const self = '/v2-beta/machinedrivers/' + row.id;
  if (row.links?.self && safeApiUrl(row.links.self).replace(/\/$/, '') !== self)
    throw new Error('Referência de driver inválida.');
  const actions: DriverMetadata['actions'] = {};
  for (const kind of ['activate', 'reactivate', 'deactivate', 'remove'] as const) {
    const raw = row.actions?.[kind];
    if (!raw) continue;
    const url = new URL(safeApiUrl(raw), location.origin);
    if (url.pathname.replace(/\/$/, '') !== self || url.search !== '?action=' + kind)
      throw new Error('Ação de driver inválida.');
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
      throw new Error('Configuração de driver inválida.');
    fields[key] = (row[key] as string) ?? '';
  }
  return { ...driverMetadata(row), ...fields };
}
export const customDriver = (row: DriverMetadata) => !row.builtin && !row.catalog;
export function sameDriver(before: DriverSnapshot, fresh: DriverSnapshot) {
  if (JSON.stringify(before) !== JSON.stringify(fresh))
    throw new Error('O driver mudou. Atualize e reabra o painel.');
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
    throw new Error('Operação indisponível.');
  if (before) {
    if (!fresh || !customDriver(fresh))
      throw new Error('Somente drivers personalizados podem ser editados.');
    sameDriver(before, fresh);
    if (!['active', 'inactive', 'error'].includes(fresh.state))
      throw new Error('Aguarde a transição do driver.');
  }
  const payload: Record<string, string | boolean> = {};
  for (const key of Object.keys(emptyDriver) as (keyof DriverFields)[]) {
    const field = schema.resourceFields[key],
      value = fields[key];
    if (!field?.[operation] || value.includes('\0') || value.length > (field.maxLength ?? 65535))
      throw new Error('Campo de driver fora do contrato.');
    if (key === 'url' || (key === 'uiUrl' && value)) {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error('Informe uma URL HTTP ou HTTPS válida.');
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
        throw new Error('Use URL HTTP ou HTTPS sem usuário, senha ou fragmento.');
    }
    payload[key] = value;
  }
  if (!before) {
    if (!schema.resourceFields.activateOnCreate?.create)
      throw new Error('Cadastro inativo indisponível.');
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
    throw new Error('Ação indisponível.');
  if (kind === 'remove' && !customDriver(fresh))
    throw new Error('Remoção manual indisponível para este driver.');
  return fresh.actions[kind]!;
}
