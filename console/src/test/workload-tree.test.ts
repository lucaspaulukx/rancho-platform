import { describe, expect, it } from 'vitest';
import { serviceTopology } from '../components/ServiceTopology';
import type { Resource } from '../api';
import { workloadTree } from '../workload-tree';
const resource = (id: string, fields: Record<string, unknown> = {}): Resource => ({
  id,
  type: 'container',
  state: 'active',
  links: {},
  ...fields,
});
const inventory = {
  stacks: [
    resource('store', { name: 'Loja', type: 'stack' }),
    resource('infra', { system: true, type: 'stack' }),
  ],
  services: [
    resource('web', { name: 'Frontend', type: 'service', stackId: 'store' }),
    resource('dns', { type: 'service', stackId: 'infra' }),
  ],
  containers: [
    resource('web-1', { state: 'running', serviceIds: ['web'] }),
    resource('web-2', { state: 'stopped', serviceIds: ['web'] }),
    resource('dns-1', { serviceIds: ['dns'] }),
    resource('standalone', { name: 'manual', state: 'stopped' }),
  ],
};
describe('Topologia nativa de serviços', () => {
  const services = [
    resource('web', { type: 'service', accountId: 'p1' }),
    resource('database', { type: 'service', accountId: 'p1' }),
  ];
  const mapping = resource('link', {
    accountId: 'p1',
    serviceId: 'web',
    consumedServiceId: 'database',
    name: 'database-alias',
  });
  it('preserva direção e nome do vínculo nativo sem deduzir conexões', () => {
    expect(serviceTopology(services, [], [], 'p1').edges).toEqual([]);
    const result = serviceTopology(services, [mapping], [], 'p1');
    expect(result.edges[0]).toMatchObject({
      id: 'link',
      source: 'web',
      target: 'database',
      label: 'database-alias',
    });
    expect(
      result.nodes.every(
        (node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y),
      ),
    ).toBe(true);
  });
  it('sinaliza referência ausente e ignora vínculos removidos', () => {
    const result = serviceTopology(
      services,
      [
        { ...mapping, consumedServiceId: 'missing' },
        { ...mapping, id: 'old', removed: '2026-10-21' },
      ],
      [],
      'p1',
    );
    expect(result.edges).toEqual([]);
    expect(result.unresolved).toBe(1);
  });
  it('rejeita inventário cruzado e excesso de nós antes do layout', () => {
    expect(() => serviceTopology(services, [{ ...mapping, accountId: 'other' }], [], 'p1')).toThrow(
      'outro environment',
    );
    expect(() =>
      serviceTopology(
        Array.from({ length: 501 }, (_, index) => ({ ...services[0], id: String(index) })),
        [],
        [],
        'p1',
      ),
    ).toThrow('limite');
  });
  it('enquadra verticalmente no móvel preservando arestas e handles direcionais', () => {
    const horizontal = serviceTopology(services, [mapping], [], 'p1');
    const vertical = serviceTopology(services, [mapping], [], 'p1', 'TB');
    expect(vertical.edges).toEqual(horizontal.edges);
    expect(vertical.nodes[0].position.x).toBeCloseTo(vertical.nodes[1].position.x);
    expect(vertical.nodes[0].position.y).toBeLessThan(vertical.nodes[1].position.y);
    expect(
      vertical.nodes.every(
        (node) => node.sourcePosition === 'bottom' && node.targetPosition === 'top',
      ),
    ).toBe(true);
  });
  it('mantém ciclos nativos sem falhar no layout', () => {
    const result = serviceTopology(
      services,
      [mapping, { ...mapping, id: 'reverse', serviceId: 'database', consumedServiceId: 'web' }],
      [],
      'p1',
    );
    expect(result.edges).toHaveLength(2);
    expect(result.nodes).toHaveLength(2);
  });
});

describe('Operação em uma única tela', () => {
  it('oculta agentes e outros containers de sistema avulsos pelo label nativo', () => {
    const fixture = {
      stacks: [],
      services: [],
      containers: [
        resource('application'),
        resource('agent', { labels: { 'io.rancher.container.system': 'always' } }),
      ],
    };
    expect(
      workloadTree(fixture, { query: '', state: '', includeSystem: false }).containers.map(
        (value) => value.id,
      ),
    ).toEqual(['application']);
    expect(
      workloadTree(fixture, { query: '', state: '', includeSystem: true }).containers.map(
        (value) => value.id,
      ),
    ).toEqual(['application', 'agent']);
  });
  it('não transforma recursos de infraestrutura oculta em avulsos', () => {
    const tree = workloadTree(inventory, { query: '', state: '', includeSystem: false });
    expect(tree.stacks.map((node) => node.resource.id)).toEqual(['store']);
    expect(tree.containers.map((node) => node.id)).toEqual(['standalone']);
    expect(tree.services).toEqual([]);
  });
  it('preserva ordem e vínculos compartilhados com serviços declarados pela stack', () => {
    const tree = workloadTree(
      {
        stacks: [resource('store', { type: 'stack', serviceIds: ['legacy'] })],
        services: [
          resource('web', { type: 'service', stackId: 'store' }),
          resource('legacy', { type: 'service' }),
          resource('standalone-service', { type: 'service' }),
        ],
        containers: [
          resource('shared', { serviceIds: ['legacy', 'web', 'legacy', 'standalone-service'] }),
          resource('direct', { stackId: 'store' }),
          resource('legacy-only', { serviceIds: ['legacy'] }),
          resource('orphan', { serviceIds: ['missing'] }),
        ],
      },
      { query: '', state: '', includeSystem: false },
    );
    expect(tree.stacks[0].services.map((node) => node.resource.id)).toEqual(['web', 'legacy']);
    expect(
      tree.stacks[0].services.map((node) => node.containers.map((container) => container.id)),
    ).toEqual([['shared'], ['shared', 'legacy-only']]);
    expect(tree.stacks[0].containers.map((container) => container.id)).toEqual(['direct']);
    expect(tree.services.map((node) => node.resource.id)).toEqual(['standalone-service']);
    expect(tree.services[0].containers.map((container) => container.id)).toEqual(['shared']);
    expect(tree.containers.map((container) => container.id)).toEqual(['orphan']);
  });
  it('mantém stack e serviço ao buscar um container', () => {
    const tree = workloadTree(inventory, { query: 'web-2', state: '', includeSystem: false });
    expect(tree.stacks[0].resource.id).toBe('store');
    expect(tree.stacks[0].services[0].resource.id).toBe('web');
    expect(tree.stacks[0].services[0].containers.map((node) => node.id)).toEqual(['web-2']);
  });
  it('buscar a stack mantém seus descendentes visíveis', () => {
    const tree = workloadTree(inventory, { query: 'Loja', state: '', includeSystem: false });
    expect(tree.stacks[0].services[0].containers).toHaveLength(2);
  });
  it('filtra estado dos containers preservando contexto de pais ativos', () => {
    const tree = workloadTree(inventory, { query: '', state: 'stopped', includeSystem: false });
    expect(tree.stacks[0].services[0].containers.map((node) => node.id)).toEqual(['web-2']);
    expect(tree.containers.map((node) => node.id)).toEqual(['standalone']);
  });
  it('não cria pais ou vínculos entre inventários de environments diferentes', () => {
    const tree = workloadTree(
      { stacks: [], services: [], containers: [resource('other', { serviceIds: ['web'] })] },
      { query: '', state: '', includeSystem: true },
    );
    expect(tree.stacks).toEqual([]);
    expect(tree.services).toEqual([]);
    expect(tree.containers.map((node) => node.id)).toEqual(['other']);
  });
});
