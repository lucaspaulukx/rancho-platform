import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import contract from './fixtures/webhook-schema.json';
import { Webhooks } from '../pages/Webhooks';
import { I18nProvider, useI18n } from '../i18n/provider';
import { api, type Resource } from '../api';
const backend = vi.hoisted(() => ({
  readonly: false,
  revoked: false,
  records: [] as Resource[],
  posts: [] as unknown[],
}));
const service = {
  id: '1s1',
  type: 'service',
  name: 'target',
  accountId: '1a12',
  state: 'active',
  links: {},
  environment: { PASSWORD: 'synthetic-private-service' },
} as Resource;
vi.mock('../state', () => ({
  useApp: () => ({
    identity: '1a1',
    project: { id: '1a12', name: 'Lab' },
    admin: true,
    config: { modules: { webhooks: true, unsavedChangesGuard: true } },
  }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  allPages: vi.fn(async () => [structuredClone(service)]),
  api: vi.fn(async (path: string, body?: Record<string, unknown>, method?: string) => {
    if (path.startsWith('/v1-webhooks/schemas?')) return { data: Object.values(contract) };
    if (path.startsWith('localAccessReports?'))
      return {
        data: [
          {
            accountId: '1',
            projectId: '12',
            complete: true,
            effectiveRole: backend.readonly || backend.revoked ? 'readonly' : 'owner',
          },
        ],
      };
    if (method === 'POST') {
      backend.posts.push(body);
      const value = {
        ...body,
        id: '1wh1',
        type: 'receiver',
        state: 'active',
        links: {},
        url: 'http://localhost:18090/v1-webhooks/endpoint?key=synthetic-private-webhook&projectId=1a12',
      } as Resource;
      backend.records = [value];
      return structuredClone(value);
    }
    if (method === 'DELETE') {
      backend.posts.push({ delete: true });
      backend.records = [];
      return {};
    }
    if (path === '/v1-webhooks/receivers?projectId=1a12')
      return { data: structuredClone(backend.records) };
    if (path === '/v1-webhooks/receivers/1wh1?projectId=1a12')
      return structuredClone(backend.records[0]);
    throw new Error('Unexpected webhook request');
  }),
}));
function SwitchLanguage() {
  const { setLocale } = useI18n();
  return <button onClick={() => setLocale('en-US')}>English</button>;
}
function mount(localized = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    router = createMemoryRouter([{ path: '/', element: <Webhooks /> }]);
  render(
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={
          localized
            ? {
                enabled: true,
                defaultLocale: 'pt-BR',
                availableLocales: ['pt-BR', 'en-US'],
                selectable: true,
                detectBrowser: false,
                preview: true,
              }
            : undefined
        }
      >
        {localized && <SwitchLanguage />}
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return client;
}
function cached(client: QueryClient) {
  return JSON.stringify([
    ...client
      .getQueryCache()
      .getAll()
      .map((q) => q.state.data),
    ...client
      .getMutationCache()
      .getAll()
      .map((q) => q.state.data),
  ]);
}
async function review() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Criar webhook' }));
  await user.type(screen.getByLabelText('Nome do webhook'), 'fixture');
  await user.selectOptions(screen.getByLabelText('Serviço de destino'), '1s1');
  await user.click(screen.getByRole('button', { name: 'Revisar webhook' }));
  await screen.findByRole('dialog', { name: 'Criar webhook?' });
  return user;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('rancho.console.locale.anonymous');
  backend.readonly = false;
  backend.revoked = false;
  backend.records = [];
  backend.posts = [];
});
describe('Tela de webhooks', () => {
  it('cria com revisão e segredo privado mascarado sem consultar a URL de invocação', async () => {
    const client = mount(),
      user = await review();
    expect(backend.posts).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByLabelText('URL de invocação');
    expect(screen.getByLabelText('URL de invocação')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Copiar URL' }));
    expect(await navigator.clipboard.readText()).toContain('synthetic-private-webhook');
    expect(cached(client)).not.toContain('synthetic-private');
    expect(vi.mocked(api).mock.calls.some(([path]) => path.includes('/endpoint'))).toBe(false);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
      'synthetic-private',
    );
  });
  it('limpa a URL privada quando o relatório atualizado revoga o gerenciamento', async () => {
    const client = mount(),
      user = await review();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByLabelText('URL de invocação');
    backend.revoked = true;
    client.setQueryData(['data', '1a1', 'project', '1a12', 'webhook-access'], {
      accountId: '1',
      projectId: '12',
      complete: true,
      effectiveRole: 'readonly',
    });
    await waitFor(() =>
      expect(screen.queryByLabelText('URL de invocação')).not.toBeInTheDocument(),
    );
  });
  it('readonly não recebe ações mesmo quando o schema anuncia POST/DELETE', async () => {
    backend.readonly = true;
    mount();
    await screen.findByText(
      'Seu perfil pode consultar os metadados disponíveis. Criação, clonagem, exclusão e URL exigem acesso de gerenciamento comprovado.',
    );
    expect(screen.queryByRole('button', { name: 'Criar webhook' })).not.toBeInTheDocument();
  });
  it('permissão revogada depois da revisão bloqueia POST e preserva rascunho', async () => {
    mount();
    const user = await review();
    backend.revoked = true;
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Seu acesso não permite gerenciar webhooks neste environment.');
    expect(backend.posts).toHaveLength(0);
    expect(screen.getByLabelText('Nome do webhook')).toHaveValue('fixture');
  });
  it('clonagem consulta configuração separadamente sem reapresentar URL antiga', async () => {
    backend.records = [
      {
        id: '1wh1',
        type: 'receiver',
        name: 'original',
        driver: 'scaleService',
        state: 'active',
        links: {},
        url: 'http://localhost:18090/v1-webhooks/endpoint?key=synthetic-private-webhook&projectId=1a12',
        scaleServiceConfig: {
          type: 'scaleService',
          serviceId: '1s1',
          action: 'up',
          amount: 2,
          min: 1,
          max: 10,
        },
      },
    ];
    const client = mount(),
      user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ações do webhook original' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clonar configuração' }));
    await screen.findByLabelText('Nome do webhook');
    expect(screen.getByLabelText('Nome do webhook')).toHaveValue('original - cópia');
    expect(screen.getByLabelText('Quantidade por evento')).toHaveValue('2');
    expect(screen.queryByLabelText('URL de invocação')).not.toBeInTheDocument();
    expect(cached(client)).not.toContain('synthetic-private');
  });
  it('seletor exige chaves únicas e não colapsa duplicatas silenciosamente', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Criar webhook' }));
    await user.type(screen.getByLabelText('Nome do webhook'), 'fixture');
    await user.selectOptions(screen.getByLabelText('Função do webhook'), 'scaleHost');
    await user.click(screen.getByRole('button', { name: 'Adicionar label' }));
    await user.type(screen.getByLabelText('Label 1: chave'), 'fixture');
    await user.click(screen.getByRole('button', { name: 'Adicionar label' }));
    await user.type(screen.getByLabelText('Label 2: chave'), 'fixture');
    await user.click(screen.getByRole('button', { name: 'Revisar webhook' }));
    await screen.findAllByText('Revise labels válidas, sem repetição de chaves.');
    expect(backend.posts).toHaveLength(0);
  });
  it('traduz validação numérica com o rascunho aberto sem reenviar', async () => {
    mount(true);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Criar webhook' }));
    await user.type(screen.getByLabelText('Nome do webhook'), 'fixture');
    await user.selectOptions(screen.getByLabelText('Serviço de destino'), '1s1');
    const amount = screen.getByLabelText('Quantidade por evento');
    await user.clear(amount);
    await user.type(amount, '1.5');
    await user.click(screen.getByRole('button', { name: 'Revisar webhook' }));
    expect(
      await screen.findAllByText('Quantidade por evento deve ser um inteiro positivo.'),
    ).not.toHaveLength(0);

    const requests = vi.mocked(api).mock.calls.length;
    fireEvent.click(screen.getByText('English'));
    expect(screen.getAllByText('Amount per event must be a positive integer.')).not.toHaveLength(0);
    expect(screen.getByLabelText('Amount per event')).toBe(amount);
    expect(amount).toHaveValue('1.5');
    expect(vi.mocked(api)).toHaveBeenCalledTimes(requests);
    expect(backend.posts).toHaveLength(0);
  });
  it('fechamento de rascunho exige descarte e reload é protegido', async () => {
    mount();
    const user = await review();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await screen.findByRole('dialog', { name: 'Descartar webhook não salvo?' });
    expect(backend.posts).toHaveLength(0);
  });
});
