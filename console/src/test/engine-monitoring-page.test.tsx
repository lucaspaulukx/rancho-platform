import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClusterMonitoring, ProcessPools } from '../pages/EngineMonitoring';
import { Processes } from '../pages/Processes';
import { allPages, type Resource } from '../api';
import { faIR } from '../i18n/catalogs/fa-IR';
import { I18nProvider } from '../i18n/provider';
const state = vi.hoisted(() => ({ admin: true, cluster: true, pools: true }));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    admin: state.admin,
    config: {
      modules: {
        clusterMonitoring: state.cluster,
        processPools: state.pools,
        processes: true,
        processReplay: false,
        unsavedChangesGuard: true,
      },
    },
  }),
}));
vi.mock('../hooks/useSchemas', () => ({
  useSchemas: () => ({
    data: {
      processInstance: {
        id: 'processInstance',
        resourceFields: {},
        links: {},
        resourceMethods: ['GET'],
        resourceActions: {},
      },
    },
  }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  allPages: vi.fn(async (path: string) =>
    path.startsWith('clustermemberships')
      ? [
          {
            id: '1cm1',
            type: 'clusterMembership',
            links: {},
            uuid: 'node-1',
            heartbeat: Date.parse('2026-10-22T12:00:00Z'),
            config: JSON.stringify({
              advertiseAddress: '10.0.0.1',
              httpPort: 8080,
              clustered: true,
              password: 'synthetic-private',
            }),
          },
        ]
      : [
          {
            id: '',
            type: 'processPool',
            links: {},
            name: 'Executor',
            activeTasks: 0,
            poolSize: 1,
            minPoolSize: 1,
            maxPoolSize: 5,
            completedTasks: 10,
            rejectedTasks: 0,
            queueSize: 0,
            queueRemainingCapacity: 100,
            data: 'synthetic-private',
          },
        ],
  ),
  api: vi.fn(async () => ({
    data: [
      {
        id: '1pi1',
        type: 'processInstance',
        links: {},
        processName: 'credential.deactivate',
        resourceId: '1c1',
        resourceType: 'credential',
        phase: 'DONE',
      },
    ],
  })),
}));
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.admin = true;
  state.cluster = true;
  state.pools = true;
});
describe('Monitoramento de HA e pools', () => {
  it('membros só entram no cache após DTO e tabela recebe foco para rolagem', async () => {
    const client = mount(
      <I18nProvider
        policy={{
          enabled: true,
          preview: true,
          defaultLocale: 'pt-BR',
          availableLocales: ['pt-BR', 'fa-IR'],
          selectable: true,
          detectBrowser: false,
        }}
      >
        <ClusterMonitoring />
      </I18nProvider>,
    );
    const node = await screen.findByText('node-1');
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Atualizar membros automaticamente (5 s)' }),
    );
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
    const table = screen.getByRole('region', { name: 'Membros reportados do cluster' });
    expect(table).toHaveAttribute('tabindex', '0');
    table.focus();
    const requests = vi.mocked(allPages).mock.calls.length;
    const key = 'rancho.console.locale.anonymous';
    localStorage.setItem(key, JSON.stringify({ version: 1, locale: 'fa-IR' }));
    fireEvent(window, new StorageEvent('storage', { key }));
    expect(await screen.findByRole('region', { name: faIR['engineMonitoring.membersLabel'] })).toBe(
      table,
    );
    expect(table).toHaveFocus();
    expect(screen.getByText('node-1')).toBe(node);
    expect(screen.getByText(faIR['engineMonitoring.clusterNotice'])).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: faIR['engineMonitoring.autoMembers'] }),
    ).not.toBeChecked();
    expect(vi.mocked(allPages)).toHaveBeenCalledTimes(requests);
  });
  it('pools não mostram payloads livres nem controles de mutação', async () => {
    const client = mount(<ProcessPools />);
    await screen.findByText('Executor');
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('synthetic-private');
    expect(screen.getByText('Rejeitadas (acumulado)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Confirmar|Editar|Excluir/ }),
    ).not.toBeInTheDocument();
  });
  it('trocar de aba preserva filtro da lista de execuções', async () => {
    mount(<Processes />);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Detalhes do processo 1pi1' });
    await user.type(screen.getByLabelText('Nome do processo'), 'credential.deactivate');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await user.click(screen.getByRole('tab', { name: 'Pools do engine' }));
    await screen.findByText('Executor');
    await user.click(screen.getByRole('tab', { name: 'Execuções' }));
    expect(screen.getByLabelText('Nome do processo')).toHaveValue('credential.deactivate');
  });
  it.each(['admin', 'cluster'] as const)('não consulta HA sem %s', (kind) => {
    state[kind] = false;
    mount(<ClusterMonitoring />);
    expect(
      screen.getByText('Monitoramento do cluster indisponível neste acesso.'),
    ).toBeInTheDocument();
    expect(allPages).not.toHaveBeenCalled();
  });
  it('flag pools preserva a lista sem renderizar aba adicional', async () => {
    state.pools = false;
    mount(<Processes />);
    await screen.findByRole('button', { name: 'Detalhes do processo 1pi1' });
    expect(screen.queryByRole('tab', { name: 'Pools do engine' })).not.toBeInTheDocument();
  });
});
