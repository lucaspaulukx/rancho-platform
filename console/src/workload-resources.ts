import type { Schema } from './api';
import { isCpuField, validateCpuResource } from './cpu-resources';
export const memoryUnits = { Bytes: 1, MiB: 1048576, GiB: 1073741824 } as const;
export function memoryBytes(text: string, unit: keyof typeof memoryUnits) {
  if (text.trim() === '') return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(text))
    throw new Error('Informe memória não negativa, sem notação exponencial.');
  if (text.length > 100) throw new Error('Memória fora dos limites.');
  const parts = text.split('.'),
    denominator = 10n ** BigInt(parts[1]?.length || 0);
  const numerator = BigInt(parts.join('')) * BigInt(memoryUnits[unit]);
  if (numerator % denominator !== 0n || numerator / denominator > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('A memória precisa representar bytes inteiros dentro do limite seguro.');
  return Number(numerator / denominator);
}
export function validateWorkloadResources(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new Error('A configuração tem níveis demais.');
  for (const key of ['memory', 'memoryReservation']) {
    const value = values[key];
    if (
      schema.resourceFields[key] &&
      value != null &&
      value !== '' &&
      (!Number.isSafeInteger(value) || Number(value) < 0)
    )
      throw new Error('Memória e reserva precisam ser bytes inteiros não negativos.');
  }
  if (Number(values.memory) > 0 && Number(values.memoryReservation) > Number(values.memory))
    throw new Error('A reserva de memória não pode exceder o limite.');
  for (const [name, value] of Object.entries(values)) {
    if (isCpuField(name) && schema.resourceFields[name]) validateCpuResource(name, value);
    const field = schema.resourceFields[name],
      nested = field && schemas[field.type];
    if (nested && value && typeof value === 'object' && !Array.isArray(value))
      validateWorkloadResources(nested, value as Record<string, unknown>, schemas, depth + 1);
    const arrayType = field && /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
    if (arrayType && schemas[arrayType] && Array.isArray(value))
      for (const row of value)
        if (row && typeof row === 'object' && !Array.isArray(row))
          validateWorkloadResources(schemas[arrayType], row, schemas, depth + 1);
  }
}
