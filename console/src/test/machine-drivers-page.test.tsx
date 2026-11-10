import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MachineDrivers } from '../pages/MachineDrivers';
import { allPages, api } from '../api';
import type { Locale } from '../i18n/locales';
import { I18nProvider } from '../i18n/provider';
const state = vi.hoisted(() => ({ admin: true, enabled: true, activation: false }));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    admin: state.admin,
    config: {
      modules: {
        machineDrivers: state.enabled,
        driverActivation: state.activation,
        unsavedChangesGuard: true,
      },
    },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: { machineDriver: { collectionMethods: ['GET', 'POST'] } } }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
const raw = {
  id: '1md99',
  type: 'machineDriver',
  name: 'fixture',
  state: 'inactive',
  builtin: false,
  url: 'https://driver.invalid/binary?secret=synthetic-private',
  checksum: 'synthetic-private',
  links: { self: '/v2-beta/machinedrivers/1md99' },
  actions: {
    activate: '/v2-beta/machinedrivers/1md99?action=activate',
    remove: '/v2-beta/machinedrivers/1md99?action=remove',
  },
};
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  allPages: vi.fn(),
  api: vi.fn(),
}));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <MachineDrivers /> }]);
  const page = (locale: Locale) => (
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={{
          enabled: true,
          defaultLocale: locale,
          availableLocales: ['pt-BR', 'en-US'],
          selectable: false,
          detectBrowser: false,
          preview: true,
        }}
      >
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(page('pt-BR'));
  return { client, showLocale: (locale: Locale) => rerender(page(locale)) };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { admin: true, enabled: true, activation: false });
  vi.mocked(allPages).mockResolvedValue([raw]);
  vi.mocked(api).mockResolvedValue(raw);
});
describe('Tela de drivers', () => {
  it('sanitiza cache e respeita a flag das ações', async () => {
    const { client } = mount();
    await screen.findByText('fixture');
    expect(JSON.stringify(client.getQueryData(['data', 'admin', 'machine-drivers']))).not.toContain(
      'synthetic-private',
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ações do driver fixture' }));
    expect(screen.queryByRole('menuitem', { name: 'Ativar driver' })).not.toBeInTheDocument();
  });
  it('expõe ativação somente quando habilitada', async () => {
    state.activation = true;
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ações do driver fixture' }));
    expect(screen.getByRole('menuitem', { name: 'Ativar driver' })).toBeInTheDocument();
  });
  it.each(['admin', 'enabled'] as const)('nega acesso sem %s antes da consulta', async (key) => {
    state[key] = false;
    mount();
    expect(screen.getByText('Drivers indisponíveis neste acesso.')).toBeInTheDocument();
    expect(allPages).not.toHaveBeenCalled();
  });
  it('protege campos ao abrir e pede descarte de alteração', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Ações do driver fixture' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar driver' }));
    const field = await screen.findByLabelText('URL do binário');
    expect(field).toHaveAttribute('type', 'password');
    await user.clear(field);
    await user.type(field, 'https://driver.invalid/other');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      await screen.findByRole('heading', { name: 'Descartar alterações do driver?' }),
    ).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('translates open validation errors without exposing URL data or sending a write', async () => {
    const user = userEvent.setup();
    const { showLocale } = mount();
    vi.mocked(api).mockResolvedValueOnce({
      id: 'machineDriver',
      collectionMethods: ['GET', 'POST'],
      resourceFields: {
        url: { create: true },
        uiUrl: { create: true },
        checksum: { create: true },
        description: { create: true },
        activateOnCreate: { create: true },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Adicionar driver' }));
    const url = 'https://example.invalid/driver#synthetic-private';
    await user.type(screen.getByLabelText('URL do binário'), url);
    await user.click(screen.getByRole('button', { name: 'Revisar driver' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Use URL HTTP ou HTTPS sem usuário, senha ou fragmento.');
    expect(api).toHaveBeenCalledExactlyOnceWith(
      'schemas/machineDriver',
      undefined,
      undefined,
      expect.any(AbortSignal),
    );

    showLocale('en-US');
    expect(
      screen.getByText('Use an HTTP or HTTPS URL without a username, password, or fragment.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/synthetic-private/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Binary URL')).toHaveValue(url);
  });
});
