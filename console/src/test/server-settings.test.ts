import { describe, expect, it } from 'vitest';
import {
  settingMetadata,
  settingSnapshot,
  settingWritable,
  prepareSetting,
} from '../server-settings';
import type { Resource, Schema } from '../api';
const raw = {
  id: 'console.lab.fixture.test',
  name: 'console.lab.fixture.test',
  type: 'setting',
  source: 'Database',
  inDb: true,
  value: 'synthetic-private\nline-two',
  activeValue: 'synthetic-private\nline-two',
  links: { self: '/v2-beta/settings/console.lab.fixture.test' },
} as Resource;
const schema: Schema = {
  id: 'setting',
  pluralName: 'settings',
  links: {},
  resourceFields: { value: { type: 'string', update: true, maxLength: 100 } },
  resourceMethods: ['GET', 'PUT', 'DELETE'],
};
describe('Configurações do servidor', () => {
  it('listagem sanitiza todos valores independentemente do nome e limita links', () => {
    const dto = settingMetadata({
      ...raw,
      other: 'synthetic-private',
      actions: { export: '/private' },
    });
    expect(JSON.stringify(dto)).not.toContain('synthetic-private');
    expect(dto).not.toHaveProperty('value');
    expect(dto).not.toHaveProperty('activeValue');
    expect(dto).not.toHaveProperty('actions');
  });
  it('preserva caixa do nome mesmo quando o link nativo veio em minúsculas', () => {
    const metadata = settingMetadata({
      ...raw,
      id: 'some.agentInstance',
      name: 'some.agentInstance',
      links: { self: '/v2-beta/settings/some.agentinstance' },
    });
    expect(metadata.self).toBe('/v2-beta/settings/some.agentInstance');
  });
  it('aceita activeSetting nativo apenas com baseType setting', () => {
    expect(settingSnapshot({ ...raw, type: 'activeSetting', baseType: 'setting' }).name).toBe(
      raw.name,
    );
    expect(() => settingSnapshot({ ...raw, type: 'activeSetting', baseType: 'apiKey' })).toThrow(
      'indisponível',
    );
  });
  it('snapshot privado conserva valores multiline e nulidade sem normalizar', () => {
    expect(settingSnapshot(raw).value).toBe('synthetic-private\nline-two');
    expect(settingSnapshot({ ...raw, value: null }).value).toBe(null);
    expect(() => settingSnapshot({ ...raw, value: { secret: 'private' } })).toThrow();
  });
  it('recusa endpoints fora de settings, outra origem e nomes malformados', () => {
    for (const self of [
      '/v2-beta/apikeys',
      'https://untrusted.example/v2-beta/settings/console.lab.fixture.test',
    ])
      expect(() => settingMetadata({ ...raw, links: { self } })).toThrow();
    expect(() => settingMetadata({ ...raw, name: 'invalid?token=private' })).toThrow();
  });
  it('PUT só envia value; não troca nome/origem e exige confirmação de vazio', () => {
    const snap = settingSnapshot(raw);
    expect(prepareSetting(schema, snap, snap, 'new\nvalue', false)).toEqual({
      value: 'new\nvalue',
    });
    expect(() => prepareSetting(schema, snap, snap, '', false)).toThrow('vazio');
    expect(prepareSetting(schema, snap, snap, '', true)).toEqual({ value: '' });
    expect(() => prepareSetting(schema, snap, snap, 'x'.repeat(101), false)).toThrow('limites');
  });
  it('fresh snapshot bloqueia concorrência em valor efetivo/configurado e origem', () => {
    const snap = settingSnapshot(raw);
    for (const change of [
      { value: 'external' },
      { activeValue: 'external' },
      { source: 'Environment' },
      { inDb: false },
      { name: 'other' },
    ])
      expect(() => prepareSetting(schema, snap, { ...snap, ...change }, 'new', false)).toThrow(
        'mudou',
      );
  });
  it('reset exige override DB e schema DELETE disponível', () => {
    const snap = settingSnapshot(raw);
    expect(prepareSetting(schema, snap, snap, '', false, true)).toBeUndefined();
    expect(settingWritable(schema, 'reset', { ...snap, inDb: false })).toBe(false);
    expect(() =>
      prepareSetting({ ...schema, resourceMethods: ['GET'] }, snap, snap, 'new', false),
    ).toThrow('disponível');
  });
});
