import { describe, expect, it, vi } from 'vitest';
import { allPages } from '../api';
import {
  catalogDefaults,
  catalogPath,
  catalogQuestions,
  prepareCatalogStack,
  type CatalogTemplate,
  type CatalogVersion,
} from '../catalog';
import { safeConfiguration } from '../components/ResourceDetails';
const template: CatalogTemplate = {
  id: 'lab:fixture',
  type: 'template',
  links: { self: '/v1-catalog/templates/lab:fixture' },
};
const version: CatalogVersion = {
  id: 'lab:fixture:1',
  type: 'templateversion',
  templateId: template.id,
  version: '1.0',
  links: {},
  files: {
    'docker-compose.yml': 'services: {}',
    'docker-compose.yml.tpl': 'versioned template',
    'rancher-compose.yml': 'version: 2',
  },
  questions: [
    { variable: 'ENABLED', type: 'boolean', required: true, default: false },
    {
      variable: 'COUNT',
      label: 'Réplicas',
      type: 'int',
      required: true,
      default: 0,
      min: 0,
      max: 5,
    },
  ],
};
const payload = (answers: Record<string, unknown>, v = version) =>
  prepareCatalogStack(template, v, ' fixture-stack ', ' Lab ', answers, false);
describe('Catálogo nativo', () => {
  it('preserva arquivos e referência da versão sem alterar o Compose no navegador', () => {
    expect(payload({ ENABLED: false, COUNT: '0', UNKNOWN: 'not-sent' })).toEqual({
      name: 'fixture-stack',
      description: 'Lab',
      environment: { ENABLED: false, COUNT: 0 },
      externalId: 'catalog://lab:fixture:1',
      dockerCompose: 'versioned template',
      rancherCompose: 'version: 2',
      startOnCreate: false,
      system: false,
    });
  });
  it('converte defaults booleanos e preserva zero', () => {
    expect(catalogDefaults(version.questions!, {})).toEqual({ ENABLED: false, COUNT: 0 });
    expect(
      catalogDefaults([{ variable: 'FEATURE', type: 'boolean', default: 'false' }], {}),
    ).toEqual({ FEATURE: false });
  });
  it('usa o nome completo da stack/serviço e rejeita defaults ambíguos', () => {
    const options = {
      service: [
        { value: 'one/web', label: 'one/web' },
        { value: 'two/web', label: 'two/web' },
      ],
    };
    expect(
      catalogDefaults([{ variable: 'TARGET', type: 'service', default: 'web' }], options),
    ).toEqual({ TARGET: '' });
    expect(
      catalogDefaults([{ variable: 'TARGET', type: 'service', default: 'one/web' }], options),
    ).toEqual({ TARGET: 'one/web' });
  });
  it.each([
    ['COUNT', 1.5],
    ['COUNT', 6],
    ['COUNT', -1],
    ['COUNT', 'NaN'],
    ['COUNT', ''],
    ['ENABLED', 'false'],
  ])('valida parâmetro %s com valor %s', (name, value) => {
    expect(() => payload({ ENABLED: false, COUNT: 0, [name]: value })).toThrow();
  });
  it('rejeita opções e referências que não pertencem às escolhas autorizadas', () => {
    expect(() =>
      payload(
        { MODE: 'forged' },
        { ...version, questions: [{ variable: 'MODE', type: 'enum', options: ['safe'] }] },
      ),
    ).toThrow('opção válida');
    expect(() =>
      payload(
        { CERT: 'foreign-certificate' },
        { ...version, questions: [{ variable: 'CERT', type: 'certificate' }] },
      ),
    ).toThrow('recurso disponível');
  });
  it('rejeita versões de outro template e arquivos Compose ausentes', () => {
    expect(() => payload({}, { ...version, templateId: 'other' })).toThrow('outro template');
    expect(() => payload({}, { ...version, files: { 'README.md': 'documentation' } })).toThrow(
      'Compose utilizável',
    );
  });
  it('rejeita perguntas desconhecidas, duplicadas e nomes que alteram protótipos', () => {
    expect(() =>
      catalogQuestions({ ...version, questions: [{ variable: 'WHAT', type: 'unsupported' }] }),
    ).toThrow('não suportado');
    expect(() =>
      catalogQuestions({
        ...version,
        questions: [
          { variable: 'KEY', type: 'string' },
          { variable: 'KEY', type: 'string' },
        ],
      }),
    ).toThrow('duplicadas');
    expect(() =>
      catalogQuestions({ ...version, questions: [{ variable: '__proto__', type: 'string' }] }),
    ).toThrow('inválidas');
  });
  it('valida datas de calendário e mantém limites zero/zero do contrato nativo', () => {
    expect(() =>
      payload(
        { DATE: '2026-02-30' },
        { ...version, questions: [{ variable: 'DATE', type: 'date' }] },
      ),
    ).toThrow('data válida');
    expect(
      payload(
        { N: 123 },
        { ...version, questions: [{ variable: 'N', type: 'int', min: 0, max: 0 }] },
      ).environment,
    ).toEqual({ N: 123 });
  });
  it('mantém as consultas paginadas do catálogo no mesmo environment', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'one' }],
            pagination: { next: '/v1-catalog/templates?next=2' },
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'two' }] }) }),
    );
    try {
      expect(
        await allPages('/v1-catalog/templates', undefined, { 'X-Api-Project-Id': '1a12' }),
      ).toEqual([{ id: 'one' }, { id: 'two' }]);
      for (const [, options] of vi.mocked(fetch).mock.calls)
        expect(options?.headers).toMatchObject({ 'X-Api-Project-Id': '1a12' });
      expect(() => catalogPath('/v2-beta/projects')).toThrow('rota inválida');
      expect(() => catalogPath('https://untrusted.example/v1-catalog/templates')).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('protege variantes comuns de credenciais nos detalhes da stack', () => {
    expect(
      safeConfiguration({
        environment: { AWS_ACCESS_KEY_ID: 'private', DB_PASS: 'private', PUBLIC_NAME: 'fixture' },
      }),
    ).toEqual({
      environment: {
        AWS_ACCESS_KEY_ID: '[protegido]',
        DB_PASS: '[protegido]',
        PUBLIC_NAME: 'fixture',
      },
    });
  });
});
