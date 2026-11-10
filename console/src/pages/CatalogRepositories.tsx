import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Resource, type Schema } from '../api';
import { useI18n } from '../i18n/provider';
import { SettingValidationError } from '../server-settings';
import { useApp } from '../state';
import { useSchemas } from '../hooks/useSchemas';
import { useRequestScope } from '../hooks/useRequestScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  repositoryDocument,
  repositoryMetadata,
  repositoryPayload,
  type RepositoryDocument,
  type RepositoryDraft,
} from '../catalog-repositories';
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
class CatalogRepositoryError extends Error {
  constructor(
    readonly key:
      | 'catalogRepositories.httpError'
      | 'catalogRepositories.requestError'
      | 'catalogRepositories.configurationUnavailable'
      | 'catalogRepositories.reopen',
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
      ? new CatalogRepositoryError('catalogRepositories.httpError', { status: e.status })
      : new CatalogRepositoryError('catalogRepositories.requestError');
  }
}
export function CatalogRepositories() {
  const app = useApp();
  return <RepositoryScope key={app.identity} />;
}
function RepositoryScope() {
  const { t } = useI18n();
  function errorText(error: Error) {
    if (error instanceof SettingValidationError) return t(error.key);
    if (!(error instanceof CatalogRepositoryError)) return error.message;
    return error.key === 'catalogRepositories.httpError'
      ? t(error.key, { status: error.params!.status })
      : t(error.key);
  }
  const app = useApp(),
    scope = useRequestScope(app.identity + ':catalog-repositories'),
    schemas = useSchemas(false),
    client = useQueryClient(),
    toast = useToast(),
    enabled = app.admin && app.config.modules.catalogRepositories;
  const [editor, setEditor] = useState<RepositoryDocument | null>(null),
    [rows, setRows] = useState<RepositoryDraft[]>([]),
    [revealed, setRevealed] = useState(false),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [empty, setEmpty] = useState(false),
    [opening, setOpening] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const query = useQuery({
    queryKey: ['data', app.identity, 'catalog-repositories'],
    enabled,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      repositoryMetadata(
        repositoryDocument(
          await request<Resource>('settings/catalog.url', undefined, undefined, signal),
        ),
      ),
  });
  const dirty = !!editor && JSON.stringify(rows) !== JSON.stringify(editor.entries);
  async function open() {
    setOpening(true);
    setError(null);
    try {
      const snapshot = repositoryDocument(
        await request<Resource>('settings/catalog.url', undefined, undefined, scope.signal()),
      );
      scope.assertCurrent();
      setEditor(snapshot);
      setRows(snapshot.entries.map((v) => ({ ...v })));
      setRevealed(false);
      setEmpty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e
          : new CatalogRepositoryError('catalogRepositories.configurationUnavailable'),
      );
    } finally {
      setOpening(false);
    }
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled || !editor) throw new CatalogRepositoryError('catalogRepositories.reopen');
      const signal = scope.signal(),
        schema = await request<Schema>('schemas/setting', undefined, undefined, signal);
      scope.assertCurrent();
      const fresh = repositoryDocument(
        await request<Resource>('settings/catalog.url', undefined, undefined, signal),
      );
      scope.assertCurrent();
      const payload = repositoryPayload(schema, editor, fresh, rows, empty);
      await request<unknown>('settings/catalog.url', payload, 'PUT', signal);
      scope.assertCurrent();
    },
    onSuccess: () => {
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast(t('catalogRepositories.saved'));
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function clear() {
    setEditor(null);
    setRows([]);
    setRevealed(false);
    setReview(false);
    setEmpty(false);
    write.reset();
  }
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else clear();
  }
  function change(key: string, field: 'name' | 'url' | 'branch', value: string) {
    setRows((v) => v.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  if (!enabled) return <Alert>{t('catalogRepositories.unavailable')}</Alert>;
  return (
    <>
      <PageHeader
        title={t('catalogRepositories.title')}
        description={t('catalogRepositories.description')}
        action={
          <>
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              {t('catalogRepositories.refresh')}
            </Button>
            <Button
              onClick={() => void open()}
              disabled={opening || !schemas.data?.setting?.resourceFields.value?.update}
            >
              {t('catalogRepositories.configure')}
            </Button>
          </>
        }
      />
      <Alert tone="info">{t('catalogRepositories.notice')}</Alert>
      {error && <Alert>{errorText(error)}</Alert>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        query.error instanceof CatalogRepositoryError ||
        query.error instanceof SettingValidationError ? (
          <div className="error-state">
            <Alert>{errorText(query.error)}</Alert>
            <Button onClick={() => void query.refetch()}>{t('catalogRepositories.retry')}</Button>
          </div>
        ) : (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        )
      ) : (
        <>
          <p className="muted">
            {t('catalogRepositories.source', {
              source: query.data.source || t('settings.unknown'),
            })}{' '}
            {query.data.inDb
              ? t('catalogRepositories.override')
              : t('catalogRepositories.noOverride')}
          </p>
          <DataTable
            label={t('catalogRepositories.tableLabel')}
            rows={query.data.entries}
            rowKey={(v) => v.name}
            searchText={(v) => `${v.name} ${v.branch}`}
            columns={[
              { key: 'name', label: t('catalogRepositories.repository'), render: (v) => v.name },
              {
                key: 'branch',
                label: t('catalogRepositories.branch'),
                render: (v) =>
                  v.usesDefaultBranch ? t('catalogRepositories.defaultBranch') : v.branch,
              },
            ]}
            emptyTitle={t('catalogRepositories.emptyTitle')}
            emptyDescription={t('catalogRepositories.emptyDescription')}
          />
        </>
      )}
      <Modal
        open={!!editor}
        drawer
        title={t('catalogRepositories.editorTitle')}
        description={t('catalogRepositories.editorDescription')}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              {t('catalogRepositories.cancel')}
            </Button>
            <Button
              onClick={() => {
                setRevealed(false);
                setReview(true);
              }}
              disabled={!dirty}
            >
              {t('catalogRepositories.review')}
            </Button>
          </>
        }
      >
        <CheckboxField
          label={t('catalogRepositories.showUrls')}
          checked={revealed}
          onChange={(e) => setRevealed(e.target.checked)}
        />
        {rows.map((row, index) => (
          <fieldset key={row.key} className="form-fieldset nested-fields">
            <legend>{t('catalogRepositories.repositoryIndex', { index: index + 1 })}</legend>
            <Field label={t('catalogRepositories.nameLabel', { index: index + 1 })}>
              {(id) => (
                <input
                  id={id}
                  value={row.name}
                  autoComplete="off"
                  onChange={(e) => change(row.key, 'name', e.target.value)}
                />
              )}
            </Field>
            <Field
              label={t('catalogRepositories.urlLabel', { index: index + 1 })}
              hint={t('catalogRepositories.urlHint')}
            >
              {(id, description) => (
                <input
                  id={id}
                  aria-describedby={description}
                  type={revealed ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={row.url}
                  onChange={(e) => change(row.key, 'url', e.target.value)}
                />
              )}
            </Field>
            <Field
              label={t('catalogRepositories.branchLabel', { index: index + 1 })}
              hint={t('catalogRepositories.branchHint')}
            >
              {(id, description) => (
                <input
                  id={id}
                  aria-describedby={description}
                  value={row.branch}
                  autoComplete="off"
                  onChange={(e) => change(row.key, 'branch', e.target.value)}
                />
              )}
            </Field>
            <Button
              onClick={() => setRows((v) => v.filter((r) => r.key !== row.key))}
              aria-label={t('catalogRepositories.removeLabel', { index: index + 1 })}
            >
              {t('catalogRepositories.remove')}
            </Button>
          </fieldset>
        ))}
        <Button
          onClick={() =>
            setRows((v) => [
              ...v,
              { key: crypto.randomUUID(), original: null, name: '', url: '', branch: 'master' },
            ])
          }
        >
          {t('catalogRepositories.add')}
        </Button>
        {!rows.length && (
          <CheckboxField
            label={t('catalogRepositories.confirmEmpty')}
            checked={empty}
            onChange={(e) => setEmpty(e.target.checked)}
          />
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(o) => {
          if (!write.isPending) setReview(o);
        }}
        title={t('catalogRepositories.saveTitle')}
        description={t('catalogRepositories.reviewDescription', { count: rows.length })}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{errorText(write.error)}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('catalogRepositories.discardTitle')}
        description={t('catalogRepositories.discardDescription')}
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
        title={t('catalogRepositories.leaveTitle')}
        description={t('catalogRepositories.leaveDescription')}
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
