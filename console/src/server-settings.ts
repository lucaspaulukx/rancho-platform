import { safeApiUrl, type Resource, type Schema } from './api';
export interface SettingMetadata {
  id: string;
  name: string;
  source: string;
  inDb: boolean;
  self: string;
}
export interface SettingSnapshot extends SettingMetadata {
  value: string | null;
  activeValue: string | null;
}
const safeName = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_.:-]{0,254}$/.test(value) ? value : '';
export function settingMetadata(value: Resource): SettingMetadata {
  const name = safeName(value.name),
    path = safeApiUrl(value.links?.self || '/v2-beta/settings/' + encodeURIComponent(name));
  if (
    !name ||
    ![
      '/v2-beta/settings/' + encodeURIComponent(name).toLowerCase(),
      '/v2-beta/settings/' + String(value.id).toLowerCase(),
    ].includes(new URL(path, location.origin).pathname.toLowerCase())
  )
    throw new Error('Referência de configuração inválida.');
  return {
    id: String(value.id),
    name,
    source:
      typeof value.source === 'string' && /^[a-zA-Z0-9_ .:-]{0,160}$/.test(value.source)
        ? value.source
        : 'Não informada',
    inDb: value.inDb === true,
    self: '/v2-beta/settings/' + encodeURIComponent(name),
  };
}
export function settingSnapshot(value: Resource): SettingSnapshot {
  if (value.type !== 'setting' && !(value.type === 'activeSetting' && value.baseType === 'setting'))
    throw new Error('Configuração indisponível.');
  for (const field of ['value', 'activeValue'])
    if (value[field] != null && typeof value[field] !== 'string')
      throw new Error('Formato de configuração não suportado.');
  return {
    ...settingMetadata(value),
    value: (value.value as string) ?? null,
    activeValue: (value.activeValue as string) ?? null,
  };
}
export function settingWritable(
  schema: Schema | undefined,
  kind: 'update' | 'reset',
  row?: SettingMetadata,
) {
  return (
    schema?.id === 'setting' &&
    (kind === 'update'
      ? !!schema.resourceMethods?.includes('PUT') && schema.resourceFields.value?.update === true
      : !!schema.resourceMethods?.includes('DELETE') && row?.inDb === true)
  );
}
export function prepareSetting(
  schema: Schema,
  before: SettingSnapshot,
  fresh: SettingSnapshot,
  value: string,
  empty: boolean,
  reset = false,
) {
  if (!settingWritable(schema, reset ? 'reset' : 'update', fresh))
    throw new Error('A operação não está mais disponível.');
  if (
    ['id', 'name', 'source', 'inDb', 'self', 'value', 'activeValue'].some(
      (k) => before[k as keyof SettingSnapshot] !== fresh[k as keyof SettingSnapshot],
    )
  )
    throw new Error('A configuração mudou. Reabra o editor.');
  if (reset) return;
  if (value.length > (schema.resourceFields.value?.maxLength ?? 65535) || value.includes('\0'))
    throw new Error('O valor excede os limites permitidos.');
  if (!value && !empty) throw new Error('Confirme explicitamente o valor vazio.');
  return { value };
}
