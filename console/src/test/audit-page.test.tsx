import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useI18n } from '../i18n/provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Audit } from '../pages/Audit';
import { api } from '../api';
import { frFR } from '../i18n/catalogs/fr-FR';
const state = vi.hoisted(() => ({ admin: true, enabled: true }));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    admin: state.admin,
    config: { modules: { audit: state.enabled } },
  }),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  api: vi.fn(async (path: string) => ({
    data: [
      {
        id: path.includes('marker') ? '1al2' : '1al1',
        type: 'auditLog',
        eventType: 'api.create',
        resourceType: 'service',
        responseCode: 200,
        requestObject: 'synthetic-private',
        responseObject: 'synthetic-private',
        description: 'synthetic-private',
        links: {},
        created: '2026-10-22T12:00:00Z',
      },
    ],
    pagination: path.includes('marker') ? {} : { next: '/v2-beta/auditlogs?marker=100' },
  })),
}));
function SwitchLanguage() {
  const { setLocale } = useI18n();
  return (
    <>
      <button onClick={() => setLocale('en-US')}>English</button>
      <button onClick={() => setLocale('fr-FR')}>Français</button>
    </>
  );
}
function mount(localized = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={
          localized
            ? {
                enabled: true,
                preview: true,
                defaultLocale: 'pt-BR',
                availableLocales: ['pt-BR', 'en-US', 'fr-FR'],
                selectable: true,
                detectBrowser: false,
              }
            : undefined
        }
      >
        {localized && <SwitchLanguage />}
        <Audit />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('rancho.console.locale.anonymous');
  state.admin = true;
  state.enabled = true;
});
describe('Tela de auditoria', () => {
  it('cache e modal usam apenas DTO e paginação segue link nativo sem carregar o histórico inteiro', async () => {
    const client = mount(),
      user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Detalhes do evento 1al1' }));
    expect(screen.queryByText('synthetic-private')).not.toBeInTheDocument();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
    await user.click(screen.getByRole('button', { name: 'Fechar diálogo' }));
    expect(api).toHaveBeenCalledTimes(1);
    const pagination = screen.getByRole('navigation', { name: 'Paginação da auditoria' });
    await user.click(within(pagination).getByRole('button', { name: 'Mais eventos' }));
    await screen.findByRole('button', { name: 'Detalhes do evento 1al2' });
    expect(screen.getByText('Página 2')).toBeInTheDocument();
    expect(api).toHaveBeenLastCalledWith(
      '/v2-beta/auditlogs?marker=100',
      undefined,
      undefined,
      expect.any(AbortSignal),
    );
  });
  it('valida filtros sem disparar request inválido e reinicia paginação ao aplicar', async () => {
    mount(true);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Detalhes do evento 1al1' });
    await user.type(screen.getByLabelText('Filtrar por conta autenticada'), 'bad-account');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await screen.findByText(
      'Use identificadores válidos de evento/recurso e uma conta no formato 1a123.',
    );
    const input = screen.getByLabelText('Filtrar por conta autenticada');
    fireEvent.click(screen.getByText('English'));
    expect(
      screen.getByText(
        'Use valid event and resource identifiers and an account in the 1a123 format.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Français'));
    expect(await screen.findByText(frFR['auditPage.invalidFilter'])).toBeInTheDocument();
    expect(screen.getByLabelText(frFR['auditPage.filterAccount'])).toBe(input);
    expect(input).toHaveValue('bad-account');
    expect(api).toHaveBeenCalledTimes(1);
    await user.clear(input);
    await user.type(input, '1a1');
    await user.click(screen.getByRole('button', { name: frFR['auditPage.apply'] }));
    await waitFor(() =>
      expect(api).toHaveBeenLastCalledWith(
        expect.stringContaining('authenticatedAsAccountId=1a1'),
        undefined,
        undefined,
        expect.any(AbortSignal),
      ),
    );
  });
  it.each(['admin', 'flag'])('não consulta backend sem %s', async (kind) => {
    if (kind === 'admin') state.admin = false;
    else state.enabled = false;
    mount();
    expect(screen.getByText('Auditoria indisponível neste acesso.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
