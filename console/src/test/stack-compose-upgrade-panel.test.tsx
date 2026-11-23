import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StackComposeUpgradePanel from '../components/StackComposeUpgradePanel';
import { api, ApiError, type Resource } from '../api';
const state = vi.hoisted(() => ({ readonly: false, enabled: true, source: true, fail: false }));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    project: { id: '1a12', name: 'Lab', orchestration: 'cattle' },
    config: {
      modules: { stackComposeUpgrades: state.enabled, workloads: true, unsavedChangesGuard: true },
    },
  }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({ ...(await vi.importActual('../api')), api: vi.fn() }));
const stack: Resource = {
  id: '1st2',
  type: 'stack',
  name: 'fixture',
  state: 'active',
  accountId: '1a12',
  links: { self: '/v2-beta/projects/1a12/stacks/1st2' },
  actions: {
    upgrade: '/v2-beta/projects/1a12/stacks/1st2?action=upgrade',
    exportconfig: '/v2-beta/projects/1a12/stacks/1st2?action=exportconfig',
  },
  dockerCompose: 'private original',
  environment: { TOKEN: 'synthetic-private' },
};
const permission = {
  id: 'stack',
  resourceActions: {
    upgrade: { input: 'stackUpgrade' },
    exportconfig: { input: 'composeConfigInput' },
  },
};
function mount() {
  const saved = vi.fn(),
    close = vi.fn(),
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    router = createMemoryRouter([
      {
        path: '/',
        element: <StackComposeUpgradePanel resource={stack} onSaved={saved} onClose={close} />,
      },
    ]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { saved, close, client };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { readonly: false, enabled: true, source: true, fail: false });
  vi.mocked(api).mockImplementation(async (path, body, method) => {
    if (state.fail) throw new ApiError(422, 'synthetic-private');
    if (path.endsWith('/schemas/stack'))
      return { ...permission, resourceActions: state.readonly ? {} : permission.resourceActions };
    if (path.endsWith('/schemas/stackUpgrade'))
      return {
        id: 'stackUpgrade',
        resourceFields: {
          dockerCompose: { type: 'string', create: true },
          rancherCompose: { type: 'string', create: true },
          environment: { type: 'map[string]', create: true },
        },
      };
    if (path.includes('action=exportconfig'))
      return {
        id: '',
        type: 'composeConfig',
        links: {},
        dockerComposeConfig:
          'services: {web: {image: alpine:3.20, environment: {TOKEN: synthetic-private}}}',
        rancherComposeConfig: 'services: {web: {scale: 0}}',
      };
    if (method === 'POST' && path.includes('action=upgrade'))
      return { ...stack, state: 'upgrading' };
    return { ...stack, dockerCompose: state.source ? stack.dockerCompose : '' };
  });
});
describe('Painel Compose existente', () => {
  it('carrega exportação somente em estado privado e oculta o conteúdo', async () => {
    const { client } = mount();
    await screen.findByRole('button', { name: 'Mostrar Docker Compose' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(JSON.stringify(client.getQueryCache().getAll())).not.toContain('synthetic-private');
  });
  it('preserva parâmetros, remascara revisão e não retorna segredo ao cache', async () => {
    const user = userEvent.setup(),
      { saved, client } = mount();
    await user.click(await screen.findByRole('button', { name: 'Mostrar Docker Compose' }));
    const field = screen.getByLabelText('Docker Compose');
    await user.clear(field);
    await user.type(field, 'services:\n  web:\n    image: alpine:3.19');
    await user.click(
      screen.getByLabelText('Entendo que o upgrade pode iniciar serviços e substituir containers'),
    );
    await user.click(screen.getByRole('button', { name: 'Revisar atualização' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    const call = vi.mocked(api).mock.calls.find((v) => v[0].includes('action=upgrade'));
    expect(call?.[1]).toHaveProperty('environment', stack.environment);
    expect(JSON.stringify(saved.mock.calls)).not.toContain('synthetic-private');
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((v) => v.state.data),
      ),
    ).not.toContain('synthetic-private');
  });
  it('flag desligada impede consulta e exportação do editor', async () => {
    state.enabled = false;
    mount();
    await screen.findByText('Editor Compose indisponível para esta stack.');
    expect(api).not.toHaveBeenCalled();
  });
  it('bloqueia exportação sem permissão de atualizar', async () => {
    state.readonly = true;
    mount();
    await screen.findByText('Sua permissão de exportar ou atualizar não está disponível.');
    expect(vi.mocked(api).mock.calls.some((v) => v[0].includes('action=exportconfig'))).toBe(false);
  });
  it('não trata stack sem Compose de origem como upgrade aplicado', async () => {
    state.source = false;
    mount();
    await screen.findByText('Esta stack não tem Compose de origem. Use os editores dos serviços.');
    expect(vi.mocked(api).mock.calls.some((v) => v[0].includes('action=upgrade'))).toBe(false);
  });
  it('falha sanitizada não expõe resposta nativa', async () => {
    state.fail = true;
    mount();
    await screen.findByText(/Operação Compose não concluída/);
    expect(screen.queryByText('synthetic-private')).not.toBeInTheDocument();
  });
  it('protege fechamento com arquivo editado', async () => {
    const user = userEvent.setup(),
      { close } = mount();
    await user.click(await screen.findByRole('button', { name: 'Mostrar Docker Compose' }));
    await user.type(screen.getByLabelText('Docker Compose'), 'changed');
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    await screen.findByRole('heading', { name: 'Descartar alterações Compose?' });
    expect(close).not.toHaveBeenCalled();
  });
});
