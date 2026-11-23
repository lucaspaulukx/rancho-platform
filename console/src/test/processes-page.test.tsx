import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Processes } from '../pages/Processes';
import { api, type Resource, type Schema } from '../api';
const backend = vi.hoisted(() => ({
  admin: true,
  enabled: true,
  replay: true,
  changed: false,
  denied: false,
  posts: 0,
}));
const row = {
  id: '1pi1',
  type: 'processInstance',
  processName: 'credential.update',
  resourceType: 'credential',
  resourceId: '1c1',
  phase: 'DONE',
  executionCount: 1,
  startTime: '2026-10-22T12:00:00Z',
  endTime: '2026-10-22T12:00:01Z',
  exitReason: 'DONE',
  data: { secret: 'synthetic-private' },
  result: 'synthetic-private',
  links: { self: '/v2-beta/processinstances/1pi1' },
  actions: { replay: '/v2-beta/processinstances/1pi1/?action=replay' },
} as Resource;
const schema: Schema = {
  id: 'processInstance',
  pluralName: 'processInstances',
  links: {},
  resourceFields: {},
  resourceMethods: ['GET'],
  resourceActions: { replay: {} },
};
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    admin: backend.admin,
    config: {
      modules: {
        processes: backend.enabled,
        processReplay: backend.replay,
        unsavedChangesGuard: true,
      },
    },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({ data: { processInstance: schema } }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  api: vi.fn(async (path: string, _body?: unknown, method?: string) => {
    if (path === 'schemas/processInstance')
      return { ...schema, resourceActions: backend.denied ? {} : schema.resourceActions };
    if (method === 'POST') {
      backend.posts++;
      return structuredClone(row);
    }
    if (path === 'processinstances/1pi1')
      return { ...structuredClone(row), executionCount: backend.changed ? 2 : 1 };
    if (path.startsWith('/v2-beta/processinstances?'))
      return { data: [structuredClone(row)], pagination: {} };
    throw new Error('Unexpected process request');
  }),
}));
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Processes />
    </QueryClientProvider>,
  );
  return client;
}
async function review() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Detalhes do processo 1pi1' }));
  await user.click(screen.getByRole('button', { name: 'Reexecutar processo' }));
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(backend, {
    admin: true,
    enabled: true,
    replay: true,
    changed: false,
    denied: false,
    posts: 0,
  });
});
describe('Tela de processos', () => {
  it('DTO remove payloads/resultados também no cache e detalhes', async () => {
    const client = mount();
    await review();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
    expect(screen.queryByText('synthetic-private')).not.toBeInTheDocument();
  });
  it('replay confirma e revalida contrato/recurso antes de POST sem guardar resposta bruta', async () => {
    const client = mount(),
      user = await review();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(backend.posts).toBe(1));
    expect(api).toHaveBeenCalledWith(
      'schemas/processInstance',
      undefined,
      undefined,
      expect.any(AbortSignal),
    );
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
  });
  it.each(['changed', 'denied'] as const)(
    'recusa %s depois da confirmação sem enviar replay',
    async (kind) => {
      mount();
      const user = await review();
      backend[kind] = true;
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));
      await screen.findByText(
        kind === 'changed'
          ? 'O processo mudou. Atualize e revise novamente.'
          : 'O replay não está mais disponível.',
      );
      expect(backend.posts).toBe(0);
    },
  );
  it('flag de replay desliga somente a mutação', async () => {
    backend.replay = false;
    mount();
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Detalhes do processo 1pi1' }));
    expect(screen.queryByRole('button', { name: 'Reexecutar processo' })).not.toBeInTheDocument();
  });
  it.each(['admin', 'enabled'] as const)('não consulta processos sem %s', (kind) => {
    backend[kind] = false;
    mount();
    expect(screen.getByText('Processos indisponíveis neste acesso.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
