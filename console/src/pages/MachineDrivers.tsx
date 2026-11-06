import { ActionMenu, type MenuAction } from '../components/ActionMenu';
import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, allPages, ApiError, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useI18n } from '../i18n/provider';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  driverMetadata,
  driverSnapshot,
  driverPayload,
  driverAction,
  customDriver,
  sameDriver,
  emptyDriver,
  type DriverFields,
  type DriverSnapshot,
  type DriverMetadata,
  type DriverAction,
} from '../machine-drivers';
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
type PageErrorKey =
  | 'machineDrivers.loadFailed'
  | 'machineDrivers.changed'
  | 'machineDrivers.editUnavailable'
  | 'machineDrivers.accessUnavailable'
  | 'machineDrivers.activationDisabled'
  | 'machineDrivers.reopen'
  | 'machineDrivers.operationFailed'
  | 'machineDrivers.unavailable';
class DriverPageError extends Error {
  constructor(
    readonly key: PageErrorKey,
    readonly status?: number,
  ) {
    super(key);
  }
}
export function MachineDrivers() {
  const app = useApp();
  return <DriverScope key={app.identity} />;
}
function DriverScope() {
  const { t } = useI18n();
  const errorText = (error: Error) =>
    error instanceof DriverPageError
      ? error.status !== undefined
        ? t('machineDrivers.httpFailed', { status: error.status })
        : t(error.key)
      : error.message;
  async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
    try {
      return await api<T>(path, body, method, signal);
    } catch (e) {
      throw new DriverPageError(
        'machineDrivers.operationFailed',
        e instanceof ApiError ? e.status : undefined,
      );
    }
  }

  const app = useApp(),
    scope = useRequestScope(app.identity + ':drivers'),
    schemas = useSchemas(false),
    client = useQueryClient(),
    toast = useToast();
  const [editor, setEditor] = useState<DriverSnapshot | 'new' | null>(null),
    [fields, setFields] = useState<DriverFields>({ ...emptyDriver }),
    [revealed, setRevealed] = useState(false),
    [auto, setAuto] = useState(true),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [action, setAction] = useState<{ row: DriverSnapshot; kind: DriverAction } | null>(null),
    [opening, setOpening] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const enabled = app.admin && app.config.modules.machineDrivers;
  const query = useQuery({
    queryKey: ['data', app.identity, 'machine-drivers'],
    enabled,
    gcTime: 0,
    refetchInterval: auto ? 5000 : false,
    queryFn: async ({ signal }) => {
      try {
        return (await allPages<Resource>('machinedrivers?limit=100', signal)).map(driverMetadata);
      } catch {
        throw new DriverPageError('machineDrivers.loadFailed');
      }
    },
  });
  const before = editor && editor !== 'new' ? editor : undefined;
  const dirty =
    !!editor &&
    (Object.keys(emptyDriver) as (keyof DriverFields)[]).some(
      (k) => fields[k] !== (before?.[k] ?? ''),
    );
  function clear() {
    setEditor(null);
    setFields({ ...emptyDriver });
    setRevealed(false);
    setReview(false);
    setAction(null);
    write.reset();
  }
  async function open(row: DriverMetadata, kind?: DriverAction) {
    if (opening) return;
    setOpening(true);
    setError(null);
    try {
      const snapshot = driverSnapshot(
        await request<Resource>(row.self, undefined, undefined, scope.signal()),
      );
      scope.assertCurrent();
      if (snapshot.id !== row.id) throw new DriverPageError('machineDrivers.changed');
      if (kind) setAction({ row: snapshot, kind });
      else {
        if (!customDriver(snapshot)) throw new DriverPageError('machineDrivers.editUnavailable');
        setEditor(snapshot);
        setFields({
          url: snapshot.url,
          uiUrl: snapshot.uiUrl,
          checksum: snapshot.checksum,
          description: snapshot.description,
        });
        setRevealed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new DriverPageError('machineDrivers.unavailable'));
    } finally {
      setOpening(false);
    }
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled) throw new DriverPageError('machineDrivers.accessUnavailable');
      const signal = scope.signal(),
        schema = await request<Schema>('schemas/machineDriver', undefined, undefined, signal);
      scope.assertCurrent();
      if (action) {
        if (action.kind !== 'remove' && !app.config.modules.driverActivation)
          throw new DriverPageError('machineDrivers.activationDisabled');
        const fresh = driverSnapshot(
          await request<Resource>(action.row.self, undefined, undefined, signal),
        );
        scope.assertCurrent();
        const target = driverAction(schema, action.row, fresh, action.kind);
        await request<unknown>(target, {}, 'POST', signal);
      } else {
        if (!editor) throw new DriverPageError('machineDrivers.reopen');
        const fresh = before
          ? driverSnapshot(await request<Resource>(before.self, undefined, undefined, signal))
          : undefined;
        scope.assertCurrent();
        if (before && fresh) sameDriver(before, fresh);
        const payload = driverPayload(schema, fields, before, fresh);
        await request<unknown>(
          before?.self || 'machinedrivers',
          payload,
          before ? 'PUT' : 'POST',
          signal,
        );
      }
      scope.assertCurrent();
    },
    onSuccess: () => {
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'machine-drivers'] });
      toast(t('machineDrivers.sent'));
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  if (!enabled) return <Alert>{t('machineDrivers.driversUnavailable')}</Alert>;
  const actionLabels: Record<DriverAction, string> = {
    activate: t('machineDrivers.activate'),
    reactivate: t('machineDrivers.reactivate'),
    deactivate: t('machineDrivers.deactivate'),
    remove: t('machineDrivers.remove'),
  };
  return (
    <>
      <PageHeader
        title={t('machineDrivers.title')}
        description={t('machineDrivers.description')}
        action={
          <>
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              {t('machineDrivers.refresh')}
            </Button>
            <Button
              disabled={!schemas.data?.machineDriver?.collectionMethods?.includes('POST')}
              onClick={() => {
                setEditor('new');
                setFields({ ...emptyDriver });
                setError(null);
              }}
            >
              {t('machineDrivers.add')}
            </Button>
          </>
        }
      />
      <CheckboxField
        label={t('machineDrivers.auto')}
        checked={auto}
        onChange={(e) => setAuto(e.target.checked)}
      />
      <Alert tone="info">{t('machineDrivers.info')}</Alert>
      {error && <Alert>{errorText(error)}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={new Error(errorText(query.error))} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          label={t('machineDrivers.title')}
          rows={query.data || []}
          rowKey={(v) => v.id}
          searchText={(v) =>
            `${v.name} ${v.state} ${v.builtin ? t('machineDrivers.builtin') : v.catalog ? t('machineDrivers.catalog') : t('machineDrivers.custom')}`
          }
          columns={[
            { key: 'name', label: t('machineDrivers.driver'), render: (v) => v.name },
            {
              key: 'state',
              label: t('machineDrivers.state'),
              render: (v) => <Badge state={v.state}>{v.state || '—'}</Badge>,
            },
            {
              key: 'origin',
              label: t('machineDrivers.origin'),
              render: (v) =>
                v.builtin
                  ? t('machineDrivers.builtin')
                  : v.catalog
                    ? t('machineDrivers.catalog')
                    : t('machineDrivers.custom'),
            },
            {
              key: 'actions',
              label: t('machineDrivers.actions'),
              render: (v) => {
                const actions: MenuAction[] = [];
                if (customDriver(v) && ['active', 'inactive', 'error'].includes(v.state))
                  actions.push({
                    id: 'edit',
                    label: t('machineDrivers.edit'),
                    disabled: opening,
                    onSelect: () => void open(v),
                  });
                if (app.config.modules.driverActivation)
                  for (const k of ['activate', 'reactivate', 'deactivate'] as const)
                    if (v.actions[k])
                      actions.push({
                        id: k,
                        label: t('machineDrivers.actionLabel', { action: actionLabels[k] }),
                        disabled: opening,
                        onSelect: () => void open(v, k),
                      });
                if (customDriver(v) && v.actions.remove)
                  actions.push({
                    id: 'remove',
                    label: t('machineDrivers.removeDriver'),
                    danger: true,
                    disabled: opening,
                    onSelect: () => void open(v, 'remove'),
                  });
                return (
                  <ActionMenu
                    label={t('machineDrivers.rowActions', { name: v.name })}
                    actions={actions}
                  />
                );
              },
            },
          ]}
        />
      )}
      <Modal
        open={!!editor}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        title={before ? t('machineDrivers.edit') : t('machineDrivers.add')}
        description={before?.name || t('machineDrivers.nameHint')}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              {t('machineDrivers.cancel')}
            </Button>
            <Button
              onClick={() => {
                setRevealed(false);
                setReview(true);
              }}
              disabled={!fields.url || !dirty}
            >
              {t('machineDrivers.review')}
            </Button>
          </>
        }
      >
        <CheckboxField
          label={t('machineDrivers.show')}
          checked={revealed}
          onChange={(e) => setRevealed(e.target.checked)}
        />
        {(Object.keys(emptyDriver) as (keyof DriverFields)[]).map((key) => (
          <Field
            key={key}
            label={
              {
                url: t('machineDrivers.binaryUrl'),
                uiUrl: t('machineDrivers.uiUrl'),
                checksum: t('machineDrivers.checksum'),
                description: t('machineDrivers.fieldDescription'),
              }[key]
            }
            hint={key === 'url' ? t('machineDrivers.binaryHint') : undefined}
          >
            {(id, descriptionId) => (
              <input
                id={id}
                aria-describedby={descriptionId}
                type={key === 'description' || revealed ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={fields[key]}
                onChange={(e) => setFields((v) => ({ ...v, [key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </Modal>
      <Confirm
        open={review || !!action}
        onOpenChange={(o) => {
          if (!write.isPending && !o) {
            setReview(false);
            setAction(null);
            write.reset();
          }
        }}
        title={
          action
            ? t('machineDrivers.actionTitle', { action: actionLabels[action.kind] })
            : t('machineDrivers.saveTitle')
        }
        description={
          action
            ? t('machineDrivers.actionDescription', {
                name: action.row.name,
                effect:
                  action.kind === 'remove'
                    ? t('machineDrivers.removeDescription')
                    : action.kind === 'deactivate'
                      ? t('machineDrivers.deactivateDescription')
                      : t('machineDrivers.activateDescription'),
              })
            : t('machineDrivers.saveDescription')
        }
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{errorText(write.error)}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('machineDrivers.discardTitle')}
        description={t('machineDrivers.discardDescription')}
        onConfirm={() => {
          setDiscard(false);
          clear();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('machineDrivers.leaveTitle')}
        description={t('machineDrivers.leaveDescription')}
        busy={write.isPending}
        onConfirm={() => {
          if (!write.isPending && blocker.state === 'blocked') {
            clear();
            blocker.proceed();
          }
        }}
      />
    </>
  );
}
