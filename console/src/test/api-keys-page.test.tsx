import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ApiKeys } from '../pages/ApiKeys';
import { allPages, type Resource, type Schema } from '../api';
const backend = vi.hoisted(() => ({
  records: [] as Resource[],
  contract: {} as Schema,
  revoked: false,
  posts: [] as unknown[],
  identity: 'admin',
}));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: backend.identity,
    project: { id: '1a12', name: 'Lab' },
    config: { modules: { apiKeys: true, unsavedChangesGuard: true } },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: { apiKey: backend.contract }, isPending: false }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  allPages: vi.fn(async () => structuredClone(backend.records)),
  api: vi.fn(async (path: string, payload?: Record<string, unknown>, method?: string) => {
    if (path.endsWith('schemas/apiKey'))
      return {
        ...structuredClone(backend.contract),
        ...(backend.revoked ? { collectionMethods: ['GET'], resourceMethods: ['GET'] } : {}),
      };
    if (method === 'POST' && path === '/keys') {
      backend.posts.push(payload);
      const row = {
        id: 'k1',
        type: 'apiKey',
        accountId: '1a1',
        name: payload!.name,
        description: payload!.description,
        state: 'active',
        publicValue: 'synthetic-public',
        secretValue: 'synthetic-private-value',
        links: { self: '/keys/k1' },
        actions: { deactivate: '/deactivate', remove: '/remove' },
      } as Resource;
      backend.records = [row];
      return structuredClone(row);
    }
    if (method === 'PUT') {
      backend.posts.push(payload);
      backend.records[0] = { ...backend.records[0], ...payload };
      return structuredClone(backend.records[0]);
    }
    if (method === 'POST' && path === '/deactivate') {
      backend.posts.push(payload);
      backend.records[0] = {
        ...backend.records[0],
        state: 'inactive',
        actions: { activate: '/activate', remove: '/remove' },
      };
      return structuredClone(backend.records[0]);
    }
    if (path === '/keys/k1') return structuredClone(backend.records[0]);
    throw new Error('Unexpected API key test request: ' + path);
  }),
}));
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/', element: <ApiKeys /> }]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}
function cached(client: QueryClient) {
  return JSON.stringify([
    ...client
      .getQueryCache()
      .getAll()
      .map((v) => v.state.data),
    ...client
      .getMutationCache()
      .getAll()
      .map((v) => v.state.data),
  ]);
}
async function create() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Criar chave' }));
  await user.type(screen.getByLabelText('Nome da chave'), 'automation');
  await user.click(screen.getByRole('button', { name: 'Revisar' }));
  await user.click(screen.getByRole('button', { name: 'Confirmar' }));
  await screen.findByLabelText('Segredo da chave');
  return user;
}
beforeEach(() => {
  backend.identity = 'admin';
  backend.records = [];
  backend.posts = [];
  backend.revoked = false;
  backend.contract = {
    id: 'apiKey',
    pluralName: 'apiKeys',
    links: { collection: '/keys' },
    collectionMethods: ['GET', 'POST'],
    resourceMethods: ['GET', 'PUT', 'DELETE'],
    resourceFields: {
      name: { type: 'string', create: true, update: true },
      description: { type: 'string', create: true, update: true },
      secretValue: { type: 'password', create: true },
      accountId: { type: 'reference[account]', create: true },
    },
    resourceActions: { deactivate: {}, remove: {}, activate: {} },
  };
});
describe('Tela de chaves de API', () => {
  it('consulta removidas com a opção nativa explícita, sem misturar a lista atual', async () => {
    mount();
    await screen.findByRole('button', { name: 'Criar chave' });
    await userEvent.setup().selectOptions(screen.getByLabelText('Situação das chaves'), 'removed');
    await waitFor(() =>
      expect(allPages).toHaveBeenCalledWith(
        '/keys?_removed=true&removed_notnull=true&limit=100',
        expect.any(AbortSignal),
      ),
    );
  });
  it('mantém segredo privado, copia somente por ação explícita e remove a exibição após concluir', async () => {
    const { client } = mount(),
      user = await create();
    expect(screen.getByLabelText('Segredo da chave')).toHaveAttribute('type', 'password');
    expect(cached(client)).not.toContain('synthetic-private');
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeDisabled();
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Copiar segredo' }));
    expect(copy).toHaveBeenCalledWith('synthetic-private-value');
    await user.click(screen.getByRole('button', { name: 'Mostrar segredo' }));
    expect(screen.getByLabelText('Segredo da chave')).toHaveAttribute('type', 'text');
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Guardei a credencial ou aceito perder a visualização do segredo',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(screen.queryByLabelText('Segredo da chave')).not.toBeInTheDocument();
    expect(cached(client)).not.toContain('synthetic-private');
  });
  it('protege fechar sem guardar e não recria a chave ao dispensar o aviso', async () => {
    mount();
    const user = await create();
    await user.click(screen.getByRole('button', { name: 'Fechar diálogo' }));
    await screen.findByText('Fechar sem guardar o segredo?');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Segredo da chave')).toBeInTheDocument();
    expect(backend.posts).toHaveLength(1);
  });
  it('protege reload enquanto há segredo disponível, sem gravar segredo no storage', async () => {
    mount();
    await create();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
      'synthetic-private',
    );
  });
  it('recusa permissão de criação revogada depois da revisão', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Criar chave' }));
    await user.type(screen.getByLabelText('Nome da chave'), 'automation');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    backend.revoked = true;
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('A criação de chaves não está disponível neste escopo.');
    expect(backend.posts).toHaveLength(0);
    expect(screen.getByLabelText('Nome da chave')).toHaveValue('automation');
  });
  it('dados secretos recebidos na listagem também não entram no cache', async () => {
    backend.records = [
      {
        id: 'k1',
        type: 'apiKey',
        accountId: '1a1',
        name: 'existing',
        state: 'active',
        secretValue: 'synthetic-private-list',
        links: { self: '/keys/k1' },
      },
    ];
    const { client } = mount();
    await screen.findByText('existing');
    expect(cached(client)).not.toContain('synthetic-private');
    expect(screen.queryByLabelText('Segredo da chave')).not.toBeInTheDocument();
  });
  it('revalida recurso e contrato antes de desativar uma chave', async () => {
    backend.records = [
      {
        id: 'k1',
        type: 'apiKey',
        accountId: '1a1',
        name: 'existing',
        state: 'active',
        secretValue: 'synthetic-private-list',
        links: { self: '/keys/k1' },
        actions: { deactivate: '/deactivate' },
      },
    ];
    const { client } = mount(),
      user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ações da chave existing' }));
    await user.click(screen.getByRole('menuitem', { name: 'Desativar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(backend.records[0].state).toBe('inactive'));
    expect(cached(client)).not.toContain('synthetic-private');
  });
});
