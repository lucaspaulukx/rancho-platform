import type { Resource } from './api';
export function streamResourceAllowed(
  current: Resource,
  expected: Resource,
  mode: 'logs' | 'execute',
  environment?: string,
) {
  return (
    current.id === expected.id &&
    current.type === expected.type &&
    (!environment || current.accountId === environment) &&
    typeof current.actions?.[mode] === 'string'
  );
}
export function websocketAddress(endpoint: string, token: string, classicUrl: string) {
  const publicOrigin = new URL(location.origin);
  const classic = new URL(classicUrl);
  const url = new URL(endpoint, location.origin);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || url.username || url.password)
    throw new Error('O servidor retornou um protocolo de conexão não permitido.');
  const normalizedOrigin = url.origin.replace(/^ws/, 'http');
  if (![publicOrigin.origin, classic.origin].includes(normalizedOrigin)) {
    throw new Error('O servidor retornou um endereço de conexão não permitido.');
  }
  if (!/^\/(v1|v2-beta|r)(\/|$)/.test(url.pathname)) {
    throw new Error('O servidor retornou uma rota de conexão não permitida.');
  }
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  url.host = location.host;
  url.searchParams.set('token', token);
  return url.toString();
}

export { encodeUtf8Base64 as encodeTerminal } from './encoding';
export function decodeTerminal(text: string, decoder?: TextDecoder) {
  const raw = atob(text);
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  return decoder ? decoder.decode(bytes, { stream: true }) : new TextDecoder().decode(bytes);
}
export interface LogLine {
  channel: 'stdout' | 'stderr' | 'combined';
  text: string;
}
export function decodeLogFrame(frame: string): LogLine[] {
  const channel = frame[1] === '1' ? 'stdout' : frame[1] === '2' ? 'stderr' : 'combined';
  return frame
    .slice(2, 65_538)
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      channel,
      text: line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').slice(0, 4096),
    }));
}
const logSizes = new WeakMap<LogLine, number>();
function logSize(line: LogLine) {
  const size = logSizes.get(line) ?? new TextEncoder().encode(line.text).length + 1;
  logSizes.set(line, size);
  return size;
}
export function boundedLogs(current: LogLine[], incoming: LogLine[], maxLines = 2000) {
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) return [];
  const result = [...current, ...incoming].slice(-maxLines);
  let chars = 0;
  let start = result.length;
  while (start > 0 && chars + logSize(result[start - 1]) <= 512_000) {
    chars += logSize(result[--start]);
  }
  return result.slice(start);
}
