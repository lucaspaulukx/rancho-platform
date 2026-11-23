import { describe, expect, it } from 'vitest';
import {
  appendMetricPoint,
  metricPoint,
  metricPaths,
  metricResourceAllowed,
  parseMetricsFrame,
} from '../metrics';
import { streamResourceAllowed } from '../streams';
import type { Resource } from '../api';
const resource: Resource = {
  id: '1i1',
  type: 'container',
  accountId: '1a12',
  externalId: 'docker-fixture',
  links: {
    self: '/v2-beta/projects/1a12/containers/1i1',
    stats: '/v2-beta/projects/1a12/containers/1i1/stats',
  },
  actions: { logs: '/logs', execute: '/execute' },
};
const raw = (timestamp = '2026-10-21T12:00:00Z') => ({
  id: 'docker-fixture',
  resourceType: 'container',
  timestamp,
  cpu: { usage: { total: 900e9, user: 1e9, system: 1e9, per_cpu_usage: [1e9, 1e9] } },
  memory: { usage: 1048576 },
  network: { interfaces: [{ name: 'eth0', rx_bytes: 1024, tx_bytes: 2048 }] },
  diskio: { io_service_bytes: [{ stats: { Read: 4096, Write: 8192 } }] },
});
describe('Métricas nativas do Rancher', () => {
  it('usa deltas de CPU usuário/sistema e unidades explícitas para as taxas', () => {
    const first = parseMetricsFrame(JSON.stringify([raw()]), resource)[0];
    const next = raw('2026-10-21T12:00:01Z');
    next.cpu.usage.user += 5e8;
    next.cpu.usage.system += 5e8;
    next.cpu.usage.total += 100e9;
    next.network.interfaces[0].rx_bytes += 1024;
    next.network.interfaces[0].tx_bytes += 2048;
    next.diskio.io_service_bytes[0].stats.Read += 4096;
    expect(
      metricPoint(parseMetricsFrame(JSON.stringify([next]), resource)[0], first),
    ).toMatchObject({
      cpuPercent: 100,
      cpus: 2,
      memoryMiB: 1,
      rxKiBs: 1,
      txKiBs: 2,
      readKiBs: 4,
      writeKiBs: 0,
    });
  });
  it('não inventa zero para contadores ausentes nem taxa para a primeira amostra', () => {
    const counters = parseMetricsFrame(
      JSON.stringify([
        {
          id: 'docker-fixture',
          resourceType: 'container',
          timestamp: '2026-10-21T12:00:00Z',
          memory: { usage: 0 },
        },
      ]),
      resource,
    )[0];
    expect(metricPoint(counters)).toMatchObject({ memoryMiB: 0 });
    expect(metricPoint(counters)?.cpuPercent).toBeUndefined();
    expect(metricPoint(counters)?.readKiBs).toBeUndefined();
    expect(metricPoint(counters)?.memoryLimitMiB).toBeUndefined();
  });
  it('descarta amostras de outro container e aceita host sem ID como no contrato nativo', () => {
    expect(parseMetricsFrame(JSON.stringify([{ ...raw(), id: 'other' }]), resource)).toEqual([]);
    const host = { ...resource, id: '1h1', type: 'host' };
    expect(
      parseMetricsFrame(JSON.stringify([{ ...raw(), id: null, resourceType: 'host' }]), host),
    ).toHaveLength(1);
    expect(parseMetricsFrame(JSON.stringify([raw()]), host)).toEqual([]);
  });
  it('não inclui idle do host quando só o contador total foi reportado', () => {
    const host = { ...resource, type: 'host' };
    expect(
      parseMetricsFrame(
        JSON.stringify([
          { ...raw(), resourceType: 'host', id: null, cpu: { usage: { total: 99e9 } } },
        ]),
        host,
      )[0].cpu,
    ).toBeUndefined();
  });
  it('trata reset dos contadores como lacuna e ignora duplicatas ou tempo regressivo', () => {
    const reset = metricPoint(
      { ts: 2000, cpu: 1, network: { all: { rx: 1 } } },
      { ts: 1000, cpu: 5, network: { all: { rx: 5 } } },
    );
    expect(reset?.cpuPercent).toBeUndefined();
    expect(reset?.rxKiBs).toBeUndefined();
    expect(metricPoint({ ts: 1000 }, { ts: 1000 })).toBeUndefined();
    expect(metricPoint({ ts: 900 }, { ts: 1000 })).toBeUndefined();
  });
  it('limita frames e histórico e desenha lacunas sem ligá-las como dados válidos', () => {
    expect(() => parseMetricsFrame('x'.repeat(1_048_577), resource)).toThrow('limite');
    expect(() => parseMetricsFrame(JSON.stringify(Array(33).fill(raw())), resource)).toThrow(
      'inválida',
    );
    const points = Array.from({ length: 400 }, (_, index) => ({
      ts: index * 1000,
      memoryMiB: index,
    }));
    const values = appendMetricPoint(points, { ts: 400000, memoryMiB: 400 });
    expect(values).toHaveLength(300);
    expect(values[0].ts).toBe(101000);
    expect(
      metricPaths(
        [{ ts: 1, cpuPercent: 10 }, { ts: 2 }, { ts: 3, cpuPercent: 20 }],
        'cpuPercent',
        100,
      ),
    ).toHaveLength(2);
  });
  it('encerra a autorização de exec após downgrade mesmo que o recurso ainda possa ser lido', () => {
    expect(
      streamResourceAllowed(
        { ...resource, actions: { logs: '/logs' } },
        resource,
        'execute',
        '1a12',
      ),
    ).toBe(false);
    expect(
      streamResourceAllowed({ ...resource, actions: { logs: '/logs' } }, resource, 'logs', '1a12'),
    ).toBe(true);
    expect(metricResourceAllowed({ ...resource, accountId: 'other' }, resource, '1a12')).toBe(
      false,
    );
    expect(metricResourceAllowed({ ...resource, links: {} }, resource, '1a12')).toBe(false);
  });
});
