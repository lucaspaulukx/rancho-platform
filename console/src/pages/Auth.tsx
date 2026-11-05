import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { acceptToken, api, logout, oidcLogin, policy, type Token } from '../api';
import { useApp } from '../state';
import { AuthLayout } from '../layouts';
import { Alert, Button, Empty, Field, Loading, PageHeader } from '../components/ui';

export function Login() {
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ticket, setTicket] = useState(() =>
    new URLSearchParams(window.location.search).get('oidc_ticket'),
  );
  const [entryError, setEntryError] = useState(
    () => new URLSearchParams(window.location.search).get('oidc_error') === 'failed',
  );
  const [ticketError, setTicketError] = useState('');
  const [oidcError, setOidcError] = useState(
    entryError ? 'Não foi possível concluir sua autenticação. Inicie um novo login.' : '',
  );
  const [oidcPending, setOidcPending] = useState(false);
  const oidcRequest = useRef<AbortController | null>(null);
  const consuming = useRef(false);
  const settings = useQuery({ queryKey: ['login-policy'], queryFn: policy, retry: 1 });
  async function finish(token: Token) {
    acceptToken(token);
    setPassword('');
    await app.refresh();
    const from = (location.state as { from?: string } | null)?.from;
    navigate(
      from?.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : '/',
      { replace: true },
    );
  }
  const local = useMutation({
    gcTime: 0,
    mutationFn: () => api<Token>('token', { code: `${username}:${password}` }),
    onSuccess: finish,
  });
  useEffect(() => () => oidcRequest.current?.abort(), []);
  useEffect(() => {
    if (!entryError || app.authenticated) return;
    history.replaceState({}, '', window.location.pathname);
    sessionStorage.setItem('rancher.oidc.autoAttempt', '1');
  }, [entryError, app.authenticated]);
  async function beginOidc() {
    oidcRequest.current?.abort();
    const request = new AbortController();
    oidcRequest.current = request;
    setTicket(null);
    setEntryError(false);
    setTicketError('');
    setOidcError('');
    setOidcPending(true);
    try {
      await oidcLogin(settings.data?.preflight === true, request.signal);
    } catch (error) {
      if (
        !request.signal.aborted &&
        oidcRequest.current === request &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        setOidcError('Não foi possível acessar o provedor de login. Tente novamente.');
    } finally {
      if (!request.signal.aborted && oidcRequest.current === request) setOidcPending(false);
    }
  }
  useEffect(() => {
    if (!ticket || consuming.current) return;
    consuming.current = true;
    history.replaceState({}, '', window.location.pathname);
    void api<Token>('token', { code: `oidc-ticket:${ticket}` })
      .then(finish)
      .catch(() =>
        setTicketError('O login expirou ou foi recusado. Inicie uma nova autenticação.'),
      );
  }, [ticket]);
  useEffect(() => {
    if (!settings.data?.autoLogin || ticket || app.authenticated || ticketError || entryError)
      return;
    const stopped = sessionStorage.getItem('rancher.oidc.signedOut');
    const attempted = sessionStorage.getItem('rancher.oidc.autoAttempt');
    if (!stopped && !attempted && !new URLSearchParams(window.location.search).has('timedOut')) {
      sessionStorage.setItem('rancher.oidc.autoAttempt', '1');
      void beginOidc();
    }
  }, [settings.data, ticket, app.authenticated, ticketError, entryError]);
  if (app.authenticated && !ticket) return <Navigate to="/" replace />;
  function submit(event: FormEvent) {
    event.preventDefault();
    oidcRequest.current?.abort();
    oidcRequest.current = null;
    setOidcPending(false);
    setOidcError('');
    local.mutate();
  }
  return (
    <AuthLayout>
      {ticket && !ticketError ? (
        <Loading label="Concluindo seu login…" />
      ) : (
        <>
          <div
            className="empty-icon"
            style={{ width: 48, height: 48, padding: 12, marginBottom: 22 }}
          >
            <LockKeyhole size={24} />
          </div>
          <p className="eyebrow">BEM-VINDO À CONSOLE</p>
          <h1>Acesse seu ambiente</h1>
          <p className="page-description">
            Entre com sua conta para gerenciar os recursos aos quais você tem acesso.
          </p>
          {ticketError && <Alert>{ticketError}</Alert>}
          {oidcError && <Alert>{oidcError}</Alert>}
          {settings.error && (
            <Alert>
              Não foi possível verificar os métodos de login.{' '}
              <button onClick={() => void settings.refetch()}>Tentar novamente</button>
            </Alert>
          )}
          {settings.isPending ? (
            <Loading label="Verificando acesso…" />
          ) : (
            <>
              {settings.data?.enabled && (
                <Button variant="primary" busy={oidcPending} onClick={() => void beginOidc()}>
                  <ShieldCheck size={18} />
                  Entrar com Keycloak
                  <ArrowRight size={17} />
                </Button>
              )}
              {settings.data && !settings.data.only && (
                <>
                  {settings.data.enabled && (
                    <div className="auth-divider">ou use sua conta local</div>
                  )}
                  <form onSubmit={submit}>
                    <Field label="Usuário">
                      {(id) => (
                        <input
                          id={id}
                          name="username"
                          autoComplete="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      )}
                    </Field>
                    <Field label="Senha">
                      {(id) => (
                        <input
                          id={id}
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      )}
                    </Field>
                    {local.error && <Alert>{local.error.message}</Alert>}
                    <Button
                      variant={settings.data.enabled ? 'secondary' : 'primary'}
                      type="submit"
                      busy={local.isPending}
                    >
                      Entrar com conta local
                      <ArrowRight size={17} />
                    </Button>
                  </form>
                </>
              )}
            </>
          )}
        </>
      )}
    </AuthLayout>
  );
}
export function NoAccess() {
  const app = useApp();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  if (app.projects.length) return <Navigate to="/" replace />;
  async function check() {
    setChecking(true);
    setMessage('');
    try {
      await app.refresh();
      setMessage('Seu acesso ainda está aguardando liberação.');
    } catch {
      setMessage('Não foi possível verificar o acesso. Tente novamente.');
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Seu acesso"
        description="Sua conta está autenticada. Falta definir quais ambientes você poderá acessar."
      />
      <section className="panel pending-card">
        <div className="empty-icon">
          <ShieldCheck size={32} />
        </div>
        <p className="eyebrow">ACESSO PENDENTE</p>
        <h2>Seu espaço está quase pronto</h2>
        <p>
          Um administrador precisa incluir sua conta em um grupo com permissão para os environments.
          Nenhum ambiente será criado automaticamente.
        </p>
        <div className="pending-steps">
          <div className="pending-step">
            <span>1</span>
            <div>
              <strong>Fale com seu administrador</strong>
              <p>
                Informe sua conta:{' '}
                {app.token.userIdentity?.login || app.token.userIdentity?.name || app.identity}.
              </p>
            </div>
          </div>
          <div className="pending-step">
            <span>2</span>
            <div>
              <strong>Receba acesso pelo seu grupo</strong>
              <p>As permissões são definidas e gerenciadas no Rancher.</p>
            </div>
          </div>
          <div className="pending-step">
            <span>3</span>
            <div>
              <strong>Volte para sua console</strong>
              <p>Depois da liberação, verifique novamente para carregar seus ambientes.</p>
            </div>
          </div>
        </div>
        {message && (
          <div style={{ marginBottom: 20 }}>
            <Alert tone="info">{message}</Alert>
          </div>
        )}
        <div className="pending-actions">
          <Button variant="primary" onClick={() => void check()} busy={checking}>
            <RefreshCw size={16} />
            Verificar acesso
          </Button>
          <Button onClick={() => void logout()}>
            <LogOut size={16} />
            Sair da conta
          </Button>
        </div>
      </section>
    </>
  );
}
export function Missing({
  forbidden = false,
  disabled = false,
}: {
  forbidden?: boolean;
  disabled?: boolean;
}) {
  return (
    <Empty
      title={
        disabled ? 'Módulo desativado' : forbidden ? 'Acesso restrito' : 'Página não encontrada'
      }
      description={
        disabled
          ? 'Este módulo está desativado na configuração da console.'
          : forbidden
            ? 'Sua conta não tem permissão para acessar esta área.'
            : 'O endereço pode ter mudado ou não estar disponível nesta console.'
      }
      action={
        <a className="button secondary" href="/console/">
          Voltar ao início
        </a>
      }
    />
  );
}
