import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { allPages, api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  assertKeyScope,
  canCreateKey,
  keyActionAllowed,
  keyActionTarget,
  keyActions,
  keyMetadata,
  keySecret,
  prepareKeyCreate,
  prepareKeyEdit,
  type KeyAction,
} from '../api-keys';
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Confirm,
  DataTable,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  useToast,
} from '../components/ui';
import { ActionMenu } from '../components/ActionMenu';
const labels: Record<KeyAction, string> = {
  activate: 'Ativar',
  deactivate: 'Desativar',
  remove: 'Revogar',
  purge: 'Excluir definitivamente',
};
export function ApiKeys() {
  const app = useApp(),
    client = useQueryClient(),
    toast = useToast();
  const [environment, setEnvironment] = useState(false),
    [removed, setRemoved] = useState(false);
  const project = environment ? app.project?.id : undefined;
  const scopeKey = `${app.identity}:api-keys:${environment ? 'project:' + project : 'accounts'}`;
  const scope = useRequestScope(scopeKey),
    schemas = useSchemas(environment),
    schema = schemas.data?.apiKey;
  const [editor, setEditor] = useState<'new' | Resource | null>(null),
    [name, setName] = useState(''),
    [description, setDescription] = useState('');
  const [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [action, setAction] = useState<{ row: Resource; kind: KeyAction } | null>(null);
  const [oneTime, setOneTime] = useState<{
    scope: string;
    id: string;
    publicValue: string;
    secretValue: string;
  } | null>(null);
  const secret = oneTime?.scope === scopeKey ? oneTime : null;
  const [revealed, setRevealed] = useState(false),
    [saved, setSaved] = useState(false),
    [loseSecret, setLoseSecret] = useState(false);
  const [validation, setValidation] = useState('');
  const base = environment ? `projects/${project}/` : '';
  const listKey = ['data', app.identity, 'api-keys', environment ? project : 'accounts', removed];
  const query = useQuery({
    queryKey: listKey,
    enabled: (!environment || !!project) && !!schema?.links.collection,
    queryFn: async ({ signal }) => {
      const path =
        schema!.links.collection +
        (removed ? '?_removed=true&removed_notnull=true&limit=100' : '?limit=100');
      return (await allPages<Resource>(path, signal)).map(keyMetadata);
    },
    gcTime: 0,
    refetchInterval: 10000,
  });
  const dirty =
    !!editor &&
    (editor === 'new'
      ? !!name || !!description
      : name !== (editor.name || '') || description !== (editor.description || ''));
  useEffect(() => {
    setOneTime(null);
    setRevealed(false);
    setSaved(false);
    setEditor(null);
    setReview(false);
    setAction(null);
  }, [scopeKey]);
  function open(value: 'new' | Resource) {
    setEditor(value);
    setName(value === 'new' ? '' : String(value.name || ''));
    setDescription(value === 'new' ? '' : String(value.description || ''));
    setValidation('');
  }
  async function freshSchema(signal: AbortSignal) {
    const contract = await api<Schema>(base + 'schemas/apiKey', undefined, undefined, signal);
    scope.assertCurrent();
    return contract;
  }
  const write = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async () => {
      if (!app.config.modules.apiKeys || !editor || (environment && !project))
        throw new Error('Reabra o editor no escopo desejado.');
      const signal = scope.signal(),
        contract = await freshSchema(signal);
      if (editor === 'new') {
        const payload = prepareKeyCreate(contract, name, description, project);
        const value = await api<Resource>(contract.links.collection, payload, 'POST', signal);
        scope.assertCurrent();
        assertKeyScope(value, project);
        const credential = keySecret(value);
        setOneTime({ scope: scopeKey, id: value.id, ...credential });
        setRevealed(false);
        setSaved(false);
        return keyMetadata(value);
      }
      const fresh = await api<Resource>(editor.links.self, undefined, undefined, signal);
      scope.assertCurrent();
      const payload = prepareKeyEdit(contract, editor, fresh, name, description, project);
      const value = await api<Resource>(fresh.links.self, payload, 'PUT', signal);
      scope.assertCurrent();
      return keyMetadata(value);
    },
    onError: () => setReview(false),
    onSuccess: () => {
      setEditor(null);
      setReview(false);
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'api-keys'] });
      toast('Chave atualizada no Rancher.');
    },
  });
  const run = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async () => {
      if (!action || !app.config.modules.apiKeys) throw new Error('Reabra a operação.');
      const signal = scope.signal(),
        contract = await freshSchema(signal),
        fresh = await api<Resource>(action.row.links.self, undefined, undefined, signal);
      scope.assertCurrent();
      if (
        fresh.type !== 'apiKey' ||
        fresh.id !== action.row.id ||
        fresh.accountId !== action.row.accountId ||
        (project && fresh.accountId !== project) ||
        !keyActionAllowed(contract, fresh, action.kind)
      )
        throw new Error('A ação não está mais disponível neste escopo.');
      const target = keyActionTarget(contract, fresh, action.kind)!;
      await api<unknown>(
        target.url,
        target.method === 'POST' ? {} : undefined,
        target.method,
        signal,
      );
      scope.assertCurrent();
    },
    onSuccess: () => {
      setAction(null);
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'api-keys'] });
      toast('Operação enviada ao Rancher. Acompanhe o estado da chave.');
    },
  });
  const pending = write.isPending || run.isPending,
    blocker = useBlocker(dirty || pending || !!secret);
  usePageLeaveGuard(dirty || pending || !!secret, app.config.modules.unsavedChangesGuard);
  function close() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else setEditor(null);
  }
  function clearSecret() {
    setOneTime(null);
    setRevealed(false);
    setSaved(false);
    setLoseSecret(false);
  }
  function requestReview() {
    try {
      if (!schema || !editor) return;
      if (editor === 'new') prepareKeyCreate(schema, name, description, project);
      else prepareKeyEdit(schema, editor, editor, name, description, project);
      setValidation('');
      setReview(true);
    } catch (e) {
      setValidation(e instanceof Error ? e.message : 'Revise os campos.');
    }
  }
  return (
    <>
      <PageHeader
        title="Chaves de API"
        description="Credenciais persistentes e seus titulares. Desative uma chave para interromper o acesso; depois, revogue-a se não for mais utilizada."
        action={
          <>
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={16} />
              Atualizar
            </Button>
            {canCreateKey(schema, project) && (!environment || project) && (
              <Button variant="primary" onClick={() => open('new')}>
                <Plus size={16} />
                Criar chave
              </Button>
            )}
          </>
        }
      />
      <section className="panel">
        <div className="form-grid">
          <Field label="Escopo das chaves">
            {(id) => (
              <select
                id={id}
                value={environment ? 'environment' : 'accounts'}
                onChange={(e) => {
                  setEnvironment(e.target.value === 'environment');
                  setRemoved(false);
                }}
              >
                <option value="accounts">Contas autorizadas</option>
                <option value="environment" disabled={!app.project}>
                  Environment: {app.project?.name || 'nenhum selecionado'}
                </option>
              </select>
            )}
          </Field>
          <Field label="Situação das chaves">
            {(id) => (
              <select
                id={id}
                value={removed ? 'removed' : 'current'}
                onChange={(e) => setRemoved(e.target.value === 'removed')}
              >
                <option value="current">Ativas e inativas</option>
                <option value="removed">Removidas</option>
              </select>
            )}
          </Field>
        </div>
        <Alert tone="info">
          {environment
            ? `Chaves deste environment autenticam como ${app.project?.name}. Elas são compartilhadas e independem da sessão pessoal; remover um usuário não revoga automaticamente estas credenciais.`
            : 'A lista segue as contas que o Rancher permite consultar. Novas chaves deste escopo pertencem à conta autenticada e herdam seus acessos.'}
        </Alert>
      </section>
      {query.isPending || schemas.isPending ? (
        <Loading />
      ) : query.error || schemas.error ? (
        <ErrorState
          error={query.error || schemas.error}
          retry={() => {
            void query.refetch();
            void schemas.refetch();
          }}
        />
      ) : (
        <DataTable
          rows={query.data || []}
          rowKey={(v) => v.id}
          searchText={(v) => `${v.name || ''} ${v.accountId || ''} ${v.id} ${v.publicValue || ''}`}
          columns={[
            {
              key: 'name',
              label: 'Chave',
              sortValue: (v) => String(v.name || v.id),
              render: (v) => (
                <>
                  <strong>{String(v.name || v.id)}</strong>
                  {!!v.description && <p className="muted">{String(v.description)}</p>}
                </>
              ),
            },
            { key: 'owner', label: 'Titular', render: (v) => String(v.accountId || '—') },
            {
              key: 'public',
              label: 'Identificador',
              render: (v) => (
                <code>
                  {typeof v.publicValue === 'string' ? v.publicValue.slice(0, 8) + '…' : v.id}
                </code>
              ),
            },
            {
              key: 'state',
              label: 'Estado',
              render: (v) => <Badge state={v.state}>{v.state || '—'}</Badge>,
            },
            {
              key: 'actions',
              label: 'Ações',
              render: (v) => (
                <ActionMenu
                  label={`Ações da chave ${v.name || v.id}`}
                  actions={[
                    ...(schema?.resourceMethods?.includes('PUT') && !v.removed
                      ? [{ id: 'edit', label: 'Editar nome e descrição', onSelect: () => open(v) }]
                      : []),
                    ...keyActions
                      .filter((kind) => keyActionAllowed(schema, v, kind))
                      .map((kind) => ({
                        id: kind,
                        label: labels[kind],
                        danger: kind === 'remove' || kind === 'purge',
                        onSelect: () => {
                          run.reset();
                          setAction({ row: v, kind });
                        },
                      })),
                  ]}
                />
              ),
            },
          ]}
        />
      )}
      <Modal
        open={!!editor}
        drawer
        title={editor === 'new' ? 'Criar chave de API' : 'Editar chave de API'}
        description={
          environment
            ? `Environment: ${app.project?.name}`
            : 'Nova credencial para a conta autenticada'
        }
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={pending} onClick={requestReview}>
              Revisar
            </Button>
          </>
        }
      >
        <fieldset disabled={pending} className="form-fieldset">
          <Field label="Nome da chave">
            {(id) => (
              <input
                id={id}
                value={name}
                maxLength={schema?.resourceFields.name?.maxLength ?? 255}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Descrição da chave">
            {(id) => (
              <textarea
                id={id}
                value={description}
                rows={3}
                maxLength={schema?.resourceFields.description?.maxLength ?? 1024}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
        </fieldset>
        {(validation || write.error) && <Alert>{validation || write.error?.message}</Alert>}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={setReview}
        title={editor === 'new' ? 'Criar credencial persistente?' : 'Aplicar alteração da chave?'}
        description={
          environment
            ? `Escopo: ${app.project?.name}. A credencial funciona independentemente da sessão pessoal e precisa ser revogada separadamente.`
            : 'Escopo: conta autenticada. A chave terá os acessos desta conta enquanto estiver ativa.'
        }
        busy={pending}
        onConfirm={() => write.mutate()}
      >
        <p>
          Nome: <strong>{name}</strong>
        </p>
        {editor !== 'new' && editor && <p>Nome anterior: {String(editor.name || editor.id)}</p>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alteração da chave?"
        description="As informações não salvas serão descartadas."
        onConfirm={() => {
          setDiscard(false);
          setEditor(null);
        }}
      />
      <Modal
        open={!!secret}
        title="Guarde sua chave de API"
        description="O segredo é exibido somente agora. Depois de fechar, este frontend não o recupera."
        onOpenChange={(open) => {
          if (!open) {
            if (saved) clearSecret();
            else setLoseSecret(true);
          }
        }}
        footer={
          <Button variant="primary" disabled={!saved} onClick={clearSecret}>
            Concluir
          </Button>
        }
      >
        <Alert tone="warning">
          Guarde esta credencial em local seguro. Você pode revogá-la na lista de chaves.
        </Alert>
        <Field label="Chave de acesso">
          {(id) => <input id={id} readOnly value={secret?.publicValue || ''} autoComplete="off" />}
        </Field>
        <Field label="Segredo da chave">
          {(id) => (
            <input
              id={id}
              readOnly
              type={revealed ? 'text' : 'password'}
              value={secret?.secretValue || ''}
              autoComplete="new-password"
            />
          )}
        </Field>
        <div className="workspace-panel-actions">
          <Button aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}{' '}
            {revealed ? 'Ocultar segredo' : 'Mostrar segredo'}
          </Button>
          <Button
            onClick={async () => {
              try {
                if (secret) {
                  await navigator.clipboard.writeText(secret.secretValue);
                  toast('Segredo copiado.');
                }
              } catch {
                toast('Não foi possível copiar. Revele e selecione o segredo manualmente.');
              }
            }}
          >
            <Copy size={16} />
            Copiar segredo
          </Button>
        </div>
        <CheckboxField
          label="Guardei a credencial ou aceito perder a visualização do segredo"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
      </Modal>
      <Confirm
        open={loseSecret}
        onOpenChange={setLoseSecret}
        title="Fechar sem guardar o segredo?"
        description="O frontend não recuperará o segredo após fechar. Você precisará revogar e criar outra chave."
        onConfirm={clearSecret}
      />
      <Confirm
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
        title={`${action ? labels[action.kind] : 'Alterar'} chave?`}
        description={`Chave: ${action?.row.name || action?.row.id || ''}. Titular: ${action?.row.accountId || ''}. ${action?.kind === 'activate' ? 'O acesso pela credencial será reativado.' : 'Requisições usando esta credencial poderão ser interrompidas.'}`}
        busy={pending}
        onConfirm={() => run.mutate()}
      >
        {run.error && <Alert>{run.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Mudar de contexto?"
        description="Há alterações pendentes ou um segredo que não será recuperado. Aguarde qualquer envio em andamento."
        busy={pending}
        onConfirm={() => {
          if (!pending && blocker.state === 'blocked') {
            clearSecret();
            blocker.proceed();
          }
        }}
      />
    </>
  );
}
