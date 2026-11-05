import { describe, it, expect } from 'vitest';
import {
  driverMetadata,
  driverSnapshot,
  driverPayload,
  driverAction,
  customDriver,
} from '../machine-drivers';
import type { Resource, Schema } from '../api';
const raw: Resource = {
  id: '1md99',
  type: 'machineDriver',
  name: 'fixture',
  state: 'inactive',
  builtin: false,
  url: 'https://driver.invalid/binary?token=synthetic-private',
  uiUrl: 'https://driver.invalid/ui',
  checksum: 'synthetic-private',
  description: 'fixture',
  links: { self: '/v2-beta/machinedrivers/1md99' },
  actions: {
    activate: '/v2-beta/machinedrivers/1md99/?action=activate',
    remove: '/v2-beta/machinedrivers/1md99/?action=remove',
  },
};
const schema: Schema = {
  id: 'machineDriver',
  pluralName: 'machinedrivers',
  links: {},
  collectionMethods: ['GET', 'POST'],
  resourceMethods: ['GET', 'PUT', 'DELETE'],
  resourceActions: { activate: {}, remove: {} },
  resourceFields: Object.fromEntries(
    ['url', 'uiUrl', 'checksum', 'description', 'activateOnCreate'].map((k) => [
      k,
      { type: 'string', create: true, update: true },
    ]),
  ),
};
const fields = {
  url: 'https://driver.invalid/docker-machine-driver-fixture',
  uiUrl: '',
  checksum: '',
  description: 'new',
};
describe('Drivers de máquinas', () => {
  it('cache contém só metadados e ações locais validadas', () => {
    const dto = driverMetadata({ ...raw, data: { token: 'synthetic-private' } });
    expect(JSON.stringify(dto)).not.toContain('synthetic-private');
    expect(dto).not.toHaveProperty('url');
    expect(dto).not.toHaveProperty('checksum');
  });
  it('não aceita ação para outro driver', () => {
    expect(() =>
      driverMetadata({ ...raw, actions: { remove: '/v2-beta/machinedrivers/1md1?action=remove' } }),
    ).toThrow();
  });
  it('não aceita ação em origem externa', () => {
    expect(() =>
      driverMetadata({
        ...raw,
        actions: {
          activate: 'https://external.invalid/v2-beta/machinedrivers/1md99?action=activate',
        },
      }),
    ).toThrow();
  });
  it('envia apenas campos suportados e solicita cadastro inativo', () => {
    const body = driverPayload(schema, fields);
    expect(body).toEqual({ ...fields, activateOnCreate: false });
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('builtin');
  });
  it.each([
    'javascript:alert(1)',
    'file:///bin/driver',
    'https://user:pass@driver.invalid/file',
    'https://driver.invalid/file#hash',
    'relative',
  ])('rejeita URL inválida %s', (url) => {
    expect(() => driverPayload(schema, { ...fields, url })).toThrow();
  });
  it('rejeita schema sem criação inativa', () => {
    expect(() =>
      driverPayload(
        {
          ...schema,
          resourceFields: {
            ...schema.resourceFields,
            activateOnCreate: { type: 'boolean', create: false },
          },
        },
        fields,
      ),
    ).toThrow();
  });
  it('não edita embutidos ou vinculados ao catálogo', () => {
    for (const extra of [{ builtin: true }, { externalId: 'catalog://fixture' }]) {
      const row = driverSnapshot({ ...raw, ...extra });
      expect(customDriver(row)).toBe(false);
      expect(() => driverPayload(schema, fields, row, row)).toThrow();
      expect(() => driverAction(schema, row, row, 'remove')).toThrow();
    }
  });
  it('revalida snapshot completo antes de atualizar', () => {
    const row = driverSnapshot(raw);
    expect(() => driverPayload(schema, fields, row, { ...row, checksum: 'changed' })).toThrow(
      /mudou/,
    );
    expect(driverPayload(schema, fields, row, row)).toEqual(fields);
  });
  it('ação exige contrato, link e snapshot atuais', () => {
    const row = driverSnapshot(raw);
    expect(driverAction(schema, row, row, 'activate')).toContain('?action=activate');
    expect(() => driverAction(schema, row, { ...row, state: 'active' }, 'activate')).toThrow();
    expect(() => driverAction({ ...schema, resourceActions: {} }, row, row, 'activate')).toThrow();
  });
  it('erro nativo continua editável sem esconder estado', () => {
    const row = driverSnapshot({ ...raw, state: 'error' });
    expect(driverPayload(schema, fields, row, row)).toEqual(fields);
  });
});
