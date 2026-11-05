import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { OperationsPage } from '../pages/Operations';
import type { Resource } from '../api';

const fixture = vi.hoisted(() => ({
  project: { id: 'p1', name: 'Laboratório' },
  identity: 'admin',
  readonly: false,
  config: {
    modules: {
      workloads: true,
      contextActions: true,
      observability: true,
      metrics: true,
      bulkActions: true,
    },
  },
  unmounted: [] as string[],
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
          links: {},
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
    selection: { resource: Resource; action?: string };
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Operação do recurso">
      {selection.action}
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
describe('Workspace unificado', () => {
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
