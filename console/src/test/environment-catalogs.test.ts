import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import { CatalogRepositoryValidationError } from '../catalog-repositories';
import {
  environmentRepositoryMetadata,
  environmentRepositoryPath,
  prepareEnvironmentRepository,
  repositoryDraft,
} from '../environment-catalogs';
const own: Resource = {
  id: 'fixture',
  type: 'catalog',
  name: 'fixture',
  environmentId: '1a417',
  kind: 'native',
  url: 'https://git.invalid/private?token=synthetic-private',
  branch: 'main',
  links: { self: 'https://git.invalid/private?token=synthetic-private' },
};
const draft = () => ({
  name: 'new-fixture',
  url: 'http://127.0.0.1:1/repo.git',
  branch: 'main',
  kind: 'native',
});
describe('Fontes de catálogo por environment', () => {
  it('retira URLs, links e campos desconhecidos antes do cache', () => {
    expect(environmentRepositoryMetadata(own)).toEqual({
      id: 'fixture',
      name: 'fixture',
      branch: 'main',
      kind: 'native',
      environmentId: '1a417',
    });
    expect(JSON.stringify(environmentRepositoryMetadata(own))).not.toContain('synthetic-private');
  });
  it('cria somente payload nativo sem copiar environment, links ou campos arbitrários', () => {
    expect(prepareEnvironmentRepository('1a417', draft(), [own])).toEqual(draft());
  });
  it('bloqueia nomes duplicados inclusive fontes globais', () => {
    expect(() =>
      prepareEnvironmentRepository('1a417', { ...draft(), name: 'fixture' }, [own]),
    ).toThrow('Já existe');
  });
  it('impede edição e exclusão de fonte global ou de outro environment', () => {
    for (const environmentId of ['global', '1a12'])
      for (const removing of [true, false])
        expect(() =>
          prepareEnvironmentRepository(
            '1a417',
            repositoryDraft(own),
            [{ ...own, environmentId }],
            { ...own, environmentId },
            removing,
          ),
        ).toThrow('mudou');
  });
  it('detecta troca de identidade e alterações concorrentes mesmo em URL privada', () => {
    for (const change of [
      { id: 'other' },
      { branch: 'other' },
      { url: 'http://127.0.0.1:1/changed.git' },
      { kind: 'helm' },
    ])
      expect(() =>
        prepareEnvironmentRepository('1a417', repositoryDraft(own), [{ ...own, ...change }], own),
      ).toThrow('mudou');
  });
  it('preserva URL herdada ao alterar branch e valida alterações de URL', () => {
    expect(
      prepareEnvironmentRepository('1a417', { ...repositoryDraft(own), branch: 'next' }, [own], own)
        .url,
    ).toBe(own.url);
    expect(() =>
      prepareEnvironmentRepository(
        '1a417',
        { ...repositoryDraft(own), url: 'https://user:password@git.invalid/repo' },
        [own],
        own,
      ),
    ).toThrow('sem senha');
  });
  it('rejeita branch malformada, tipo não Cattle e nome/path malicioso', () => {
    expect(() =>
      prepareEnvironmentRepository('1a417', { ...draft(), branch: '../main' }, []),
    ).toThrow(new CatalogRepositoryValidationError('catalogRepositories.validation.branch'));
    expect(() => prepareEnvironmentRepository('1a417', { ...draft(), kind: 'helm' }, [])).toThrow(
      'nativo',
    );
    for (const name of ['../global', 'constructor', 'bad/name', ''])
      expect(() => environmentRepositoryPath(name)).toThrow();
  });
  it('permite remover uma fonte herdada sem exigir URL atualmente válida', () => {
    const inherited = { ...own, url: 'git@internal:repo.git' };
    expect(
      prepareEnvironmentRepository(
        '1a417',
        repositoryDraft(inherited),
        [inherited],
        inherited,
        true,
      ).name,
    ).toBe('fixture');
  });
});
