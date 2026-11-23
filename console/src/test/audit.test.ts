import { describe, expect, it } from 'vitest';
import { auditMetadata, auditNext, auditQuery } from '../audit';
import type { Resource } from '../api';
describe('Metadados administrativos de auditoria', () => {
  it('remove objetos opacos, IP, descrição, actions e campos desconhecidos antes do cache', () => {
    const row = auditMetadata({
      id: '1al1',
      type: 'auditLog',
      links: { self: '/private' },
      actions: { replay: '/private' },
      created: '2026-10-22T12:00:00Z',
      requestObject: '{"password":"private"}',
      responseObject: 'private',
      description: 'private',
      clientIp: 'private',
      unknown: 'private',
      eventType: 'api.create',
      resourceType: 'apiKey',
      responseCode: 201,
    } as Resource);
    expect(row).toEqual({
      id: '1al1',
      created: '2026-10-22T12:00:00.000Z',
      eventType: 'api.create',
      resourceType: 'apiKey',
      resourceId: '',
      accountId: '',
      authenticatedAsAccountId: '',
      authenticatedAsIdentityId: '',
      authType: '',
      responseCode: 201,
    });
    expect(JSON.stringify(row)).not.toContain('private');
  });
  it('rejeita identificadores com payload, código inválido e data impossível', () => {
    const row = auditMetadata({
      id: '1al2',
      type: 'auditLog',
      links: {},
      eventType: '<script>unsafe</script>',
      accountId: 'x?token=private',
      responseCode: 999,
      created: 'private',
    });
    expect(row.eventType).toBe('');
    expect(row.accountId).toBe('');
    expect(row.responseCode).toBe(null);
    expect(row.created).toBe('');
  });
  it('limita página, ordena e codifica somente filtros permitidos', () => {
    const url = new URL(
      auditQuery({ event: ' api.create ', resource: 'service', account: '1a1' }),
      location.origin,
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '100',
      sort: 'id',
      order: 'desc',
      eventType: 'api.create',
      resourceType: 'service',
      authenticatedAsAccountId: '1a1',
    });
    for (const filters of [
      { event: 'x?secret=value', resource: '', account: '' },
      { event: '', resource: '', account: 'bad-account' },
    ])
      expect(() => auditQuery(filters)).toThrow();
  });
  it('paginação permanece em auditlogs e na mesma origem', () => {
    expect(auditNext('/v2-beta/auditlogs?marker=100')).toBe('/v2-beta/auditlogs?marker=100');
    expect(auditNext(null)).toBe(null);
    for (const url of [
      'https://untrusted.example/v2-beta/auditlogs',
      '/v2-beta/apikeys',
      '/oidc/login',
      {},
    ])
      expect(() => auditNext(url)).toThrow();
  });
});
