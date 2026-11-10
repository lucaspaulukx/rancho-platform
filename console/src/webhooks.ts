import { safeApiUrl, type Resource, type Schema } from './api';
import { ptWebhooksPage } from './i18n/domains/webhooks-page';

type WebhookValidationKey = Extract<
  keyof typeof ptWebhooksPage,
  `webhooksPage.validation.${string}`
>;
type NumericValidationKey = 'webhooksPage.validation.integer' | 'webhooksPage.validation.range';
type WebhookNumberField =
  | 'webhooksPage.minimum'
  | 'webhooksPage.maximum'
  | 'webhooksPage.amount'
  | 'webhooksPage.batchSize'
  | 'webhooksPage.interval';
type WebhookValidationFailure =
  | { key: Exclude<WebhookValidationKey, NumericValidationKey> }
  | { key: NumericValidationKey; label: WebhookNumberField };

export class WebhookValidationError extends Error {
  constructor(readonly failure: WebhookValidationFailure) {
    const message = ptWebhooksPage[failure.key];
    super(
      'label' in failure
        ? message.replace('{label}', () => ptWebhooksPage[failure.label])
        : message,
    );
  }
}

export const webhookDrivers = ['scaleService', 'serviceUpgrade', 'scaleHost'] as const;
export type WebhookDriver = (typeof webhookDrivers)[number];
export interface SelectorRow {
  id: string;
  key: string;
  value: string;
}
export interface WebhookDraft {
  name: string;
  driver: WebhookDriver;
  serviceId: string;
  action: 'up' | 'down';
  amount: string;
  min: string;
  max: string;
  selectors: SelectorRow[];
  deleteOption: 'leastRecent' | 'mostRecent';
  tag: string;
  batchSize: string;
  intervalSeconds: string;
  payloadFormat: string;
  addressType: string;
  startFirst: boolean;
}
export function newWebhookDraft(): WebhookDraft {
  return {
    name: '',
    driver: 'scaleService',
    serviceId: '',
    action: 'up',
    amount: '1',
    min: '1',
    max: '100',
    selectors: [],
    deleteOption: 'leastRecent',
    tag: '',
    batchSize: '1',
    intervalSeconds: '2',
    payloadFormat: 'dockerhub',
    addressType: 'registry',
    startFirst: false,
  };
}
export function webhookPath(project: string, id?: string) {
  if (
    !/^1a[1-9]\d*$/.test(project) ||
    (id !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id))
  )
    throw new WebhookValidationError({ key: 'webhooksPage.validation.scope' });
  return (
    '/v1-webhooks/receivers' +
    (id ? '/' + encodeURIComponent(id) : '') +
    '?projectId=' +
    encodeURIComponent(project)
  );
}
export interface ReceiverMetadata {
  id: string;
  name: string;
  driver: string;
  state: string;
  target: string | null;
}
export function receiverMetadata(v: Resource): ReceiverMetadata {
  if (
    v.type !== 'receiver' ||
    typeof v.id !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v.id)
  )
    throw new WebhookValidationError({ key: 'webhooksPage.validation.receiver' });
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name.slice(0, 255) : v.id,
    driver: typeof v.driver === 'string' ? v.driver : '',
    state: typeof v.state === 'string' ? v.state : '',
    target:
      v.driver === 'scaleService' &&
      v.scaleServiceConfig &&
      typeof v.scaleServiceConfig === 'object' &&
      typeof (v.scaleServiceConfig as Record<string, unknown>).serviceId === 'string'
        ? String((v.scaleServiceConfig as Record<string, unknown>).serviceId)
        : null,
  };
}
export function webhookNext(value: unknown, project: string) {
  if (!value) return null;
  if (typeof value !== 'string')
    throw new WebhookValidationError({ key: 'webhooksPage.validation.pagination' });
  let path: string;
  try {
    path = safeApiUrl(value);
  } catch {
    throw new WebhookValidationError({ key: 'webhooksPage.validation.pagination' });
  }
  const url = new URL(path, location.origin);
  if (url.pathname !== '/v1-webhooks/receivers' || url.searchParams.get('projectId') !== project)
    throw new WebhookValidationError({ key: 'webhooksPage.validation.paginationScope' });
  return path;
}
export function webhookWriter(report: unknown, project: string) {
  if (!report || typeof report !== 'object') return false;
  const r = report as Record<string, unknown>;
  return (
    r.complete === true &&
    r.projectId === project.replace(/^1a/, '') &&
    typeof r.accountId === 'string' &&
    /^[1-9]\d*$/.test(r.accountId) &&
    ['owner', 'member'].includes(String(r.effectiveRole))
  );
}
export function webhookCreateAllowed(schema?: Schema) {
  return (
    schema?.id === 'receiver' &&
    schema.collectionMethods?.includes('POST') &&
    schema.resourceFields.name?.create === true &&
    schema.resourceFields.driver?.create === true
  );
}
export function webhookSelectors(rows: SelectorRow[]) {
  if (!rows.length || rows.length > 64)
    throw new WebhookValidationError({ key: 'webhooksPage.validation.selectorCount' });
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]{0,252}$/.test(key) ||
      row.value.length > 1024 ||
      /[\x00-\x1f\x7f]/.test(row.value) ||
      Object.hasOwn(result, key)
    )
      throw new WebhookValidationError({ key: 'webhooksPage.validation.selectorKeys' });
    Object.defineProperty(result, key, {
      value: row.value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}
function number(value: string, label: WebhookNumberField, schema?: { min?: number; max?: number }) {
  if (!/^\d+$/.test(value.trim()))
    throw new WebhookValidationError({ key: 'webhooksPage.validation.integer', label });
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < Math.max(1, schema?.min ?? 1) || n > (schema?.max ?? 100000))
    throw new WebhookValidationError({ key: 'webhooksPage.validation.range', label });
  return n;
}
function choice(value: string, field: string, schema: Schema) {
  const options = schema.resourceFields[field]?.options;
  if (!options?.includes(value) || !schema.resourceFields[field]?.create)
    throw new WebhookValidationError({ key: 'webhooksPage.validation.choice' });
  return value;
}
export function prepareWebhook(
  draft: WebhookDraft,
  schemas: Record<string, Schema>,
  project: string,
  services: Resource[],
) {
  webhookPath(project);
  const receiver = schemas.receiver,
    config = schemas[draft.driver];
  if (
    !webhookCreateAllowed(receiver) ||
    !webhookDrivers.includes(draft.driver) ||
    !receiver.resourceFields.driver.options?.includes(draft.driver) ||
    !config ||
    !receiver.resourceFields[draft.driver + 'Config']?.create
  )
    throw new WebhookValidationError({ key: 'webhooksPage.validation.driver' });
  const name = draft.name.trim();
  if (!name || name.length > 255 || /[\x00-\x1f\x7f]/.test(name))
    throw new WebhookValidationError({ key: 'webhooksPage.validation.name' });
  let body: Record<string, unknown> = { type: draft.driver };
  const required: string[] = [];
  if (draft.driver === 'scaleService' || draft.driver === 'scaleHost') {
    required.push('action', 'amount', 'min', 'max');
    const min = number(draft.min, 'webhooksPage.minimum', config.resourceFields.min),
      max = number(draft.max, 'webhooksPage.maximum', config.resourceFields.max);
    if (max <= min) throw new WebhookValidationError({ key: 'webhooksPage.validation.bounds' });
    body = {
      ...body,
      action: choice(draft.action, 'action', config),
      amount: number(draft.amount, 'webhooksPage.amount', config.resourceFields.amount),
      min,
      max,
    };
    if (draft.driver === 'scaleService') {
      required.push('serviceId');
      const service = services.find(
        (v) =>
          v.id === draft.serviceId &&
          v.accountId === project &&
          v.type === 'service' &&
          !v.removed &&
          ['active', 'inactive'].includes(v.state || ''),
      );
      if (!service) throw new WebhookValidationError({ key: 'webhooksPage.validation.service' });
      body.serviceId = service.id;
    } else {
      required.push('hostSelector');
      body.hostSelector = webhookSelectors(draft.selectors);
      if (draft.action === 'down') {
        required.push('deleteOption');
        body.deleteOption = choice(draft.deleteOption, 'deleteOption', config);
      }
    }
  } else {
    required.push(
      'tag',
      'serviceSelector',
      'batchSize',
      'intervalMillis',
      'payloadFormat',
      'addressType',
      'startFirst',
    );
    const tag = draft.tag.trim();
    if (!tag || tag.length > 255 || /\s|[\x00-\x1f\x7f]/.test(tag))
      throw new WebhookValidationError({ key: 'webhooksPage.validation.tag' });
    body = {
      ...body,
      tag,
      serviceSelector: webhookSelectors(draft.selectors),
      batchSize: number(draft.batchSize, 'webhooksPage.batchSize', config.resourceFields.batchSize),
      intervalMillis: number(
        draft.intervalSeconds,
        'webhooksPage.interval',
        config.resourceFields.intervalMillis,
      ),
      payloadFormat: choice(draft.payloadFormat, 'payloadFormat', config),
      addressType: choice(draft.addressType, 'addressType', config),
      startFirst: draft.startFirst,
    };
    if (typeof draft.startFirst !== 'boolean')
      throw new WebhookValidationError({ key: 'webhooksPage.validation.strategy' });
  }
  if (required.some((name) => config.resourceFields[name]?.create !== true))
    throw new WebhookValidationError({ key: 'webhooksPage.validation.contract' });
  return { name, driver: draft.driver, [draft.driver + 'Config']: body };
}
export function receiverSecret(value: Resource, project: string) {
  const row = receiverMetadata(value);
  if (typeof value.url !== 'string')
    throw new WebhookValidationError({ key: 'webhooksPage.validation.urlDenied' });
  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    throw new WebhookValidationError({ key: 'webhooksPage.validation.urlInvalid' });
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname.replace(/\/$/, '') !== '/v1-webhooks/endpoint' ||
    url.searchParams.get('projectId') !== project ||
    !url.searchParams.get('key') ||
    [...url.searchParams.keys()].some((k) => !['key', 'projectId'].includes(k))
  )
    throw new WebhookValidationError({ key: 'webhooksPage.validation.urlScope' });
  return { id: row.id, url: url.toString() };
}
export function cloneReceiver(
  value: Resource,
  formatName = (name: string) =>
    ptWebhooksPage['webhooksPage.cloneName'].replace('{name}', () => name),
): WebhookDraft {
  const row = receiverMetadata(value);
  if (!webhookDrivers.includes(row.driver as WebhookDriver))
    throw new WebhookValidationError({ key: 'webhooksPage.validation.cloneDriver' });
  const driver = row.driver as WebhookDriver,
    config = value[driver + 'Config'];
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new WebhookValidationError({ key: 'webhooksPage.validation.cloneConfiguration' });
  const v = config as Record<string, unknown>,
    d = newWebhookDraft();
  const selector = v[driver === 'scaleHost' ? 'hostSelector' : 'serviceSelector'];
  return {
    ...d,
    name: formatName(row.name),
    driver,
    serviceId: typeof v.serviceId === 'string' ? v.serviceId : '',
    action: v.action === 'down' ? 'down' : 'up',
    amount: String(v.amount ?? d.amount),
    min: String(v.min ?? d.min),
    max: String(v.max ?? d.max),
    deleteOption: v.deleteOption === 'mostRecent' ? 'mostRecent' : 'leastRecent',
    tag: typeof v.tag === 'string' ? v.tag : '',
    batchSize: String(v.batchSize ?? d.batchSize),
    intervalSeconds: String(v.intervalMillis ?? d.intervalSeconds),
    payloadFormat: typeof v.payloadFormat === 'string' ? v.payloadFormat : d.payloadFormat,
    addressType: typeof v.addressType === 'string' ? v.addressType : d.addressType,
    startFirst: v.startFirst === true,
    selectors:
      selector && typeof selector === 'object' && !Array.isArray(selector)
        ? Object.entries(selector).map(([key, value]) => ({
            id: crypto.randomUUID(),
            key,
            value: String(value),
          }))
        : [],
  };
}
