import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { NetworkPolicies } from '../components/NetworkPolicies';

const context = vi.hoisted(() => ({
  identity: 'admin',
  config: { modules: { environments: true, networkPolicies: true } },
}));
vi.mock('../state', () => ({ useApp: () => context }));
function fixture(manager = false, revoked = false) {
  const writes: string[] = [];
  const network = {
    id: '1n18',
    type: 'network',
    name: 'ipsec',
    accountId: '1a12',
    state: 'active',
    defaultPolicyAction: 'allow',
    policy: null,
    links: { self: '/v2-beta/projects/1a12/networks/1n18' },
  };
  let schemaReads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      if (init.method !== 'GET') {
        writes.push(String(input));
        return Response.json(network);
      }
      if (String(input).endsWith('/schemas/network')) {
        schemaReads++;
        return Response.json({
          id: 'network',
          resourceMethods: revoked && schemaReads > 1 ? ['GET'] : ['GET', 'PUT'],
          resourceFields: { policy: { update: true }, defaultPolicyAction: { update: true } },
        });
      }
      if (String(input).includes('/stacks?'))
        return Response.json({
          data: manager
            ? [
                {
                  id: '1st2',
                  type: 'stack',
                  name: 'network-policy-manager',
                  accountId: '1a12',
                  state: 'active',
                  healthState: 'healthy',
                },
              ]
            : [],
        });
      if (String(input).endsWith('/networks')) return Response.json({ data: [network] });
      return Response.json(network);
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <NetworkPolicies project={{ id: '1a12', type: 'project', name: 'Test', links: {} }} />
      ),
    },
  ]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return writes;
}
describe('Painel de políticas nativas', () => {
  it.each(['environments', 'networkPolicies'] as const)(
    'não consulta nem exibe controles com %s desligado',
    (flag) => {
      context.config.modules[flag] = false;
      try {
        fixture();
        expect(
          screen.queryByRole('button', { name: 'Consultar políticas de rede' }),
        ).not.toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        context.config.modules[flag] = true;
      }
    },
  );
  it('não permite alterações sem gerenciador saudável e não envia POST ou PUT', async () => {
    const writes = fixture();
    await userEvent.click(screen.getByRole('button', { name: 'Consultar políticas de rede' }));
    expect(await screen.findByLabelText('Demais comunicações')).toBeDisabled();
    expect(screen.getByText(/network-policy-manager não está ativo/)).toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it('revalida a permissão depois da confirmação e bloqueia o envio revogado', async () => {
    const writes = fixture(true, true);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar políticas de rede' }));
    await userEvent.selectOptions(await screen.findByLabelText('Demais comunicações'), 'deny');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar alteração' }));
    expect(screen.getByRole('dialog', { name: 'Aplicar políticas de rede?' })).toHaveTextContent(
      'Permitir → Bloquear',
    );
    expect(writes).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('permissão');
    expect(writes).toEqual([]);
  });
  it('impede confirmar quando o usuário retorna aos valores originais', async () => {
    const writes = fixture(true);
    await userEvent.click(screen.getByRole('button', { name: 'Consultar políticas de rede' }));
    const field = await screen.findByLabelText('Demais comunicações');
    await userEvent.selectOptions(field, 'deny');
    await userEvent.selectOptions(field, 'allow');
    expect(screen.getByRole('button', { name: 'Revisar alteração' })).toBeDisabled();
    expect(writes).toEqual([]);
  });
});
