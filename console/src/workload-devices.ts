import type { Schema, SchemaField } from './api';
import { ptDevices } from './i18n/domains/devices';

export const maxDeviceMappings = 32;
// Local editor budget, not a claim about every native Docker/filesystem path limit.
const maxMappingLength = 8192;
export const devicePermissions = ['r', 'w', 'm'] as const;
type DeviceErrorKey = Extract<keyof typeof ptDevices, `devices.error.${string}`>;
export class DeviceValidationError extends Error {
  constructor(public readonly key: DeviceErrorKey) {
    // Existing form/API error boundaries retain readable pt-BR until their full extraction.
    super(ptDevices[key]);
    this.name = 'DeviceValidationError';
  }
}
export function supportsDevices(field: SchemaField | undefined) {
  return field?.create === true && field.type === 'array[string]';
}

/** Parse only the explicit three-part format, including incomplete editable drafts. */
export function deviceFields(value: string) {
  const fields = value.split(':');
  if (
    fields.length !== 3 ||
    !/^[rwm]*$/.test(fields[2]) ||
    new Set(fields[2]).size !== fields[2].length
  )
    return undefined;
  return { host: fields[0], container: fields[1], permissions: fields[2] };
}

/** Preserve accepted strings byte-for-byte: only an explicit editor action may reserialize a row. */
export function normalizeDevices(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > maxDeviceMappings)
    throw new DeviceValidationError('devices.error.list');
  const targets = new Set<string>();
  return value.map((entry) => {
    if (typeof entry !== 'string') throw new DeviceValidationError('devices.error.format');
    const fields = entry.split(':');
    if (fields.length !== 3) throw new DeviceValidationError('devices.error.format');
    const [host, container, permissions] = fields;
    if (
      entry.length > maxMappingLength ||
      !host.startsWith('/') ||
      !container.startsWith('/') ||
      /[\u0000-\u001f\u007f]/.test(entry)
    )
      throw new DeviceValidationError('devices.error.path');
    if (!/^[rwm]+$/.test(permissions) || new Set(permissions).size !== permissions.length)
      throw new DeviceValidationError('devices.error.permissions');
    if (targets.has(container)) throw new DeviceValidationError('devices.error.duplicate');
    targets.add(container);
    return entry;
  });
}

export function validateWorkloadDevices(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new DeviceValidationError('devices.error.depth');
  if (values.devices != null) {
    if (!supportsDevices(schema.resourceFields.devices))
      throw new DeviceValidationError('devices.error.contract');
    normalizeDevices(values.devices);
  }
  for (const [name, value] of Object.entries(values)) {
    const type = schema.resourceFields[name]?.type;
    if (name === 'devices' || !type) continue;
    if (schemas[type] && value && typeof value === 'object' && !Array.isArray(value))
      validateWorkloadDevices(schemas[type], value as Record<string, unknown>, schemas, depth + 1);
    const child = /^array\[([^\]]+)\]$/.exec(type)?.[1];
    if (child && schemas[child] && Array.isArray(value))
      for (const row of value)
        if (row && typeof row === 'object' && !Array.isArray(row))
          validateWorkloadDevices(schemas[child], row, schemas, depth + 1);
  }
}
