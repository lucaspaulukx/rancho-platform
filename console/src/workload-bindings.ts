import type { Schema } from './api';
import { ptBindingsEditor } from './i18n/domains/bindings-editor';

type BindingValidationKey = Extract<
  keyof typeof ptBindingsEditor,
  `bindingsEditor.validation.${string}`
>;

export class BindingValidationError extends Error {
  constructor(readonly key: BindingValidationKey) {
    super(ptBindingsEditor[key]);
  }
}

export type BindingKind = 'ports' | 'dataVolumes';
export interface PortDraft {
  kind: 'ports';
  key: number;
  host: string;
  container: string;
  ip: string;
  protocol: 'tcp' | 'udp';
  original?: string;
  changed?: boolean;
}
export interface VolumeDraft {
  kind: 'dataVolumes';
  key: number;
  source: string;
  target: string;
  mode: 'rw' | 'ro';
  original?: string;
  changed?: boolean;
}
export interface NativeDraft {
  kind: 'native';
  key: number;
  original: string;
}
export type BindingDraft = PortDraft | VolumeDraft | NativeDraft;
function numeric(value: string) {
  return (
    /^\d+$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= 65535 &&
    Number.isSafeInteger(Number(value))
  );
}
function validIp(value: string) {
  if (!value) return true;
  if (value.includes(':')) {
    try {
      return /^[0-9a-fA-F:.]+$/.test(value) && !!new URL(`http://[${value}]/`).hostname;
    } catch {
      return false;
    }
  }
  return (
    /^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(value) &&
    value.split('.').every((v) => Number(v) <= 255)
  );
}
const absolute = (value: string) => value.startsWith('/') && !/[:\x00-\x1f\x7f]/.test(value);
export function decodeBinding(kind: BindingKind, value: string, key: number): BindingDraft {
  if (kind === 'ports') {
    const match = /^(?:(?:(\[[0-9a-fA-F:.]+\]|[0-9.]+):)?(\d+):)?(\d+)(?:\/(tcp|udp))?$/.exec(
      value,
    );
    if (match) {
      const ip = (match[1] || '').replace(/^\[|\]$/g, '');
      if (numeric(match[3]) && (!match[2] || numeric(match[2])) && validIp(ip))
        return {
          kind,
          key,
          host: match[2] || '',
          container: match[3],
          ip,
          protocol: (match[4] || 'tcp') as 'tcp' | 'udp',
          original: value,
        };
    }
  } else {
    const pieces = value.split(':');
    if (pieces.length === 1 && absolute(value))
      return { kind, key, source: '', target: value, mode: 'rw', original: value };
    if (pieces.length === 2 && absolute(pieces[0]) && ['rw', 'ro'].includes(pieces[1]))
      return {
        kind,
        key,
        source: '',
        target: pieces[0],
        mode: pieces[1] as 'rw' | 'ro',
        original: value,
      };
    if (
      (pieces.length === 2 || pieces.length === 3) &&
      pieces[0] &&
      absolute(pieces[1]) &&
      (!pieces[2] || ['rw', 'ro'].includes(pieces[2])) &&
      (absolute(pieces[0]) || /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(pieces[0]))
    )
      return {
        kind,
        key,
        source: pieces[0],
        target: pieces[1],
        mode: (pieces[2] || 'rw') as 'rw' | 'ro',
        original: value,
      };
  }
  return { kind: 'native', key, original: value };
}
export function encodeBinding(row: BindingDraft): string {
  if (row.kind === 'native' || (row.original !== undefined && !row.changed)) return row.original!;
  if (row.kind === 'ports')
    return `${row.ip ? `${row.ip.includes(':') ? '[' + row.ip + ']' : row.ip}:` : ''}${row.host ? row.host + ':' : ''}${row.container}/${row.protocol}`;
  return row.source
    ? `${row.source}:${row.target}:${row.mode}`
    : row.mode === 'rw'
      ? row.target
      : `${row.target}:ro`;
}
export function validateBindings(kind: BindingKind, values: unknown, baseline: unknown = []): void {
  if (!Array.isArray(values) || values.length > 100 || values.some((v) => typeof v !== 'string'))
    throw new BindingValidationError('bindingsEditor.validation.limit');
  const retained = new Map<string, number>();
  for (const v of Array.isArray(baseline) ? baseline : [])
    if (typeof v === 'string' && decodeBinding(kind, v, 0).kind === 'native')
      retained.set(v, (retained.get(v) || 0) + 1);
  const targets = new Set<string>(),
    listeners: { host: string; ip: string; protocol: string }[] = [];
  for (const [i, value] of values.entries()) {
    const row = decodeBinding(kind, value, i);
    if (row.kind === 'native') {
      if (value.trim() && !/[\x00-\x1f\x7f]/.test(value) && (retained.get(value) || 0) > 0) {
        retained.set(value, retained.get(value)! - 1);
        continue;
      }
      throw new BindingValidationError(
        kind === 'ports' ? 'bindingsEditor.validation.ports' : 'bindingsEditor.validation.volumes',
      );
    }
    if (row.kind === 'ports') {
      if (row.ip && !row.host)
        throw new BindingValidationError('bindingsEditor.validation.ipNeedsHostPort');
      if (row.host) {
        const host = String(Number(row.host)),
          ip = row.ip.includes(':')
            ? new URL(`http://[${row.ip}]/`).hostname.slice(1, -1)
            : row.ip || '0.0.0.0';
        if (
          listeners.some(
            (v) =>
              v.host === host &&
              v.protocol === row.protocol &&
              (v.ip === ip || ['0.0.0.0', '::'].includes(ip) || ['0.0.0.0', '::'].includes(v.ip)),
          )
        )
          throw new BindingValidationError('bindingsEditor.validation.portConflict');
        listeners.push({ host, ip, protocol: row.protocol });
      }
    } else {
      const parts: string[] = [];
      for (const part of row.target.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
      }
      const path = '/' + parts.join('/');
      if (targets.has(path))
        throw new BindingValidationError('bindingsEditor.validation.duplicateTarget');
      targets.add(path);
    }
  }
}
export function validateBindingFields(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  baseline: Record<string, unknown> = {},
  depth = 0,
) {
  if (depth > 12) throw new BindingValidationError('bindingsEditor.validation.depth');
  for (const [name, field] of Object.entries(schema.resourceFields)) {
    const value = values[name];
    if (value === undefined || value === null) continue;
    if (['ports', 'dataVolumes'].includes(name) && field.type === 'array[string]')
      validateBindings(name as BindingKind, value, baseline[name]);
    else if (schemas[field.type] && typeof value === 'object' && !Array.isArray(value))
      validateBindingFields(
        schemas[field.type],
        value as Record<string, unknown>,
        schemas,
        (baseline[name] || {}) as Record<string, unknown>,
        depth + 1,
      );
  }
}
