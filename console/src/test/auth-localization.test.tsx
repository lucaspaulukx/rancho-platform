import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Login, Missing, NoAccess } from '../pages/Auth';
import { I18nProvider, useI18n } from '../i18n/provider';
import type { Locale } from '../i18n/locales';

const fixture = vi.hoisted(() => ({
  api: vi.fn(),
  oidcLogin: vi.fn(),
  policy: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../api', async () => ({
  ...(await vi.importActual('../api')),
  api: fixture.api,
  oidcLogin: fixture.oidcLogin,
  policy: fixture.policy,
  acceptToken: vi.fn(),
}));
vi.mock('../state', () => ({
  useApp: () => ({
    authenticated: false,
    identity: 'fixture-account',
    projects: [],
    token: { userIdentity: { login: 'fixture<user>' } },
    refresh: fixture.refresh,
  }),
}));
vi.mock('../layouts', () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('../hooks/useLogout', () => ({
  useLogout: () => ({ pending: false, signOut: fixture.signOut }),
}));

function SwitchLanguage() {
  const { setLocale } = useI18n();
  const location = useLocation();
  return (
    <>
      <button onClick={() => setLocale('en-US')}>English fixture</button>
      <button onClick={() => setLocale('pt-BR')}>Português fixture</button>
      <output aria-label="Fixture route">
        {location.pathname + location.search + location.hash}
      </output>
    </>
  );
}

function mount(children: ReactNode, locale: Locale = 'pt-BR', from?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/login', search: '?env=1a12', state: { from } }]}>
        <I18nProvider
          identity="auth-localization-fixture"
          policy={{
            enabled: true,
            defaultLocale: locale,
            availableLocales: ['pt-BR', 'en-US'],
            selectable: true,
            detectBrowser: false,
            preview: true,
          }}
        >
          <SwitchLanguage />
          {children}
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/console/login');
  fixture.policy.mockResolvedValue({
    enabled: true,
    only: false,
    autoLogin: false,
    preflight: true,
  });
  fixture.refresh.mockResolvedValue(undefined);
  fixture.oidcLogin.mockResolvedValue(undefined);
});

