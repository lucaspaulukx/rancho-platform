import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Resource, Schema } from '../api';
import { api, allPages, ApiError } from '../api';
import {
  accountPath,
  accountProfile,
  credentialMetadata,
  passwordCreate,
  validateAccountChange,
  sessionAccountId,
} from '../local-accounts';
import { LocalAccountPanel } from '../components/LocalAccountPanel';
import { I18nProvider } from '../i18n/provider';
import type { Locale } from '../i18n/locales';
const state = vi.hoisted(() => ({ admin: true, enabled: true }));
vi.mock('../state', () => ({
  useApp: () => ({
    admin: state.admin,
    identity: '1a1',
    token: { userIdentity: { externalId: '1', externalIdType: 'rancher_id' } },
    config: { modules: { localAccountAdministration: state.enabled, unsavedChangesGuard: true } },
    refresh: vi.fn(),
  }),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  api: vi.fn(),
  allPages: vi.fn(),
}));
vi.mock('../components/ui', async () => ({
  ...(await vi.importActual('../components/ui')),
  useToast: () => vi.fn(),
}));
const text = { type: 'string', create: true, update: true };
const accountSchema: Schema = {
  id: 'account',
  pluralName: 'accounts',
  links: {},
  collectionMethods: ['GET', 'POST'],
  resourceMethods: ['GET', 'PUT'],
  resourceFields: {
    name: { ...text, maxLength: 255 },
    description: { ...text, maxLength: 1024 },
    kind: text,
  },
};
const passwordSchema: Schema = {
  id: 'password',
  pluralName: 'passwords',
  links: {},
  collectionMethods: ['POST'],
  resourceFields: {
    accountId: { type: 'reference[account]', create: true },
    publicValue: { ...text, maxLength: 4096 },
    secretValue: { type: 'password', create: true, readOnCreateOnly: true },
  },
};
const change: Schema = {
  id: 'changeSecretInput',
  pluralName: 'changeSecretInputs',
  links: {},
  resourceFields: { oldSecret: text, newSecret: text },
};
const account: Resource = {
  id: '1a900',
  type: 'account',
  name: 'test',
  description: 'fixture',
  kind: 'user',
  state: 'active',
  links: { self: '/v2-beta/accounts/1a900' },
  actions: { deactivate: '/v2-beta/accounts/1a900?action=deactivate' },
};
beforeEach(() => {
  vi.clearAllMocks();
  state.admin = true;
  state.enabled = true;
  vi.mocked(allPages).mockImplementation(async (path) =>
    path === 'schemas' ? [accountSchema, passwordSchema, change] : ([] as never),
  );
  vi.mocked(api).mockImplementation(async (path) =>
    path === 'token' ? { data: [{ userType: 'admin', accountId: '1a1' }] } : (account as never),
  );
});
function mount(mode: 'create' | 'password' = 'create') {
  const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
    close = vi.fn();
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <LocalAccountPanel
          selection={{ mode, ...(mode === 'password' ? { account: { id: account.id } } : {}) }}
          onClose={close}
        />
      ),
    },
  ]);
  const view = (defaultLocale: Locale) => (
    <QueryClientProvider client={client}>
      <I18nProvider
        policy={{
          enabled: true,
          defaultLocale,
          availableLocales: ['pt-BR', 'en-US'],
          selectable: false,
          detectBrowser: false,
          preview: true,
        }}
      >
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(view('pt-BR'));
  return { client, close, changeLocale: (locale: Locale) => rerender(view(locale)) };
}
describe('Contas locais: fronteiras de privilégio e credencial', () => {
  it('resolve a conta da sessão GET nativa sem confundir identidade externa e ID interno', () => {
    expect(
      sessionAccountId({ userIdentity: { externalId: '1', externalIdType: 'rancher_id' } }),
    ).toBe('1a1');
    expect(sessionAccountId({ accountId: '1a1' })).toBe('1a1');
    expect(
      sessionAccountId({ userIdentity: { externalId: '1', externalIdType: 'oidc_subject' } }),
    ).toBeUndefined();
    expect(sessionAccountId({})).toBeUndefined();
    expect(() =>
      validateAccountChange(
        { ...account, id: '1a1', kind: 'admin' },
        { ...account, id: '1a1', kind: 'admin' },
        sessionAccountId({ userIdentity: { externalId: '1', externalIdType: 'rancher_id' } })!,
        'deactivate',
        'admin',
        [account],
      ),
    ).toThrow('outro administrador');
  });
  it('payload de perfil usa apenas campos permitidos e rejeita kind externo e limites', () => {
    expect(accountProfile(accountSchema, ' Name ', 'description', 'user', true)).toEqual({
      name: 'Name',
      description: 'description',
      kind: 'user',
    });
    expect(() => accountProfile(accountSchema, 'Name', '', 'superadmin', true)).toThrow();
    expect(accountProfile(accountSchema, 'Name', '', 'user')).toEqual({
      name: 'Name',
      description: '',
      kind: 'user',
    });
    expect(() => accountProfile(accountSchema, 'x'.repeat(256), '', 'user', true)).toThrow();
    for (const id of ['../1a1', '1a0', 'http://external/']) expect(() => accountPath(id)).toThrow();
  });
  it('protege a própria administração, último admin e exige inativação antes de excluir', () => {
    const admin = { ...account, id: '1a1', kind: 'admin' };
    expect(() => validateAccountChange(admin, admin, '1a1', 'profile', 'user', [admin])).toThrow(
      'outro administrador',
    );
    expect(() =>
      validateAccountChange(admin, admin, '1a2', 'deactivate', 'admin', [admin]),
    ).toThrow('pelo menos');
    expect(() =>
      validateAccountChange(account, account, '1a1', 'remove', 'user', [account]),
    ).toThrow('Desative');
    expect(() =>
      validateAccountChange(account, { ...account, name: 'changed' }, '1a1', 'profile', 'user', [
        account,
      ]),
    ).toThrow('mudou');
  });
  it('rejeita schema de senha sem proteção e não armazena secretValue em metadados', () => {
    expect(
      credentialMetadata({
        ...account,
        id: '1c900',
        accountId: '1a900',
        publicValue: 'test',
        secretValue: 'synthetic-private',
        actions: { secret: 'synthetic-private' },
      }),
    ).toEqual({ id: '1c900', accountId: '1a900', login: 'test', state: 'active', removed: false });
    expect(() =>
      passwordCreate(
        {
          ...passwordSchema,
          resourceFields: { ...passwordSchema.resourceFields, secretValue: { ...text } },
        },
        '1a900',
        'test',
        'password',
      ),
    ).toThrow('proteção');
    expect(() => passwordCreate(passwordSchema, '1a900', 'bad:login', 'password')).toThrow();
  });
  it('retoma cadastro após falha de senha sem criar segunda conta e sem segredo no mutation cache', async () => {
    let passwordWrites = 0;
    vi.mocked(api).mockImplementation(async (path, body) => {
      if (path === 'token') return { data: [{ userType: 'admin', accountId: '1a1' }] } as never;
      if (path === 'passwords' && body) {
        passwordWrites++;
        if (passwordWrites === 1) throw new ApiError(500, 'synthetic-private echoed');
        return { id: '1c900' } as never;
      }
      return account as never;
    });
    const user = userEvent.setup(),
      { close, client } = mount();
    await user.type(await screen.findByLabelText('Nome da conta'), 'test');
    await user.type(screen.getByLabelText('Login local'), 'test');
    await user.type(screen.getByLabelText('Nova senha local'), 'synthetic-private');
    await user.type(screen.getByLabelText('Confirmar senha local'), 'synthetic-private');
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Operação de conta não concluída (HTTP 500).')).toBeVisible();
    expect(screen.queryByText('synthetic-private echoed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(vi.mocked(api).mock.calls.filter(([p, body]) => p === 'accounts' && body).length).toBe(
      1,
    );
    expect(passwordWrites).toBe(2);
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((v) => ({
            variables: v.state.variables,
            data: v.state.data,
            error: v.state.error?.message,
          })),
      ),
    ).not.toContain('synthetic-private');
  });
  it.each([
    {
      login: 'invalid:login',
      portuguese: 'Informe login sem espaços/dois pontos e uma senha.',
      english: 'Enter a login without spaces or colons and a password.',
    },
    {
      login: 'valid-login',
      portuguese: 'Nova senha local aceita até 4 caracteres.',
      english: 'New local password accepts up to 4 characters.',
    },
  ])(
    'retranslates an invalid credential without sending the draft ($login)',
    async ({ login, portuguese, english }) => {
      vi.mocked(allPages).mockResolvedValueOnce([
        accountSchema,
        {
          ...passwordSchema,
          resourceFields: {
            ...passwordSchema.resourceFields,
            secretValue: { ...passwordSchema.resourceFields.secretValue, maxLength: 4 },
          },
        },
      ]);
      const user = userEvent.setup();
      const { client, changeLocale } = mount();
      const password = 'unsubmitted-fixture-password';
      await user.type(await screen.findByLabelText('Nome da conta'), 'Fixture');
      const loginInput = screen.getByLabelText('Login local');
      const passwordInput = screen.getByLabelText('Nova senha local');
      await user.type(loginInput, login);
      await user.type(passwordInput, password);
      await user.type(screen.getByLabelText('Confirmar senha local'), password);
      await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
      await user.click(screen.getByRole('button', { name: 'Confirmar' }));
      expect(await screen.findByText(portuguese)).toBeVisible();

      changeLocale('en-US');
      expect(screen.getByText(english)).toBeVisible();
      expect(loginInput).toHaveValue(login);
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveValue(password);
      expect(screen.queryByText(password)).not.toBeInTheDocument();
      expect(vi.mocked(api).mock.calls.some(([, body]) => !!body)).toBe(false);
      const mutation = client.getMutationCache().getAll()[0].state;
      expect(JSON.stringify({ ...mutation, error: mutation.error?.message })).not.toContain(
        password,
      );
    },
  );
  it('não cria senha local implicitamente para uma identidade sem credencial', async () => {
    const user = userEvent.setup();
    mount('password');
    await user.type(await screen.findByLabelText('Nova senha local'), 'synthetic-private');
    await user.type(screen.getByLabelText('Confirmar senha local'), 'synthetic-private');
    await user.click(screen.getByRole('button', { name: 'Revisar alterações' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/não possui uma única credencial local ativa/)).toBeVisible();
    expect(vi.mocked(api).mock.calls.some(([p, body]) => p.startsWith('passwords') && !!body)).toBe(
      false,
    );
  });
  it('administração desligada não renderiza controles', () => {
    state.enabled = false;
    mount();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
