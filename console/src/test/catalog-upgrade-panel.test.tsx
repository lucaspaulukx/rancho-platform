import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { CatalogUpgrade, QuestionField } from '../pages/Catalog';
import type { Resource } from '../api';

const backend = vi.hoisted(() => ({
  stack: {} as Resource,
  readonly: false,
  posts: [] as Record<string, unknown>[],
}));
const schema = {
  id: 'stack',
  links: { collection: '/stacks', self: '/schema' },
  resourceMethods: ['GET', 'PUT'],
  collectionMethods: ['GET', 'POST'],
  resourceActions: { upgrade: { input: 'stackUpgrade' } },
  resourceFields: { name: { type: 'string' } },
};
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    project: { id: 'p1', name: 'Lab', orchestration: 'cattle' },
  }),
  useDataKey: (...parts: unknown[]) => ['data', 'admin', 'p1', ...parts],
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: { stack: schema } }),
  canManageResource: (value: { resourceMethods?: string[] }) =>
    !!value?.resourceMethods?.includes('PUT'),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => {
  const original = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...original,
    api: vi.fn(async (path: string, payload?: Record<string, unknown>, method?: string) => {
      if (method === 'POST') {
        backend.posts.push(payload!);
        return { ...backend.stack, externalId: payload!.externalId };
      }
      if (path === '/stack')
        return structuredClone({
          ...backend.stack,
          actions: backend.readonly ? {} : { upgrade: '/upgrade' },
        });
      if (path.endsWith('/schemas/stack')) return schema;
      if (path.startsWith('/v1-catalog/templates/'))
        return {
          id: 'community:demo',
          type: 'template',
          name: 'Demo',
          links: { self: path },
          defaultVersion: 'v2',
          versionLinks: {
            v1: '/v1-catalog/templateversions/community:demo:0',
            v2: '/v1-catalog/templateversions/community:demo:1',
          },
        };
      if (path.startsWith('/v1-catalog/templateversions/'))
        return {
          id: path.endsWith(':0') ? 'community:demo:0' : 'community:demo:1',
          templateId: 'community:demo',
          version: path.endsWith(':0') ? 'v1' : 'v2',
          type: 'templateVersion',
          links: { self: path },
          files: { 'docker-compose.yml': 'services: {}' },
          questions: [
            { variable: 'replicas', label: 'Réplicas', type: 'int', required: true, default: 1 },
          ],
        };
      throw new Error('Unexpected test request');
    }),
  };
});
function mount() {
  const updated = vi.fn(),
    close = vi.fn(),
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <CatalogUpgrade
          stack={structuredClone(backend.stack)}
          onClose={close}
          onUpdated={updated}
        />
      ),
    },
  ]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { updated, client, router };
}
beforeEach(() => {
  backend.stack = {
    id: 'st1',
    type: 'stack',
    name: 'Loja',
    accountId: 'p1',
    externalId: 'catalog://community:demo:0',
    environment: { replicas: '2' },
    links: { self: '/stack' },
    actions: { upgrade: '/upgrade' },
  };
  backend.readonly = false;
  backend.posts = [];
});
describe('Painel de upgrade do catálogo', () => {
  it('mantém chave multilinha oculta até revelar explicitamente, preservando quebras de linha', async () => {
    const secret = 'synthetic-private-content\nsecond-line';
    render(
      <QuestionField
        question={{ variable: 'consul1_key', label: 'Chave de teste', type: 'multiline' }}
        value={secret}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar para editar' }));
    expect(screen.getByLabelText('Chave de teste')).toHaveValue(secret);
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar conteúdo' }));
    expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
  });
  it('mantém a stack e suas respostas, seleciona outra versão e envia somente upgrade', async () => {
    const { updated, router, client } = mount();
    await screen.findByLabelText('Réplicas *');
    expect(screen.getByLabelText('Réplicas *')).toHaveValue(2);
    expect(screen.getByLabelText('Nome da stack *')).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Versão do template'), 'v2');
    await waitFor(() => expect(screen.getByLabelText('Réplicas *')).toHaveValue(2));
    await userEvent.clear(screen.getByLabelText('Réplicas *'));
    await userEvent.type(screen.getByLabelText('Réplicas *'), '3');
    await userEvent.click(screen.getByRole('checkbox', { name: /Autorizo recriar/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar stack' }));
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    expect(backend.posts).toEqual([
      {
        externalId: 'catalog://community:demo:1',
        environment: { replicas: 3 },
        dockerCompose: 'services: {}',
      },
    ]);
    expect(updated.mock.calls[0][0].id).toBe('st1');
    router.dispose();
    client.clear();
  });
  it('recusa sobrescrever a configuração alterada enquanto o painel estava aberto', async () => {
    const { router, client } = mount();
    await screen.findByLabelText('Réplicas *');
    backend.stack = { ...backend.stack, environment: { replicas: '9' } };
    await userEvent.click(screen.getByRole('checkbox', { name: /Autorizo recriar/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar stack' }));
    await screen.findByText(/alterada por outro cliente/);
    expect(backend.posts).toHaveLength(0);
    router.dispose();
    client.clear();
  });
  it('não abre o editor nem envia mutação quando a action foi revogada', async () => {
    backend.readonly = true;
    const { router, client } = mount();
    await screen.findByText(/não está disponível neste estado/);
    expect(screen.queryByRole('button', { name: 'Atualizar stack' })).not.toBeInTheDocument();
    expect(backend.posts).toHaveLength(0);
    router.dispose();
    client.clear();
  });
  it('exige aceite explícito do impacto e o retira ao mudar parâmetros', async () => {
    const { router, client } = mount();
    await screen.findByLabelText('Réplicas *');
    const submit = screen.getByRole('button', { name: 'Atualizar stack' });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /Autorizo recriar/ }));
    expect(submit).toBeEnabled();
    await userEvent.clear(screen.getByLabelText('Réplicas *'));
    expect(screen.getByRole('checkbox', { name: /Autorizo recriar/ })).not.toBeChecked();
    expect(submit).toBeDisabled();
    expect(backend.posts).toHaveLength(0);
    router.dispose();
    client.clear();
  });
});
