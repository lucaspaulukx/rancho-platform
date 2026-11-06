import { ptWorkloadPolicyValidation } from './i18n/domains/workload-policy-validation';
export class WorkloadPolicyValidationError extends Error {
  constructor(readonly key: keyof typeof ptWorkloadPolicyValidation) {
    super(ptWorkloadPolicyValidation[key]);
  }
}
import type { Schema } from './api';
export const affinityPrefix = 'io.rancher.scheduler.affinity:';
export const globalLabel = 'io.rancher.scheduler.global';
export const schedulingKinds = {
  host_label: 'Label de host',
  container_label: 'Label de container',
  container: 'Nome de container',
} as const;
export const schedulingModes = {
  '': 'Deve corresponder',
  _ne: 'Não pode corresponder',
  _soft: 'Preferir correspondência',
  _soft_ne: 'Preferir evitar',
} as const;
export interface SchedulingRule {
  id: string;
  kind: keyof typeof schedulingKinds;
  mode: keyof typeof schedulingModes;
  key: string;
  value: string;
}
function match(key: string) {
  return /^io\.rancher\.scheduler\.affinity:(host_label|container_label|container)(_soft_ne|_soft|_ne)?$/.exec(
    key,
  );
}
export function decodeScheduling(labels: Record<string, string>) {
  const rules: SchedulingRule[] = [],
    other: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(labels)) {
    const m = match(key);
    if (!m) {
      other[key] = value;
      continue;
    }
    for (const part of value.split(',')) {
      const index = m[1] === 'container' ? -1 : part.indexOf('=');
      const rule: SchedulingRule = {
        id: crypto.randomUUID(),
        kind: m[1] as SchedulingRule['kind'],
        mode: (m[2] || '') as SchedulingRule['mode'],
        key: index === -1 ? '' : part.slice(0, index),
        value: index === -1 ? part : part.slice(index + 1),
      };
      validateRule(rule);
      rules.push(rule);
    }
  }
  if (rules.length > 100) throw new WorkloadPolicyValidationError('workloadPolicyValidation.limit');
  return { rules, other };
}
function validateRule(rule: SchedulingRule) {
  if (
    !Object.hasOwn(schedulingKinds, rule.kind) ||
    !Object.hasOwn(schedulingModes, rule.mode) ||
    !rule.value.trim() ||
    /[,\x00-\x1f\x7f]/.test(rule.value) ||
    rule.value.length > 4096 ||
    (rule.kind !== 'container' &&
      (!rule.key.trim() || /[=,\s\x00-\x1f\x7f]/.test(rule.key) || rule.key.length > 255))
  )
    throw new WorkloadPolicyValidationError('workloadPolicyValidation.rule');
}
export function encodeScheduling(
  rules: SchedulingRule[],
  other: Record<string, string>,
  strict = true,
) {
  if (rules.length > 100) throw new WorkloadPolicyValidationError('workloadPolicyValidation.limit');
  const labels = { ...other };
  for (const rule of rules) {
    if (strict) validateRule(rule);
    const key = affinityPrefix + rule.kind + rule.mode;
    const value = rule.kind === 'container' ? rule.value : rule.key + '=' + rule.value;
    labels[key] = key in labels ? labels[key] + ',' + value : value;
  }
  if (strict) validateSchedulingLabels(labels);
  return labels;
}
export function validateSchedulingLabels(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WorkloadPolicyValidationError('workloadPolicyValidation.map');
  const labels = value as Record<string, string>;
  if (Object.values(labels).some((v) => typeof v !== 'string'))
    throw new WorkloadPolicyValidationError('workloadPolicyValidation.text');
  const { rules } = decodeScheduling(labels);
  if (
    labels[globalLabel] === 'true' &&
    rules.some((v) => v.kind !== 'host_label' || v.mode.includes('_soft'))
  )
    throw new WorkloadPolicyValidationError('workloadPolicyValidation.global');
}
export function validateWorkloadScheduling(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new WorkloadPolicyValidationError('workloadPolicyValidation.depth');
  for (const [name, value] of Object.entries(values)) {
    const field = schema.resourceFields[name];
    if (name === 'labels' && field?.type === 'map[string]' && value != null)
      validateSchedulingLabels(value);
    const nested = field && schemas[field.type];
    if (nested && value && typeof value === 'object' && !Array.isArray(value))
      validateWorkloadScheduling(nested, value as Record<string, unknown>, schemas, depth + 1);
    const arrayType = field && /^array\[([^\]]+)\]$/.exec(field.type)?.[1];
    if (arrayType && schemas[arrayType] && Array.isArray(value))
      for (const entry of value)
        if (entry && typeof entry === 'object' && !Array.isArray(entry))
          validateWorkloadScheduling(
            schemas[arrayType],
            entry as Record<string, unknown>,
            schemas,
            depth + 1,
          );
  }
}
