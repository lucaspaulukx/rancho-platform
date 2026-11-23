import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import type { CatalogTemplate, CatalogVersion } from '../catalog';
import {
  catalogReference,
  catalogStackSnapshot,
  catalogUpgradeDefaults,
  prepareCatalogUpgrade,
} from '../catalog-upgrade';
const template = { id: 'community:demo', type: 'template', links: {} } as CatalogTemplate;
const version = {
  id: 'community:demo:1',
  type: 'templateVersion',
  links: {},
  templateId: template.id,
  version: 'v2',
  files: { 'docker-compose.yml': 'services: {}' },
  questions: [
    { variable: 'enabled', type: 'boolean', default: true },
    { variable: 'replicas', type: 'int', default: 1 },
  ],
} as CatalogVersion;
const stack = {
  id: 'st1',
  type: 'stack',
  name: 'Loja',
  accountId: 'p1',
  externalId: 'catalog://community:demo:0',
  environment: { enabled: 'false', replicas: '2' },
  links: {},
} as Resource;
describe('Upgrade de catálogo', () => {
  it('separa template e revisão sem confundir com a versão exibida', () => {
    expect(catalogReference(stack.externalId)).toEqual({
      templateId: 'community:demo',
      versionId: 'community:demo:0',
      revision: '0',
    });
  });
  it.each([
    'https://outside/template',
    'catalog://../demo:0',
    'catalog://a:b:0?token=x',
    'catalog://a:b:0#x',
    'catalog://a:b',
  ])('recusa referência inválida %s', (value) => expect(catalogReference(value)).toBeNull());
  it('mantém booleano falso e resposta numérica da stack; completa perguntas novas', () => {
    expect(catalogUpgradeDefaults(version.questions!, {}, stack)).toEqual({
      enabled: false,
      replicas: '2',
    });
  });
  it('produz somente stackUpgrade e não cria ou inicia outra stack', () => {
    expect(
      prepareCatalogUpgrade(stack, template, version, { enabled: false, replicas: '3' }),
    ).toEqual({
      externalId: 'catalog://community:demo:1',
      environment: { enabled: false, replicas: 3 },
      dockerCompose: 'services: {}',
    });
    expect(() =>
      prepareCatalogUpgrade(
        { ...stack, externalId: 'catalog://other:demo:0' },
        template,
        version,
        {},
      ),
    ).toThrow('outro catálogo');
  });
  it('detecta mudança concorrente em answers/Compose, sem falso conflito pela ordem das chaves', () => {
    expect(catalogStackSnapshot(stack)).toBe(
      catalogStackSnapshot({ ...stack, environment: { replicas: '2', enabled: 'false' } }),
    );
    expect(catalogStackSnapshot(stack)).not.toBe(
      catalogStackSnapshot({ ...stack, environment: { replicas: '4', enabled: 'false' } }),
    );
  });
});
