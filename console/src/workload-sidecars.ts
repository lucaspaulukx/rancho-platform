import type { Schema } from './api';
import { ptSidecarValidation } from './i18n/domains/sidecar-validation';
import type { createTranslator } from './i18n/messages';

type NamedSidecarError =
  | 'sidecarValidation.fieldUnavailable'
  | 'sidecarValidation.fieldContract'
  | 'sidecarValidation.image';
type SidecarErrorDetail =
  | [key: Exclude<keyof typeof ptSidecarValidation, NamedSidecarError>]
  | [key: NamedSidecarError, name: string];

export class SidecarValidationError extends Error {
  readonly detail: SidecarErrorDetail;

  constructor(...detail: SidecarErrorDetail) {
    const [key, name] = detail;
    super(ptSidecarValidation[key].replace('{name}', () => name ?? ''));
    this.detail = detail;
  }

  format(t: ReturnType<typeof createTranslator>['t']) {
    const [key, name] = this.detail;
    if (
      key === 'sidecarValidation.fieldUnavailable' ||
      key === 'sidecarValidation.fieldContract' ||
      key === 'sidecarValidation.image'
    )
      return t(key, { name });
    return t(key);
  }
}

function validateFields(
  row: Record<string, unknown>,
  schema: Schema,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new SidecarValidationError('sidecarValidation.depth');
  for (const [name, value] of Object.entries(row)) {
    const field = schema.resourceFields[name];
    if (!field?.create)
      throw new SidecarValidationError('sidecarValidation.fieldUnavailable', name);
    if (value && typeof value === 'object') {
      const nested = schemas[field.type];
      const itemType = /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
      if (nested && !Array.isArray(value))
        validateFields(value as Record<string, unknown>, nested, schemas, depth + 1);
      else if (Array.isArray(value) && itemType && schemas[itemType])
        for (const item of value) {
          if (!item || typeof item !== 'object' || Array.isArray(item))
            throw new SidecarValidationError('sidecarValidation.reviewItems');
          validateFields(item, schemas[itemType], schemas, depth + 1);
        }
      else if (
        !Array.isArray(value) &&
        !field.type.startsWith('map[') &&
        !['json', 'object'].includes(field.type) &&
        !nested
      )
        throw new SidecarValidationError('sidecarValidation.fieldContract', name);
    }
  }
}
export function validateSidecars(values: Record<string, unknown>, schemas: Record<string, Schema>) {
  const raw = values.secondaryLaunchConfigs;
  if (raw == null) return;
  if (!Array.isArray(raw) || raw.length > 50)
    throw new SidecarValidationError('sidecarValidation.limit');
  const schema = schemas.secondaryLaunchConfig;
  if (
    raw.length &&
    (!schema?.resourceFields.name?.create || !schema.resourceFields.imageUuid?.create)
  )
    throw new SidecarValidationError('sidecarValidation.contract');
  const names = new Set<string>();
  const primary = String(values.name || '');
  if (primary) names.add(primary);
  const uniqueNames = new Set([...names].map((name) => name.toLowerCase()));
  const configs = raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new SidecarValidationError('sidecarValidation.review');
    const row = value as Record<string, unknown>;
    validateFields(row, schema, schemas);
    const name = row.name;
    if (
      typeof name !== 'string' ||
      !/^[a-zA-Z0-9-]{1,63}$/.test(name) ||
      uniqueNames.has(name.toLowerCase())
    )
      throw new SidecarValidationError('sidecarValidation.name');
    names.add(name);
    uniqueNames.add(name.toLowerCase());
    if (typeof row.imageUuid !== 'string' || !row.imageUuid.trim() || /\s/.test(row.imageUuid))
      throw new SidecarValidationError('sidecarValidation.image', name);
    if (row.imageUuid.replace(/^docker:/, '').toLowerCase() === 'rancher/none')
      throw new SidecarValidationError('sidecarValidation.reservedImage');
    return row;
  });
  const launch = values.launchConfig;
  const all = [
    ...(launch && typeof launch === 'object' && !Array.isArray(launch)
      ? [{ ...(launch as Record<string, unknown>), name: primary }]
      : []),
    ...configs,
  ];
  const graph = new Map<string, string[]>();
  for (const row of all) {
    if (row.networkLaunchConfig && row.networkMode !== 'container')
      throw new SidecarValidationError('sidecarValidation.networkMode');
    const combined: string[] = [];
    for (const field of ['networkLaunchConfig', 'dataVolumesFromLaunchConfigs']) {
      const value = row[field];
      const refs = field === 'networkLaunchConfig' ? (value ? [value] : []) : (value ?? []);
      if (
        !Array.isArray(refs) ||
        refs.some((v) => typeof v !== 'string' || !names.has(v) || v === row.name)
      )
        throw new SidecarValidationError('sidecarValidation.links');
      combined.push(...(refs as string[]));
    }
    graph.set(String(row.name), [...new Set(combined)]);
  }
  const done = new Set<string>(),
    active = new Set<string>();
  function visit(name: string) {
    if (active.has(name)) throw new SidecarValidationError('sidecarValidation.cycle');
    if (done.has(name)) return;
    active.add(name);
    for (const next of graph.get(name) || []) visit(next);
    active.delete(name);
    done.add(name);
  }
  for (const name of graph.keys()) visit(name);
}
