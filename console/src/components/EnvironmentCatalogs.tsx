import { useI18n } from '../i18n/provider';
import { useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allPages, api, ApiError, type Resource } from '../api';
import { useApp, useDataKey } from '../state';
import { useActionScope } from '../hooks/useActionScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { useEnvironmentCatalogAccess } from '../hooks/useEnvironmentCatalogAccess';
import {
  environmentRepositoryMetadata,
  environmentRepositoryPath,
  prepareEnvironmentRepository,
  repositoryDraft,
  type EnvironmentRepository,
  type EnvironmentRepositoryDraft,
} from '../environment-catalogs';
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
  useToast,
} from './ui';

class EnvironmentCatalogError extends Error {
  constructor(
    readonly key:
      | 'environmentCatalogs.error.operation'
      | 'environmentCatalogs.error.list'
      | 'environmentCatalogs.error.unavailable'
      | 'environmentCatalogs.error.reopen',
    readonly status?: number,
  ) {
    super(key);
  }
}
const emptyDraft = (): EnvironmentRepositoryDraft => ({
  name: '',
  url: '',
  branch: 'master',
  kind: 'native',
});
export function EnvironmentCatalogs({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const errorText = (error: Error) =>
    error instanceof EnvironmentCatalogError
      ? error.status === undefined
        ? t(error.key)
        : t('environmentCatalogs.error.http', { status: error.status })
      : error.message;
  const app = useApp(),
    scope = useActionScope(),
    client = useQueryClient(),
    toast = useToast();
  const environment = app.project!.id;
  const access = useEnvironmentCatalogAccess();
  const enabled = access.allowed;
  const headers = { 'X-Api-Project-Id': environment };
  const [before, setBefore] = useState<Resource | undefined>();
  const [draft, setDraft] = useState<EnvironmentRepositoryDraft | null>(null);
  const [revealed, setRevealed] = useState(false),
    [opening, setOpening] = useState(false);
  const [review, setReview] = useState<'save' | 'remove' | null>(null);
  const [discard, setDiscard] = useState(false),
    [discardCloses, setDiscardCloses] = useState(false),
    [error, setError] = useState<Error | null>(null);
  async function request<T>(
    path: string,
    body?: unknown,
    method?: string,
    signal = scope.signal(),
  ) {
    try {
      return await api<T>(path, body, method, signal, headers);
    } catch (e) {
      throw e instanceof ApiError
        ? new EnvironmentCatalogError('environmentCatalogs.error.operation', e.status)
        : new EnvironmentCatalogError('environmentCatalogs.error.operation');
    }
  }
  async function rows(signal = scope.signal()) {
    try {
      return await allPages<Resource>('/v1-catalog/catalogs', signal, headers);
    } catch {
      throw new EnvironmentCatalogError('environmentCatalogs.error.list');
    }
  }
  const query = useQuery({
    queryKey: useDataKey('environment-catalogs'),
    enabled,
    gcTime: 0,
    queryFn: async ({ signal }) => (await rows(signal)).map(environmentRepositoryMetadata),
  });
  const dirty =
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(before ? repositoryDraft(before) : emptyDraft());
  async function open(row: EnvironmentRepository, remove = false) {
    setOpening(true);
    setError(null);
    try {
      await access.check(scope.signal());
      scope.assertCurrent();
      const fresh = (await rows()).find(
        (v) => v.id === row.id && v.name === row.name && v.environmentId === environment,
      );
      scope.assertCurrent();
      if (!fresh || fresh.kind !== 'native')
        throw new EnvironmentCatalogError('environmentCatalogs.error.unavailable');
      setBefore(fresh);
      setDraft(repositoryDraft(fresh));
      setRevealed(false);
      if (remove) setReview('remove');
    } catch (e) {
      setError(e as Error);
    } finally {
      setOpening(false);
    }
  }
  function clear() {
    setDraft(null);
    setBefore(undefined);
    setRevealed(false);
    setReview(null);
    setError(null);
    write.reset();
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!enabled || !draft || !review)
        throw new EnvironmentCatalogError('environmentCatalogs.error.reopen');
      await access.check(scope.signal());
      scope.assertCurrent();
      await request<Resource>('projects/' + environment);
      scope.assertCurrent();
      const fresh = await rows();
      scope.assertCurrent();
      const payload = prepareEnvironmentRepository(
        environment,
        draft,
        fresh,
        before,
        review === 'remove',
      );
      const path = before ? environmentRepositoryPath(draft.name) : '/v1-catalog/catalogs';
      await request<unknown>(
        path,
        payload,
        review === 'remove' ? 'DELETE' : before ? 'PUT' : 'POST',
      );
      scope.assertCurrent();
    },
    onSuccess: () => {
      const removed = review === 'remove';
      clear();
      void client.invalidateQueries({ queryKey: ['data', app.identity] });
      toast(removed ? t('environmentCatalogs.removed') : t('environmentCatalogs.saved'));
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (write.isPending) return;
    if (dirty) {
      setDiscardCloses(true);
      setDiscard(true);
    } else {
      clear();
      onClose();
    }
  }
  if (!enabled) return null;
  return (
    <>
      <Modal
        open
        drawer
        title={t('environmentCatalogs.title')}
        description={t('environmentCatalogs.description', { environment: app.project!.name })}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <Button onClick={close} disabled={write.isPending}>
            {t('environmentCatalogs.close')}
          </Button>
        }
      >
        <Alert tone="info">{t('environmentCatalogs.notice')}</Alert>
        {error && <Alert>{errorText(error)}</Alert>}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState
            error={
              query.error instanceof EnvironmentCatalogError
                ? new Error(errorText(query.error))
                : query.error
            }
            retry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            label={t('environmentCatalogs.sources')}
            rows={query.data || []}
            rowKey={(v) => v.id}
            searchText={(v) => `${v.name} ${v.branch}`}
            columns={[
              { key: 'name', label: t('environmentCatalogs.repository'), render: (v) => v.name },
              {
                key: 'scope',
                label: t('environmentCatalogs.scope'),
                render: (v) => (
                  <Badge>
                    {v.environmentId === environment
                      ? t('environmentCatalogs.thisEnvironment')
                      : t('environmentCatalogs.global')}
                  </Badge>
                ),
              },
              {
                key: 'branch',
                label: t('environmentCatalogs.branch'),
                render: (v) => v.branch || t('environmentCatalogs.serverDefault'),
              },
              {
                key: 'actions',
                label: t('environmentCatalogs.actions'),
                render: (v) =>
                  v.environmentId === environment && v.kind === 'native' ? (
                    <div className="row-actions">
                      <Button disabled={opening || !!draft} onClick={() => void open(v)}>
                        {t('environmentCatalogs.edit', { name: v.name })}
                      </Button>
                      <Button disabled={opening || !!draft} onClick={() => void open(v, true)}>
                        {t('environmentCatalogs.remove', { name: v.name })}
                      </Button>
                    </div>
                  ) : (
                    t('environmentCatalogs.readOnly')
                  ),
              },
            ]}
            emptyTitle={t('environmentCatalogs.empty')}
            emptyDescription={t('environmentCatalogs.emptyDescription')}
          />
        )}
        {!draft && (
          <Button
            disabled={opening}
            onClick={() => {
              setBefore(undefined);
              setDraft(emptyDraft());
              setError(null);
            }}
          >
            {t('environmentCatalogs.add')}
          </Button>
        )}
        {draft && (
          <fieldset className="form-fieldset nested-fields" disabled={write.isPending}>
            <legend>
              {before ? t('environmentCatalogs.editSource') : t('environmentCatalogs.newSource')}
            </legend>
            <Field label={t('environmentCatalogs.name')}>
              {(id) => (
                <input
                  id={id}
                  value={draft.name}
                  disabled={!!before}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  autoComplete="off"
                />
              )}
            </Field>
            <CheckboxField
              label={t('environmentCatalogs.showUrl')}
              checked={revealed}
              onChange={(e) => setRevealed(e.target.checked)}
            />
            <Field label={t('environmentCatalogs.url')} hint={t('environmentCatalogs.urlHint')}>
              {(id, description) => (
                <input
                  id={id}
                  aria-describedby={description}
                  type={revealed ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('environmentCatalogs.repositoryBranch')}>
              {(id) => (
                <input
                  id={id}
                  value={draft.branch}
                  onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                  autoComplete="off"
                />
              )}
            </Field>
            <p className="muted">{t('environmentCatalogs.typeNotice')}</p>
            <div className="row-actions">
              <Button
                onClick={() => {
                  if (dirty) {
                    setDiscardCloses(false);
                    setDiscard(true);
                  } else clear();
                }}
              >
                {t('environmentCatalogs.cancel')}
              </Button>
              <Button
                disabled={!dirty}
                onClick={() => {
                  setRevealed(false);
                  setReview('save');
                }}
              >
                {t('environmentCatalogs.review')}
              </Button>
            </div>
          </fieldset>
        )}
      </Modal>
      <Confirm
        open={!!review}
        onOpenChange={(o) => {
          if (!o && !write.isPending) {
            setReview(null);
            write.reset();
          }
        }}
        title={
          review === 'remove'
            ? t('environmentCatalogs.removeTitle')
            : t('environmentCatalogs.saveTitle')
        }
        description={t(
          review === 'remove'
            ? 'environmentCatalogs.removeDescription'
            : 'environmentCatalogs.saveDescription',
          {
            name: draft?.name || t('environmentCatalogs.repository'),
            environment: app.project!.name,
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
        title={t('environmentCatalogs.discard')}
        description={t('environmentCatalogs.unsent')}
        onConfirm={() => {
          setDiscard(false);
          clear();
          if (discardCloses) onClose();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('environmentCatalogs.leave')}
        description={t('environmentCatalogs.wait')}
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
