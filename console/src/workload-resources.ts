import { ResourceValidationError } from './resource-validation';
import type { Schema } from './api';
import { isCpuField, validateCpuResource } from './cpu-resources';
export const memoryUnits = { Bytes: 1, MiB: 1048576, GiB: 1073741824 } as const;
export function memoryBytes(text: string, unit: keyof typeof memoryUnits) {
  if (text.trim() === '') return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(text))
    throw new ResourceValidationError('resourceValidation.memoryFormat');
  if (text.length > 100) throw new ResourceValidationError('resourceValidation.memoryRange');
  const parts = text.split('.'),
    denominator = 10n ** BigInt(parts[1]?.length || 0);
  const numerator = BigInt(parts.join('')) * BigInt(memoryUnits[unit]);
  if (numerator % denominator !== 0n || numerator / denominator > BigInt(Number.MAX_SAFE_INTEGER))
    throw new ResourceValidationError('resourceValidation.memoryBytes');
  return Number(numerator / denominator);
}
export function validateWorkloadResources(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new ResourceValidationError('resourceValidation.depth');
  for (const key of ['memory', 'memoryReservation']) {
    const value = values[key];
    if (
      schema.resourceFields[key] &&
      value != null &&
      value !== '' &&
      (!Number.isSafeInteger(value) || Number(value) < 0)
    )
      throw new ResourceValidationError('resourceValidation.memoryValues');
  }
  if (Number(values.memory) > 0 && Number(values.memoryReservation) > Number(values.memory))
    throw new ResourceValidationError('resourceValidation.memoryReservation');
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
