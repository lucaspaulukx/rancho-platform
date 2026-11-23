import { describe, expect, it, vi } from 'vitest';
import { allPages, safeApiUrl, type Resource, type Schema } from '../api';
import { validateConfig } from '../config';
import config from '../../public/console-config.json';
import { preparePayload } from '../components/SchemaForm';
import { groupChanges } from '../pages/Groups';

describe('Configuração pública e temas', () => {
  it('aceita o contrato distribuído com a console', () =>
    expect(validateConfig(config).themeDefault).toBe('dark'));
  it.each(['yes', 'false', 1, null])('rejeita flag sem tipo booleano: %s', (value) =>
    expect(() =>
      validateConfig({ ...config, modules: { ...config.modules, groups: value } }),
    ).toThrow(),
  );
  it.each([
    { background: 'url(https://example.test)' },
    { background: '#fff;display:none' },
    { unknown: '#002532' },
    { text: 'javascript:alert(1)' },
  ])('rejeita tokens arbitrários: %s', (customTheme) =>
    expect(() => validateConfig({ ...config, customTheme })).toThrow(),
  );
  it('aceita cores com contraste válido no preset correto', () =>
    expect(
      validateConfig({ ...config, customTheme: { light: { primary: '#002532' } } }).customTheme
        .light?.primary,
    ).toBe('#002532'));
  it('rejeita tema com texto ilegível', () =>
    expect(() =>
      validateConfig({ ...config, customTheme: { light: { text: '#ffffff' } } }),
    ).toThrow('Contraste'));
  it('não aplica uma cor escura de ação ao preset escuro', () =>
    expect(() =>
      validateConfig({ ...config, customTheme: { dark: { primary: '#002532' } } }),
    ).toThrow('Contraste'));
});
describe('Transporte e paginação', () => {
  it('permite apenas APIs conhecidas da mesma origem', () => {
    expect(safeApiUrl('projects?limit=20')).toBe('/v2-beta/projects?limit=20');
    expect(safeApiUrl('/v1-catalog/templates')).toBe('/v1-catalog/templates');
    expect(() => safeApiUrl('https://outside.test/v2-beta/projects')).toThrow();
    expect(() => safeApiUrl('/console/login')).toThrow();
    expect(() => safeApiUrl('//outside.test/v2-beta/token')).toThrow();
  });
  it('segue paginação com o mesmo AbortSignal', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 1 }],
            pagination: { next: '/v2-beta/projects?marker=next' },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 2 }] })));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect(await allPages('projects', controller.signal)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetcher.mock.calls[1][1].signal).toBe(controller.signal);
  });
  it('recusa ciclos de paginação', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ data: [], pagination: { next: '/v2-beta/projects' } })),
          ),
        ),
    );
    await expect(allPages('projects')).rejects.toThrow('ciclo');
  });
});
describe('Payloads baseados em capacidade do servidor', () => {
  it('normaliza a imagem e valida campos aninhados antes da criação do serviço', () => {
    const launchConfig: Schema = {
      id: 'launchConfig',
      pluralName: 'launchConfigs',
      links: {},
      resourceFields: {
        imageUuid: { type: 'string', create: true, required: true },
        memory: { type: 'int', create: true, min: 0 },
        computed: { type: 'string' },
      },
    };
    const service: Schema = {
      id: 'service',
      pluralName: 'services',
      links: {},
      resourceFields: { launchConfig: { type: 'launchConfig', create: true, required: true } },
    };
    expect(
      preparePayload(
        service,
        { launchConfig: { imageUuid: 'alpine:3.20', memory: '128', computed: 'ignored' } },
        undefined,
        { launchConfig },
      ),
    ).toEqual({ launchConfig: { imageUuid: 'docker:alpine:3.20', memory: 128 } });
    expect(() =>
      preparePayload(service, { launchConfig: { memory: 128 } }, undefined, { launchConfig }),
    ).toThrow('Imagem');
    expect(() =>
      preparePayload(service, { launchConfig: { imageUuid: 'alpine', memory: -1 } }, undefined, {
        launchConfig,
      }),
    ).toThrow('limites');
  });
  it('preserva null ao limpar um campo numérico anulável', () => {
    const schema: Schema = {
      id: 'x',
      pluralName: 'xs',
      links: {},
      resourceFields: { scale: { type: 'int', update: true, nullable: true } },
    };
    expect(
      preparePayload(schema, { scale: null }, { id: 'x', type: 'x', links: {}, scale: 1 }),
    ).toEqual({ scale: null });
  });
  it('valida as restrições reais de nomes, escala e booleanos de Cattle', () => {
    const schema: Schema = {
      id: 'stack',
      pluralName: 'stacks',
      links: {},
      resourceFields: {
        name: {
          type: 'string',
          create: true,
          required: true,
          validChars: 'a-zA-Z0-9-',
          minLength: 1,
          maxLength: 63,
        },
        scale: { type: 'int', create: true, min: 0 },
        startOnCreate: { type: 'bool', create: true },
      },
    };
    expect(() => preparePayload(schema, { name: 'Stack com espaços' })).toThrow('caracteres');
    expect(() => preparePayload(schema, { name: 'x'.repeat(64) })).toThrow('63');
    expect(() => preparePayload(schema, { name: 'web', scale: -1 })).toThrow('limites');
    expect(() => preparePayload(schema, { name: 'web', startOnCreate: 'false' })).toThrow(
      'verdadeiro',
    );
    expect(preparePayload(schema, { name: 'web', scale: 0, startOnCreate: false })).toEqual({
      name: 'web',
      scale: 0,
      startOnCreate: false,
    });
  });
  const schema: Schema = {
    id: 'example',
    pluralName: 'examples',
    links: {},
    resourceFields: {
      name: { type: 'string', create: true, update: true, required: true },
      scale: { type: 'int', create: true, update: true },
      state: { type: 'string' },
      role: { type: 'enum', create: true, options: ['member', 'readonly'] },
    },
  };
  it('não envia campos fora das capacidades declaradas', () =>
    expect(preparePayload(schema, { name: 'App', state: 'active', admin: true })).toEqual({
      name: 'App',
    }));
  it('valida campos obrigatórios, inteiros e enums', () => {
    expect(() => preparePayload(schema, { scale: 2 })).toThrow('Nome');
    expect(() => preparePayload(schema, { name: 'App', scale: 1.5 })).toThrow('inteiro');
    expect(() => preparePayload(schema, { name: 'App', role: 'owner' })).toThrow('opção');
  });
  it('envia apenas diferenças em atualização', () =>
    expect(
      preparePayload(schema, { name: 'App', scale: '3' }, {
        id: '1',
        type: 'example',
        name: 'App',
        scale: 2,
        links: {},
      } as Resource),
    ).toEqual({ scale: 3 }));
  it('preserva zero em campos numéricos', () =>
    expect(preparePayload(schema, { name: 'App', scale: 0 }).scale).toBe(0));
});
describe('Revisão de grupos', () => {
  it('compara membros e grants sem inferir papel efetivo', () => {
    expect(
      groupChanges(
        { id: 'g', name: 'Grupo', revision: 1, members: ['1', '2'], grants: { '7': 'readonly' } },
        { name: 'Grupo', members: ['2', '3'], grants: { '7': 'member', '8': 'readonly' } },
      ),
    ).toEqual({ added: ['3'], removed: ['1'], changed: ['7', '8'] });
  });
  it('um grupo novo não recebe grants ou membros implicitamente', () =>
    expect(groupChanges(null, { name: 'Novo', members: [], grants: {} })).toEqual({
      added: [],
      removed: [],
      changed: [],
    }));
});
