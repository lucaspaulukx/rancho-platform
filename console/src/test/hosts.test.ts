import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { containersOnHost, hostSummary } from '../hosts';
import { safeConfiguration } from '../components/ResourceDetails';
const resource = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'host', links: { self: '/v2-beta/hosts/' + id }, ...extra }) as Resource;
describe('Inventário de hosts', () => {
  it('apresenta capacidade reportada sem inventar métricas de utilização', () => {
    expect(
      hostSummary(
        resource('h1', {
          agentIpAddress: '10.0.0.5',
          info: {
            cpuInfo: { count: 2 },
            memoryInfo: { memTotal: 1536 },
            osInfo: { operatingSystem: 'RancherOS', dockerVersion: '19.03.15' },
          },
        }),
      ),
    ).toEqual({ cpu: 2, memoryGiB: 1.5, os: 'RancherOS', docker: '19.03.15', address: '10.0.0.5' });
    expect(
      hostSummary(
        resource('h2', { info: { cpuInfo: { count: -1 }, memoryInfo: { memTotal: 'invalid' } } }),
      ),
    ).toEqual({
      cpu: undefined,
      memoryGiB: undefined,
      os: undefined,
      docker: undefined,
      address: undefined,
    });
  });
  it('inclui somente containers do host selecionado que não foram removidos', () => {
    const containers = [
      resource('c1', { hostId: 'h1', state: 'running' }),
      resource('c2', { hostId: 'h2', state: 'running' }),
      resource('c3', { hostId: 'h1', removed: 'today' }),
      resource('c4', { hostId: 'h1', state: 'purged' }),
      resource('c5', { hostId: 'h1', state: 'stopped' }),
    ];
    expect(containersOnHost(resource('h1'), containers).map((value) => value.id)).toEqual([
      'c1',
      'c5',
    ]);
  });
  it('protege chaves de autenticação e do agente em detalhes e exportações', () => {
    expect(
      safeConfiguration({
        authKey: 'private',
        info: { hostKey: { data: 'private' }, cpuInfo: { count: 2 } },
      }),
    ).toEqual({ authKey: '[protegido]', info: { hostKey: '[protegido]', cpuInfo: { count: 2 } } });
  });
});
