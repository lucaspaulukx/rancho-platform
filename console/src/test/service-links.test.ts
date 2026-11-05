import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import {
  activeServiceLinks,
  assertServiceLinksUnchanged,
  canEditServiceLinks,
  editableServiceLinks,
  prepareServiceLinks,
} from '../service-links';
import { operationCommands } from '../operation-actions';
const source: Resource = {
  id: 's1',
  type: 'service',
  accountId: 'p1',
  stackId: 'st1',
  state: 'active',
  links: {},
  actions: { setservicelinks: 'native-action' },
};
const target: Resource = { ...source, id: 's2', name: 'web' };
const stack: Resource = { id: 'st1', type: 'stack', accountId: 'p1', state: 'active', links: {} };
const schema = {
  id: 'service',
  pluralName: 'services',
  links: {},
  resourceFields: {},
  resourceMethods: ['GET', 'PUT'],
  resourceActions: { setservicelinks: { input: 'setServiceLinksInput' } },
} as Schema;
const linkSchema = {
  id: 'serviceLink',
  pluralName: 'serviceLinks',
  links: {},
  resourceFields: {
    serviceId: { type: 'reference[service]', create: true },
    name: { type: 'string', create: true, validChars: 'a-zA-Z0-9-._' },
  },
} as Schema;
const mapping: Resource = {
  id: 'm1',
  type: 'serviceConsumeMap',
  accountId: 'p1',
  serviceId: 's1',
  consumedServiceId: 's2',
  name: 'backend',
  state: 'active',
  ports: null,
  links: {},
};
const rows = [{ key: 1, serviceId: 's2', name: 'backend' }];
const prepare = (entries = rows, targets = [target], stacks = [stack]) =>
  prepareServiceLinks(source, schema, linkSchema, entries, targets, stacks, 'p1');
describe('Vínculos contextuais de serviços', () => {
  it('exige flag, tipo, estado estável, schema gravável e action anunciada', () => {
    expect(canEditServiceLinks(source, schema, true)).toBe(true);
    expect(canEditServiceLinks(source, schema, false)).toBe(false);
    expect(canEditServiceLinks({ ...source, type: 'loadBalancerService' }, schema, true)).toBe(
      false,
    );
    expect(canEditServiceLinks({ ...source, state: 'upgrading' }, schema, true)).toBe(false);
    expect(canEditServiceLinks({ ...source, actions: {} }, schema, true)).toBe(false);
    expect(canEditServiceLinks(source, { ...schema, resourceMethods: ['GET'] }, true)).toBe(false);
  });
  it('adiciona comando nativo somente com capacidade/flag', () => {
    const options = {
      environment: 'p1',
      observability: false,
      metrics: false,
      containers: [],
      containerWritable: false,
      createService: false,
      restartServices: 0,
      serviceLinks: true,
    };
    expect(operationCommands(source, schema, options)).toContainEqual({
      id: 'setservicelinks',
      label: 'Gerenciar vínculos de serviços',
      kind: 'native',
      action: 'setservicelinks',
    });
    expect(
      operationCommands(source, schema, { ...options, serviceLinks: false }).some(
        (v) => v.id === 'setservicelinks',
      ),
    ).toBe(false);
  });
  it('filtra outros proprietários/removidos e recusa mapa da origem em outro environment', () => {
    expect(
      activeServiceLinks(
        [
          mapping,
          { ...mapping, id: 'm2', serviceId: 's3' },
          { ...mapping, id: 'm3', removed: 'now' },
        ],
        source,
        'p1',
      ),
    ).toEqual([mapping]);
    expect(() => activeServiceLinks([{ ...mapping, accountId: 'p2' }], source, 'p1')).toThrow(
      'outro environment',
    );
  });
  it.each([
    { consumedServiceId: null, consumedService: 'external/ref' },
    { ports: ['80'] },
    { state: 'removing' },
  ])('bloqueia configuração não suportada %j para evitar perda silenciosa', (extra) => {
    expect(() => editableServiceLinks([{ ...mapping, ...extra }], [target], 'p1')).toThrow(
      'avançados',
    );
  });
  it('preserva alias e alvo existentes; omite alias vazio sem inventar identificadores', () => {
    expect(editableServiceLinks([mapping], [target], 'p1')).toEqual([
      { key: 0, serviceId: 's2', name: 'backend' },
    ]);
    expect(prepare()).toEqual({ serviceLinks: [{ serviceId: 's2', name: 'backend' }] });
    expect(prepare([{ ...rows[0], name: '' }])).toEqual({ serviceLinks: [{ serviceId: 's2' }] });
    expect(prepare([])).toEqual({ serviceLinks: [] });
  });
  it('recusa destinos externos ao escopo, removidos, a própria origem e infraestrutura', () => {
    for (const value of [
      { ...target, accountId: 'p2' },
      { ...target, removed: 'now' },
      { ...source, id: 's2', type: 'dnsService' },
      source,
    ]) {
      expect(() => prepare([{ key: 1, serviceId: value.id, name: '' }], [value])).toThrow(
        'disponível',
      );
    }
    expect(() => prepare(rows, [target], [{ ...stack, system: true }])).toThrow('stack');
  });
  it('recusa duplicidades de destino/alias, alias inválido e limite maior que 100', () => {
    expect(() => prepare([rows[0], { ...rows[0], key: 2 }])).toThrow('repita');
    expect(() =>
      prepare(
        [rows[0], { key: 2, serviceId: 's3', name: 'BACKEND' }],
        [target, { ...target, id: 's3' }],
      ),
    ).toThrow('repita');
    expect(() => prepare([{ ...rows[0], name: 'bad alias' }])).toThrow('Alias');
    expect(() => prepare(Array.from({ length: 101 }, (_, key) => ({ ...rows[0], key })))).toThrow(
      '100',
    );
  });
  it('detecta alias, remoção, portas ou identidade do mapa alterados por outro cliente, ignorando ordem', () => {
    expect(() =>
      assertServiceLinksUnchanged(
        [mapping, { ...mapping, id: 'm2' }],
        [{ ...mapping, id: 'm2' }, mapping],
      ),
    ).not.toThrow();
    for (const extra of [
      { name: 'other' },
      { ports: ['443'] },
      { consumedServiceId: 's3' },
      { id: 'm2' },
    ])
      expect(() => assertServiceLinksUnchanged([mapping], [{ ...mapping, ...extra }])).toThrow(
        'outro cliente',
      );
    expect(() => assertServiceLinksUnchanged([mapping], [])).toThrow('outro cliente');
  });
  it('não filtra silenciosamente campos revogados pelo contrato', () => {
    expect(() =>
      prepareServiceLinks(
        source,
        schema,
        { ...linkSchema, resourceFields: {} },
        rows,
        [target],
        [stack],
        'p1',
      ),
    ).toThrow('contrato');
  });
});
