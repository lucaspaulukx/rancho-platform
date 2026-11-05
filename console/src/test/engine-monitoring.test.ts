import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { clusterMemberMetadata, processPoolMetadata, engineNumber } from '../engine-monitoring';
const row = {
  id: '1cm1',
  type: 'clusterMembership',
  uuid: 'node-1',
  heartbeat: Date.parse('2026-10-22T12:00:00Z'),
  clustered: false,
  links: {},
  config: JSON.stringify({
    advertiseAddress: '10.0.0.1',
    httpPort: 8080,
    clustered: true,
    password: 'synthetic-private',
    id: 'untrusted',
    uuid: 'untrusted',
    heartbeat: 0,
  }),
} as Resource;
describe('Metadados de HA e pools', () => {
  it('extrai somente endereço/porta/clustering sem sobrescrever identidade ou heartbeat do registro', () => {
    const value = clusterMemberMetadata(row);
    expect(value).toEqual({
      id: '1cm1',
      uuid: 'node-1',
      address: '10.0.0.1',
      port: 8080,
      clustered: true,
      heartbeat: '2026-10-22T12:00:00.000Z',
      configurationIncomplete: false,
    });
    expect(JSON.stringify(value)).not.toContain('synthetic-private');
    expect(value).not.toHaveProperty('config');
  });
  it.each(['{broken', '[]', 'x'.repeat(1024 * 1024 + 1)])(
    'configuração opaca/malformada fica fora do DTO',
    (config) => {
      const value = clusterMemberMetadata({ ...row, config });
      expect(value.configurationIncomplete).toBe(true);
      expect(value.id).toBe('1cm1');
      expect(value.address).toBe('');
      expect(value.port).toBe(null);
    },
  );
  it('preserva IPv6/porta numérica string e recusa endereço com credenciais', () => {
    expect(
      clusterMemberMetadata({
        ...row,
        config: JSON.stringify({ advertiseAddress: '2001:db8::1', httpPort: '443' }),
      }),
    ).toMatchObject({ address: '2001:db8::1', port: 443 });
    expect(
      clusterMemberMetadata({
        ...row,
        config: JSON.stringify({ advertiseAddress: 'http://user:secret@host', httpPort: 65536 }),
      }),
    ).toMatchObject({ address: '', port: null });
  });
  it('não converte heartbeat desconhecido/fora da faixa em agora ou zero', () => {
    for (const heartbeat of [0, -1, Infinity, '2026-10-22', Number.MAX_SAFE_INTEGER])
      expect(clusterMemberMetadata({ ...row, heartbeat }).heartbeat).toBe('');
  });
  it('pools mantêm contadores zero e sentinel nativo, sem resultados/payloads livres', () => {
    const pool = processPoolMetadata(
      {
        id: '',
        type: 'processPool',
        links: {},
        name: 'Executor',
        activeTasks: 0,
        poolSize: 0,
        minPoolSize: 15,
        maxPoolSize: 2147483647,
        queueSize: 0,
        queueRemainingCapacity: 2147483647,
        completedTasks: 100,
        rejectedTasks: 0,
        data: 'synthetic-private',
      },
      0,
    );
    expect(pool).toMatchObject({
      activeTasks: 0,
      poolSize: 0,
      minPoolSize: 15,
      maxPoolSize: 2147483647,
      queueRemainingCapacity: 2147483647,
      rejectedTasks: 0,
    });
    expect(JSON.stringify(pool)).not.toContain('synthetic-private');
    expect(engineNumber(pool.maxPoolSize)).toBe('2.147.483.647');
    expect(engineNumber(0)).toBe('0');
    expect(engineNumber(null)).toBe('—');
  });
  it('chaves de linhas não confundem executores de mesmo nome e valores inválidos são desconhecidos', () => {
    const first = processPoolMetadata(
        {
          id: '',
          type: 'processPool',
          links: {},
          name: 'Executor',
          activeTasks: -1,
          poolSize: 1.5,
          completedTasks: Number.MAX_SAFE_INTEGER + 1,
        },
        0,
      ),
      second = processPoolMetadata({ id: '', type: 'processPool', links: {}, name: 'Executor' }, 1);
    expect(first.key).not.toBe(second.key);
    expect(first.activeTasks).toBe(null);
    expect(first.poolSize).toBe(null);
    expect(first.completedTasks).toBe(null);
  });
});
