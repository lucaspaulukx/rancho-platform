import { describe, it, expect } from 'vitest';
import {
  composeExport,
  composeStackTarget,
  composeStackSnapshot,
  prepareComposeUpgrade,
  composeStackMetadata,
} from '../stack-compose-upgrade';
import type { Resource, Schema } from '../api';
const stack: Resource = {
  id: '1st2',
  type: 'stack',
  name: 'fixture',
  state: 'active',
  accountId: '1a12',
  links: { self: '/v2-beta/projects/1a12/stacks/1st2' },
  actions: {
    upgrade: '/v2-beta/projects/1a12/stacks/1st2/?action=upgrade',
    exportconfig: '/v2-beta/projects/1a12/stacks/1st2/?action=exportconfig',
  },
  dockerCompose: 'private original',
  environment: { TOKEN: 'synthetic-private' },
  answers: { SECRET: 'synthetic-private' },
  templates: { source: 'synthetic-private' },
};
const before = {
    dockerCompose: 'services: {web: {image: alpine:3.20}}',
    rancherCompose: 'services: {web: {scale: 0}}',
  },
  draft = { ...before, dockerCompose: 'services: {web: {image: alpine:3.19}}' };
const schema = {
  id: 'stack',
  pluralName: 'stacks',
  links: {},
  resourceFields: {},
  resourceActions: {
    upgrade: { input: 'stackUpgrade' },
    exportconfig: { input: 'composeConfigInput' },
  },
} as Schema;
const input = {
  id: 'stackUpgrade',
  resourceFields: Object.fromEntries(
    ['dockerCompose', 'rancherCompose', 'environment', 'answers', 'templates'].map((k) => [
      k,
      {
        type: k.endsWith('Compose') ? 'string' : k === 'answers' ? 'map[json]' : 'map[string]',
        create: true,
      },
    ]),
  ),
} as Schema;
const prepare = (
  changes: Partial<{
    fresh: Resource;
    current: typeof before;
    draft: typeof draft;
    permission: Schema;
    input: Schema;
    environment: string;
    impact: boolean;
  }> = {},
) =>
  prepareComposeUpgrade(
    stack,
    changes.fresh ?? stack,
    before,
    changes.current ?? before,
    changes.draft ?? draft,
    changes.permission ?? schema,
    changes.input ?? input,
    changes.environment ?? '1a12',
    changes.impact ?? true,
  );
describe('Upgrade Compose de stack existente', () => {
  it('exportação só aceita strings limitadas e tipo nativo', () => {
    expect(
      composeExport({
        id: '',
        type: 'composeConfig',
        links: {},
        dockerComposeConfig: before.dockerCompose,
      }),
    ).toEqual({ dockerCompose: before.dockerCompose, rancherCompose: '' });
    expect(() =>
      composeExport({ id: '', type: 'other', links: {}, dockerComposeConfig: 'synthetic-private' }),
    ).toThrow();
    expect(() =>
      composeExport({
        id: '',
        type: 'composeConfig',
        links: {},
        dockerComposeConfig: 'é'.repeat(262145),
      }),
    ).toThrow();
  });
  it('ação local exata exige conta, stack ativa e Compose de origem', () => {
    expect(composeStackTarget(stack, '1a12', 'upgrade')).toContain('?action=upgrade');
    for (const change of [
      { accountId: '1a8' },
      { dockerCompose: '' },
      { state: 'upgraded' },
      { system: true },
      { externalId: 'catalog://fixture:v:1' },
    ])
      expect(() => composeStackTarget({ ...stack, ...change }, '1a12', 'upgrade')).toThrow();
  });
  it('rejeita links externos, outra stack ou query adicional', () => {
    for (const url of [
      'https://other.invalid/v2-beta/projects/1a12/stacks/1st2?action=upgrade',
      '/v2-beta/projects/1a12/stacks/1st3?action=upgrade',
      '/v2-beta/projects/1a12/stacks/1st2?action=upgrade&x=1',
    ])
      expect(() =>
        composeStackTarget(
          { ...stack, actions: { ...stack.actions, upgrade: url } },
          '1a12',
          'upgrade',
        ),
      ).toThrow();
  });
  it('preserva parâmetros e não envia controles internos', () => {
    expect(prepare()).toEqual({
      ...draft,
      environment: stack.environment,
      answers: stack.answers,
      templates: stack.templates,
    });
    expect(prepare()).not.toHaveProperty('name');
  });
  it('snapshot é estável por chave mas detecta parâmetros e estado', () => {
    expect(composeStackSnapshot({ ...stack, environment: { B: 'b', A: 'a' } })).toBe(
      composeStackSnapshot({ ...stack, environment: { A: 'a', B: 'b' } }),
    );
    expect(() => prepare({ fresh: { ...stack, environment: { TOKEN: 'changed' } } })).toThrow(
      /mudaram/,
    );
  });
  it('relê exportação dos serviços antes do upgrade', () => {
    expect(() =>
      prepare({ current: { ...before, dockerCompose: 'changed by another client' } }),
    ).toThrow(/mudaram/);
  });
  it('exige impacto e alteração real', () => {
    expect(() => prepare({ impact: false })).toThrow(/impacto/);
    expect(() => prepare({ draft: before })).toThrow(/Altere/);
  });
  it('contrato deve permitir parâmetros atuais e arquivos', () => {
    expect(() => prepare({ permission: { ...schema, resourceActions: {} } })).toThrow();
    expect(() =>
      prepare({
        input: {
          ...input,
          resourceFields: {
            ...input.resourceFields,
            environment: { type: 'map[string]', create: false },
          },
        },
      }),
    ).toThrow(/preservados/);
  });
  it('DTO da resposta elimina Compose e parâmetros privados', () => {
    const row = composeStackMetadata(stack);
    expect(JSON.stringify(row)).not.toContain('synthetic-private');
    expect(row).not.toHaveProperty('dockerCompose');
  });
});
