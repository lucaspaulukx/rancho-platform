import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogRepositories } from '../pages/CatalogRepositories';
import { api } from '../api';
const state = vi.hoisted(() => ({ admin: true, enabled: true }));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    admin: state.admin,
    config: { modules: { catalogRepositories: state.enabled, unsavedChangesGuard: true } },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: { setting: { resourceFields: { value: { update: true } } } } }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({ ...(await vi.importActual('../api')), api: vi.fn() }));
const raw = {
  id: 'catalog.url',
  name: 'catalog.url',
  type: 'activeSetting',
  baseType: 'setting',
  source: 'Default',
  inDb: false,
  value: null,
  activeValue: JSON.stringify({
    catalogs: {
      library: { url: 'https://git.invalid/?token=synthetic-private', branch: 'master' },
    },
  }),
  links: { self: '/v2-beta/settings/catalog.url' },
};
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <CatalogRepositories /> }]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { admin: true, enabled: true });
  vi.mocked(api).mockResolvedValue(raw);
});
describe('Editor administrativo de repositórios', () => {
  it('não guarda URLs no cache da listagem', async () => {
    const client = mount();
    await screen.findByText('library');
    expect(
      JSON.stringify(client.getQueryData(['data', 'admin', 'catalog-repositories'])),
    ).not.toContain('synthetic-private');
  });
  it.each(['admin', 'enabled'] as const)('nega acesso sem %s', (key) => {
    state[key] = false;
    mount();
    expect(screen.getByText('Repositórios indisponíveis neste acesso.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
  it('abre URL mascarada, adiciona linha estável e protege descarte', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('library');
    await user.click(screen.getByRole('button', { name: 'Configurar repositórios' }));
    expect(await screen.findByLabelText('URL do repositório 1')).toHaveAttribute(
      'type',
      'password',
    );
    await user.click(screen.getByRole('button', { name: 'Adicionar repositório' }));
    await user.type(screen.getByLabelText('Nome do repositório 2'), 'fixture');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      await screen.findByRole('heading', { name: 'Descartar alterações dos repositórios?' }),
    ).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(2);
  });
  it('exige aceite explícito se todas as entradas forem removidas', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText('library');
    await user.click(screen.getByRole('button', { name: 'Configurar repositórios' }));
    await user.click(await screen.findByRole('button', { name: 'Remover repositório 1' }));
    expect(
      screen.getByLabelText('Confirmo remover todos os repositórios globais'),
    ).not.toBeChecked();
  });
});
