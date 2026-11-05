import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { validateConfig } from '../config';
import config from '../../public/console-config.json';
import {
  metricsLink,
  metricResourceAllowed,
  scopedServiceMetricLink,
  serviceMetricTargets,
  serviceMetricMembership,
  serviceMetricsEnabled,
  ServiceMetricHistory,
} from '../metrics';

const base = '/v2-beta/projects/1a12/services/1s1';
const service: Resource = {
  id: '1s1',
  type: 'service',
  accountId: '1a12',
  name: 'web',
  state: 'active',
  links: { self: base, instances: base + '/instances', containerStats: base + '/containerstats' },
};
const instance = (id: number, changes: Partial<Resource> = {}): Resource => ({
  id: `1i${id}`,
  name: `web-${id}`,
  type: 'container',
  accountId: '1a12',
  state: 'running',
  externalId: `docker-${id}`,
  serviceIds: ['1s1'],
  links: {},
  ...changes,
});
const frame = (id: string, time: number, memory: number, cpu: number) => ({
  id,
  resourceType: 'container',
  timestamp: new Date(1_700_000_000_000 + time * 1000).toISOString(),
  memory: { usage: memory * 1048576 },
  cpu: { usage: { total: cpu * 1e9 } },
});
const targets = (...rows: Resource[]) => serviceMetricTargets(service, rows, '1a12');

describe('Métricas por container no contexto do serviço', () => {
  it('é uma flag aditiva que não muda métricas de outros recursos ou as dependências da tela', () => {
    const { serviceMetrics: _absent, ...oldModules } = config.modules as Record<string, unknown>;
    const old = validateConfig({ ...config, modules: oldModules });
    expect(old.modules.serviceMetrics).toBe(false);
    const on = validateConfig({ ...config, modules: { ...config.modules, serviceMetrics: true } });
    expect(serviceMetricsEnabled(on.modules)).toBe(true);
    for (const key of ['metrics', 'observability', 'workloads', 'contextActions'] as const)
      expect(serviceMetricsEnabled({ ...on.modules, [key]: false })).toBe(false);
    expect(() =>
      validateConfig({ ...config, modules: { ...config.modules, serviceMetrics: 'true' } }),
    ).toThrow();
    expect(metricsLink(service)).toBeUndefined();
    expect(metricsLink(service, true)).toBe(base + '/containerstats');
    expect(
      metricsLink({ ...service, links: { containerStats: base + '/containerstats' } }, true),
    ).toBeUndefined();
    expect(metricResourceAllowed(service, service, '1a12', true)).toBe(true);
    expect(metricResourceAllowed(service, service, '1a99', true)).toBe(false);
  });
  it('descobre links nativos no escopo exato e recusa outra origem, serviço ou query', () => {
    expect(scopedServiceMetricLink(service, '1a12', 'instances')).toBe(
      base + '/instances?limit=65',
    );
    for (const invalid of [
      base.replace('1s1', '1s9') + '/instances',
      base + '/instances?limit=-1',
      'https://elsewhere.example' + base + '/instances',
    ])
      expect(() =>
        scopedServiceMetricLink(
          { ...service, links: { ...service.links, instances: invalid } },
          '1a12',
          'instances',
        ),
      ).toThrow();
  });
  it('aceita só containers em execução com vínculo explícito; identidades conflitantes falham fechadas', () => {
    expect(
      targets(
        instance(2),
        instance(1),
        instance(3, { state: 'stopped' }),
        instance(4, { removed: '2026-11-05' }),
      ).map((row) => row.id),
    ).toEqual(['1i1', '1i2']);
    expect(() => targets(instance(1, { accountId: '1a99' }))).toThrow('não corresponde');
    expect(() => targets(instance(1, { serviceIds: ['1s9'] }))).toThrow('não corresponde');
    expect(() => targets(instance(1), instance(2, { externalId: 'docker-1' }))).toThrow(
      'conflitantes',
    );
    expect(() => targets(...Array.from({ length: 65 }, (_, i) => instance(i + 1)))).toThrow('64');
  });
  it('calcula deltas independentes para réplicas misturadas e ignora fontes desconhecidas', () => {
    const history = new ServiceMetricHistory(targets(instance(1), instance(2)));
    const first = history.read(
      JSON.stringify([
        frame('docker-1', 1, 3, 1),
        frame('docker-2', 1, 10, 50),
        frame('foreign', 1, 99, 0),
      ]),
    );
    expect([...first]).toEqual(['1i1', '1i2']);
    expect(history.pointsFor('1i1')[0].cpuPercent).toBeUndefined();
    history.read(JSON.stringify([frame('1i2', 2, 12, 52), frame('docker-1', 2, 4, 1.5)]));
    expect(history.pointsFor('1i1').at(-1)).toMatchObject({ memoryMiB: 4, cpuPercent: 50 });
    expect(history.pointsFor('1i2').at(-1)).toMatchObject({ memoryMiB: 12, cpuPercent: 200 });
    expect(history.pointsFor('foreign')).toEqual([]);
  });
  it('mantém lacunas em resets, ignora duplicatas e detecta troca de identidade do container', () => {
    const original = targets(instance(1));
    const history = new ServiceMetricHistory(original);
    history.read(
      JSON.stringify([
        frame('docker-1', 2, 3, 9),
        frame('docker-1', 2, 99, 99),
        frame('docker-1', 1, 99, 99),
        frame('docker-1', 3, 4, 1),
      ]),
    );
    expect(history.pointsFor('1i1')).toHaveLength(2);
    expect(history.pointsFor('1i1').at(-1)).toMatchObject({ memoryMiB: 4 });
    expect(history.pointsFor('1i1').at(-1)?.cpuPercent).toBeUndefined();
    expect(serviceMetricMembership(targets(instance(1, { name: 'novo nome' })))).toBe(
      serviceMetricMembership(original),
    );
    expect(serviceMetricMembership(targets(instance(1, { externalId: 'novo-docker' })))).not.toBe(
      serviceMetricMembership(original),
    );
  });
  it('limita frames e históricos por fonte sem desalojar outra réplica', () => {
    const history = new ServiceMetricHistory(targets(instance(1), instance(2)));
    history.read(JSON.stringify([frame('docker-2', 0, 8, 1)]));
    for (let index = 0; index < 310; index++)
      history.read(JSON.stringify([frame('docker-1', index, 2, index)]));
    expect(history.pointsFor('1i1')).toHaveLength(300);
    expect(history.pointsFor('1i2')).toHaveLength(1);
    expect(() => history.read(JSON.stringify(Array(33).fill(frame('docker-1', 1, 2, 1))))).toThrow(
      'inválida',
    );
  });
});
