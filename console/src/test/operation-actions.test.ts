import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import { operationCommands, operationContainers } from '../operation-actions';
const stack: Resource = {
  id: 's1',
  type: 'stack',
  accountId: 'p1',
  name: 'Web',
  serviceIds: ['svc1'],
  links: {},
  actions: { remove: 'remove', upgrade: 'upgrade', exportconfig: 'export' },
};
const service: Resource = {
  id: 'svc1',
  type: 'service',
  stackId: 's1',
  accountId: 'p1',
  links: {},
};
const container: Resource = {
  id: 'c1',
  type: 'container',
  accountId: 'p1',
  serviceIds: ['svc1'],
  state: 'running',
  links: {},
  actions: { logs: 'logs', execute: 'execute', restart: 'restart' },
};
const schema: Schema = {
  id: 'stack',
  pluralName: 'stacks',
  links: {},
  resourceFields: {},
  resourceMethods: ['GET', 'PUT'],
};
const options = {
  environment: 'p1',
  observability: true,
  metrics: true,
  containers: [container],
  containerWritable: true,
  createService: true,
  restartServices: 2,
};
describe('Ações na hierarquia operacional', () => {
  it('resolve containers por IDs e não inclui homônimos de outros environments', () => {
    const inventory = {
      stacks: [stack],
      services: [service],
      containers: [
        container,
        { ...container, id: 'foreign', accountId: 'p2' },
        { ...container, id: 'unrelated', serviceIds: ['other'] },
      ],
    };
    expect(operationContainers(stack, inventory, 'p1').map((value) => value.id)).toEqual(['c1']);
    expect(operationContainers(service, inventory, 'p1').map((value) => value.id)).toEqual(['c1']);
    expect(operationContainers({ ...stack, accountId: 'p2' }, inventory, 'p1')).toEqual([]);
  });
  it('mantém logs consultáveis e remove mutações/terminal para readonly', () => {
    const commands = operationCommands(
      stack,
      { ...schema, resourceMethods: ['GET'] },
      { ...options, containerWritable: false, createService: false },
    );
    expect(commands.map((value) => value.kind)).toEqual(['detail', 'logs']);
  });
  it('não inventa ações nativas e desliga logs/terminal conforme a flag', () => {
    const commands = operationCommands(stack, schema, { ...options, observability: false });
    expect(commands.some((value) => ['logs', 'execute', 'metrics'].includes(value.kind))).toBe(
      false,
    );
    expect(commands.some((value) => value.action === 'restart')).toBe(false);
    expect(commands.find((value) => value.kind === 'restartServices')?.label).toContain('(2)');
  });
  it('não oferece operações fora do escopo e limita lotes sem truncamento silencioso', () => {
    expect(operationCommands({ ...stack, accountId: 'p2' }, schema, options)).toEqual([]);
    expect(
      operationCommands(stack, schema, { ...options, restartServices: 101 }).find(
        (value) => value.kind === 'restartServices',
      )?.disabled,
    ).toBe(true);
  });
  it('explica logs indisponíveis de um pai sem iniciar conexões ou navegar', () => {
    const commands = operationCommands(stack, schema, { ...options, containers: [] });
    expect(commands.find((value) => value.kind === 'logs')?.disabled).toBe(true);
    expect(commands.find((value) => value.id === 'remove')?.danger).toBe(true);
    expect(commands.find((value) => value.id === 'upgrade')?.label).toBe('Atualizar stack');
  });
});
