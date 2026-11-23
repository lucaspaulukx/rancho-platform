import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const navigation = vi.hoisted(() => vi.fn());
vi.mock('../browser-navigation', () => ({ navigateBrowser: navigation }));
import { logout } from '../api';

const provider = () =>
  `https://identity.example/realms/test/logout?client_id=console&post_logout_redirect_uri=${encodeURIComponent(location.origin + '/console/login?oidc_logout=returned')}`;
beforeEach(() => {
  navigation.mockClear();
  document.cookie = 'token=synthetic-opaque-session; Path=/';
  document.cookie = 'CSRF=synthetic-csrf; Path=/';
  localStorage.setItem('accountId', 'synthetic-account');
});
afterEach(() => {
  document.cookie = 'token=; Path=/; Max-Age=0';
  document.cookie = 'CSRF=; Path=/; Max-Age=0';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Saída local e federada', () => {
  it('Set-Cookie expirado pelo DELETE nativo não cancela limpeza e navegação', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementationOnce(() => {
        document.cookie = 'token=; Path=/; Max-Age=0';
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
    await logout();
    expect(localStorage.getItem('accountId')).toBeNull();
    expect(sessionStorage.getItem('rancher.oidc.signedOut')).toBe('1');
    expect(navigation).toHaveBeenCalledWith('/console/login?signedOut=true');
  });

  it('flag off executa somente DELETE e limpa sessão sem rejeição não tratada', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await logout();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/v2-beta/token/current');
    expect(fetcher.mock.calls[0][1].method).toBe('DELETE');
    expect(document.cookie).not.toContain('token=');
    expect(localStorage.getItem('accountId')).toBeNull();
    expect(sessionStorage.getItem('rancher.oidc.signedOut')).toBe('1');
    expect(navigation).toHaveBeenCalledWith('/console/login?signedOut=true');
  });

  it('prepara destino antes de revogar e só então navega ao provedor sem ID token', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ federated: true, url: provider() }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await logout(true);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/oidc/logout',
      '/v2-beta/token/current',
    ]);
    expect(fetcher.mock.calls[0][1].headers['X-Api-Csrf']).toBe('synthetic-csrf');
    expect(navigation).toHaveBeenCalledWith(provider());
    expect(document.cookie).not.toContain('token=');
    expect(sessionStorage.getItem('rancher.oidc.logoutWarning')).toBeNull();
  });

  it('sessão local com flag federada ativa não encerra o SSO', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ federated: false }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await logout(true);
    expect(navigation).toHaveBeenCalledWith('/console/login?signedOut=true');
    expect(sessionStorage.getItem('rancher.oidc.logoutWarning')).toBeNull();
  });

  it('IdP indisponível não impede saída local e registra aviso sem detalhes privados', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'private-detail-not-for-ui' }, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await logout(true);
    expect(sessionStorage.getItem('rancher.oidc.logoutWarning')).toBe('provider');
    expect(navigation).toHaveBeenCalledWith('/console/login?signedOut=true');
    expect(document.cookie).not.toContain('token=');
  });

  it('tempo limite no preparo continua para revogação local', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        (_, options) =>
          new Promise((_, reject) => {
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const promise = logout(true);
    await vi.advanceTimersByTimeAsync(5001);
    await promise;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('rancher.oidc.logoutWarning')).toBe('provider');
  });

  it('preparo atrasado não encerra uma sessão substituída por outro login', async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const promise = logout(true);
    document.cookie = 'token=synthetic-replacement; Path=/';
    resolve(Response.json({ federated: true, url: provider() }));
    await promise;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(document.cookie).toContain('synthetic-replacement');
    expect(localStorage.getItem('accountId')).toBe('synthetic-account');
    expect(navigation).not.toHaveBeenCalled();
  });

  it('falha de DELETE ainda limpa navegador, avisa e não rejeita a promise', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('synthetic-network-failure')));
    await expect(logout()).resolves.toBeUndefined();
    expect(document.cookie).not.toContain('token=');
    expect(sessionStorage.getItem('rancher.oidc.logoutWarning')).toBe('server');
    expect(navigation).toHaveBeenCalled();
  });

  it('cliques repetidos compartilham a mesma operação', async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const one = logout();
    const two = logout();
    expect(one).toBe(two);
    resolve(new Response(null, { status: 204 }));
    await one;
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(navigation).toHaveBeenCalledTimes(1);
  });

  it('recusa esquema inseguro, credenciais, fragmento, retorno externo ou ID token no destino', async () => {
    for (const url of [
      'javascript:alert(1)',
      provider().replace('identity.example', 'user:pass@identity.example'),
      provider() + '#fragment',
      provider() + '&id_token_hint=synthetic-private-token',
      'https://identity.example/logout?client_id=console&post_logout_redirect_uri=https%3A%2F%2Foutside.example%2Fconsole%2Flogin',
    ]) {
      document.cookie = 'token=synthetic-opaque-session; Path=/';
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ federated: true, url }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetcher);
      await logout(true);
      expect(navigation).toHaveBeenLastCalledWith('/console/login?signedOut=true');
      expect(sessionStorage.getItem('rancher.oidc.logoutWarning')).toBe('provider');
    }
  });
});
