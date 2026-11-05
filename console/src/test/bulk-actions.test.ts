import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Resource, type Schema } from '../api';
import { commonBulkActions, executeBulk, type BulkResult } from '../bulk-actions';
const resource = (id: string, extra: Record<string, unknown> = {}): Resource => ({
  id,
  type: 'container',
  name: id,
  accountId: 'p1',
  links: { self: `/v2-beta/projects/p1/containers/${id}` },
  actions: { start: `/v2-beta/projects/p1/containers/${id}?action=start` },
  ...extra,
});
describe('Operações em lote', () => {
  it('revalida o serviço e envia o corpo exigido pelo restart nativo', async () => {
    const row = resource('s1', { type: 'service', actions: { restart: '/native-restart' } });
    const transport = vi.fn(async () => row),
      onResult = vi.fn();
    await executeBulk([row], 'restart', 'p1', onResult, transport);
    expect(transport).toHaveBeenLastCalledWith(
      '/native-restart',
      { rollingRestartStrategy: { batchSize: 1, intervalMillis: 2000 } },
      expect.any(AbortSignal),
    );
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
  });
  it('oferece remoção apenas para alvos homogêneos com action nativa, nunca purge', () => {
    const schemas = {
      container: { resourceMethods: ['DELETE'] } as Schema,
      service: { resourceMethods: ['DELETE'] } as Schema,
    };
    const removable = resource('a', { actions: { remove: '/remove-a', purge: '/purge-a' } });
    expect(commonBulkActions([removable], schemas)).toEqual(['remove']);
    expect(
      commonBulkActions(
        [removable, resource('b', { type: 'service', actions: { remove: '/remove-b' } })],
        schemas,
      ),
    ).toEqual([]);
    expect(
      commonBulkActions([removable], { container: { resourceMethods: ['GET'] } as Schema }),
    ).toEqual([]);
  });
  it('rejeita remoção de tipos misturados antes de qualquer chamada', async () => {
    const transport = vi.fn();
    await expect(
      executeBulk(
        [resource('a'), resource('b', { type: 'service' })],
        'remove',
        'p1',
        vi.fn(),
        transport,
      ),
    ).rejects.toThrow('mesmo tipo');
    expect(transport).not.toHaveBeenCalled();
  });
  it('remove somente pela action atual e preserva falhas individuais sem retry', async () => {
    const rows = [resource('a'), resource('b')];
    const outcomes: BulkResult[] = [];
    const transport = vi.fn(async (url: string, payload?: Record<string, unknown>) => {
      if (payload) return rows[1];
      return url === rows[0].links.self
        ? { ...rows[0], actions: {} }
        : { ...rows[1], actions: { remove: '/current-remove-b' } };
    });
    await executeBulk(rows, 'remove', 'p1', (result) => outcomes.push(result), transport);
    expect(outcomes.map((value) => value.status)).toEqual(['failed', 'accepted']);
    expect(
      transport.mock.calls.filter(([, payload]) => payload !== undefined).map(([url]) => url),
    ).toEqual(['/current-remove-b']);
  });
  it('oferece apenas ações em comum autorizadas e limita a seleção', () => {
    const schemas = { container: { resourceMethods: ['GET', 'PUT'] } as Schema };
    expect(
      commonBulkActions([resource('a'), resource('b', { actions: { stop: '/stop' } })], schemas),
    ).toEqual([]);
    expect(
      commonBulkActions([resource('a')], { container: { resourceMethods: ['GET'] } as Schema }),
    ).toEqual([]);
    expect(
      commonBulkActions(
        Array.from({ length: 101 }, (_, index) => resource(String(index))),
        schemas,
      ),
    ).toEqual([]);
    expect(commonBulkActions([resource('a'), resource('b')], schemas)).toEqual(['start']);
  });
  it('revalida cada alvo e continua após falhas sem repetir os já aceitos', async () => {
    const rows = [resource('a'), resource('b'), resource('c'), resource('d')];
    const outcomes: BulkResult[] = [];
    const transport = vi.fn(async (url: string, payload?: Record<string, unknown>) => {
      const item = rows.find((row) => url.startsWith(row.links.self))!;
      if (payload) {
        if (item.id === 'c') throw new ApiError(403, 'Acesso negado.');
        return item;
      }
      if (item.id === 'a') return { ...item, actions: {} };
      if (item.id === 'd') return { ...item, accountId: 'another-environment' };
      return item;
    });
    await executeBulk(rows, 'start', 'p1', (result) => outcomes.push(result), transport);
    expect(outcomes.map((value) => value.status)).toEqual([
      'failed',
      'accepted',
      'failed',
      'failed',
    ]);
    expect(
      transport.mock.calls.filter(([, payload]) => payload !== undefined).map(([url]) => url),
    ).toEqual([rows[1].actions!.start, rows[2].actions!.start]);
  });
  it('trata perda de resposta após envio como estado incerto, sem retry automático', async () => {
    const outcomes: BulkResult[] = [];
    const transport = vi.fn(async (_url: string, payload?: Record<string, unknown>) => {
      if (payload) throw new DOMException('Timeout', 'TimeoutError');
      return resource('a');
    });
    await executeBulk([resource('a')], 'start', 'p1', (value) => outcomes.push(value), transport);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(outcomes[0].status).toBe('unknown');
  });
  it('encerra o envio ao perder o contexto sem alcançar o próximo recurso', async () => {
    const controller = new AbortController();
    const transport = vi.fn(async () => resource('a'));
    await executeBulk(
      [resource('a'), resource('b')],
      'start',
      'p1',
      () => controller.abort(),
      transport,
      controller.signal,
    );
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('rejeita alvos duplicados antes de qualquer requisição', async () => {
    const transport = vi.fn();
    await expect(
      executeBulk([resource('a'), resource('a')], 'start', 'p1', vi.fn(), transport),
    ).rejects.toThrow('duplicados');
    expect(transport).not.toHaveBeenCalled();
  });
});
