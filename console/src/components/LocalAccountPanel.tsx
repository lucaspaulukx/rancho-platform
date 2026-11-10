import type { enLocalAccountPanel } from '../i18n/domains/local-account-panel';
import { useI18n } from '../i18n/provider';
import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  allPages,
  ApiError,
  type Resource,
  type Schema,
  type Token,
  type Collection,
} from '../api';
import { useApp } from '../state';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  accountPath,
  accountProfile,
  localAccountMetadata,
  LocalAccountValidationError,
  credentialMetadata,
  passwordCreate,
  passwordReset,
  validateAccountChange,
  sessionAccountId,
  type AccountOperation,
} from '../local-accounts';
import { Alert, Button, CheckboxField, Confirm, Field, Loading, Modal, useToast } from './ui';
import { schemaPayloadValidationMessage } from './SchemaForm';

const payloadLabelKeys: Readonly<
  Record<string, `localAccountPanel.${'name' | 'description' | 'kind' | 'login' | 'newPassword'}`>
> = {
  name: 'localAccountPanel.name',
  description: 'localAccountPanel.description',
  kind: 'localAccountPanel.kind',
  publicValue: 'localAccountPanel.login',
  secretValue: 'localAccountPanel.newPassword',
};

type PanelErrorKey = Exclude<
  Extract<keyof typeof enLocalAccountPanel, `localAccountPanel.error.${string}`>,
  'localAccountPanel.error.http'
