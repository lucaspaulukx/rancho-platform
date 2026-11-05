import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import {
  dataEditorSchema,
  dataResourceMetadata,
  isNamedVolume,
  normalizeRegistryAddress,
  prepareDataPayload,
} from '../data-resources';
import { preparePayload } from '../components/SchemaForm';
const schema = (id: string, fields: Record<string, unknown>): Schema => ({
  id,
  pluralName: id + 's',
  links: {},
  resourceFields: fields as Schema['resourceFields'],
});
describe('Adaptadores de dados nativos', () => {
  it('separa volumes nomeados de discos raiz e caminhos de bind mount', () => {
    const volume = { id: 'fixture', type: 'volume', links: {}, name: 'persistent-data' };
    expect(isNamedVolume(volume)).toBe(true);
    expect(isNamedVolume({ ...volume, instanceId: 'container' })).toBe(false);
    expect(isNamedVolume({ ...volume, name: '/var/lib/example' })).toBe(false);
    expect(isNamedVolume({ ...volume, name: undefined })).toBe(false);
  });
  it('envia secrets em base64 UTF-8 sem truncar Unicode ou múltiplas linhas', () => {
    const text = 'Olá 🔒\nconteúdo de teste\n'.repeat(1000);
    const body = prepareDataPayload(
      'secret',
      { name: 'fixture', value: text },
      schema('secret', { value: { type: 'string', maxLength: 16777215 } }),
      false,
    );
    expect(
      new TextDecoder().decode(
        Uint8Array.from(atob(String(body.value)), (character) => character.charCodeAt(0)),
      ),
    ).toBe(text);
  });
  it('confere o limite do conteúdo codificado definido pelo schema', () => {
    expect(() =>
      prepareDataPayload(
        'secret',
        { value: '🔒' },
        schema('secret', { value: { maxLength: 4 } }),
        false,
      ),
    ).toThrow('tamanho');
  });
  it('preserva a imutabilidade do nome e do valor do secret', () => {
    const native = schema('secret', {
      name: { type: 'string', create: true, update: false },
      value: { type: 'string', create: true, update: false },
      description: { type: 'string', create: true, update: true },
    });
    expect(Object.keys(dataEditorSchema(native, true).resourceFields)).toEqual(['description']);
    expect(
      prepareDataPayload(
        'secret',
        { name: 'other', value: 'changed', description: 'new description' },
        native,
        true,
      ),
    ).toEqual({ description: 'new description' });
  });
  it('atualiza metadados de certificado sem exigir ou reenviar a chave existente', () => {
    const native = schema('certificate', {
      name: { type: 'string', create: true, update: true, required: true },
      description: { type: 'string', create: true, update: true },
      key: { type: 'string', create: true, update: true, required: true },
      cert: { type: 'string', create: true, update: true, required: true },
    });
    const original = {
      id: 'cert',
      type: 'certificate',
      links: {},
      name: 'fixture',
      description: 'before',
    };
    const form = dataEditorSchema(native, true);
    expect(preparePayload(form, { name: 'fixture', description: 'after' }, original)).toEqual({
      description: 'after',
    });
    expect(
      prepareDataPayload(
        'certificate',
        { description: 'after', key: 'forged' },
        native,
        true,
        false,
      ),
    ).toEqual({ description: 'after' });
  });
  it('troca o par de certificado e chave apenas no modo explícito e limpa a cadeia anterior', () => {
    const native = schema('certificate', {});
    expect(() =>
      prepareDataPayload('certificate', { cert: 'bad', key: 'bad' }, native, false),
    ).toThrow('PEM');
    const cert = '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
    const key = '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----';
    expect(prepareDataPayload('certificate', { cert, key }, native, true, true)).toEqual({
      cert,
      key,
      certChain: null,
    });
    // Cryptographic validity and certificate/key matching remain server checks.
  });
  it.each([
    ['https://Registry.Example:5000/v2/', 'registry.example:5000'],
    ['index.docker.io', 'index.docker.io'],
    ['http://[::1]:5000/', '[::1]:5000'],
  ])('normaliza registry %s sem mudar a porta', (input, output) => {
    expect(normalizeRegistryAddress(input)).toBe(output);
  });
  it.each([
    'https://user:password@registry.invalid',
    'ftp://registry.invalid',
    'https://registry.invalid:99999',
    '',
  ])('rejeita registry inválido ou credencial no endereço %s', (input) => {
    expect(() => normalizeRegistryAddress(input)).toThrow();
  });
  it('remove valores sensíveis antes do cache sem alterar a resposta original', () => {
    const input: Resource = {
      id: 'credential',
      type: 'registryCredential',
      links: { self: '/v2-beta/credential' },
      publicValue: 'fixture-user',
      secretValue: 'private',
      options: { API_KEY: 'private', bucket: 'fixture' },
    };
    expect(dataResourceMetadata(input)).toEqual({
      id: 'credential',
      type: 'registryCredential',
      links: { self: '/v2-beta/credential' },
      publicValue: 'fixture-user',
      options: { bucket: 'fixture' },
    });
    expect(input.secretValue).toBe('private');
  });
  it('não substitui opções sensíveis de driver durante edição de metadados do volume', () => {
    const native = schema('volume', {
      description: { type: 'string', update: true },
      driverOpts: { type: 'map[string]', create: true, update: true },
      hostId: { type: 'reference[host]', update: true },
      name: { type: 'string', create: true },
    });
    expect(Object.keys(dataEditorSchema(native, true).resourceFields)).toEqual(['description']);
  });
});