describe('Authentication localization without session side effects', () => {
  it('returns to the requested console path after the external OIDC round trip', async () => {
    const destination = '/stacks?env=1a12#services';
    const initial = mount(<Login />, 'pt-BR', destination);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Entrar com Keycloak' }));
    expect(fixture.oidcLogin).toHaveBeenCalledTimes(1);
    initial.unmount();

    window.history.replaceState({}, '', '/console/login?oidc_ticket=synthetic-fixture-ticket');
    fixture.api.mockResolvedValue({ jwt: 'synthetic-fixture-jwt' });
    mount(<Login />);
    await waitFor(() =>
      expect(screen.getByLabelText('Fixture route')).toHaveTextContent(destination),
    );
    expect(sessionStorage.getItem('rancher.oidc.returnPath')).toBeNull();
  });

  it.each([
    '//external.invalid',
    '/\\external.invalid',
    '/\t/[',
    '/stacks/..//external.invalid',
    '/login?env=1a12',
  ])('falls back to the console home for unsafe stored return path %s', async (destination) => {
    sessionStorage.setItem('rancher.oidc.returnPath', destination);
    window.history.replaceState({}, '', '/console/login?oidc_ticket=synthetic-fixture-ticket');
    fixture.api.mockResolvedValue({ jwt: 'synthetic-fixture-jwt' });
    mount(<Login />);
    await waitFor(() => expect(screen.getByLabelText('Fixture route')).toHaveTextContent(/^\/$/));
    expect(sessionStorage.getItem('rancher.oidc.returnPath')).toBeNull();
  });

  it('changes labels without losing credential drafts or the route', async () => {
    const user = userEvent.setup();
    mount(<Login />);
    await user.type(await screen.findByLabelText('Usuário'), 'fixture-user');
    await user.type(screen.getByLabelText('Senha'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'English fixture' }));
    expect(screen.getByRole('heading', { name: 'Access your environment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('fixture-user');
    expect(screen.getByLabelText('Password')).toHaveValue('synthetic-password');
    expect(screen.getByRole('button', { name: 'Sign in with Keycloak' })).toBeInTheDocument();
    expect(screen.getByLabelText('Fixture route')).toHaveTextContent('/login?env=1a12');
    expect(fixture.api).not.toHaveBeenCalled();
    expect(fixture.oidcLogin).not.toHaveBeenCalled();
  });

  it('retranslates an autologin failure without another authentication attempt', async () => {
    fixture.policy.mockResolvedValue({
      enabled: true,
      only: true,
      autoLogin: true,
      preflight: true,
    });
    fixture.oidcLogin.mockRejectedValue(new Error('sentinel-private-provider-detail'));
    const user = userEvent.setup();
    mount(<Login />);
    expect(
      await screen.findByText('Não foi possível acessar o provedor de login. Tente novamente.'),
    ).toBeInTheDocument();
    expect(fixture.oidcLogin).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'English fixture' }));
    expect(
      screen.getByText('The sign-in provider could not be reached. Try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('sentinel-private-provider-detail')).not.toBeInTheDocument();
    expect(fixture.oidcLogin).toHaveBeenCalledTimes(1);
    expect(fixture.api).not.toHaveBeenCalled();
  });

  it('retranslates a consumed ticket rejection without redeeming the ticket twice', async () => {
    window.history.replaceState({}, '', '/console/login?oidc_ticket=synthetic-fixture-ticket');
    fixture.api.mockRejectedValue(new Error('sentinel-private-ticket-detail'));
    const user = userEvent.setup();
    mount(<Login />);
    expect(
      await screen.findByText('O login expirou ou foi recusado. Inicie uma nova autenticação.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English fixture' }));
    expect(
      screen.getByText('The sign-in expired or was refused. Start a new authentication.'),
    ).toBeInTheDocument();
    expect(fixture.api).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('sentinel-private-ticket-detail')).not.toBeInTheDocument();
  });

  it('renders a safe localized local-login error and preserves the failed draft', async () => {
    fixture.api.mockRejectedValue(new Error('sentinel-private-local-detail'));
    const user = userEvent.setup();
    mount(<Login />);
    await user.type(await screen.findByLabelText('Usuário'), 'fixture-user');
    await user.type(screen.getByLabelText('Senha'), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Entrar com conta local' }));
    expect(
      await screen.findByText(
        'Não foi possível concluir o login. Confira suas credenciais e tente novamente.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English fixture' }));
    expect(
      screen.getByText('Sign-in could not be completed. Check your credentials and try again.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveValue('fixture-user');
    expect(screen.getByLabelText('Password')).toHaveValue('synthetic-password');
    expect(screen.queryByText('sentinel-private-local-detail')).not.toBeInTheDocument();
    expect(fixture.api).toHaveBeenCalledTimes(1);
  });

  it('updates an existing no-access result without rechecking or translating the account identity', async () => {
    const user = userEvent.setup();
    mount(<NoAccess />);
    await user.click(screen.getByRole('button', { name: 'Verificar acesso' }));
    expect(
      await screen.findByText('Seu acesso ainda está aguardando liberação.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'English fixture' }));
    expect(screen.getByRole('heading', { name: 'Your access' })).toBeInTheDocument();
    expect(screen.getByText('Your access is still awaiting approval.')).toBeInTheDocument();
    expect(screen.getByText('Provide your account: fixture<user>.')).toBeInTheDocument();
    expect(fixture.refresh).toHaveBeenCalledTimes(1);
    expect(fixture.api).not.toHaveBeenCalled();
    expect(fixture.signOut).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'Page not found'],
    [{ forbidden: true }, 'Access restricted'],
    [{ disabled: true }, 'Module disabled'],
  ])('localizes route denial state %j', async (props, title) => {
    mount(<Missing {...props} />, 'en-US');
    await waitFor(() => expect(screen.getByRole('heading', { name: title })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/console/');
    expect(fixture.api).not.toHaveBeenCalled();
  });
});
