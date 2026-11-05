import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupEditor } from '../pages/Groups';
import { ToastProvider } from '../components/ui';
import { AccessDiagnostics, GroupAudit } from '../components/AccessDiagnostics';

vi.mock('../state', () => ({
  useApp: () => ({ identity: 'fixture', project: { id: '1a12' } }),
}));

const account = { id: '1a10', name: 'Leitor', kind: 'user', state: 'active' };
const projects = [{ id: '1a12', name: 'Operações', state: 'active' }];
function respond(value: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => value,
  } as Response);
}
function mount(element: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {element}
    </QueryClientProvider>,
  );
}

describe('Diagnóstico backend e snapshots de grupos', () => {
  it('mostra o papel do servidor sem deduzir precedência das fontes', async () => {
    respond({
      data: [
        {
          accountId: '10',
          projectId: '12',
          complete: true,
          identityScope: 'rancher_id',
          effectiveRole: 'owner',
          sources: [{ kind: 'group', groupId: 'fixture', name: 'Equipe', role: 'readonly' }],
        },
      ],
    });
    mount(<AccessDiagnostics account={account} projects={projects} onClose={vi.fn()} />);
    expect(await screen.findByText('Equipe')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('targetAccount=1a10&targetEnvironment=1a12'),
      expect.anything(),
    );
  });
  it('não apresenta diagnóstico parcial como papel efetivo completo', async () => {
    respond({
      data: [
        {
          accountId: '10',
          projectId: '12',
          complete: false,
          identityScope: 'rancher_id',
          effectiveRole: 'owner',
          sources: [],
        },
      ],
    });
    mount(<AccessDiagnostics account={account} projects={projects} onClose={vi.fn()} />);
    expect(await screen.findByText('Não determinado')).toBeInTheDocument();
    expect(screen.getByText(/Diagnóstico parcial/)).toBeInTheDocument();
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });
  it('rejeita diagnóstico retornado para outra conta', async () => {
    respond({
      data: [
        {
          accountId: '11',
          projectId: '12',
          complete: true,
          identityScope: 'rancher_id',
          effectiveRole: 'owner',
          sources: [],
        },
      ],
    });
    mount(<AccessDiagnostics account={account} projects={projects} onClose={vi.fn()} />);
    expect(await screen.findByText(/não corresponde à conta/)).toBeInTheDocument();
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });
  it('exibe os snapshots antes e depois do evento persistido', async () => {
    const before = {
      id: 'fixture',
      name: 'Nome anterior',
      revision: 1,
      members: ['10'],
      grants: { '12': 'readonly' },
    };
    respond({
      data: [
        {
          id: 'event-2',
          actorId: '1',
          groupId: 'fixture',
          operation: 'update',
          created: '2026-10-21T12:00:00Z',
          before,
          after: { ...before, name: 'Nome novo', revision: 2, members: [], grants: {} },
        },
      ],
    });
    mount(
      <GroupAudit
        group={{ id: 'fixture', name: 'Equipe', revision: 2, members: [], grants: {} }}
        users={[account]}
        projects={projects}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar evento event-2' }));
    const change = within(screen.getByRole('region', { name: 'Alteração auditada' }));
    expect(change.getByText('Nome anterior')).toBeInTheDocument();
    expect(change.getByText('Nome novo')).toBeInTheDocument();
    expect(change.getByText('Leitor')).toBeInTheDocument();
    expect(change.getByText(/Operações:/)).toBeInTheDocument();
  });
  it('permite revisar exclusão de grupo fora da listagem atual', async () => {
    respond({
      data: [
        {
          id: 'deleted-event',
          actorId: '1',
          groupId: 'removed-group',
          operation: 'delete',
          created: '2026-10-21T12:00:00Z',
          before: {
            id: 'removed-group',
            name: 'Grupo excluído',
            revision: 2,
            members: ['10'],
            grants: {},
          },
          after: null,
        },
      ],
    });
    mount(<GroupAudit users={[account]} projects={projects} onClose={vi.fn()} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Revisar evento deleted-event' }),
    );
    expect(screen.getByText('Grupo inexistente')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.not.stringContaining('groupId='),
      expect.anything(),
    );
  });
});

describe('Manutenção de vínculos de grupos', () => {
  it('permite remover vínculos indisponíveis sem permitir novas contas inativas', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <ToastProvider>
            <GroupEditor
              group={{
                id: 'g1',
                name: 'Operações',
                revision: 2,
                members: ['99'],
                grants: { '88': 'readonly' },
              }}
              users={[{ id: '1a10', name: 'Conta inativa', state: 'inactive', kind: 'user' }]}
              projects={[]}
              onClose={vi.fn()}
              onSaved={vi.fn()}
            />
          </ToastProvider>
        ),
      },
    ]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('Conta indisponível (99)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover vínculo da conta 99' }));
    expect(screen.queryByText('Conta indisponível (99)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Environments (1)' }));
    expect(screen.getByText('Environment indisponível (88)')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remover permissão do environment 88' }),
    );
    expect(screen.getByRole('tab', { name: 'Environments (0)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Revisão' }));
    expect(
      screen.getByText('Este grupo não concederá acesso a nenhum environment.'),
    ).toBeInTheDocument();
    router.dispose();
  });
});
