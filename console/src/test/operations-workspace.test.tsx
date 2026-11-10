import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { OperationsPage } from '../pages/Operations';
import type { Resource } from '../api';
import { I18nProvider, useI18n } from '../i18n/provider';

const fixture = vi.hoisted(() => ({
  project: { id: 'p1', name: 'Laboratório' },
  identity: 'admin',
  readonly: false,
  config: {
    workloadInventoryPagination: false,
    workloadTreePagination: false,
    modules: {
      workloads: true,
      contextActions: true,
      observability: true,
      metrics: true,
      serviceMetrics: false,
      bulkActions: true,
    },
  },
  unmounted: [] as string[],
  extraContainers: [] as Resource[],
}));
vi.mock('../state', () => ({ useApp: () => fixture }));
vi.mock('../hooks/useSchemas', () => ({
  canManageResource: (schema: { resourceMethods?: string[] } | undefined) =>
    !!schema?.resourceMethods?.includes('PUT'),
  useSchemas: () => ({
    isPending: false,
    data: Object.fromEntries(
      ['stack', 'service', 'container'].map((kind) => [
        kind,
        {
          id: kind,
          links: {},
          resourceFields: {},
          resourceMethods: fixture.readonly ? ['GET'] : ['GET', 'PUT'],
          collectionMethods: fixture.readonly ? ['GET'] : ['GET', 'POST'],
        },
      ]),
    ),
  }),
}));
vi.mock('../pages/Workloads', () => ({
  useWorkloadInventory: () => ({
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
    data: {
      stacks: [
        { id: 'st1', type: 'stack', accountId: 'p1', name: 'Loja', links: {}, state: 'active' },
      ],
      services: [
        {
          id: 's1',
          type: 'service',
          accountId: 'p1',
          stackId: 'st1',
          name: 'web',
          links: { instances: '/instances', containerStats: '/containerstats' },
          state: 'active',
          actions: { restart: 'restart' },
        },
      ],
      containers: [
        {
          id: 'c1',
          type: 'container',
          accountId: 'p1',
          serviceIds: ['s1'],
          name: 'web-1',
          links: {},
          state: 'running',
          healthState: 'healthy',
          actions: { logs: 'logs', execute: 'execute', restart: 'restart' },
        },
        {
          id: 'c2',
          type: 'container',
          accountId: 'p1',
          serviceIds: ['s1'],
          name: 'web-2',
          links: {},
          state: 'running',
          actions: { logs: 'logs', execute: 'execute' },
        },
        ...fixture.extraContainers,
      ],
    },
  }),
}));
vi.mock('../components/ResourceStream', () => ({
  ResourceStream: ({
    resource,
    context,
    onClose,
  }: {
    resource: Resource;
    context?: React.ReactNode;
    onClose: () => void;
  }) => {
    useEffect(
      () => () => {
        fixture.unmounted.push(resource.id);
      },
      [resource.id],
    );
    return (
      <div role="dialog" aria-label={`Logs de ${resource.name}`}>
        {context}
        <button onClick={onClose}>Fechar logs</button>
      </div>
    );
  },
}));
vi.mock('../components/ResourcePanel', () => ({
  ResourcePanel: ({
    selection,
    onClose,
  }: {
    selection: { resource: Resource; action?: string; mode?: string };
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Operação do recurso">
      {selection.action || selection.mode}
      <button onClick={onClose}>Fechar painel</button>
    </div>
  ),
}));
function mount() {
  const router = createMemoryRouter([{ path: '/', element: <OperationsPage /> }], {
    initialEntries: ['/?env=p1'],
  });
  render(<RouterProvider router={router} />);
  return router;
}
afterEach(() => {
  fixture.config.modules.serviceMetrics = false;
  fixture.config.workloadInventoryPagination = false;
  fixture.config.workloadTreePagination = false;
  fixture.extraContainers = [];
  fixture.readonly = false;
});
function addContainers(length = 50) {
  fixture.extraContainers = Array.from({ length }, (_, index) => ({
    id: `extra-${index + 3}`,
    name: `web-${index + 3}`,
    type: 'container',
    accountId: 'p1',
    serviceIds: ['s1'],
    links: {},
    state: 'running',
    actions: { restart: 'restart' },
  }));
}

describe('Workspace unificado', () => {
  it('bounds an expanded stack while keeping context and selection across pages', () => {
    fixture.config.workloadTreePagination = true;
    addContainers(105);
    const router = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }));
    const stack = screen.getByRole('region', { name: 'Stack Loja' });
    const containers = stack.querySelectorAll('.operation-row.container');
    expect(containers).toHaveLength(98);
    fireEvent.click(
      within(containers[0] as HTMLElement).getByRole('checkbox', { name: 'Selecionar web-1' }),
    );
    const pager = document.querySelector<HTMLElement>('.operation-tree > .table-footer')!;
    fireEvent.click(within(pager).getByRole('button', { name: 'Próxima página' }));

    const continuation = within(screen.getByRole('region', { name: 'Stack Loja' }));
    expect(continuation.getByRole('button', { name: 'web' })).toBeInTheDocument();
    expect(continuation.getAllByRole('button', { name: /^web-\d+$/ })).toHaveLength(9);
    expect(continuation.queryByRole('button', { name: 'web-1' })).not.toBeInTheDocument();
    expect(screen.getByText('1 recursos selecionados · limite 100')).toBeInTheDocument();
    fireEvent.click(continuation.getByRole('button', { name: 'Ações de web-107' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reiniciar' }));
    const dialog = screen.getByRole('dialog', { name: 'Operação do recurso' });
    expect(dialog).toHaveTextContent('restart');
    router.dispose();
  });

  it('paginates containers while preserving bulk selection and global search', async () => {
    fixture.config.workloadInventoryPagination = true;
    addContainers();
    const router = mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Containers' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Containers' }));
    expect(panel.getAllByRole('button', { name: /^web-\d+$/ })).toHaveLength(50);
    expect(panel.queryByRole('button', { name: 'web-52' })).not.toBeInTheDocument();
    await userEvent.click(panel.getByRole('checkbox', { name: 'Selecionar web-1' }));
    await userEvent.click(panel.getByRole('button', { name: 'Próxima página' }));
    expect(panel.getAllByRole('checkbox')).toHaveLength(2);
    expect(panel.getByText('1 recursos selecionados · limite 100')).toBeInTheDocument();
    await userEvent.click(panel.getByRole('checkbox', { name: 'Selecionar web-52' }));
    expect(panel.getByText('2 recursos selecionados · limite 100')).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Buscar na operação' });
    await userEvent.type(search, 'web-52');
    expect(panel.getByRole('button', { name: 'web-52' })).toBeInTheDocument();
    expect(panel.getAllByRole('checkbox')).toHaveLength(1);
    expect(panel.getByRole('checkbox', { name: 'Selecionar web-52' })).toBeChecked();
    expect(panel.queryByRole('button', { name: 'Próxima página' })).not.toBeInTheDocument();
    await userEvent.clear(search);
    expect(panel.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(panel.getByRole('checkbox', { name: 'Selecionar web-1' })).toBeChecked();
    expect(router.state.location.search).toBe('?env=p1&view=containers');
    router.dispose();
  });

  it('retains the continuous container list when pagination is disabled', async () => {
    addContainers();
    const router = mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Containers' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Containers' }));
    expect(panel.getAllByRole('button', { name: /^web-\d+$/ })).toHaveLength(52);
    expect(panel.queryByRole('button', { name: 'Próxima página' })).not.toBeInTheDocument();
    router.dispose();
  });

  it('translates workload states while retaining the active view, filter and native action', async () => {
    fixture.extraContainers = [
      {
        id: 'c3',
        type: 'container',
        accountId: 'p1',
        name: 'external-worker',
        links: {},
        state: 'provider-paused',
      },
    ];
    function SwitchLanguage() {
      const { setLocale } = useI18n();
      return <button onClick={() => setLocale('en-US')}>English</button>;
    }
    const router = createMemoryRouter([{ path: '/', element: <OperationsPage /> }], {
      initialEntries: ['/?env=p1'],
    });
    render(
      <I18nProvider
        policy={{
          enabled: true,
          preview: true,
          defaultLocale: 'pt-BR',
          availableLocales: ['pt-BR', 'en-US'],
          selectable: true,
          detectBrowser: false,
        }}
      >
        <SwitchLanguage />
        <RouterProvider router={router} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Containers' }));
    const panel = within(screen.getByRole('tabpanel', { name: 'Containers' }));
    expect(panel.getAllByText('Em execução')).toHaveLength(2);
    expect(panel.getByText('Saudável')).toBeInTheDocument();
    expect(panel.getByText('provider-paused')).toBeInTheDocument();
    const filter = screen.getByRole('combobox', { name: 'Estado' });
    const running = within(filter).getByRole('option', { name: 'Em execução' });
    expect(running).toHaveValue('running');
    await userEvent.selectOptions(filter, running);
    expect(panel.queryByText('provider-paused')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(router.state.location.search).toContain('view=containers');
    expect(router.state.location.search).toContain('state=running');
    expect(screen.getByRole('combobox', { name: 'State' })).toHaveValue('running');
    expect(panel.getAllByText('Running')).toHaveLength(2);
    expect(panel.getByText('Healthy')).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: /Actions.*web-1/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Restart' }));
    expect(screen.getByRole('dialog', { name: 'Operação do recurso' })).toHaveTextContent(
      'restart',
    );
    router.dispose();
  });
  it('oferece métricas no menu do serviço com flag ativa, inclusive para leitura, sem trocar a rota', async () => {
    fixture.config.modules.serviceMetrics = true;
    fixture.readonly = true;
    const router = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Ações de web' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Métricas' }));
    expect(screen.getByRole('dialog', { name: 'Operação do recurso' })).toHaveTextContent(
      'metrics',
    );
    expect(router.state.location.search).toBe('?env=p1');
    router.dispose();
  });
  it('abre logs pelo menu do serviço e troca container sem mudar URL ou perder a lista', async () => {
    const router = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Ações de web' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ver logs' }));
    expect(screen.getByRole('dialog', { name: 'Logs de web-1' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Container'), 'c2');
    expect(screen.getByRole('dialog', { name: 'Logs de web-2' })).toBeInTheDocument();
    expect(fixture.unmounted).toContain('c1');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar logs' }));
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?env=p1');
    expect(screen.getByRole('region', { name: 'Stack Loja' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerenciar web' })).not.toBeInTheDocument();
    router.dispose();
  });
  it('troca as visões localmente e abre lifecycle em painel', async () => {
    const router = mount();
    await userEvent.click(screen.getByRole('tab', { name: 'Containers' }));
    const panel = screen.getByRole('tabpanel', { name: 'Containers' });
    expect(within(panel).getByRole('button', { name: 'web-1' })).toBeInTheDocument();
    expect(within(panel).getAllByText('Loja')).toHaveLength(2);
    await userEvent.click(within(panel).getByRole('button', { name: 'Ações de web-1' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Reiniciar' }));
    expect(screen.getByRole('dialog', { name: 'Operação do recurso' })).toHaveTextContent(
      'restart',
    );
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toContain('view=containers');
    router.dispose();
  });
});
