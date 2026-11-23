import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { api, allPages, ApiError, type Resource, type Schema, type Collection } from '../api';
import { useI18n } from '../i18n/provider';
import { useApp } from '../state';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  webhookDrivers,
  newWebhookDraft,
  webhookPath,
  receiverMetadata,
  receiverSecret,
  webhookNext,
  webhookWriter,
  webhookCreateAllowed,
  prepareWebhook,
  cloneReceiver,
  type WebhookDraft,
  type ReceiverMetadata,
} from '../webhooks';
import {
  Alert,
  Button,
  CheckboxField,
  Confirm,
  DataTable,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  useToast,
} from '../components/ui';
import { ActionMenu } from '../components/ActionMenu';
import { SelectorRows } from '../components/SelectorRows';
class WebhookPageError extends Error {
  constructor(
    readonly key:
      | 'webhooksPage.invalidContracts'
      | 'webhooksPage.invalidPagination'
      | 'webhooksPage.invalidList'
      | 'webhooksPage.permissionDenied'
      | 'webhooksPage.receiverUnavailable'
      | 'webhooksPage.disabled'
      | 'webhooksPage.deleteUnavailable'
      | 'webhooksPage.receiverChanged'
      | 'webhooksPage.urlUnavailable'
      | 'webhooksPage.reviewFields'
      | 'webhooksPage.httpError'
      | 'webhooksPage.requestFailed',
    readonly params?: { status: number },
  ) {
    super(key);
  }
}
async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  try {
    return await api<T>(path, body, method, signal);
  } catch (e) {
    throw e instanceof ApiError
      ? new WebhookPageError('webhooksPage.httpError', { status: e.status })
      : new WebhookPageError('webhooksPage.requestFailed');
  }
}
async function contracts(project: string, signal?: AbortSignal) {
  const rows = await request<Collection<Schema>>(
    '/v1-webhooks/schemas?projectId=' + project,
    undefined,
    undefined,
    signal,
  );
  if (!Array.isArray(rows.data)) throw new WebhookPageError('webhooksPage.invalidContracts');
  return Object.fromEntries(rows.data.map((v) => [v.id, v]));
}
async function access(project: string, signal?: AbortSignal) {
  const rows = await request<Collection<Record<string, unknown>>>(
    'localAccessReports?targetAccount=self&targetEnvironment=' + project,
    undefined,
    undefined,
    signal,
  );
  return rows.data?.[0];
}
export function Webhooks() {
  const { t } = useI18n();
  const app = useApp();
  return app.project ? (
    <WebhookScope key={app.identity + ':' + app.project.id} project={app.project.id} />
  ) : (
    <Empty
      title={t('webhooksPage.selectEnvironment')}
      description={t('webhooksPage.environmentDescription')}
    />
  );
}
function WebhookScope({ project }: { project: string }) {
  const { t } = useI18n();
  function errorText(error: Error) {
    if (!(error instanceof WebhookPageError)) return error.message;
    return error.key === 'webhooksPage.httpError'
      ? t(error.key, { status: error.params!.status })
      : t(error.key);
  }
  const names: Record<string, string> = {
    scaleService: t('webhooksPage.scaleService'),
    serviceUpgrade: t('webhooksPage.serviceUpgrade'),
    scaleHost: t('webhooksPage.scaleHost'),
    forwardPost: t('webhooksPage.forwardPost'),
  };

  const app = useApp(),
    client = useQueryClient(),
    toast = useToast(),
    scope = useRequestScope(app.identity + ':webhooks:' + project);
  const [editor, setEditor] = useState(false),
    [draft, setDraft] = useState<WebhookDraft>(newWebhookDraft),
    [dirty, setDirty] = useState(false),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [remove, setRemove] = useState<ReceiverMetadata | null>(null),
    [error, setError] = useState<Error | null>(null),
    [opening, setOpening] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ id: string; url: string } | null>(null),
    [revealed, setRevealed] = useState(false);
  const schema = useQuery({
    queryKey: ['data', app.identity, 'project', project, 'webhook-schemas'],
    queryFn: ({ signal }) => contracts(project, signal),
  });
  const authorization = useQuery({
    queryKey: ['data', app.identity, 'project', project, 'webhook-access'],
    queryFn: ({ signal }) => access(project, signal),
    refetchInterval: 10000,
    retry: false,
  });
  const writer = webhookWriter(authorization.data, project);
  useEffect(() => {
    if (authorization.isSuccess && !writer) {
      setSecret(null);
      setRevealed(false);
    }
  }, [authorization.isSuccess, writer]);
  const list = useQuery({
    queryKey: ['data', app.identity, 'project', project, 'webhooks'],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const result: ReceiverMetadata[] = [];
      let next: string | null = webhookPath(project);
      const seen = new Set<string>();
      while (next) {
        if (seen.has(next) || seen.size >= 100)
          throw new WebhookPageError('webhooksPage.invalidPagination');
        seen.add(next);
        const page = await request<Collection<Resource>>(next, undefined, undefined, signal);
        if (!Array.isArray(page.data)) throw new WebhookPageError('webhooksPage.invalidList');
        result.push(...page.data.map(receiverMetadata));
        next = webhookNext(page.pagination?.next, project);
      }
      return result;
    },
    refetchInterval: 10000,
  });
  const services = useQuery({
    queryKey: ['data', app.identity, 'project', project, 'webhook-targets'],
    queryFn: async ({ signal }) =>
      (await allPages<Resource>(`projects/${project}/services?limit=100`, signal))
        .filter(
          (v) =>
            v.accountId === project &&
            !v.removed &&
            v.type === 'service' &&
            ['active', 'inactive'].includes(v.state || ''),
        )
        .map(
          (v) =>
            ({
              id: v.id,
              type: v.type,
              name: v.name,
              accountId: v.accountId,
              state: v.state,
              links: {},
            }) as Resource,
        ),
  });
  function change(patch: Partial<WebhookDraft>) {
    setDraft((v) => ({ ...v, ...patch }));
    setDirty(true);
  }
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  function clear() {
    setEditor(false);
    setDraft(newWebhookDraft());
    setDirty(false);
    setReview(false);
    setError(null);
    write.reset();
  }
  async function freshPermission(signal: AbortSignal) {
    const [s, r] = await Promise.all([contracts(project, signal), access(project, signal)]);
    scope.assertCurrent();
    if (!webhookWriter(r, project)) throw new WebhookPageError('webhooksPage.permissionDenied');
    return s;
  }
  async function open(row: ReceiverMetadata, clone = false) {
    if (opening) return;
    setOpening(row.id);
    setError(null);
    try {
      const signal = scope.signal();
      await freshPermission(signal);
      const value = await request<Resource>(
        webhookPath(project, row.id),
        undefined,
        undefined,
        signal,
      );
      scope.assertCurrent();
      if (receiverMetadata(value).id !== row.id)
        throw new WebhookPageError('webhooksPage.receiverUnavailable');
      if (clone) {
        setDraft(cloneReceiver(value));
        setEditor(true);
        setDirty(true);
      } else {
        setSecret(receiverSecret(value, project));
        setRevealed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new WebhookPageError('webhooksPage.receiverUnavailable'));
    } finally {
      setOpening(null);
    }
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!app.config.modules.webhooks) throw new WebhookPageError('webhooksPage.disabled');
      const signal = scope.signal(),
        current = await freshPermission(signal);
      if (remove) {
        if (!current.receiver?.resourceMethods?.includes('DELETE'))
          throw new WebhookPageError('webhooksPage.deleteUnavailable');
        const value = receiverMetadata(
          await request<Resource>(webhookPath(project, remove.id), undefined, undefined, signal),
        );
        scope.assertCurrent();
        if (
          value.id !== remove.id ||
          value.name !== remove.name ||
          value.driver !== remove.driver ||
          value.target !== remove.target
        )
          throw new WebhookPageError('webhooksPage.receiverChanged');
        await request<unknown>(webhookPath(project, value.id), undefined, 'DELETE', signal);
        scope.assertCurrent();
        return;
      }
      const available = (
        await allPages<Resource>(`projects/${project}/services?limit=100`, signal)
      ).map(
        (v) =>
          ({
            id: v.id,
            type: v.type,
            accountId: v.accountId,
            state: v.state,
            removed: v.removed,
            links: {},
          }) as Resource,
      );
      scope.assertCurrent();
      const payload = prepareWebhook(draft, current, project, available),
        value = await request<Resource>(webhookPath(project), payload, 'POST', signal);
      scope.assertCurrent();
      receiverMetadata(value);
      setEditor(false);
      setDraft(newWebhookDraft());
      setDirty(false);
      setReview(false);
      try {
        setSecret(receiverSecret(value, project));
        setRevealed(false);
      } catch {
        setError(new WebhookPageError('webhooksPage.urlUnavailable'));
      }
    },
    onSuccess: () => {
      setRemove(null);
      setReview(false);
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', project, 'webhooks'],
      });
      toast(t('webhooksPage.completed'));
    },
    onError: () => setReview(false),
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  const pending = write.isPending || !!opening;
  const options = schema.data?.[draft.driver]?.resourceFields;
  function selectField(label: string, name: keyof WebhookDraft, values: string[] | undefined) {
    return (
      <Field label={label}>
        {(id) => (
          <select
            id={id}
            value={String(draft[name])}
            onChange={(e) => change({ [name]: e.target.value })}
          >
            {(values || []).map((v) => (
              <option key={v} value={v}>
                {(
                  {
                    up: t('webhooksPage.up'),
                    down: t('webhooksPage.down'),
                    leastRecent: t('webhooksPage.leastRecent'),
                    mostRecent: t('webhooksPage.mostRecent'),
                  } as Record<string, string>
                )[v] || v}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  }
  function numberField(label: string, name: keyof WebhookDraft) {
    return (
      <Field label={label}>
        {(id) => (
          <input
            id={id}
            inputMode="numeric"
            value={String(draft[name])}
            onChange={(e) => change({ [name]: e.target.value })}
          />
        )}
      </Field>
    );
  }
  return (
    <>
      <PageHeader
        title={t('webhooksPage.title')}
        description={t('webhooksPage.description')}
        action={
          <>
            <Button
              onClick={() => {
                void list.refetch();
                void authorization.refetch();
              }}
              disabled={list.isFetching}
            >
              <RefreshCw size={16} />
              {t('webhooksPage.refresh')}
            </Button>
            {writer && webhookCreateAllowed(schema.data?.receiver) && (
              <Button
                variant="primary"
                onClick={() => {
                  clear();
                  setEditor(true);
                }}
              >
                <Plus size={16} />
                {t('webhooksPage.createAction')}
              </Button>
            )}
          </>
        }
      />
      <Alert tone="info">{t('webhooksPage.privacyNotice')}</Alert>
      {!authorization.isPending && !writer && (
        <Alert tone="info">{t('webhooksPage.permissionNotice')}</Alert>
      )}
      {authorization.error && <Alert>{t('webhooksPage.accessFailed')}</Alert>}
      {error && <Alert>{errorText(error)}</Alert>}
      {list.isPending || schema.isPending ? (
        <Loading />
      ) : list.error || schema.error ? (
        (list.error || schema.error) instanceof WebhookPageError ? (
          <div className="error-state">
            <Alert>{errorText((list.error || schema.error)!)}</Alert>
            <Button
              onClick={() => {
                void list.refetch();
                void schema.refetch();
              }}
            >
              {t('webhooksPage.retry')}
            </Button>
          </div>
        ) : (
          <ErrorState
            error={list.error || schema.error}
            retry={() => {
              void list.refetch();
              void schema.refetch();
            }}
          />
        )
      ) : (
        <DataTable
          rows={list.data || []}
          rowKey={(v) => v.id}
          searchText={(v) => `${v.name} ${v.driver} ${v.target}`}
          columns={[
            { key: 'name', label: t('webhooksPage.name'), render: (v) => v.name },
            {
              key: 'driver',
              label: t('webhooksPage.function'),
              render: (v) => names[v.driver] || v.driver,
            },
            {
              key: 'target',
              label: t('webhooksPage.target'),
              render: (v) => services.data?.find((s) => s.id === v.target)?.name || v.target,
            },
            { key: 'state', label: t('webhooksPage.state'), render: (v) => v.state || '—' },
            {
              key: 'actions',
              label: t('webhooksPage.actions'),
              render: (v) => (
                <ActionMenu
                  label={t('webhooksPage.actionsLabel', { name: v.name })}
                  actions={
                    writer
                      ? [
                          {
                            id: 'url',
                            label: t('webhooksPage.protectedUrl'),
                            disabled: pending,
                            onSelect: () => void open(v),
                          },
                          ...(webhookDrivers.includes(v.driver as WebhookDraft['driver']) &&
                          webhookCreateAllowed(schema.data?.receiver)
                            ? [
                                {
                                  id: 'clone',
                                  label: t('webhooksPage.clone'),
                                  disabled: pending,
                                  onSelect: () => void open(v, true),
                                },
                              ]
                            : []),
                          ...(schema.data?.receiver.resourceMethods?.includes('DELETE')
                            ? [
                                {
                                  id: 'remove',
                                  label: t('webhooksPage.delete'),
                                  danger: true,
                                  disabled: pending,
                                  onSelect: () => {
                                    write.reset();
                                    setRemove(v);
                                  },
                                },
                              ]
                            : []),
                        ]
                      : []
                  }
                />
              ),
            },
          ]}
        />
      )}
      <Modal
        open={editor}
        drawer
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t('webhooksPage.create')}
        description={t('webhooksPage.environment', { name: app.project?.name || project })}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              {t('webhooksPage.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={write.isPending || !writer}
              onClick={() => {
                try {
                  prepareWebhook(draft, schema.data || {}, project, services.data || []);
                  setError(null);
                  setReview(true);
                } catch (e) {
                  setError(
                    e instanceof Error ? e : new WebhookPageError('webhooksPage.reviewFields'),
                  );
                }
              }}
            >
              {t('webhooksPage.review')}
            </Button>
          </>
        }
      >
        <fieldset disabled={write.isPending} className="form-fieldset">
          <legend>{t('webhooksPage.configuration')}</legend>
          <Field label={t('webhooksPage.webhookName')}>
            {(id) => (
              <input
                id={id}
                value={draft.name}
                onChange={(e) => change({ name: e.target.value })}
                maxLength={255}
              />
            )}
          </Field>
          <Field label={t('webhooksPage.webhookFunction')}>
            {(id) => (
              <select
                id={id}
                value={draft.driver}
                onChange={(e) => {
                  setDraft({
                    ...newWebhookDraft(),
                    name: draft.name,
                    driver: e.target.value as WebhookDraft['driver'],
                  });
                  setDirty(true);
                }}
              >
                {webhookDrivers
                  .filter((v) => schema.data?.receiver.resourceFields.driver.options?.includes(v))
                  .map((v) => (
                    <option key={v} value={v}>
                      {names[v]}
                    </option>
                  ))}
              </select>
            )}
          </Field>
          {draft.driver === 'scaleService' ? (
            <Field label={t('webhooksPage.targetService')}>
              {(id) => (
                <select
                  id={id}
                  value={draft.serviceId}
                  onChange={(e) => change({ serviceId: e.target.value })}
                >
                  <option value="">{t('webhooksPage.select')}</option>
                  {services.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.id} · {v.id}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <SelectorRows
              rows={draft.selectors}
              onChange={(selectors) => change({ selectors })}
              label={
                draft.driver === 'scaleHost'
                  ? t('webhooksPage.hostLabels')
                  : t('webhooksPage.serviceLabels')
              }
            />
          )}
          {draft.driver === 'serviceUpgrade' ? (
            <>
              <Field label={t('webhooksPage.imageTag')}>
                {(id) => (
                  <input
                    id={id}
                    value={draft.tag}
                    onChange={(e) => change({ tag: e.target.value })}
                    placeholder={t('webhooksPage.tagPlaceholder')}
                  />
                )}
              </Field>
              <div className="form-grid">
                {selectField(
                  t('webhooksPage.payloadFormat'),
                  'payloadFormat',
                  options?.payloadFormat.options,
                )}
                {selectField(
                  t('webhooksPage.addressType'),
                  'addressType',
                  options?.addressType.options,
                )}
                {numberField(t('webhooksPage.batchSize'), 'batchSize')}
                {numberField(t('webhooksPage.interval'), 'intervalSeconds')}
              </div>
              <CheckboxField
                label={t('webhooksPage.startFirst')}
                checked={draft.startFirst}
                onChange={(e) => change({ startFirst: e.target.checked })}
              />
            </>
          ) : (
            <>
              <div className="form-grid">
                {selectField(t('webhooksPage.scaleAction'), 'action', options?.action.options)}
                {numberField(t('webhooksPage.amount'), 'amount')}
                {numberField(t('webhooksPage.minimum'), 'min')}
                {numberField(t('webhooksPage.maximum'), 'max')}
              </div>
              {draft.driver === 'scaleHost' &&
                draft.action === 'down' &&
                selectField(
                  t('webhooksPage.deleteOrder'),
                  'deleteOption',
                  options?.deleteOption.options,
                )}
            </>
          )}
          {draft.driver === 'scaleHost' && (
            <Alert tone="warning">
              {draft.action === 'up'
                ? t('webhooksPage.scaleUpWarning')
                : t('webhooksPage.scaleDownWarning')}
            </Alert>
          )}
          {draft.driver === 'serviceUpgrade' && (
            <Alert tone="info">{t('webhooksPage.upgradeNotice')}</Alert>
          )}
          <Alert tone="warning">{t('webhooksPage.operationWarning')}</Alert>
          {(error || write.error) && <Alert>{errorText((error || write.error)!)}</Alert>}
        </fieldset>
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(open) => {
          if (!write.isPending) setReview(open);
        }}
        title={t('webhooksPage.createTitle')}
        description={t('webhooksPage.createDescription', {
          name: draft.name,
          driver: names[draft.driver],
          target:
            draft.driver === 'scaleService'
              ? `${services.data?.find((v) => v.id === draft.serviceId)?.name || draft.serviceId} (${draft.serviceId})`
              : draft.selectors.map((v) => `${v.key}=${v.value}`).join(', '),
          operation:
            draft.driver === 'serviceUpgrade'
              ? t('webhooksPage.upgradeReview', {
                  tag: draft.tag,
                  batch: draft.batchSize,
                  interval: draft.intervalSeconds,
                })
              : t('webhooksPage.scaleReview', {
                  action: draft.action === 'up' ? t('webhooksPage.up') : t('webhooksPage.down'),
                  amount: draft.amount,
                  min: draft.min,
                  max: draft.max,
                }),
          environment: app.project?.name || project,
        })}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      />
      <Confirm
        open={!!remove}
        onOpenChange={(open) => {
          if (!open && !write.isPending) setRemove(null);
        }}
        title={t('webhooksPage.deleteTitle')}
        description={t('webhooksPage.deleteDescription', { name: remove?.name || '' })}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{errorText(write.error)}</Alert>}
      </Confirm>
      <Modal
        open={!!secret}
        onOpenChange={(open) => {
          if (!open) {
            setSecret(null);
            setRevealed(false);
          }
        }}
        title={t('webhooksPage.urlTitle')}
        description={t('webhooksPage.urlDescription')}
      >
        <Field label={t('webhooksPage.invokeUrl')}>
          {(id) => (
            <input
              id={id}
              type={revealed ? 'text' : 'password'}
              value={secret?.url || ''}
              readOnly
              autoComplete="off"
            />
          )}
        </Field>
        <div className="row-actions about-links">
          <Button onClick={() => setRevealed((v) => !v)}>
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}{' '}
            {revealed ? t('webhooksPage.hideUrl') : t('webhooksPage.showUrl')}
          </Button>
          <Button
            onClick={async () => {
              if (secret)
                try {
                  await navigator.clipboard.writeText(secret.url);
                  toast(t('webhooksPage.copied'));
                } catch {
                  toast(t('webhooksPage.copyFailed'));
                }
            }}
          >
            <Copy size={16} />
            {t('webhooksPage.copy')}
          </Button>
        </div>
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('webhooksPage.discardTitle')}
        description={t('webhooksPage.discardDescription')}
        onConfirm={() => {
          setDiscard(false);
          clear();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('webhooksPage.contextTitle')}
        description={t('webhooksPage.contextDescription')}
        busy={write.isPending}
        onConfirm={() => {
          if (!write.isPending && blocker.state === 'blocked') {
            clear();
            setSecret(null);
            blocker.proceed();
          }
        }}
      />
    </>
  );
}
