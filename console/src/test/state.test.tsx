import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from '../state';
import { AppShell } from '../layouts';
import { Overview } from '../pages/Resources';
import configuration from '../../public/console-config.json';
import { api } from '../api';

function setup(
  enabled: boolean,
  overview = false,
  sessionState = false,
  profile?: { groups: boolean; backendGroups: boolean; noProjects?: boolean },
) {
  const fetcher = vi.fn(async (input: string) => {
    if (input === '/console/console-config.json')
      return Response.json({
        ...configuration,
        enabled,
        modules: {
          ...configuration.modules,
          workloads: false,
          hosts: false,
          groups: profile?.groups ?? configuration.modules.groups,
        },
      });
    if (input === '/oidc/config')
      return Response.json({
        version: 1,
        effective: { LOCAL_RBAC_ENABLED: profile?.backendGroups ?? false },
        available: {},
      });
    if (input === '/v2-beta/token')
      return Response.json({
        data: [
          {
            accountId: profile ? null : '1a1',
            userType: 'admin',
            userIdentity: { externalId: '1' },
          },
        ],
      });
    if (input === '/v2-beta/projects?limit=100')
      return Response.json({
        data: profile?.noProjects ? [] : [{ id: '1a7', name: 'DEV', state: 'active' }],
      });
    if (input === '/v2-beta/localAccessReports?targetAccount=self&targetEnvironment=1a7')
      return Response.json({
        data: [
          {
            accountId: '1',
            projectId: '7',
            effectiveRole: 'owner',
            complete: true,
            identityScope: 'local',
            sources: [{ kind: 'globalAdmin', role: 'owner' }],
          },
        ],
      });
    throw new Error('Unexpected request: ' + input);
  });
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Inspector() {
    const app = useApp();
    if (profile) return <AppShell />;
    return overview ? (
      <Overview />
    ) : (
      <p>
        {sessionState
          ? app.authenticated
            ? 'Autenticada'
            : 'Sessão encerrada'
          : app.config.enabled
            ? 'Ativa'
            : 'Desativada'}
      </p>
    );
  }
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppProvider>
          <Inspector />
        </AppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { fetcher, client, view };
}
describe('Configuração e escopo da console', () => {
  it('usa self autenticado pelo backend mesmo com accountId nulo no token GET', async () => {
    const { fetcher, client, view } = setup(true, false, false, {
      groups: true,
      backendGroups: true,
    });
    await screen.findByLabelText('Menu do usuário');
    await userEvent.click(screen.getByLabelText('Menu do usuário'));
    await userEvent.click(screen.getByRole('button', { name: 'Meu acesso' }));
    await screen.findByRole('heading', { name: 'Acesso efetivo · Minha conta' });
    await screen.findByRole('cell', { name: 'Proprietário' });
    expect(fetcher.mock.calls.map(([url]) => url)).toContain(
      '/v2-beta/localAccessReports?targetAccount=self&targetEnvironment=1a7',
    );
    expect(
      fetcher.mock.calls
        .map(([url]) => url)
        .some((url) => /localGroups|targetAccount=1a7/.test(url)),
    ).toBe(false);
    view.unmount();
    client.clear();
  });
  it.each([
    { groups: false, backendGroups: true },
    { groups: true, backendGroups: false },
    { groups: false, backendGroups: false },
    { groups: true, backendGroups: true, noProjects: true },
  ])('oculta o acesso próprio indisponível %j', async (profile) => {
    const { client, view } = setup(true, false, false, profile);
    await screen.findByLabelText('Menu do usuário');
    await userEvent.click(screen.getByLabelText('Menu do usuário'));
    expect(screen.queryByRole('button', { name: 'Meu acesso' })).not.toBeInTheDocument();
    view.unmount();
    client.clear();
  });
  it('revalida sessão após 401 de recurso e remove o cache da identidade expirada', async () => {
    const { fetcher, client, view } = setup(true, false, true);
    await screen.findByText('Autenticada');
    client.setQueryData(['data', '1a1', 'project', '1a7', 'private-fixture'], { name: 'fixture' });
    fetcher.mockImplementation(async () =>
      Response.json({ code: 'Unauthorized' }, { status: 401 }),
    );
    await expect(api('projects/1a7/containers')).rejects.toMatchObject({ status: 401 });
    await screen.findByText('Sessão encerrada');
    await waitFor(() =>
      expect(
        client.getQueryData(['data', '1a1', 'project', '1a7', 'private-fixture']),
      ).toBeUndefined(),
    );
    view.unmount();
    client.clear();
  });
  it('não consulta sessão ou recursos quando a console está desligada', async () => {
    const { fetcher, client, view } = setup(false);
    await screen.findByText('Desativada');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/console/console-config.json',
      '/oidc/config',
    ]);
    view.unmount();
    client.clear();
  });
  it('dashboard não consulta os domínios desativados', async () => {
    const { fetcher, client, view } = setup(true, true);
    await screen.findByRole('heading', { name: 'DEV' });
    await waitFor(() => expect(screen.getAllByText('Módulo desativado')).toHaveLength(3));
    expect(
      fetcher.mock.calls.map(([url]) => url).some((url) => /stacks|containers|hosts/.test(url)),
    ).toBe(false);
    view.unmount();
    client.clear();
  });
});
