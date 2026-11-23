import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkOidcProvider } from '../api';
afterEach(() => vi.unstubAllGlobals());
describe('Disponibilidade do provedor OIDC', () => {
  it('aceita resposta positiva sem armazenar dados de autenticação', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ready: true }));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    await expect(checkOidcProvider(signal)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/oidc/readiness', { cache: 'no-store', signal });
  });
  it.each([
    [503, { ready: false, message: 'sentinel-private-detail' }],
    [200, { ready: false }],
    [200, { ready: 'true' }],
    [200, {}],
  ])('recusa status/contrato inesperado sem mostrar detalhes: %s', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })));
    await expect(checkOidcProvider()).rejects.toThrow(
      'Não foi possível acessar o provedor de login. Tente novamente.',
    );
  });
  it('propaga cancelamento para impedir redirecionamento tardio', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')));
    await expect(checkOidcProvider(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
