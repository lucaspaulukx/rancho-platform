import { api, ApiError, type Resource, type Schema } from './api';
import { canManageResource } from './hooks/useSchemas';
import { lifecyclePayload } from './lifecycle-actions';

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
    throw new Error('Selecione entre 1 e 100 recursos para uma operação válida.');
  if (new Set(resources.map(resourceKey)).size !== resources.length)
    throw new Error('O lote contém recursos duplicados.');
  if (action === 'remove' && new Set(resources.map((resource) => resource.type)).size !== 1)
    throw new Error('A remoção em lote exige recursos do mesmo tipo.');
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
        throw new Error('O recurso não pertence ao environment deste lote.');
      const url = current.actions?.[action];
      if (!url)
        throw new Error('A ação deixou de estar disponível. Revise o estado e suas permissões.');
      submitted = true;
      await transport(url, lifecyclePayload(current, action), requestSignal);
      onResult({
        id: resourceKey(resource),
        name: resource.name || resource.id,
        status: 'accepted',
        message: 'Recebida pelo Rancher. Acompanhe o estado do recurso.',
      });
    } catch (error) {
      const interrupted =
        error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name);
      const uncertain = submitted && !(error instanceof ApiError);
      onResult({
        id: resourceKey(resource),
        name: resource.name || resource.id,
        status: uncertain ? 'unknown' : 'failed',
        message: uncertain
          ? 'Sem confirmação da resposta. Verifique o estado antes de tentar novamente.'
          : interrupted
            ? 'Não foi possível consultar o recurso a tempo.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível aplicar a operação.',
      });
    }
  }
}
