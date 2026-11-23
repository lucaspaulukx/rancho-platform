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
  credentialMetadata,
  passwordCreate,
  passwordReset,
  validateAccountChange,
  sessionAccountId,
  type AccountOperation,
} from '../local-accounts';
import { Alert, Button, CheckboxField, Confirm, Field, Loading, Modal, useToast } from './ui';

export interface AccountSelection {
  mode: AccountOperation;
  account?: { id: string };
}
const titles: Record<AccountOperation, string> = {
  create: 'Criar conta local',
  profile: 'Editar perfil da conta',
  password: 'Redefinir senha local',
  activate: 'Ativar conta',
  deactivate: 'Desativar conta',
  remove: 'Excluir conta',
};
export function LocalAccountPanel({
  selection,
  onClose,
}: {
  selection: AccountSelection;
  onClose: () => void;
}) {
  const app = useApp(),
    scope = useRequestScope(
      app.identity + ':account:' + selection.account?.id + ':' + selection.mode,
    ),
    client = useQueryClient(),
    toast = useToast();
  const enabled = app.admin && app.config.modules.localAccountAdministration;
  const ownAccount = sessionAccountId(app.token);
  const [current, setCurrent] = useState<Resource | null>(null),
    [pending, setPending] = useState<Resource | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
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
      throw new Error(
        e instanceof ApiError
          ? `Operação de conta não concluída (HTTP ${e.status}).`
          : 'Não foi possível concluir a operação de conta.',
      );
    }
  }
  async function list<T>(path: string, signal: AbortSignal) {
    try {
      return await allPages<T>(path, signal);
    } catch {
      throw new Error('Não foi possível consultar a administração de contas.');
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
        if (alive) setError((e as Error).message);
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
      if (!enabled) throw new Error('Administração de contas indisponível.');
      const signal = scope.signal();
      const token = (await request<Collection<Token>>('token', undefined, undefined, signal))
        .data?.[0];
      if (
        !token ||
        token.userType !== 'admin' ||
        !ownAccount ||
        sessionAccountId(token) !== ownAccount
      )
        throw new Error('Sua permissão de administrador mudou.');
      const schemas = Object.fromEntries(
        (await list<Schema>('schemas', signal)).map((v) => [v.id, v]),
      );
      scope.assertCurrent();
      let target = current;
      if (selection.mode === 'create') {
        if (password !== confirmation) throw new Error('As senhas não coincidem.');
        passwordCreate(schemas.password, pending?.id || ownAccount, login, password);
        if (kind === 'admin' && !privileged)
          throw new Error('Confirme o acesso administrativo global.');
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
          throw new Error('Já existe uma credencial com este login.');
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
        if (!target) throw new Error('A conta não foi criada.');
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
        if (!current) throw new Error('Reabra o painel da conta.');
        target = localAccountMetadata(
          await request<Resource>(accountPath(current.id), undefined, undefined, signal),
        );
        scope.assertCurrent();
        const rows = await list<Resource>('accounts?limit=100', signal);
        scope.assertCurrent();
        validateAccountChange(current, target, ownAccount, selection.mode, kind, rows);
        if (selection.mode === 'profile') {
          if (kind === 'admin' && current.kind !== 'admin' && !privileged)
            throw new Error('Confirme o acesso administrativo global.');
          await request<unknown>(
            accountPath(target.id),
            accountProfile(schemas.account, name, description, kind),
            'PUT',
            signal,
          );
        } else if (selection.mode === 'password') {
          if (password !== confirmation) throw new Error('As senhas não coincidem.');
          const credentials = (await list<Resource>('passwords?limit=100', signal))
            .map(credentialMetadata)
            .filter((v) => !v.removed && v.accountId === target!.id && v.state === 'active');
          scope.assertCurrent();
          if (credentials.length !== 1)
            throw new Error(
              'Esta conta não possui uma única credencial local ativa. Credenciais OIDC são gerenciadas no provedor.',
            );
          const id = credentials[0].id;
          if (!/^1c[1-9]\d*$/.test(id)) throw new Error('Credencial inválida.');
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
            throw new Error('A operação mudou. Reabra o painel.');
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
      toast('Operação recebida pelo Rancher. Acompanhe o estado da conta.');
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
            ? 'A conta nasce sem acesso a environments. Conceda acesso pelos grupos após criar.'
            : `Conta ${current?.name || selection.account?.id || ''}. Privilégio global é independente dos grupos.`
        }
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <>
            <Button disabled={write.isPending} onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={loading || !!error || (!current && selection.mode !== 'create')}
              onClick={() => setReview(true)}
            >
              {['activate', 'deactivate', 'remove'].includes(selection.mode)
                ? 'Revisar operação'
                : 'Revisar alterações'}
            </Button>
          </>
        }
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <Alert>{error}</Alert>
        ) : (
          <fieldset
            className="form-fieldset"
            disabled={write.isPending}
            onChange={() => {
              setChanged(true);
              write.reset();
            }}
          >
            {pending && (
              <Alert>
                A conta {pending.id} já foi criada. Conclua a credencial neste formulário; repetir o
                envio reaproveita esta conta.
              </Alert>
            )}
            {profile && (
              <>
                <Field label="Nome da conta">
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
                <Field label="Descrição da conta">
                  {(id) => (
                    <textarea
                      id={id}
                      value={description}
                      disabled={!!pending}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Perfil global da conta">
                  {(id) => (
                    <select
                      id={id}
                      value={kind}
                      disabled={!!pending || current?.id === ownAccount}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  )}
                </Field>
                {kind === 'admin' && current?.kind !== 'admin' && (
                  <CheckboxField
                    label="Confirmo conceder administração global do Rancher"
                    description="Administradores acessam todos os environments e configurações, independentemente dos grupos."
                    checked={privileged}
                    onChange={(e) => setPrivileged(e.target.checked)}
                  />
                )}
              </>
            )}
            {selection.mode === 'create' && (
              <Field label="Login local">
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
                <Field label="Nova senha local">
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
                <Field label="Confirmar senha local">
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
                  <Alert tone="info">
                    A troca altera apenas a credencial local. Sessões JWT já emitidas não são
                    revogadas pela troca de senha. Para bloquear o uso da conta, desative-a. Senhas
                    do Keycloak são gerenciadas no provedor.
                  </Alert>
                )}
              </>
            )}
            {selection.mode === 'deactivate' && (
              <Alert>
                A conta deixará de autenticar e a próxima consulta de sessão será recusada. Grupos e
                acessos cadastrados serão preservados.
              </Alert>
            )}
            {selection.mode === 'remove' && (
              <Alert>
                A conta deve estar inativa. A exclusão lógica é aplicada pelo Rancher; esta tela não
                executa purge nem apaga dados dos environments.
              </Alert>
            )}
            {selection.mode === 'activate' && (
              <Alert tone="info">
                A conta volta a autenticar e poderá recuperar os acessos diretos e de grupos ainda
                cadastrados.
              </Alert>
            )}
          </fieldset>
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(o) => {
          if (!write.isPending) setReview(o);
        }}
        title="Aplicar alteração da conta?"
        description={`${titles[selection.mode]}: ${name || current?.name || 'nova conta'}. ${kind === 'admin' ? 'O perfil administrativo tem acesso global. ' : ''}Credenciais ficam protegidas nesta revisão.`}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={pending ? 'Abandonar cadastro incompleto?' : 'Descartar alterações da conta?'}
        description={
          pending
            ? `A conta ${pending.id} já existe. Fechar não a exclui e a credencial pode estar incompleta; verifique a conta antes de criar outro cadastro.`
            : 'As alterações ainda não foram enviadas.'
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
        title="Sair com alteração pendente?"
        description={
          pending
            ? 'A conta já foi criada e a credencial pode estar incompleta.'
            : 'As alterações ainda não foram enviadas.'
        }
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
