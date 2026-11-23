import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { allPages, api, ApiError, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useI18n } from '../i18n/provider';
import type { MessageKey } from '../i18n/messages';
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
  KeyValidationError,
  prepareKeyCreate,
  prepareKeyEdit,
  type KeyAction,
} from '../api-keys';
import {
  Alert,
  ResourceStateBadge,
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
type KeyPageErrorKey = Extract<
  MessageKey,
  | 'apiKeys.reopenEditor'
  | 'apiKeys.reopenOperation'
  | 'apiKeys.actionUnavailable'
  | 'apiKeys.reviewFields'
  | 'apiKeys.requestFailed'
>;
class KeyPageError extends Error {
  constructor(
    readonly key: KeyPageErrorKey,
    readonly status?: number,
  ) {
    super(key);
  }
}
async function keyRequest<T>(request: Promise<T>) {
  try {
    return await request;
  } catch (error) {
    throw new KeyPageError(
      'apiKeys.requestFailed',
      error instanceof ApiError ? error.status : undefined,
    );
  }
}
export function ApiKeys() {
  const { t } = useI18n();
  function errorText(error: Error) {
    if (error instanceof KeyValidationError) return t(error.key);
    const status =
      error instanceof ApiError || error instanceof KeyPageError ? error.status : undefined;
    if (status !== undefined) return t('apiKeys.httpFailed', { status });
    return t(error instanceof KeyPageError ? error.key : 'apiKeys.requestFailed');
  }
  const labels: Record<KeyAction, string> = {
    activate: t('apiKeys.activate'),
    deactivate: t('apiKeys.deactivate'),
    remove: t('apiKeys.remove'),
    purge: t('apiKeys.purge'),
  };

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
  const [validation, setValidation] = useState<Error | null>(null);
  const base = environment ? `projects/${project}/` : '';
  const listKey = ['data', app.identity, 'api-keys', environment ? project : 'accounts', removed];
  const query = useQuery({
    queryKey: listKey,
    enabled: (!environment || !!project) && !!schema?.links.collection,
    queryFn: async ({ signal }) => {
      const path =
        schema!.links.collection +
        (removed ? '?_removed=true&removed_notnull=true&limit=100' : '?limit=100');
      return (await keyRequest(allPages<Resource>(path, signal))).map(keyMetadata);
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
    setValidation(null);
  }
  async function freshSchema(signal: AbortSignal) {
    const contract = await keyRequest(
      api<Schema>(base + 'schemas/apiKey', undefined, undefined, signal),
    );
    scope.assertCurrent();
    return contract;
  }
  const write = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async () => {
      if (!app.config.modules.apiKeys || !editor || (environment && !project))
        throw new KeyPageError('apiKeys.reopenEditor');
      const signal = scope.signal(),
        contract = await freshSchema(signal);
      if (editor === 'new') {
        const payload = prepareKeyCreate(contract, name, description, project);
        const value = await keyRequest(
          api<Resource>(contract.links.collection, payload, 'POST', signal),
        );
        scope.assertCurrent();
        assertKeyScope(value, project);
        const credential = keySecret(value);
        setOneTime({ scope: scopeKey, id: value.id, ...credential });
        setRevealed(false);
        setSaved(false);
        return keyMetadata(value);
      }
      const fresh = await keyRequest(
        api<Resource>(editor.links.self, undefined, undefined, signal),
      );
      scope.assertCurrent();
      const payload = prepareKeyEdit(contract, editor, fresh, name, description, project);
      const value = await keyRequest(api<Resource>(fresh.links.self, payload, 'PUT', signal));
      scope.assertCurrent();
      return keyMetadata(value);
    },
    onError: () => setReview(false),
    onSuccess: () => {
      setEditor(null);
      setReview(false);
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'api-keys'] });
      toast(t('apiKeys.updated'));
    },
  });
  const run = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async () => {
      if (!action || !app.config.modules.apiKeys) throw new KeyPageError('apiKeys.reopenOperation');
      const signal = scope.signal(),
        contract = await freshSchema(signal),
        fresh = await keyRequest(
          api<Resource>(action.row.links.self, undefined, undefined, signal),
        );
      scope.assertCurrent();
      if (
        fresh.type !== 'apiKey' ||
        fresh.id !== action.row.id ||
        fresh.accountId !== action.row.accountId ||
        (project && fresh.accountId !== project) ||
        !keyActionAllowed(contract, fresh, action.kind)
      )
        throw new KeyPageError('apiKeys.actionUnavailable');
      const target = keyActionTarget(contract, fresh, action.kind)!;
      await keyRequest(
        api<unknown>(target.url, target.method === 'POST' ? {} : undefined, target.method, signal),
      );
      scope.assertCurrent();
    },
    onSuccess: () => {
      setAction(null);
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'api-keys'] });
      toast(t('apiKeys.operationSent'));
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
      setValidation(null);
      setReview(true);
    } catch (e) {
      setValidation(e instanceof Error ? e : new KeyPageError('apiKeys.reviewFields'));
    }
  }
  return (
    <>
      <PageHeader
        title={t('apiKeys.title')}
        description={t('apiKeys.description')}
        action={
          <>
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={16} />
              {t('apiKeys.refresh')}
            </Button>
            {canCreateKey(schema, project) && (!environment || project) && (
              <Button variant="primary" onClick={() => open('new')}>
                <Plus size={16} />
                {t('apiKeys.create')}
              </Button>
            )}
          </>
        }
      />
      <section className="panel">
        <div className="form-grid">
          <Field label={t('apiKeys.scope')}>
            {(id) => (
              <select
                id={id}
                value={environment ? 'environment' : 'accounts'}
                onChange={(e) => {
                  setEnvironment(e.target.value === 'environment');
                  setRemoved(false);
                }}
              >
                <option value="accounts">{t('apiKeys.accounts')}</option>
                <option value="environment" disabled={!app.project}>
                  {t('apiKeys.environment', { name: app.project?.name || t('apiKeys.none') })}
                </option>
              </select>
            )}
          </Field>
          <Field label={t('apiKeys.status')}>
            {(id) => (
              <select
                id={id}
                value={removed ? 'removed' : 'current'}
                onChange={(e) => setRemoved(e.target.value === 'removed')}
              >
                <option value="current">{t('apiKeys.current')}</option>
                <option value="removed">{t('apiKeys.removed')}</option>
              </select>
            )}
          </Field>
        </div>
        <Alert tone="info">
          {environment
            ? t('apiKeys.environmentInfo', { name: app.project?.name || '' })
            : t('apiKeys.accountInfo')}
        </Alert>
      </section>
      {query.isPending || schemas.isPending ? (
        <Loading />
      ) : query.error || schemas.error ? (
        <ErrorState
          error={new Error(errorText((query.error || schemas.error)!))}
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
              label: t('apiKeys.key'),
              sortValue: (v) => String(v.name || v.id),
              render: (v) => (
                <>
                  <strong>{String(v.name || v.id)}</strong>
                  {!!v.description && <p className="muted">{String(v.description)}</p>}
                </>
              ),
            },
            { key: 'owner', label: t('apiKeys.owner'), render: (v) => String(v.accountId || '—') },
            {
              key: 'public',
              label: t('apiKeys.identifier'),
              render: (v) => (
                <code>
                  {typeof v.publicValue === 'string' ? v.publicValue.slice(0, 8) + '…' : v.id}
                </code>
              ),
            },
            {
              key: 'state',
              label: t('apiKeys.state'),
              render: (v) => <ResourceStateBadge state={v.state} />,
            },
            {
              key: 'actions',
              label: t('apiKeys.actions'),
              render: (v) => (
                <ActionMenu
                  label={t('apiKeys.rowActions', { name: String(v.name || v.id) })}
                  actions={[
                    ...(schema?.resourceMethods?.includes('PUT') && !v.removed
                      ? [{ id: 'edit', label: t('apiKeys.editMetadata'), onSelect: () => open(v) }]
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
        title={editor === 'new' ? t('apiKeys.createTitle') : t('apiKeys.editTitle')}
        description={
          environment
            ? t('apiKeys.environment', { name: app.project?.name || '' })
            : t('apiKeys.newCredential')
        }
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={pending}>
              {t('apiKeys.cancel')}
            </Button>
            <Button variant="primary" disabled={pending} onClick={requestReview}>
              {t('apiKeys.review')}
            </Button>
          </>
        }
      >
        <fieldset disabled={pending} className="form-fieldset">
          <Field label={t('apiKeys.name')}>
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
          <Field label={t('apiKeys.keyDescription')}>
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
        {(validation || write.error) && <Alert>{errorText((validation || write.error)!)}</Alert>}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={setReview}
        title={editor === 'new' ? t('apiKeys.createConfirm') : t('apiKeys.editConfirm')}
        description={
          environment
            ? t('apiKeys.environmentReview', { name: app.project?.name || '' })
            : t('apiKeys.accountReview')
        }
        busy={pending}
        onConfirm={() => write.mutate()}
      >
        <p>
          {t('apiKeys.namePrefix')} <strong>{name}</strong>
        </p>
        {editor !== 'new' && editor && (
          <p>{t('apiKeys.previousName', { name: String(editor.name || editor.id) })}</p>
        )}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('apiKeys.discardTitle')}
        description={t('apiKeys.discardDescription')}
        onConfirm={() => {
          setDiscard(false);
          setEditor(null);
        }}
      />
      <Modal
        open={!!secret}
        title={t('apiKeys.saveTitle')}
        description={t('apiKeys.saveDescription')}
        onOpenChange={(open) => {
          if (!open) {
            if (saved) clearSecret();
            else setLoseSecret(true);
          }
        }}
        footer={
          <Button variant="primary" disabled={!saved} onClick={clearSecret}>
            {t('apiKeys.done')}
          </Button>
        }
      >
        <Alert tone="warning">{t('apiKeys.saveWarning')}</Alert>
        <Field label={t('apiKeys.accessKey')}>
          {(id) => <input id={id} readOnly value={secret?.publicValue || ''} autoComplete="off" />}
        </Field>
        <Field label={t('apiKeys.secret')}>
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
            {revealed ? t('apiKeys.hideSecret') : t('apiKeys.showSecret')}
          </Button>
          <Button
            onClick={async () => {
              try {
                if (secret) {
                  await navigator.clipboard.writeText(secret.secretValue);
                  toast(t('apiKeys.copied'));
                }
              } catch {
                toast(t('apiKeys.copyFailed'));
              }
            }}
          >
            <Copy size={16} />
            {t('apiKeys.copy')}
          </Button>
        </div>
        <CheckboxField
          label={t('apiKeys.saved')}
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
      </Modal>
      <Confirm
        open={loseSecret}
        onOpenChange={setLoseSecret}
        title={t('apiKeys.loseTitle')}
        description={t('apiKeys.loseDescription')}
        onConfirm={clearSecret}
      />
      <Confirm
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
        title={t('apiKeys.actionTitle', {
          action: action ? labels[action.kind] : t('apiKeys.change'),
        })}
        description={t('apiKeys.actionDescription', {
          name: String(action?.row.name || action?.row.id || ''),
          owner: String(action?.row.accountId || ''),
          effect: action?.kind === 'activate' ? t('apiKeys.reactivate') : t('apiKeys.interrupt'),
        })}
        busy={pending}
        onConfirm={() => run.mutate()}
      >
        {run.error && <Alert>{errorText(run.error)}</Alert>}
      </Confirm>
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('apiKeys.contextTitle')}
        description={t('apiKeys.contextDescription')}
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