>;
class AccountPanelError extends Error {
  constructor(
    readonly key: PanelErrorKey,
    readonly status?: number,
  ) {
    super(key);
  }
}
export interface AccountSelection {
  mode: AccountOperation;
  account?: { id: string };
}
export function LocalAccountPanel({
  selection,
  onClose,
}: {
  selection: AccountSelection;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const titles: Record<AccountOperation, string> = {
    create: t('localAccountPanel.create'),
    profile: t('localAccountPanel.profile'),
    password: t('localAccountPanel.password'),
    activate: t('localAccountPanel.activate'),
    deactivate: t('localAccountPanel.deactivate'),
    remove: t('localAccountPanel.remove'),
  };
  const app = useApp(),
    scope = useRequestScope(
      app.identity + ':account:' + selection.account?.id + ':' + selection.mode,
    ),
    client = useQueryClient(),
    toast = useToast();
  function errorText(error: Error) {
    if (error instanceof LocalAccountValidationError) return t(error.key);
    if (error instanceof AccountPanelError)
      return error.status !== undefined
        ? t('localAccountPanel.error.http', { status: error.status })
        : t(error.key);
    return (
      schemaPayloadValidationMessage(error, t, (name) =>
        Object.hasOwn(payloadLabelKeys, name) ? t(payloadLabelKeys[name]) : undefined,
      ) ?? error.message
    );
  }
  const enabled = app.admin && app.config.modules.localAccountAdministration;
  const ownAccount = sessionAccountId(app.token);
  const [current, setCurrent] = useState<Resource | null>(null),
    [pending, setPending] = useState<Resource | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null);
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [kind, setKind] = useState('user'),
    [login, setLogin] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [changed, setChanged] = useState(false),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [privileged, setPrivileged] = useState(false);
  async function request<T>(
    path: string,
    body?: unknown,
    method?: string,
    signal = scope.signal(),
  ) {
    try {
      return await api<T>(path, body, method, signal);
    } catch (e) {
      throw e instanceof ApiError
        ? new AccountPanelError('localAccountPanel.error.operation', e.status)
        : new AccountPanelError('localAccountPanel.error.operation');
    }
  }
  async function list<T>(path: string, signal: AbortSignal) {
    try {
      return await allPages<T>(path, signal);
    } catch {
      throw new AccountPanelError('localAccountPanel.error.list');
    }
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (selection.account) {
          const row = localAccountMetadata(
            await request<Resource>(accountPath(selection.account.id)),
          );
          scope.assertCurrent();
          if (alive) {
            setCurrent(row);
            setName(row.name || '');
            setDescription(row.description || '');
            setKind(row.kind);
          }
        }
      } catch (e) {
        if (alive) setError(e as Error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled) throw new AccountPanelError('localAccountPanel.error.unavailable');
      const signal = scope.signal();
      const token = (await request<Collection<Token>>('token', undefined, undefined, signal))
        .data?.[0];
      if (
        !token ||
        token.userType !== 'admin' ||
        !ownAccount ||
        sessionAccountId(token) !== ownAccount
      )
        throw new AccountPanelError('localAccountPanel.error.permission');
      const schemas = Object.fromEntries(
        (await list<Schema>('schemas', signal)).map((v) => [v.id, v]),
      );
      scope.assertCurrent();
      let target = current;
      if (selection.mode === 'create') {
        if (password !== confirmation)
          throw new AccountPanelError('localAccountPanel.error.passwordMismatch');
        passwordCreate(schemas.password, pending?.id || ownAccount, login, password);
        if (kind === 'admin' && !privileged)
          throw new AccountPanelError('localAccountPanel.error.confirmPrivilege');
        const credentials = (await list<Resource>('passwords?limit=100', signal)).map(
          credentialMetadata,
        );
        scope.assertCurrent();
        if (
          credentials.some(
            (v) =>
              !v.removed &&
              v.login.toLowerCase() === login.trim().toLowerCase() &&
              v.accountId !== pending?.id,
          )
        )
          throw new AccountPanelError('localAccountPanel.error.duplicateLogin');
        if (!pending) {
          target = localAccountMetadata(
            await request<Resource>(
              'accounts',
              accountProfile(schemas.account, name, description, kind, true),
              'POST',
              signal,
            ),
          );
          scope.assertCurrent();
          setPending(target);
          void client.invalidateQueries({ queryKey: ['data', app.identity, 'access'] });
        } else target = pending;
        if (!target) throw new AccountPanelError('localAccountPanel.error.notCreated');
        if (
          !credentials.some(
            (v) => !v.removed && v.accountId === target!.id && v.login === login.trim(),
          )
        )
          await request<unknown>(
            'passwords',
            passwordCreate(schemas.password, target.id, login, password),
            'POST',
            signal,
          );
      } else {
        if (!current) throw new AccountPanelError('localAccountPanel.error.reopen');
        target = localAccountMetadata(
          await request<Resource>(accountPath(current.id), undefined, undefined, signal),
        );
        scope.assertCurrent();
        const rows = await list<Resource>('accounts?limit=100', signal);
        scope.assertCurrent();
        validateAccountChange(current, target, ownAccount, selection.mode, kind, rows);
        if (selection.mode === 'profile') {
          if (kind === 'admin' && current.kind !== 'admin' && !privileged)
            throw new AccountPanelError('localAccountPanel.error.confirmPrivilege');
          await request<unknown>(
            accountPath(target.id),
            accountProfile(schemas.account, name, description, kind),
            'PUT',
            signal,
          );
        } else if (selection.mode === 'password') {
          if (password !== confirmation)
            throw new AccountPanelError('localAccountPanel.error.passwordMismatch');
          const credentials = (await list<Resource>('passwords?limit=100', signal))
            .map(credentialMetadata)
            .filter((v) => !v.removed && v.accountId === target!.id && v.state === 'active');
          scope.assertCurrent();
          if (credentials.length !== 1)
            throw new AccountPanelError('localAccountPanel.error.credentialCount');
          const id = credentials[0].id;
          if (!/^1c[1-9]\d*$/.test(id))
            throw new AccountPanelError('localAccountPanel.error.credential');
          await request<unknown>(
            'passwords/' + id + '?action=changesecret',
            passwordReset(schemas.changeSecretInput, password),
            'POST',
            signal,
          );
        } else {
          const url = new URL(target.actions![selection.mode], location.origin);
          if (
            url.origin !== location.origin ||
            url.pathname.replace(/\/$/, '') !== '/v2-beta/accounts/' + target.id ||
            url.search !== '?action=' + selection.mode
          )
            throw new AccountPanelError('localAccountPanel.error.changedOperation');
          await request<unknown>(url.pathname + url.search, {}, 'POST', signal);
        }
      }
      scope.assertCurrent();
    },
    onSuccess: () => {
      setPassword('');
      setConfirmation('');
      setChanged(false);
      setPending(null);
      setReview(false);
      void client.invalidateQueries({ queryKey: ['data', app.identity] });
      void app.refresh();
      toast(t('localAccountPanel.success'));
      onClose();
    },
  });
  const dirty = changed || !!pending;
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  if (!enabled) return null;
  const profile = selection.mode === 'create' || selection.mode === 'profile',
    secret = selection.mode === 'create' || selection.mode === 'password';
  return (
    <>
      <Modal
        open
        drawer
        title={titles[selection.mode]}
        description={
          selection.mode === 'create'
            ? t('localAccountPanel.createDescription')
            : t('localAccountPanel.accountDescription', {
                account: current?.name || selection.account?.id || '',
              })
        }
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <>
            <Button disabled={write.isPending} onClick={close}>
              {t('localAccountPanel.cancel')}
            </Button>
            <Button
              disabled={loading || !!error || (!current && selection.mode !== 'create')}
              onClick={() => setReview(true)}
            >
              {['activate', 'deactivate', 'remove'].includes(selection.mode)
                ? t('localAccountPanel.reviewOperation')
                : t('localAccountPanel.reviewChanges')}
            </Button>
          </>
        }
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert>{errorText(error)}</Alert>
        ) : (
          <fieldset
            className="form-fieldset"
            disabled={write.isPending}
            onChange={() => {
              setChanged(true);
              write.reset();
            }}
          >
            {pending && <Alert>{t('localAccountPanel.pending', { account: pending.id })}</Alert>}
            {profile && (
              <>
                <Field label={t('localAccountPanel.name')}>
                  {(id) => (
                    <input
                      id={id}
                      value={name}
                      disabled={!!pending}
                      autoComplete="off"
                      onChange={(e) => setName(e.target.value)}
                    />
                  )}
                </Field>
                <Field label={t('localAccountPanel.description')}>
                  {(id) => (
                    <textarea
                      id={id}
                      value={description}
                      disabled={!!pending}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  )}
                </Field>
                <Field label={t('localAccountPanel.kind')}>
                  {(id) => (
                    <select
                      id={id}
                      value={kind}
                      disabled={!!pending || current?.id === ownAccount}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="user">{t('localAccountPanel.user')}</option>
                      <option value="admin">{t('localAccountPanel.admin')}</option>
                    </select>
                  )}
                </Field>
                {kind === 'admin' && current?.kind !== 'admin' && (
                  <CheckboxField
                    label={t('localAccountPanel.confirmAdmin')}
                    description={t('localAccountPanel.adminDescription')}
                    checked={privileged}
                    onChange={(e) => setPrivileged(e.target.checked)}
                  />
                )}
              </>
            )}
            {selection.mode === 'create' && (
              <Field label={t('localAccountPanel.login')}>
                {(id) => (
                  <input
                    id={id}
                    value={login}
                    autoComplete="off"
                    onChange={(e) => setLogin(e.target.value)}
                  />
                )}
              </Field>
            )}
            {secret && (
              <>
                <Field label={t('localAccountPanel.newPassword')}>
                  {(id) => (
                    <input
                      id={id}
                      type="password"
                      value={password}
                      autoComplete="new-password"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}
                </Field>
                <Field label={t('localAccountPanel.confirmPassword')}>
                  {(id) => (
                    <input
                      id={id}
                      type="password"
                      value={confirmation}
                      autoComplete="new-password"
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  )}
                </Field>
                {selection.mode === 'password' && (
                  <Alert tone="info">{t('localAccountPanel.passwordNotice')}</Alert>
                )}
              </>
            )}
            {selection.mode === 'deactivate' && (
              <Alert>{t('localAccountPanel.deactivateNotice')}</Alert>
            )}
            {selection.mode === 'remove' && <Alert>{t('localAccountPanel.removeNotice')}</Alert>}
            {selection.mode === 'activate' && (
              <Alert tone="info">{t('localAccountPanel.activateNotice')}</Alert>
            )}
          </fieldset>
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(o) => {
          if (!write.isPending) setReview(o);
        }}
        title={t('localAccountPanel.reviewTitle')}
        description={t(
          kind === 'admin'
            ? 'localAccountPanel.reviewAdmin'
            : 'localAccountPanel.reviewDescription',
          {
            operation: titles[selection.mode],
            account: name || current?.name || t('localAccountPanel.newAccount'),
          },
        )}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{errorText(write.error)}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={pending ? t('localAccountPanel.abandon') : t('localAccountPanel.discard')}
        description={
          pending
            ? t('localAccountPanel.pendingDiscard', { account: pending.id })
            : t('localAccountPanel.unsent')
        }
        onConfirm={() => {
          setPassword('');
          setConfirmation('');
          onClose();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('localAccountPanel.leave')}
        description={pending ? t('localAccountPanel.incomplete') : t('localAccountPanel.unsent')}
        busy={write.isPending}
        onConfirm={() => {
          if (!write.isPending && blocker.state === 'blocked') {
            setPassword('');
            setConfirmation('');
            blocker.proceed();
          }
        }}
      />
    </>
  );
}
