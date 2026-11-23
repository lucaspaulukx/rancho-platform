import { useLogout } from '../hooks/useLogout';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { acceptToken, api, oidcLogin, policy, type Token } from '../api';
import { useApp } from '../state';
import { AuthLayout } from '../layouts';
import { Alert, Button, Empty, Field, Loading, PageHeader } from '../components/ui';
import { useI18n } from '../i18n/provider';

export function Login() {
  const app = useApp();
  const { t } = useI18n();
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
  const [ticketError, setTicketError] = useState(false);
  const [logoutWarning] = useState(
    () => sessionStorage.getItem('rancher.oidc.logoutWarning') || '',
  );
  const [oidcError, setOidcError] = useState<
    'auth.entryFailed' | 'auth.providerUnavailable' | null
  >(entryError ? 'auth.entryFailed' : null);
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
    setTicketError(false);
    setOidcError(null);
    setOidcPending(true);
    try {
      await oidcLogin(settings.data?.preflight === true, request.signal);
    } catch (error) {
      if (
        !request.signal.aborted &&
        oidcRequest.current === request &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        setOidcError('auth.providerUnavailable');
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
      .catch(() => setTicketError(true));
  }, [ticket]);
  useEffect(() => {
    if (!settings.data?.autoLogin || ticket || app.authenticated || ticketError || entryError)
      return;
    const stopped = sessionStorage.getItem('rancher.oidc.signedOut');
    const attempted = sessionStorage.getItem('rancher.oidc.autoAttempt');
    if (
      !stopped &&
      !attempted &&
      !['timedOut', 'signedOut', 'oidc_logout'].some((key) =>
        new URLSearchParams(window.location.search).has(key),
      )
    ) {
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
    setOidcError(null);
    local.mutate();
  }
  return (
    <AuthLayout>
      {ticket && !ticketError ? (
        <Loading label={t('auth.completingLogin')} />
      ) : (
        <>
          <div
            className="empty-icon"
            style={{ width: 48, height: 48, padding: 12, marginBottom: 22 }}
          >
            <LockKeyhole size={24} />
          </div>
          <p className="eyebrow">{t('auth.welcome')}</p>
          <h1>{t('auth.loginTitle')}</h1>
          <p className="page-description">{t('auth.loginDescription')}</p>
          {logoutWarning === 'provider' &&
            new URLSearchParams(window.location.search).get('oidc_logout') !== 'returned' && (
              <Alert tone="warning">{t('auth.providerLogoutWarning')}</Alert>
            )}
          {logoutWarning === 'server' && (
            <Alert tone="warning">{t('auth.serverLogoutWarning')}</Alert>
          )}
          {ticketError && <Alert>{t('auth.ticketRejected')}</Alert>}
          {oidcError && <Alert>{t(oidcError)}</Alert>}
          {settings.error && (
            <Alert>
              {t('auth.methodsUnavailable')}{' '}
              <button onClick={() => void settings.refetch()}>{t('auth.retry')}</button>
            </Alert>
          )}
          {settings.isPending ? (
            <Loading label={t('auth.checkingAccess')} />
          ) : (
            <>
              {settings.data?.enabled && (
                <Button variant="primary" busy={oidcPending} onClick={() => void beginOidc()}>
                  <ShieldCheck size={18} />
                  {t('auth.keycloakLogin')}
                  <ArrowRight size={17} />
                </Button>
              )}
              {settings.data && !settings.data.only && (
                <>
                  {settings.data.enabled && (
                    <div className="auth-divider">{t('auth.localAlternative')}</div>
                  )}
                  <form onSubmit={submit}>
                    <Field label={t('auth.username')}>
                      {(id) => (
                        <input
                          id={id}
                          name="username"
                          dir="auto"
                          autoComplete="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      )}
                    </Field>
                    <Field label={t('auth.password')}>
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
                    {local.error && <Alert>{t('auth.localRejected')}</Alert>}
                    <Button
                      variant={settings.data.enabled ? 'secondary' : 'primary'}
                      type="submit"
                      busy={local.isPending}
                    >
                      {t('auth.localLogin')}
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
  const { pending: loggingOut, signOut } = useLogout();
  const app = useApp();
  const { t } = useI18n();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<'auth.pendingStill' | 'auth.accessCheckFailed' | null>(
    null,
  );
  if (app.projects.length) return <Navigate to="/" replace />;
  async function check() {
    setChecking(true);
    setMessage(null);
    try {
      await app.refresh();
      setMessage('auth.pendingStill');
    } catch {
      setMessage('auth.accessCheckFailed');
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <PageHeader title={t('auth.accessTitle')} description={t('auth.accessDescription')} />
      <section className="panel pending-card">
        <div className="empty-icon">
          <ShieldCheck size={32} />
        </div>
        <p className="eyebrow">{t('auth.pendingEyebrow')}</p>
        <h2>{t('auth.pendingTitle')}</h2>
        <p>{t('auth.pendingDescription')}</p>
        <div className="pending-steps">
          <div className="pending-step">
            <span>1</span>
            <div>
              <strong>{t('auth.contactAdmin')}</strong>
              <p>
                {t('auth.accountHint', {
                  account:
                    app.token.userIdentity?.login || app.token.userIdentity?.name || app.identity,
                })}
              </p>
            </div>
          </div>
          <div className="pending-step">
            <span>2</span>
            <div>
              <strong>{t('auth.groupAccess')}</strong>
              <p>{t('auth.groupAccessDescription')}</p>
            </div>
          </div>
          <div className="pending-step">
            <span>3</span>
            <div>
              <strong>{t('auth.returnConsole')}</strong>
              <p>{t('auth.returnConsoleDescription')}</p>
            </div>
          </div>
        </div>
        {message && (
          <div style={{ marginBottom: 20 }}>
            <Alert tone="info">{t(message)}</Alert>
          </div>
        )}
        <div className="pending-actions">
          <Button variant="primary" onClick={() => void check()} busy={checking}>
            <RefreshCw size={16} />
            {t('auth.checkAccess')}
          </Button>
          <Button onClick={() => void signOut()} busy={loggingOut}>
            <LogOut size={16} />
            {t('auth.signOut')}
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
  const { t } = useI18n();
  return (
    <Empty
      title={t(
        disabled ? 'auth.moduleDisabled' : forbidden ? 'auth.accessRestricted' : 'auth.notFound',
      )}
      description={
        disabled
          ? t('auth.moduleDisabledDescription')
          : forbidden
            ? t('auth.accessRestrictedDescription')
            : t('auth.notFoundDescription')
      }
      action={
        <a className="button secondary" href="/console/">
          {t('auth.backHome')}
        </a>
      }
    />
  );
}
