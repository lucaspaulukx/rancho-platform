import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '../api';
import { environmentCatalogWriter } from '../environment-access';
import { useEnvironmentCatalogAccess } from '../hooks/useEnvironmentCatalogAccess';
const state = vi.hoisted(() => ({
  admin: false,
  delegated: true,
  account: '11',
  role: 'member',
  fail: false,
  freshAccount: '11',
  freshAdmin: false,
}));
vi.mock('../state', () => ({
  useApp: () => ({
    admin: state.admin,
    project: { id: '1a7' },
    token: { userIdentity: { externalId: state.account, externalIdType: 'rancher_id' } },
    config: {
      modules: { environmentCatalogs: true, environmentCatalogDelegation: state.delegated },
    },
  }),
  useDataKey: () => ['access-test'],
}));
vi.mock('../api', async () => ({ ...(await vi.importActual('../api')), api: vi.fn() }));
beforeEach(() => {
  Object.assign(state, {
    admin: false,
    delegated: true,
    account: '11',
    role: 'member',
    fail: false,
    freshAccount: '11',
    freshAdmin: false,
  });
  vi.mocked(api).mockImplementation(async (path) => {
    if (path === 'token')
      return {
        data: [
          { accountId: '1a' + state.freshAccount, userType: state.freshAdmin ? 'admin' : 'user' },
        ],
      } as never;
    if (state.fail) throw new ApiError(403, 'private backend payload');
    return {
      data: [
        { complete: true, accountId: state.account, projectId: '7', effectiveRole: state.role },
      ],
    } as never;
  });
});
function Gate() {
  const access = useEnvironmentCatalogAccess(),
    [result, setResult] = useState('');
  return (
    <>
      {access.allowed && (
        <button
          onClick={() =>
            void access.check(new AbortController().signal).then(
              () => setResult('allowed'),
              (error) => setResult(error.message),
            )
          }
        >
          Editar fonte
        </button>
      )}
      <output>{result}</output>
    </>
  );
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Gate />
    </QueryClientProvider>,
  );
  return client;
}
describe('Delegação de fontes por environment', () => {
  it('exige relatório completo de owner/member da conta e environment exatos', () => {
    const base = { complete: true, accountId: '11', projectId: '7', effectiveRole: 'member' };
    expect(environmentCatalogWriter(base, '1a7', '1a11')).toBe(true);
    expect(environmentCatalogWriter({ ...base, effectiveRole: 'owner' }, '1a7', '1a11')).toBe(true);
    for (const change of [
      { complete: false },
      { accountId: '10' },
      { projectId: '8' },
      { effectiveRole: 'readonly' },
      { effectiveRole: 'restricted' },
      { effectiveRole: null },
    ])
      expect(environmentCatalogWriter({ ...base, ...change }, '1a7', '1a11')).toBe(false);
    expect(environmentCatalogWriter(base, '1a7')).toBe(false);
  });
  it('revalida permissão na hora de escrever e recusa acesso revogado', async () => {
    const user = userEvent.setup();
    mount();
    const button = await screen.findByRole('button', { name: 'Editar fonte' });
    state.role = 'readonly';
    await user.click(button);
    expect(
      await screen.findByText('Seu acesso não permite gerenciar fontes neste environment.'),
    ).toBeVisible();
  });
  it('erro no polling não mantém autorização a partir de relatório antigo', async () => {
    const client = mount();
    await screen.findByRole('button', { name: 'Editar fonte' });
    state.fail = true;
    await act(async () => {
      await client.invalidateQueries();
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Editar fonte' })).not.toBeInTheDocument(),
    );
  });
  it('mudança de identidade recusa envio mesmo com perfil administrativo novo', async () => {
    const user = userEvent.setup();
    mount();
    const button = await screen.findByRole('button', { name: 'Editar fonte' });
    state.freshAccount = '1';
    state.freshAdmin = true;
    await user.click(button);
    expect(await screen.findByText('A identidade da sessão mudou.')).toBeVisible();
  });
  it('flag off não oferece delegação', async () => {
    state.delegated = false;
    mount();
    expect(screen.queryByRole('button', { name: 'Editar fonte' })).not.toBeInTheDocument();
  });
  it('admin da UI rebaixado é recusado', async () => {
    const user = userEvent.setup();
    state.admin = true;
    state.delegated = false;
    mount();
    await user.click(screen.getByRole('button', { name: 'Editar fonte' }));
    expect(
      await screen.findByText('Seu acesso não permite gerenciar fontes neste environment.'),
    ).toBeVisible();
  });
  it('admin com sessão atual válida funciona com delegação desligada', async () => {
    const user = userEvent.setup();
    state.admin = true;
    state.freshAdmin = true;
    state.delegated = false;
    mount();
    await user.click(screen.getByRole('button', { name: 'Editar fonte' }));
    expect(await screen.findByText('allowed')).toBeVisible();
  });
  it('erro ao revalidar não expõe payload privado', async () => {
    const user = userEvent.setup();
    mount();
    const button = await screen.findByRole('button', { name: 'Editar fonte' });
    state.fail = true;
    await user.click(button);
    expect(
      await screen.findByText('Não foi possível validar seu acesso às fontes (HTTP 403).'),
    ).toBeVisible();
    expect(screen.queryByText('private backend payload')).not.toBeInTheDocument();
  });
});
