import { api, ApiError, type Resource, type Schema } from './api';
import { canManageResource } from './hooks/useSchemas';
import { lifecyclePayload } from './lifecycle-actions';
import { ptBulkOperation } from './i18n/domains/bulk-operation';

type BulkMessageKey = Extract<keyof typeof ptBulkOperation, `bulkOperation.message.${string}`>;

export class BulkOperationError extends Error {
  constructor(readonly messageKey: BulkMessageKey) {
    super(ptBulkOperation[messageKey]);
  }
}

export const bulkActions = [
  'start',
  'stop',
  'restart',
  'activate',
  'deactivate',
  'remove',
] as const;
export type BulkAction = (typeof bulkActions)[number];
export const resourceKey = (resource: Resource) => `${resource.type}:${resource.id}`;
export function commonBulkActions(resources: Resource[], schemas: Record<string, Schema>) {
  return resources.length && resources.length <= 100
    ? bulkActions
        .filter((action) =>
          resources.every(
            (resource) => canManageResource(schemas[resource.type]) && !!resource.actions?.[action],
          ),
        )
        .filter(
          (action) =>
            action !== 'remove' || new Set(resources.map((resource) => resource.type)).size === 1,
        )
    : [];
}
export interface BulkResult {
  id: string;
  name: string;
  status: 'accepted' | 'failed' | 'unknown';
  message: string;
  messageKey?: BulkMessageKey;
}
type Transport = (
  url: string,
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<Resource>;
/** Serial requests bound load and preserve per-target outcomes. An accepted POST
 * is not proof that the asynchronous Rancher lifecycle has completed. */
export async function executeBulk(
  resources: Resource[],
  action: BulkAction,
  environment: string,
  onResult: (result: BulkResult) => void,
  transport: Transport = (url, payload, signal) =>
    api<Resource>(url, payload, payload ? 'POST' : 'GET', signal),
  signal?: AbortSignal,
) {
  if (!bulkActions.includes(action) || !resources.length || resources.length > 100)
    throw new BulkOperationError('bulkOperation.message.invalidSelection');
  if (new Set(resources.map(resourceKey)).size !== resources.length)
    throw new BulkOperationError('bulkOperation.message.duplicateResources');
  if (action === 'remove' && new Set(resources.map((resource) => resource.type)).size !== 1)
    throw new BulkOperationError('bulkOperation.message.mixedRemoval');
  for (const resource of resources) {
    if (signal?.aborted) return;
    let submitted = false;
    try {
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000);
      const current = await transport(resource.links.self, undefined, requestSignal);
      if (
        current.id !== resource.id ||
        current.type !== resource.type ||
        current.accountId !== environment
      )
        throw new BulkOperationError('bulkOperation.message.wrongEnvironment');
      const url = current.actions?.[action];
      if (!url) throw new BulkOperationError('bulkOperation.message.actionUnavailable');
      submitted = true;
      await transport(url, lifecyclePayload(current, action), requestSignal);
      onResult({
        id: resourceKey(resource),
        name: resource.name || resource.id,
        status: 'accepted',
        message: ptBulkOperation['bulkOperation.message.accepted'],
        messageKey: 'bulkOperation.message.accepted',
      });
    } catch (error) {
      const interrupted =
        error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name);
      const uncertain = submitted && !(error instanceof ApiError);
      const messageKey = uncertain
        ? 'bulkOperation.message.unknown'
        : interrupted
          ? 'bulkOperation.message.timeout'
          : error instanceof BulkOperationError
            ? error.messageKey
            : error instanceof Error
              ? undefined
              : 'bulkOperation.message.failed';
      onResult({
        id: resourceKey(resource),
        name: resource.name || resource.id,
        status: uncertain ? 'unknown' : 'failed',
        message: messageKey ? ptBulkOperation[messageKey] : (error as Error).message,
        ...(messageKey ? { messageKey } : {}),
      });
    }
  }
}
