import { ApiError, ConsoleRequestError } from './request-errors';
import { navigateBrowser } from './browser-navigation';
export { ApiError } from './request-errors';
export interface Policy {
  enabled: boolean;
  only: boolean;
  autoLogin: boolean;
  preflight?: boolean;
}
export interface Account {
  id: string;
  name: string;
  kind: string;
  state: string;
  removed?: string;
}
export interface Project {
  id: string;
  name: string;
  state: string;
  orchestration?: string;
  removed?: string;
}
export interface Identity {
  externalIdType?: string;
  name?: string;
  login?: string;
  externalId: string;
}
export interface Token {
  userIdentity?: Identity;
  userType?: string;
  accountId?: string;
  user?: string;
  jwt?: string;
  security?: boolean;
}
export const roles = ['readonly', 'restricted', 'member', 'owner'] as const;
export type Role = (typeof roles)[number];
export interface Group {
  id: string;
  name: string;
  revision: number;
  members: string[];
  grants: Record<string, Role>;
}
export interface GroupInput {
  id?: string;
  name: string;
  revision?: number;
  members?: string[];
  grants?: Record<string, Role>;
  delete?: boolean;
}
export const sessionUnauthorizedEvent = 'rancher.console.unauthorized';
function csrf() {
  return decodeURIComponent(
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('CSRF='))
      ?.slice(5) || '',
  );
}
export function safeApiUrl(path: string): string {
  let url: URL;
  try {
    url = new URL(
      path.startsWith('/') || /^https?:/.test(path) ? path : `/v2-beta/${path}`,
      location.origin,
    );
  } catch {
    throw new ConsoleRequestError('requestError.unsafeUrl');
  }
  if (
    url.origin !== location.origin ||
    !/^\/(v2-beta|v1-catalog|v1-webhooks|v1-auth)(\/|$)/.test(url.pathname)
  ) {
    throw new ConsoleRequestError('requestError.unsafeUrl');
  }
  return url.pathname + url.search;
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<T> {
  const url = safeApiUrl(path);
  const sessionCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith('token='));
  const response = await fetch(url, {
    credentials: 'same-origin',
    method: method || (body !== undefined ? 'POST' : 'GET'),
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Csrf': csrf(),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      !/^\/v2-beta\/token(?:\/|\?|$)/.test(url) &&
      sessionCookie === document.cookie.split('; ').find((cookie) => cookie.startsWith('token='))
    )
      window.dispatchEvent(new Event(sessionUnauthorizedEvent));
    const detail = [data?.message, data?.code].find(
      (value): value is string => typeof value === 'string' && Boolean(value.trim()),
    );
    throw new ApiError(response.status, detail);
  }
  return data;
}
export async function policy(): Promise<Policy> {
  const r = await fetch('/oidc/status', { cache: 'no-store' });
  if (!r.ok) throw new Error('Não foi possível carregar a configuração de login.');
  return r.json();
}
const legacyKeys = ['user', 'userType', 'accountId', 'userIdentity', 'backTo'];
export function acceptToken(token: Token) {
  if (!token.jwt) throw new Error('O servidor não retornou uma sessão válida.');
  document.cookie = `token=${encodeURIComponent(token.jwt)}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  legacyKeys.forEach((key) => localStorage.removeItem(key));
  Object.entries({
    user: token.user || token.userIdentity?.login || token.userIdentity?.name,
    userType: token.userType,
    accountId: token.accountId,
    userIdentity: token.userIdentity,
  }).forEach(([key, value]) => {
    if (value !== undefined) localStorage.setItem(key, JSON.stringify(value));
  });
  sessionStorage.removeItem('projectId');
  sessionStorage.removeItem('rancher.oidc.signedOut');
  sessionStorage.removeItem('rancher.oidc.autoAttempt');
  sessionStorage.removeItem('rancher.oidc.logoutWarning');
}
let logoutPending: Promise<void> | null = null;
function currentSessionCookie() {
  return document.cookie.split('; ').find((cookie) => cookie.startsWith('token='));
}
function logoutDestination(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Destino de saída inválido.');
  const url = new URL(value);
  const localHttp =
    location.hostname === 'localhost' && url.hostname === 'localhost' && url.protocol === 'http:';
  if (
    (url.protocol !== 'https:' && !localHttp) ||
    url.username ||
    url.password ||
    url.hash ||
    url.searchParams.has('id_token_hint')
  )
    throw new Error('Destino de saída inválido.');
  const returned = new URL(url.searchParams.get('post_logout_redirect_uri') || '');
  if (
    returned.origin !== location.origin ||
    returned.pathname !== '/console/login' ||
    !url.searchParams.get('client_id')
  )
    throw new Error('Retorno de saída inválido.');
  return url.href;
}
async function performLogout(federated: boolean) {
  const original = currentSessionCookie();
  let destination = '/console/login?signedOut=true';
  let warning = '';
  if (federated && original) {
    const request = new AbortController();
    const timer = setTimeout(() => request.abort(), 5000);
    try {
      const response = await fetch('/oidc/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: request.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Csrf': csrf(),
        },
        body: '{}',
      });
      const prepared = await response.json();
      if (!response.ok || typeof prepared.federated !== 'boolean')
        throw new Error('Saída do provedor indisponível.');
      if (prepared.federated) destination = logoutDestination(prepared.url);
    } catch {
      warning = 'provider';
    } finally {
      clearTimeout(timer);
    }
  }
  // A delayed preparation must never clear a replacement session from another tab/login.
  if (currentSessionCookie() !== original) return;
  const request = new AbortController();
  const timer = setTimeout(() => request.abort(), 5000);
  try {
    await api('token/current', undefined, 'DELETE', request.signal);
  } catch {
    warning = 'server';
  } finally {
    clearTimeout(timer);
  }
  const remaining = currentSessionCookie();
  if (remaining && remaining !== original && remaining !== 'token=') return;
  document.cookie = 'token=; Path=/; Max-Age=0';
  try {
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* Cookie cleanup still applies. */
  }
  try {
    sessionStorage.removeItem('projectId');
    sessionStorage.setItem('rancher.oidc.signedOut', '1');
    sessionStorage.setItem('rancher.oidc.autoAttempt', '1');
    if (warning) sessionStorage.setItem('rancher.oidc.logoutWarning', warning);
    else sessionStorage.removeItem('rancher.oidc.logoutWarning');
  } catch {
    /* The fixed local URL also suppresses autologin without storage. */
  }
  navigateBrowser(destination);
}
export function logout(federated = false) {
  if (!logoutPending)
    logoutPending = performLogout(federated).finally(() => {
      logoutPending = null;
    });
  return logoutPending;
}
export async function checkOidcProvider(signal?: AbortSignal) {
  const response = await fetch('/oidc/readiness', { cache: 'no-store', signal });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ready !== true)
    throw new Error('Não foi possível acessar o provedor de login. Tente novamente.');
}
export async function oidcLogin(preflight = false, signal?: AbortSignal) {
  const currentSession = () =>
    document.cookie.split('; ').find((cookie) => cookie.startsWith('token='));
  const originalSession = currentSession();
  sessionStorage.setItem('rancher.oidc.autoAttempt', '1');
  if (preflight) await checkOidcProvider(signal);
  if (signal?.aborted || currentSession() !== originalSession)
    throw new DOMException('Tentativa de login cancelada.', 'AbortError');
  sessionStorage.removeItem('rancher.oidc.signedOut');
  navigateBrowser('/oidc/login');
}
export interface Collection<T> {
  data: T[];
  links?: Record<string, string>;
  pagination?: { next?: string; partial?: boolean };
  createTypes?: Record<string, string>;
}
export interface Resource {
  id: string;
  type: string;
  name?: string;
  state?: string;
  description?: string;
  links: Record<string, string>;
  actions?: Record<string, string>;
  [key: string]: unknown;
}
export interface SchemaField {
  label?: string;
  type: string;
  create?: boolean;
  update?: boolean;
  required?: boolean;
  nullable?: boolean;
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  validChars?: string;
  description?: string;
  unique?: boolean;
  readOnCreateOnly?: boolean;
}
export interface Schema {
  id: string;
  pluralName: string;
  resourceFields: Record<string, SchemaField>;
  collectionMethods?: string[];
  resourceMethods?: string[];
  collectionActions?: Record<string, { input?: string }>;
  resourceActions?: Record<string, { input?: string }>;
  links: Record<string, string>;
}
export async function allPages<T>(
  path: string,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let next: string | undefined = path;
  while (next) {
    const safe = safeApiUrl(next);
    if (seen.has(safe)) throw new ConsoleRequestError('requestError.paginationCycle');
    seen.add(safe);
    if (seen.size > 100) throw new ConsoleRequestError('requestError.paginationLimit');
    const page = await api<Collection<T>>(safe, undefined, undefined, signal, headers);
    if (!Array.isArray(page?.data)) throw new ConsoleRequestError('requestError.invalidCollection');
    items.push(...page.data);
    next = page.pagination?.next;
  }
  return items;
}
export const rawId = (id: string) => id.replace(/^1a/, '');
