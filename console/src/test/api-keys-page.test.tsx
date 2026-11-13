import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ApiKeys } from '../pages/ApiKeys';
import { allPages, api, ApiError, type Resource, type Schema } from '../api';
import { I18nProvider } from '../i18n/provider';
import type { Locale } from '../i18n/locales';
import { frFR } from '../i18n/catalogs/fr-FR';
const backend = vi.hoisted(() => ({
  records: [] as Resource[],
  contract: {} as Schema,
  revoked: false,
  failCreate: false,
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
      if (backend.failCreate) throw new ApiError(422, 'synthetic-sensitive-error');
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
  const view = (defaultLocale: Locale) => (
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={{
          enabled: true,
          defaultLocale,
          availableLocales: ['pt-BR', 'en-US', 'fr-FR'],
          selectable: false,
          detectBrowser: false,
          preview: true,
        }}
      >
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(view('pt-BR'));
  return { client, router, changeLocale: (locale: Locale) => rerender(view(locale)) };
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
  backend.failCreate = false;
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
    expect(screen.getByLabelText('Segredo da chave')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText('Chave de acesso')).toHaveAttribute('dir', 'ltr');
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
    const { changeLocale } = mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Criar chave' }));
    const name = screen.getByLabelText('Nome da chave');
    await user.type(name, 'automation');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    backend.revoked = true;
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('A criação de chaves não está disponível neste escopo.');
    changeLocale('en-US');
    expect(screen.getByText('Key creation is unavailable in this scope.')).toBeInTheDocument();
    expect(backend.posts).toHaveLength(0);
    expect(screen.getByLabelText('Key name')).toBe(name);
    expect(name).toHaveValue('automation');
  });
  it('shows a localized HTTP status and discards the raw create error', async () => {
    const { client, changeLocale } = mount();
    const user = userEvent.setup();
    backend.failCreate = true;
    await user.click(await screen.findByRole('button', { name: 'Criar chave' }));
    await user.type(screen.getByLabelText('Nome da chave'), 'automation');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Não foi possível concluir a solicitação de chave de API (HTTP 422).');
    changeLocale('en-US');
    expect(
      screen.getByText('Unable to complete the API key request (HTTP 422).'),
    ).toBeInTheDocument();
    const requests = vi.mocked(api).mock.calls.length;
    changeLocale('fr-FR');
    expect(
      await screen.findByText(frFR['apiKeys.httpFailed'].replace('{status}', '422')),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(frFR['apiKeys.name'])).toHaveValue('automation');
    expect(vi.mocked(api)).toHaveBeenCalledTimes(requests);
    expect(screen.queryByText('synthetic-sensitive-error')).not.toBeInTheDocument();
    const error = client.getMutationCache().getAll()[0].state.error;
    expect(error).toMatchObject({ status: 422, message: 'apiKeys.requestFailed' });
    expect(error?.cause).toBeUndefined();
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
