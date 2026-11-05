import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { publicWorkload } from '../workload-privacy';
describe('Metadados públicos do inventário', () => {
  it('retira respostas e Compose privados da stack antes do query cache sem alterar o original', () => {
    const resource = {
      id: 'st1',
      type: 'stack',
      name: 'Loja',
      accountId: 'p1',
      links: { self: '/stack' },
      serviceIds: ['s1'],
      environment: { password: 'synthetic' },
      answers: { token: 'synthetic' },
      templates: { private: 'synthetic' },
      dockerCompose: 'private compose',
      rancherCompose: 'private compose',
    } as Resource;
    expect(publicWorkload(resource)).toEqual({
      id: 'st1',
      type: 'stack',
      name: 'Loja',
      accountId: 'p1',
      links: { self: '/stack' },
      serviceIds: ['s1'],
      hasComposeSource: true,
    });
    expect(resource.environment).toEqual({ password: 'synthetic' });
  });
  it('não anuncia Compose de origem para stack manual ou texto vazio', () => {
    for (const dockerCompose of [undefined, '', '   ']) {
      const row = publicWorkload({
        id: '1st2',
        type: 'stack',
        links: {},
        dockerCompose,
        hasComposeSource: true,
      });
      expect(row.hasComposeSource).toBe(false);
      expect(row).not.toHaveProperty('dockerCompose');
    }
  });
  it('preserva o contrato operacional dos demais tipos', () => {
    const container = {
      id: 'c1',
      type: 'container',
      links: {},
      serviceIds: ['s1'],
      actions: { logs: '/logs' },
    } as Resource;
    expect(publicWorkload(container)).toBe(container);
  });
});
