import type { Schema, SchemaField } from './api';

export const ulimitNames = [
  'core',
  'cpu',
  'data',
  'fsize',
  'locks',
  'memlock',
  'msgqueue',
  'nice',
  'nofile',
  'nproc',
  'rss',
  'rtprio',
  'rttime',
  'sigpending',
  'stack',
] as const;
export function supportsUlimits(field: SchemaField | undefined, schemas: Record<string, Schema>) {
  const fields = schemas.ulimit?.resourceFields;
  return (
    field?.create === true &&
    field.type === 'array[ulimit]' &&
    fields?.name?.create === true &&
    fields.name.type === 'string' &&
    ['soft', 'hard'].every((key) => fields[key]?.create === true && fields[key].type === 'int')
  );
}
export function ulimitNumber(value: unknown): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^(?:-1|0|[1-9][0-9]*)$/.test(String(value))
  )
    throw new Error('Informe um inteiro entre -1 e 2147483647; -1 significa ilimitado.');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < -1 || number > 2147483647)
    throw new Error('O limite excede o intervalo aceito por este Rancher.');
  return number;
}
export function normalizeUlimits(value: unknown) {
  if (!Array.isArray(value) || value.length > 32)
    throw new Error('Configure até 32 limites de processo.');
  const names = new Set<string>();
  return value.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).some((key) => !['name', 'soft', 'hard'].includes(key))
    )
      throw new Error('A lista de limites contém um formato incompatível.');
    const row = entry as Record<string, unknown>;
    if (
      typeof row.name !== 'string' ||
      !ulimitNames.includes(row.name as (typeof ulimitNames)[number]) ||
      names.has(row.name)
    )
      throw new Error('Escolha nomes de limites conhecidos e sem duplicatas.');
    names.add(row.name);
    const soft = ulimitNumber(row.soft),
      hard = ulimitNumber(row.hard);
    if (hard !== -1 && (soft === -1 || soft > hard))
      throw new Error('O limite inicial não pode exceder o máximo.');
    return { name: row.name, soft, hard };
  });
}
export function validateWorkloadUlimits(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new Error('A configuração tem níveis demais.');
  if (values.ulimits != null) {
    if (!supportsUlimits(schema.resourceFields.ulimits, schemas))
      throw new Error('O contrato atual não permite configurar limites de processo.');
    normalizeUlimits(values.ulimits);
  }
  for (const [name, value] of Object.entries(values)) {
    const type = schema.resourceFields[name]?.type;
    if (name === 'ulimits' || !type) continue;
    if (schemas[type] && value && typeof value === 'object' && !Array.isArray(value))
      validateWorkloadUlimits(schemas[type], value as Record<string, unknown>, schemas, depth + 1);
    const child = /^array\[([^\]]+)\]$/.exec(type)?.[1];
    if (child && schemas[child] && Array.isArray(value))
      for (const row of value)
        if (row && typeof row === 'object' && !Array.isArray(row))
          validateWorkloadUlimits(schemas[child], row, schemas, depth + 1);
  }
}

/** Strip only the native add-on discriminator; preserve every unknown property. */
export function editableUlimits(value: unknown): unknown {
  if (value == null) return [];
  if (!Array.isArray(value)) return value;
  return value.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row) && row.type === 'ulimit') {
      const { type: _type, ...fields } = row;
      return fields;
    }
    return row;
  });
}
