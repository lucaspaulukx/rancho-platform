import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptToken, checkOidcProvider, policy } from '../api';
import { AuthenticationError, requestErrorText } from '../request-errors';
import { createTranslator, englishMessages, portugueseMessages } from '../i18n/messages';
import { previewLoaders } from '../i18n/preview-loaders';
import type { Locale } from '../i18n/locales';
afterEach(() => vi.unstubAllGlobals());
describe('Disponibilidade do provedor OIDC', () => {
  it.each(Object.keys(previewLoaders))(
    'formats authentication failures with the loaded %s catalog',
    async (locale) => {
      const code = locale as keyof typeof previewLoaders;
      const messages = await previewLoaders[code]();
      const translator = createTranslator(code as Locale, messages).t;
      for (const key of [
        'auth.entryFailed',
        'auth.methodsUnavailable',
        'auth.providerUnavailable',
      ] as const) {
        const formatted = requestErrorText(new AuthenticationError(key), translator);
        expect(formatted).toBe(translator(key));
        expect(formatted).not.toBe(portugueseMessages[key]);
      }
    },
  );
  it('renders a retained provider failure in the current language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ready: false }, { status: 503 })),
    );
    const error = await checkOidcProvider().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AuthenticationError);
    const en = createTranslator('en-US', englishMessages).t;
    const pt = createTranslator('pt-BR', portugueseMessages).t;
    expect(requestErrorText(error as Error, en)).toBe(en('auth.providerUnavailable'));
    expect(requestErrorText(error as Error, pt)).toBe(pt('auth.providerUnavailable'));
  });
  it('localizes login policy and missing-session failures without response details', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ message: 'private-policy-detail' }, { status: 503 })),
    );
    const failure = await policy().catch((error: unknown) => error);
    const en = createTranslator('en-US', englishMessages).t;
    expect(requestErrorText(failure as Error, en)).toBe(en('auth.methodsUnavailable'));
    expect(() => acceptToken({})).toThrow(AuthenticationError);
    expect(document.cookie).not.toContain('token=undefined');
  });
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
