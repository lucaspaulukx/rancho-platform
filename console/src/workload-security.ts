import { WorkloadPolicyValidationError } from './workload-scheduling';
import type { Schema } from './api';
export function validateWorkloadSecurity(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new WorkloadPolicyValidationError('workloadPolicyValidation.depth');
  for (const key of ['capAdd', 'capDrop']) {
    const value = values[key],
      field = schema.resourceFields[key];
    if (value == null) continue;
    if (
      !field?.create ||
      field.type !== 'array[enum]' ||
      !field.options ||
      !Array.isArray(value) ||
      value.some((v) => typeof v !== 'string' || !field.options!.includes(v)) ||
      new Set(value).size !== value.length
    )
      throw new WorkloadPolicyValidationError('workloadPolicyValidation.capabilities');
  }
  for (const [key, value] of Object.entries(values)) {
    const field = schema.resourceFields[key],
      nested = field && schemas[field.type];
    if (nested && value && typeof value === 'object' && !Array.isArray(value))
      validateWorkloadSecurity(nested, value as Record<string, unknown>, schemas, depth + 1);
    const array = field && /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
    if (array && schemas[array] && Array.isArray(value))
      for (const row of value)
        if (row && typeof row === 'object' && !Array.isArray(row))
          validateWorkloadSecurity(schemas[array], row, schemas, depth + 1);
  }
}
