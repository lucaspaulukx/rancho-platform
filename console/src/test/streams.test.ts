import { describe, expect, it } from 'vitest';
import {
  boundedLogs,
  decodeLogFrame,
  decodeTerminal,
  encodeTerminal,
  websocketAddress,
} from '../streams';
describe('Transporte de logs e terminal', () => {
  it('preserva Unicode dividido entre mensagens do terminal', () => {
    const bytes = new TextEncoder().encode('🐳');
    const decoder = new TextDecoder();
    const first = btoa(String.fromCharCode(...bytes.subarray(0, 2)));
    const second = btoa(String.fromCharCode(...bytes.subarray(2)));
    expect(decodeTerminal(first, decoder) + decodeTerminal(second, decoder)).toBe('🐳');
  });
  it('limita o buffer em bytes UTF-8 e aceita entradas grandes sem estourar a pilha', () => {
    const logs = boundedLogs(
      [],
      Array.from({ length: 2000 }, () => ({ channel: 'stdout' as const, text: '🐳'.repeat(1024) })),
    );
    expect(
      logs.reduce((bytes, line) => bytes + new TextEncoder().encode(line.text).length + 1, 0),
    ).toBeLessThanOrEqual(512_000);
    const paste = 'ação '.repeat(40_000);
    expect(decodeTerminal(encodeTerminal(paste))).toBe(paste);
    expect(boundedLogs([], logs, 0)).toEqual([]);
  });
  it('codifica entrada Unicode sem corromper acentos ou emoji', () =>
    expect(decodeTerminal(encodeTerminal('ação 🐳\r\n'))).toBe('ação 🐳\r\n'));
  it('preserva o canal e neutraliza sequências ANSI nos logs de texto', () =>
    expect(decodeLogFrame('02\u001b[31mfalhou\u001b[0m\n')).toEqual([
      { channel: 'stderr', text: 'falhou' },
    ]));
  it('limita linhas e volume do buffer', () => {
    expect(
      boundedLogs(
        [{ channel: 'stdout', text: 'antiga' }],
        [{ channel: 'stdout', text: 'nova' }],
        1,
      ).map((l) => l.text),
    ).toEqual(['nova']);
    const logs = boundedLogs(
      [],
      Array.from({ length: 2000 }, () => ({ channel: 'stdout' as const, text: 'a'.repeat(4096) })),
    );
    expect(logs.reduce((size, line) => size + line.text.length, 0)).toBeLessThanOrEqual(512_000);
  });
  it('mantém a conexão no gateway público autorizado', () => {
    const url = new URL(
      websocketAddress(
        'ws://localhost:18080/v1/exec?session=1',
        'private-token',
        'http://localhost:18080/',
      ),
    );
    expect(url.host).toBe(location.host);
    expect(url.searchParams.get('token')).toBe('private-token');
  });
  it.each([
    'wss://outside.test/v1/exec',
    'ws://localhost:18080/console/login',
    'ftp://localhost:18080/v1/exec',
  ])('bloqueia destino inesperado: %s', (endpoint) =>
    expect(() => websocketAddress(endpoint, 'token', 'http://localhost:18080/')).toThrow(),
  );
});
