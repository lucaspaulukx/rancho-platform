import { requestErrorText } from '../request-errors';
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
  settingMetadata,
  settingSnapshot,
  settingWritable,
  prepareSetting,
  SettingValidationError,
  type SettingMetadata,
  type SettingSnapshot,
} from '../server-settings';
import {
  Alert,
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
  | 'settings.loadFailed'
  | 'settings.changed'
  | 'settings.reopen'
  | 'settings.operationFailed'
  | 'settings.unavailable';
class SettingsPageError extends Error {
  constructor(
    readonly key: PageErrorKey,
    readonly status?: number,
  ) {
    super(key);
  }
}
export function Settings() {
  const app = useApp();
  return <SettingsScope key={app.identity} />;
}
function SettingsScope() {
  const { t } = useI18n();
  const errorText = (error: Error) =>
    error instanceof SettingsPageError
      ? error.status !== undefined
        ? t('settings.httpFailed', { status: error.status })
        : t(error.key)
      : error instanceof SettingValidationError
        ? t(error.key)
        : requestErrorText(error, t);
  async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
    try {
      return await api<T>(path, body, method, signal);
    } catch (e) {
      throw new SettingsPageError(
        'settings.operationFailed',
        e instanceof ApiError ? e.status : undefined,
      );
    }
  }

  const app = useApp(),
    scope = useRequestScope(app.identity + ':settings'),
    schemas = useSchemas(false),
    client = useQueryClient(),
    toast = useToast();
  const [editor, setEditor] = useState<SettingSnapshot | null>(null),
    [value, setValue] = useState(''),
    [revealed, setRevealed] = useState(false),
    [empty, setEmpty] = useState(false),
    [review, setReview] = useState(false),
    [reset, setReset] = useState(false),
    [discard, setDiscard] = useState(false),
    [opening, setOpening] = useState<string | null>(null),
    [error, setError] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ['data', app.identity, 'server-settings'],
    enabled: app.admin && app.config.modules.settings,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      try {
        return (await allPages<Resource>('settings?limit=100', signal)).map(settingMetadata);
      } catch {
        throw new SettingsPageError('settings.loadFailed');
      }
    },
  });
  async function open(row: SettingMetadata) {
    if (opening) return;
    setOpening(row.name);
    setError(null);
    try {
      const signal = scope.signal(),
        snapshot = settingSnapshot(await request<Resource>(row.self, undefined, undefined, signal));
      scope.assertCurrent();
      if (snapshot.name !== row.name) throw new SettingsPageError('settings.changed');
      setEditor(snapshot);
      setValue(snapshot.value ?? '');
      setEmpty(false);
      setRevealed(false);
      setReview(false);
      setReset(false);
    } catch (e) {
      setError(e instanceof Error ? e : new SettingsPageError('settings.unavailable'));
    } finally {
      setOpening(null);
    }
  }
  const dirty = !!editor && value !== (editor.value ?? '');
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!app.admin || !app.config.modules.settings || !editor)
        throw new SettingsPageError('settings.reopen');
      const signal = scope.signal(),
        contract = await request<Schema>('schemas/setting', undefined, undefined, signal);
      scope.assertCurrent();
      const fresh = settingSnapshot(
        await request<Resource>(editor.self, undefined, undefined, signal),
      );
      scope.assertCurrent();
      const payload = prepareSetting(contract, editor, fresh, value, empty, reset);
      await request<unknown>(fresh.self, payload, reset ? 'DELETE' : 'PUT', signal);
      scope.assertCurrent();
    },
    onSuccess: () => {
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity, 'server-settings'] });
      toast(t('settings.sent'));
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function clear() {
    setEditor(null);
    setValue('');
    setRevealed(false);
    setEmpty(false);
    setReview(false);
    setReset(false);
    write.reset();
  }
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  if (!app.admin || !app.config.modules.settings)
    return <Alert>{t('settings.accessUnavailable')}</Alert>;
  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            {t('settings.refresh')}
          </Button>
        }
      />
      <Alert tone="info">{t('settings.listInfo')}</Alert>
      {error && <Alert>{errorText(error)}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={new Error(errorText(query.error))} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          rows={query.data || []}
          rowKey={(v) => v.name}
          searchText={(v) => `${v.name} ${v.source ?? t('settings.unknown')}`}
          columns={[
            { key: 'name', label: t('settings.setting'), render: (v) => v.name },
            {
              key: 'source',
              label: t('settings.source'),
              render: (v) => v.source || t('settings.unknown'),
            },
            {
              key: 'database',
              label: t('settings.database'),
              render: (v) => (v.inDb ? t('settings.yes') : t('settings.no')),
            },
            {
              key: 'open',
              label: t('settings.details'),
              render: (v) => (
                <Button
                  aria-label={t('settings.open', { name: v.name })}
                  onClick={() => void open(v)}
                  disabled={!!opening}
                >
                  {opening === v.name ? t('settings.opening') : t('settings.edit')}
                </Button>
              ),
            },
          ]}
        />
      )}
      <Modal
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={t('settings.title')}
        description={editor?.name || t('settings.individual')}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              {t('settings.cancel')}
            </Button>
            {settingWritable(schemas.data?.setting, 'reset', editor ?? undefined) && (
              <Button
                onClick={() => {
                  write.reset();
                  setReset(true);
                  setRevealed(false);
                  setReview(true);
                }}
                disabled={write.isPending || dirty}
              >
                {t('settings.restore')}
              </Button>
            )}
            {settingWritable(schemas.data?.setting, 'update') && (
              <Button
                variant="primary"
                onClick={() => {
                  write.reset();
                  setReset(false);
                  setRevealed(false);
                  setReview(true);
                }}
                disabled={write.isPending || !dirty}
              >
                {t('settings.review')}
              </Button>
            )}
          </>
        }
      >
        <Alert tone="info">
          {t('settings.sourceInfo', { source: editor?.source || t('settings.unknown') })}
        </Alert>
        <Field label={t('settings.configured')}>
          {(id) =>
            revealed ? (
              <textarea
                id={id}
                rows={5}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setEmpty(false);
                }}
                autoComplete="off"
                disabled={!settingWritable(schemas.data?.setting, 'update') || write.isPending}
              />
            ) : (
              <input id={id} type="password" value={value} readOnly autoComplete="off" />
            )
          }
        </Field>
        <Field label={t('settings.effective')}>
          {(id) =>
            revealed ? (
              <textarea
                id={id}
                rows={5}
                value={editor?.activeValue ?? ''}
                readOnly
                autoComplete="off"
              />
            ) : (
              <input
                id={id}
                type="password"
                value={editor?.activeValue ?? ''}
                readOnly
                autoComplete="off"
              />
            )
          }
        </Field>
        <Button onClick={() => setRevealed((v) => !v)}>
          {revealed ? t('settings.hide') : t('settings.show')}
        </Button>
        {!value && (
          <CheckboxField
            label={t('settings.empty')}
            checked={empty}
            onChange={(e) => setEmpty(e.target.checked)}
          />
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(open) => {
          if (!write.isPending) setReview(open);
        }}
        title={reset ? t('settings.restoreTitle') : t('settings.changeTitle')}
        description={t('settings.reviewDescription', {
          name: editor?.name || '',
          effect: reset ? t('settings.restoreDescription') : t('settings.changeDescription'),
        })}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{errorText(write.error)}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('settings.discardTitle')}
        description={t('settings.discardDescription')}
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
        title={t('settings.leaveTitle')}
        description={t('settings.leaveDescription')}
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
