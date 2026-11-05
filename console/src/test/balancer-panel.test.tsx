import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import BalancerRulesPanel from '../components/BalancerRulesPanel';
import type { Resource, Schema } from '../api';
const state = vi.hoisted(() => ({
  source: {} as Resource,
  schemas: [] as Schema[],
  puts: [] as Record<string, unknown>[],
  enabled: true,
}));
vi.mock('../state', () => ({
  useApp: () => ({
    identity: 'admin',
    project: { id: 'p1', name: 'Lab' },
    config: { modules: { balancerRulesEditor: state.enabled } },
  }),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  api: vi.fn(async (_path: string, payload?: Record<string, unknown>, method?: string) => {
    if (method === 'PUT') {
      state.puts.push(payload!);
      return { ...state.source, ...payload };
    }
    return structuredClone(state.source);
  }),
  allPages: vi.fn(async (path: string) => {
    if (path.endsWith('schemas')) return structuredClone(state.schemas);
    if (path.includes('stacks'))
      return [
        { id: 'st', accountId: 'p1', type: 'stack', name: 'Stack', state: 'active', links: {} },
      ];
    return [
      {
        id: 'svc',
        type: 'service',
        accountId: 'p1',
        stackId: 'st',
        name: 'Backend',
        state: 'inactive',
        links: {},
      },
    ];
  }),
}));
const schema = (id: string, fields: Record<string, string>): Schema => ({
  id,
  pluralName: id + 's',
  links: {},
  resourceMethods: ['GET', 'PUT'],
  resourceFields: Object.fromEntries(
    Object.entries(fields).map(([k, type]) => [k, { type, create: true, update: true }]),
  ),
});
function mount() {
  const saved = vi.fn(),
    close = vi.fn(),
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <BalancerRulesPanel
          resource={structuredClone(state.source)}
          onClose={close}
          onSaved={saved}
        />
      ),
    },
  ]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { saved, close, client };
}
beforeEach(() => {
  state.enabled = true;
  state.puts = [];
  state.schemas = [
    schema('loadBalancerService', { lbConfig: 'lbConfig', launchConfig: 'launchConfig' }),
    schema('lbConfig', { portRules: 'array[portRule]', config: 'string' }),
    schema('portRule', {
      protocol: 'enum',
      sourcePort: 'int',
      targetPort: 'int',
      serviceId: 'reference[service]',
      hostname: 'string',
      path: 'string',
      priority: 'int',
    }),
    schema('launchConfig', {
      imageUuid: 'string',
      ports: 'array[string]',
      expose: 'array[string]',
      environment: 'map[string]',
    }),
  ];
  state.source = {
    id: 'lb',
    type: 'loadBalancerService',
    name: 'Balancer',
    accountId: 'p1',
    stackId: 'st',
    state: 'inactive',
    links: { self: '/lb' },
    lbConfig: {
      config: 'private-synthetic-config',
      portRules: [
        { protocol: 'http', sourcePort: 8080, targetPort: 80, serviceId: 'svc', priority: 1 },
      ],
    },
    launchConfig: {
      imageUuid: 'docker:haproxy',
      ports: ['8080:8080/tcp'],
      environment: { SECRET: 'private-synthetic-environment' },
    },
  };
});
async function edit() {
  const user = userEvent.setup();
  await screen.findByLabelText('Porta de destino 1');
  await user.clear(screen.getByLabelText('Porta de destino 1'));
  await user.type(screen.getByLabelText('Porta de destino 1'), '8081');
  return user;
}
describe('Painel contextual do balanceador', () => {
  it('exige impacto, revisa antes/depois e envia somente regras/launchConfig sem cachear conteúdo privado', async () => {
    const { saved, client } = mount(),
      user = await edit();
    expect(document.body.textContent).not.toContain('private-synthetic');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    expect(screen.getByText('Confirme o impacto das portas publicadas.')).toBeInTheDocument();
    expect(state.puts).toHaveLength(0);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    expect(screen.getByText('Antes · 1 regra(s)')).toBeInTheDocument();
    expect(screen.getByText('Depois · 1 regra(s)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(Object.keys(state.puts[0]).sort()).toEqual(['launchConfig', 'lbConfig']);
    expect(state.puts[0].lbConfig).toMatchObject({
      config: 'private-synthetic-config',
      portRules: [{ targetPort: 8081 }],
    });
    expect(state.puts[0].launchConfig).toMatchObject({
      environment: { SECRET: 'private-synthetic-environment' },
    });
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((v) => v.state.data),
      ),
    ).not.toContain('private-synthetic');
  });
  it('recusa snapshot concorrente e mantém o rascunho', async () => {
    mount();
    const user = await edit();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    (state.source.lbConfig as Record<string, unknown>).config = 'external-client';
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText(/alterado por outro cliente/);
    expect(state.puts).toHaveLength(0);
    expect(screen.getByLabelText('Porta de destino 1')).toHaveValue('8081');
  });
  it('revalida o schema antes do PUT e bloqueia permissão revogada', async () => {
    mount();
    const user = await edit();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    state.schemas[0].resourceMethods = ['GET'];
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText(/não está disponível neste contexto/);
    expect(state.puts).toHaveLength(0);
  });
  it('oferece descarte e não altera o backend ao fechar', async () => {
    const { close } = mount(),
      user = await edit();
    await user.click(screen.getByRole('button', { name: /^Fechar$/ }));
    expect(close).not.toHaveBeenCalled();
    await screen.findByText('Descartar regras não salvas?');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(close).toHaveBeenCalledOnce();
    expect(state.puts).toHaveLength(0);
  });
  it('desativa escrita pela flag e mantém protocolos avançados protegidos', async () => {
    state.enabled = false;
    mount();
    await screen.findByText(/Sua conta ou o estado atual/);
    expect(screen.getByRole('button', { name: 'Revisar alterações' })).toBeDisabled();
    expect(screen.getByLabelText('Porta de destino 1')).toBeDisabled();
  });
  it('protege protocolo avançado e não revela configuração privada', async () => {
    (state.source.lbConfig as { portRules: Record<string, unknown>[] }).portRules[0].protocol =
      'https';
    mount();
    await screen.findByText(/Há regras avançadas/);
    expect(screen.getByRole('region', { name: 'Regras preservadas' })).toHaveTextContent(
      'HTTPS :8080',
    );
    expect(screen.getByRole('button', { name: 'Revisar alterações' })).toBeDisabled();
    expect(document.body.textContent).not.toContain('private-synthetic');
    expect(state.puts).toHaveLength(0);
  });
  it('recusa contrato aninhado revogado durante a revisão', async () => {
    mount();
    const user = await edit();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    state.schemas.find((v) => v.id === 'launchConfig')!.resourceFields.ports.create = false;
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Contrato de portas indisponível.');
    expect(state.puts).toHaveLength(0);
  });
});
