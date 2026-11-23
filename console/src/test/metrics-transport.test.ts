import { describe, expect, it } from 'vitest';
import { metricsConnection } from '../streams';
import { validateConfig } from '../config';
import configuration from '../../public/console-config.json';

const encode = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (claims: unknown, algorithm = 'RS256') =>
  `${encode({ alg: algorithm })}.${encode(claims)}.publicFixtureSignature`;
const envelope = token({ payload: true });
const payload = token({ service: [], fixture: 'x'.repeat(10000) });
const access = { url: `${location.origin}/v1/containerstats/service/`, token: envelope, payload };

describe('Negociação de métricas grandes', () => {
  it('mantém o conteúdo grande fora da URL e conserva o gateway público', () => {
    const connection = metricsConnection(access, 'http://localhost:18080/', true);
    expect(connection.payload).toBe(payload);
    expect(new URL(connection.address).searchParams.get('token')).toBe(envelope);
    expect(connection.address).not.toContain(payload);
    expect(connection.address.length).toBeLessThan(4096);
  });
  it('aceita o retorno legado sem enviar um primeiro frame', () => {
    expect(
      metricsConnection({ ...access, payload: null }, 'http://localhost:18080/', false).payload,
    ).toBeUndefined();
    expect(
      metricsConnection(
        { url: access.url, token: 'legacy-fixture' },
        'http://localhost:18080/',
        true,
      ).payload,
    ).toBeUndefined();
  });
  it.each([
    { ...access, payload: false },
    { ...access, payload: '' },
    { ...access, payload: 'not-a-signed-token' },
    { ...access, payload: 'x'.repeat(16 * 1024 * 1024 + 1) },
    { ...access, token: token({ payload: false }) },
    { ...access, token: token({ payload: true }, 'HS256') },
    { ...access, token: 'x'.repeat(4097) },
    { ...access, url: `${location.origin}/v1/exec` },
    { ...access, url: `${location.origin}/v1/containerstats/service?unexpected=1` },
    { ...access, url: 'https://outside.invalid/v1/containerstats/service' },
  ])('recusa retorno incompatível sem abrir outro transporte', (input) => {
    expect(() => metricsConnection(input, 'http://localhost:18080/', true)).toThrow();
  });
  it('não aceita negociar quando a flag do cliente está desligada', () => {
    expect(() => metricsConnection(access, 'http://localhost:18080/', false)).toThrow();
  });
  it('adiciona a flag ausente de configuração v1 como false', () => {
    const { metricsPayloadTransport: omitted, ...previous } = configuration.modules;
    void omitted;
    const migrated = validateConfig({ ...configuration, modules: previous });
    expect(migrated.modules.metricsPayloadTransport).toBe(false);
    expect(
      validateConfig({ ...configuration, modules: { ...previous, metricsPayloadTransport: true } })
        .modules.metricsPayloadTransport,
    ).toBe(true);
    expect(() =>
      validateConfig({
        ...configuration,
        modules: { ...previous, metricsPayloadTransport: 'true' },
      }),
    ).toThrow();
  });
});
