import type { Resource } from './api';
import { safeApiUrl } from './api';
export interface AuditEvent {
  id: string;
  created: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  accountId: string;
  authenticatedAsAccountId: string;
  authenticatedAsIdentityId: string;
  authType: string;
  responseCode: number | null;
}
const identifier = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value) ? value : '';
export function auditMetadata(value: Resource): AuditEvent {
  const created =
    typeof value.created === 'string' && Number.isFinite(Date.parse(value.created))
      ? new Date(value.created).toISOString()
      : '';
  return {
    id: identifier(value.id),
    created,
    eventType: identifier(value.eventType),
    resourceType: identifier(value.resourceType),
    resourceId: identifier(String(value.resourceId ?? '')),
    accountId: identifier(value.accountId),
    authenticatedAsAccountId: identifier(value.authenticatedAsAccountId),
    authenticatedAsIdentityId: identifier(value.authenticatedAsIdentityId),
    authType: identifier(value.authType),
    responseCode:
      typeof value.responseCode === 'number' &&
      Number.isInteger(value.responseCode) &&
      value.responseCode >= 100 &&
      value.responseCode <= 599
        ? value.responseCode
        : null,
  };
}
export interface AuditFilters {
  event: string;
  resource: string;
  account: string;
}
export function auditQuery(filters: AuditFilters) {
  const params = new URLSearchParams({ limit: '100', sort: 'id', order: 'desc' });
  for (const [field, value] of [
    ['eventType', filters.event],
    ['resourceType', filters.resource],
    ['authenticatedAsAccountId', filters.account],
  ]) {
    if (!value.trim()) continue;
    if (
      !identifier(value.trim()) ||
      (field === 'authenticatedAsAccountId' && !/^1a[1-9]\d*$/.test(value.trim()))
    )
      throw new Error(
        'Use identificadores válidos de evento/recurso e uma conta no formato 1a123.',
      );
    params.set(field, value.trim());
  }
  return '/v2-beta/auditlogs?' + params.toString();
}
export function auditNext(value: unknown) {
  if (!value) return null;
  if (typeof value !== 'string') throw new Error('Paginação de auditoria inválida.');
  const path = safeApiUrl(value);
  if (new URL(path, location.origin).pathname !== '/v2-beta/auditlogs')
    throw new Error('Paginação de auditoria fora do recurso autorizado.');
  return path;
}
