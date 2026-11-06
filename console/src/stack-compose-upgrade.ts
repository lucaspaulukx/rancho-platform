import { ptStackComposeUpgradePanel } from './i18n/domains/stack-compose-upgrade-panel';
import { safeApiUrl, type Resource, type Schema } from './api';
import { composeByteLimit } from './stack-compose';
type ComposeUpgradeValidationKey = Extract<
  keyof typeof ptStackComposeUpgradePanel,
  `stackComposeUpgradePanel.validation.${string}`
>;

export class StackComposeUpgradeValidationError extends Error {
  constructor(readonly key: ComposeUpgradeValidationKey) {
    super(ptStackComposeUpgradePanel[key]);
  }
}

export interface ComposeTexts {
  dockerCompose: string;
  rancherCompose: string;
}
export function composeStackEligible(row: Resource) {
  return (
    row.type === 'stack' && !row.system && !row.externalId && !row.removed && row.state === 'active'
  );
}
export function composeStackTarget(
  row: Resource,
  environment: string,
  action: 'upgrade' | 'exportconfig',
) {
  if (
    !composeStackEligible(row) ||
    row.accountId !== environment ||
    !/^1st[0-9]+$/.test(row.id) ||
    !/^1a[0-9]+$/.test(environment)
  )
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.stackUnavailable',
    );
  if (typeof row.dockerCompose !== 'string' || !row.dockerCompose.trim())
    throw new StackComposeUpgradeValidationError('stackComposeUpgradePanel.validation.noSource');
  const self = `/v2-beta/projects/${environment}/stacks/${row.id}`;
  if (
    !row.links?.self ||
    safeApiUrl(row.links.self).replace(/\/$/, '') !== self ||
    !row.actions?.[action]
  )
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.actionUnavailable',
    );
  const url = new URL(safeApiUrl(row.actions[action]!), location.origin);
  if (url.pathname.replace(/\/$/, '') !== self || url.search !== '?action=' + action)
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.invalidTarget',
    );
  return url.pathname + url.search;
}
export function composeExport(row: Resource): ComposeTexts {
  if (
    row.type !== 'composeConfig' ||
    typeof row.dockerComposeConfig !== 'string' ||
    !row.dockerComposeConfig.trim() ||
    (row.rancherComposeConfig != null && typeof row.rancherComposeConfig !== 'string')
  )
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.invalidExport',
    );
  const result = {
    dockerCompose: row.dockerComposeConfig,
    rancherCompose: (row.rancherComposeConfig as string) ?? '',
  };
  for (const value of Object.values(result))
    if (value.includes('\0') || new TextEncoder().encode(value).byteLength > composeByteLimit)
      throw new StackComposeUpgradeValidationError(
        'stackComposeUpgradePanel.validation.exportTooLarge',
      );
  return result;
}
export function composeStackSnapshot(row: Resource) {
  function stable(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, stable(v)]),
      );
    return v;
  }
  return JSON.stringify(
    stable(
      Object.fromEntries(
        [
          'id',
          'type',
          'uuid',
          'name',
          'state',
          'accountId',
          'externalId',
          'system',
          'removed',
          'environment',
          'answers',
          'templates',
          'dockerCompose',
          'rancherCompose',
        ].map((k) => [k, row[k] ?? null]),
      ),
    ),
  );
}
export function composeStackPermission(schema: Schema) {
  return (
    schema.id === 'stack' &&
    schema.resourceActions?.upgrade?.input === 'stackUpgrade' &&
    schema.resourceActions?.exportconfig?.input === 'composeConfigInput'
  );
}
export function prepareComposeUpgrade(
  before: Resource,
  fresh: Resource,
  exported: ComposeTexts,
  current: ComposeTexts,
  draft: ComposeTexts,
  permission: Schema,
  input: Schema,
  environment: string,
  impact: boolean,
) {
  composeStackTarget(fresh, environment, 'upgrade');
  if (!impact)
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.confirmImpact',
    );
  if (!composeStackPermission(permission) || input.id !== 'stackUpgrade')
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.contractUnavailable',
    );
  if (
    composeStackSnapshot(before) !== composeStackSnapshot(fresh) ||
    exported.dockerCompose !== current.dockerCompose ||
    exported.rancherCompose !== current.rancherCompose
  )
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.stackChanged',
    );
  if (
    draft.dockerCompose === exported.dockerCompose &&
    draft.rancherCompose === exported.rancherCompose
  )
    throw new StackComposeUpgradeValidationError(
      'stackComposeUpgradePanel.validation.changeRequired',
    );
  const payload: Record<string, unknown> = {};
  for (const key of ['dockerCompose', 'rancherCompose'] as const) {
    const value = draft[key],
      field = input.resourceFields[key];
    if (!field?.create || field.type !== 'string')
      throw new StackComposeUpgradeValidationError(
        'stackComposeUpgradePanel.validation.fieldDenied',
      );
    if (
      (key === 'dockerCompose' && !value.trim()) ||
      value.includes('\0') ||
      value.length > (field.maxLength ?? Infinity) ||
      new TextEncoder().encode(value).byteLength > composeByteLimit
    )
      throw new StackComposeUpgradeValidationError(
        'stackComposeUpgradePanel.validation.invalidFiles',
      );
    payload[key] = value;
  }
  for (const key of ['environment', 'answers', 'templates']) {
    const value = fresh[key];
    if (value == null) continue;
    const field = input.resourceFields[key];
    if (!field?.create || !value || typeof value !== 'object' || Array.isArray(value))
      throw new StackComposeUpgradeValidationError(
        'stackComposeUpgradePanel.validation.preserveParameters',
      );
    if (key !== 'answers' && Object.values(value).some((v) => typeof v !== 'string'))
      throw new StackComposeUpgradeValidationError(
        'stackComposeUpgradePanel.validation.invalidParameter',
      );
    payload[key] = value;
  }
  return payload;
}
export function composeStackMetadata(row: Resource): Resource {
  return Object.fromEntries(
    [
      'id',
      'type',
      'name',
      'accountId',
      'state',
      'uuid',
      'system',
      'externalId',
      'removed',
      'links',
      'actions',
    ].map((k) => [k, row[k]]),
  ) as Resource;
}
