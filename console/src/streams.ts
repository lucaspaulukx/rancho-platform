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

export interface MetricsAccess {
  url: string;
  token: string;
  payload?: unknown;
}
const statsPayloadLimit = 16 * 1024 * 1024;
const signedToken = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function tokenPart(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Record<
    string,
    unknown
  >;
}
export function metricsConnection(access: MetricsAccess, classicUrl: string, enabled: boolean) {
  if (
    typeof access?.url !== 'string' ||
    typeof access.token !== 'string' ||
    !access.token ||
    access.token.length > statsPayloadLimit
  )
    throw new Error('O servidor retornou uma conexão de métricas inválida.');
  const address = websocketAddress(access.url, access.token, classicUrl);
  if (access.payload === undefined || access.payload === null) return { address };
  const url = new URL(address);
  if (
    !enabled ||
    typeof access.payload !== 'string' ||
    !access.payload ||
    access.payload.length > statsPayloadLimit ||
    access.token.length > 4096 ||
    !signedToken.test(access.token) ||
    !signedToken.test(access.payload) ||
    !/^\/v1\/(containerstats|hoststats)(\/|$)/.test(url.pathname) ||
    url.hash ||
    [...url.searchParams.keys()].some((name) => name !== 'token')
  )
    throw new Error('O servidor retornou uma negociação de métricas inválida.');
  const [header, claims] = access.token.split('.');
  if (tokenPart(header).alg !== 'RS256' || tokenPart(claims).payload !== true)
    throw new Error('O servidor retornou um envelope de métricas inválido.');
  return { address, payload: access.payload };
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
