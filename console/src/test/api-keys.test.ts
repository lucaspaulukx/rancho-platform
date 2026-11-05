import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import {
  assertKeyScope,
  canCreateKey,
  keyActionAllowed,
  keyActionTarget,
  keyMetadata,
  keySecret,
  prepareKeyCreate,
  prepareKeyEdit,
} from '../api-keys';
const schema: Schema = {
  id: 'apiKey',
  pluralName: 'apiKeys',
  links: { collection: '/v2-beta/apikeys' },
  collectionMethods: ['GET', 'POST'],
  resourceMethods: ['GET', 'PUT', 'DELETE'],
  resourceFields: {
    name: { type: 'string', create: true, update: true, maxLength: 255 },
    description: { type: 'string', create: true, update: true, maxLength: 1024 },
    accountId: { type: 'reference[account]', create: true },
    secretValue: { type: 'password', create: true },
  },
  resourceActions: { deactivate: {}, remove: {} },
};
const key: Resource = {
  id: 'k1',
  type: 'apiKey',
  accountId: '1a12',
  name: 'robot',
  description: 'purpose',
  state: 'active',
  links: { self: '/apikeys/k1' },
  actions: { deactivate: '/deactivate', remove: '/remove' },
  secretValue: 'synthetic-private',
  publicValue: 'synthetic-public',
  data: { private: 'hidden' },
};
describe('Chaves de API', () => {
  it('remove segredo e campos desconhecidos antes do cache e limita links/actions', () => {
    const data = keyMetadata({ ...key, actions: { ...key.actions, export: '/private-export' } });
    expect(JSON.stringify(data)).not.toContain('synthetic-private');
    expect(data).not.toHaveProperty('data');
    expect(data.actions).toEqual({ deactivate: '/deactivate', remove: '/remove' });
    expect(data.publicValue).toBe('synthetic-public');
  });
  it('deixa o servidor gerar valores e vincula environment explicitamente', () => {
    expect(prepareKeyCreate(schema, ' robot ', 'purpose', '1a12')).toEqual({
      name: 'robot',
      description: 'purpose',
      accountId: '1a12',
    });
    expect(prepareKeyCreate(schema, 'robot', '')).toEqual({ name: 'robot', description: '' });
  });
  it('rejeita escopo inválido, POST negado e contrato incompleto', () => {
    expect(() => prepareKeyCreate(schema, 'robot', '', 'other')).toThrow('environment');
    expect(canCreateKey({ ...schema, collectionMethods: ['GET'] })).toBe(false);
    expect(() =>
      prepareKeyCreate(
        {
          ...schema,
          resourceFields: {
            ...schema.resourceFields,
            accountId: { type: 'reference[account]', create: false },
          },
        },
        'robot',
        '',
        '1a12',
      ),
    ).toThrow('escopo');
  });
  it('aceita schema scoped com titular imposto pelo servidor e segredo gerado', () => {
    const scoped = {
      ...schema,
      links: { collection: '/v2-beta/projects/1a12/apikeys' },
      resourceFields: {
        ...schema.resourceFields,
        accountId: { type: 'reference[account]', create: false },
        secretValue: { type: 'password', create: false },
      },
    };
    expect(prepareKeyCreate(scoped, 'project robot', '', '1a12')).toEqual({
      name: 'project robot',
      description: '',
    });
    expect(canCreateKey(scoped, '1a8')).toBe(false);
  });
  it('valida nome e descrição sem aceitar controles escondidos', () => {
    for (const name of ['', 'a'.repeat(256), 'bad\nname'])
      expect(() => prepareKeyCreate(schema, name, '')).toThrow('nome');
    expect(() => prepareKeyCreate(schema, 'robot', 'a'.repeat(1025))).toThrow('descrição');
  });
  it('edita somente nome/descrição, sem transferir titular ou reapresentar segredo', () => {
    expect(
      prepareKeyEdit(
        schema,
        key,
        { ...key, secretValue: 'fresh-private' },
        'new',
        'new description',
        '1a12',
      ),
    ).toEqual({ name: 'new', description: 'new description' });
  });
  it('recusa concorrência, transferência de titular, removida e permissão revogada', () => {
    expect(() =>
      prepareKeyEdit(schema, key, { ...key, name: 'external' }, 'new', '', '1a12'),
    ).toThrow('outro cliente');
    expect(() => assertKeyScope({ ...key, accountId: '1a8' }, '1a12', key)).toThrow('escopo');
    expect(() => assertKeyScope({ ...key, removed: 'now' })).toThrow('escopo');
    expect(() =>
      prepareKeyEdit({ ...schema, resourceMethods: ['GET'] }, key, key, 'new', ''),
    ).toThrow('edição');
  });
  it('ações exigem schema, permissão de write e link atual anunciados', () => {
    expect(keyActionAllowed(schema, key, 'deactivate')).toBe(true);
    expect(keyActionAllowed({ ...schema, resourceMethods: ['GET'] }, key, 'deactivate')).toBe(
      false,
    );
    expect(keyActionAllowed(schema, { ...key, actions: {} }, 'deactivate')).toBe(false);
    expect(keyActionAllowed({ ...schema, resourceActions: {} }, key, 'remove')).toBe(false);
  });
  it('o segredo completo é extraído só da resposta de criação e faltas são explícitas', () => {
    expect(keySecret(key)).toEqual({
      publicValue: 'synthetic-public',
      secretValue: 'synthetic-private',
    });
    expect(() => keySecret({ ...key, secretValue: undefined })).toThrow('credencial completa');
  });
  it('DELETE exige chave inativa e contrato nativo disponível', () => {
    const row = { ...key, state: 'inactive', actions: { activate: '/activate' } };
    expect(keyActionTarget(schema, row, 'remove')).toEqual({
      url: '/apikeys/k1',
      method: 'DELETE',
    });
    expect(keyActionAllowed({ ...schema, resourceMethods: ['GET'] }, row, 'remove')).toBe(false);
    expect(keyActionAllowed(schema, { ...row, removed: 'now' }, 'remove')).toBe(false);
    expect(keyActionAllowed(schema, { ...row, state: 'active' }, 'remove')).toBe(false);
  });
});
