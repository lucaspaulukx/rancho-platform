import { describe, it, expect } from 'vitest';
import {
  repositoryDocument,
  repositoryMetadata,
  repositoryValue,
  repositoryPayload,
} from '../catalog-repositories';
import type { Resource, Schema } from '../api';
const document = {
  catalogs: {
    library: {
      url: 'https://git.invalid/repo?token=synthetic-private',
      branch: 'v1.6',
      custom: { keep: true },
    },
    noBranch: { url: 'git@internal:repo.git' },
  },
  future: { keep: true },
};
const raw: Resource = {
  id: 'catalog.url',
  name: 'catalog.url',
  type: 'activeSetting',
  baseType: 'setting',
  source: 'Default',
  inDb: false,
  value: null,
  activeValue: JSON.stringify(document),
  links: { self: '/v2-beta/settings/catalog.url' },
};
const schema: Schema = {
  id: 'setting',
  pluralName: 'settings',
  links: {},
  resourceMethods: ['GET', 'PUT'],
  resourceFields: { value: { type: 'string', update: true, maxLength: 65535 } },
};
const fresh = () => repositoryDocument(raw);
const added = () => ({
  key: 'new',
  original: null,
  name: 'fixture',
  url: 'http://127.0.0.1:9/repo.git',
  branch: 'master',
});
describe('Configuração estruturada de catálogos', () => {
  it('cache contém somente nomes, branches e origem', () => {
    const dto = repositoryMetadata(fresh());
    expect(JSON.stringify(dto)).not.toContain('synthetic-private');
    expect(dto.entries[1].branch).toBe('Padrão do servidor');
  });
  it('preserva campos desconhecidos e branch ausente ao adicionar', () => {
    const before = fresh(),
      value = JSON.parse(repositoryValue(before, [...before.entries, added()]));
    expect(value.future).toEqual(document.future);
    expect(value.catalogs.library).toEqual(document.catalogs.library);
    expect(value.catalogs.noBranch).toEqual(document.catalogs.noBranch);
    expect(value.catalogs.fixture).toEqual({ url: added().url, branch: 'master' });
  });
  it('edita e remove somente entradas selecionadas', () => {
    const before = fresh(),
      value = JSON.parse(
        repositoryValue(before, [{ ...before.entries[0], branch: 'feature/new' }]),
      );
    expect(value.catalogs.library.custom).toEqual({ keep: true });
    expect(value.catalogs.library.branch).toBe('feature/new');
    expect(value.catalogs.noBranch).toBeUndefined();
  });
  it('rejeita nomes duplicados e reservados', () => {
    const before = fresh();
    for (const name of ['library', 'constructor', 'prototype', '__proto__', 'white space'])
      expect(() => repositoryValue(before, [...before.entries, { ...added(), name }])).toThrow();
  });
  it('não associa metadados opacos a uma origem inventada ou duplicada', () => {
    const before = fresh();
    expect(() => repositoryValue(before, [{ ...added(), original: 'unknown' }])).toThrow();
    expect(() =>
      repositoryValue(before, [before.entries[0], { ...before.entries[0], name: 'other' }]),
    ).toThrow();
  });
  it.each([
    'file:///private/repo',
    'javascript:alert(1)',
    'https://user:pass@git.invalid/repo',
    'https://git.invalid/repo#fragment',
    'relative',
  ])('rejeita URL nova inválida %s', (url) => {
    const before = fresh();
    expect(() => repositoryValue(before, [...before.entries, { ...added(), url }])).toThrow();
  });
  it.each(['feature..bad', 'white space', 'a//b', '-option', 'a.lock', 'a/.hidden', '@'])(
    'rejeita branch inválida %s',
    (branch) => {
      const before = fresh();
      expect(() => repositoryValue(before, [{ ...added(), branch }])).toThrow();
    },
  );
  it('pede aceite para limpar todas as fontes globais', () => {
    const before = fresh();
    expect(() => repositoryPayload(schema, before, before, [], false)).toThrow(/Confirme/);
    expect(JSON.parse(repositoryPayload(schema, before, before, [], true)!.value).catalogs).toEqual(
      {},
    );
  });
  it('relê valor efetivo e override antes de escrever', () => {
    const before = fresh();
    expect(() =>
      repositoryPayload(
        schema,
        before,
        repositoryDocument({ ...raw, inDb: true }),
        [...before.entries, added()],
        false,
      ),
    ).toThrow(/mudou/);
    expect(
      repositoryPayload(schema, before, before, [...before.entries, added()], false),
    ).toHaveProperty('value');
  });
  it('não converte silenciosamente formatos antigos ou inválidos', () => {
    for (const value of ['https://git.invalid/repo', '{', '{}'])
      expect(() => repositoryDocument({ ...raw, value })).toThrow();
  });
});
