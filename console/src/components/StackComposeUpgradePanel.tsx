import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Resource, type Schema } from '../api';
import { useI18n } from '../i18n/provider';
import { useApp } from '../state';
import { useActionScope } from '../hooks/useActionScope';
import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import {
  composeExport,
  composeStackEligible,
  composeStackMetadata,
  composeStackPermission,
  composeStackTarget,
  prepareComposeUpgrade,
  type ComposeTexts,
} from '../stack-compose-upgrade';
import { ComposeEditor } from './ComposeEditor';
import { Alert, Button, CheckboxField, Confirm, ErrorState, Loading, Modal, useToast } from './ui';
type ComposeErrorKey =
  | 'stackComposeUpgradePanel.unavailable'
  | 'stackComposeUpgradePanel.permission'
  | 'stackComposeUpgradePanel.loadFailed'
  | 'stackComposeUpgradePanel.reopen'
  | 'stackComposeUpgradePanel.requestFailed';
class ComposePanelError extends Error {
  constructor(
    ...args:
      | [key: ComposeErrorKey]
      | [key: 'stackComposeUpgradePanel.httpError', params: { status: string }]
  ) {
    super(args[0]);
    this.detail = args;
  }
  readonly detail:
    | [key: ComposeErrorKey]
    | [key: 'stackComposeUpgradePanel.httpError', params: { status: string }];
}
async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  try {
    return await api<T>(path, body, method, signal);
  } catch (e) {
    throw e instanceof ApiError
      ? new ComposePanelError('stackComposeUpgradePanel.httpError', { status: String(e.status) })
      : new ComposePanelError('stackComposeUpgradePanel.requestFailed');
  }
}
interface Props {
  resource: Resource;
  onClose: () => void;
  onSaved: (value: Resource) => void;
}
export default function StackComposeUpgradePanel(props: Props) {
  const app = useApp();
  return (
    <ComposeScope key={`${app.identity}:${app.project?.id}:${props.resource.id}`} {...props} />
  );
}
function ComposeScope({ resource, onClose, onSaved }: Props) {
  const { t } = useI18n();
  function errorText(error: Error) {
    if (!(error instanceof ComposePanelError)) return error.message;
    const [key, params] = error.detail;
    return key === 'stackComposeUpgradePanel.httpError' ? t(key, params) : t(key);
  }
  const app = useApp(),
    scope = useActionScope(),
    client = useQueryClient(),
    toast = useToast();
  const [baseline, setBaseline] = useState<{ stack: Resource; texts: ComposeTexts } | null>(null),
    [draft, setDraft] = useState<ComposeTexts>({ dockerCompose: '', rancherCompose: '' }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null),
    [attempt, setAttempt] = useState(0),
    [impact, setImpact] = useState(false),
    [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [editorKey, setEditorKey] = useState(0);
  const updated = useRef<Resource | null>(null),
    enabled =
      app.config.modules.stackComposeUpgrades &&
      app.config.modules.workloads &&
      app.project?.orchestration === 'cattle';
  async function load(signal: AbortSignal) {
    if (!enabled || !composeStackEligible(resource))
      throw new ComposePanelError('stackComposeUpgradePanel.unavailable');
    const base = `projects/${scope.environment}/`,
      [stack, permission] = await Promise.all([
        request<Resource>(base + 'stacks/' + resource.id, undefined, undefined, signal),
        request<Schema>(base + 'schemas/stack', undefined, undefined, signal),
      ]);
    scope.resource(stack, resource);
    if (!composeStackPermission(permission))
      throw new ComposePanelError('stackComposeUpgradePanel.permission');
    const exported = await request<Resource>(
      composeStackTarget(stack, scope.environment!, 'exportconfig'),
      {},
      'POST',
      signal,
    );
    scope.assertCurrent();
    return { stack, texts: composeExport(exported) };
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(controller.signal)
      .then((data) => {
        scope.assertCurrent();
        setBaseline(data);
        setDraft({ ...data.texts });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e : new ComposePanelError('stackComposeUpgradePanel.loadFailed'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const dirty =
    !!baseline &&
    (draft.dockerCompose !== baseline.texts.dockerCompose ||
      draft.rancherCompose !== baseline.texts.rancherCompose);
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!baseline || !enabled) throw new ComposePanelError('stackComposeUpgradePanel.reopen');
      const signal = scope.signal(),
        base = `projects/${scope.environment}/`;
      const [fresh, permission, input] = await Promise.all([
        load(signal),
        request<Schema>(base + 'schemas/stack', undefined, undefined, signal),
        request<Schema>(base + 'schemas/stackUpgrade', undefined, undefined, signal),
      ]);
      scope.assertCurrent();
      const payload = prepareComposeUpgrade(
        baseline.stack,
        fresh.stack,
        baseline.texts,
        fresh.texts,
        draft,
        permission,
        input,
        scope.environment!,
        impact,
      );
      const result = await request<Resource>(
        composeStackTarget(fresh.stack, scope.environment!, 'upgrade'),
        payload,
        'POST',
        signal,
      );
      scope.resource(result, resource);
      updated.current = composeStackMetadata(result);
    },
    onSuccess: () => {
      setBaseline(null);
      setDraft({ dockerCompose: '', rancherCompose: '' });
      setReview(false);
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast(t('stackComposeUpgradePanel.saved'));
      if (updated.current) onSaved(updated.current);
    },
  });
  const blocker = useBlocker(dirty || write.isPending);
  usePageLeaveGuard(dirty || write.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (write.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  return (
    <>
      <Modal
        open
        drawer
        title={t('stackComposeUpgradePanel.title', { name: resource.name || resource.id })}
        description={t('stackComposeUpgradePanel.description', { name: app.project?.name || '—' })}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              {t('stackComposeUpgradePanel.close')}
            </Button>
            <Button
              onClick={() => {
                setEditorKey((v) => v + 1);
                setReview(true);
              }}
              disabled={loading || !!error || !dirty || !impact}
            >
              {t('stackComposeUpgradePanel.review')}
            </Button>
          </>
        }
      >
        {loading ? (
          <Loading />
        ) : error ? (
          error instanceof ComposePanelError ? (
            <div className="error-state">
              <Alert>{errorText(error)}</Alert>
              <Button onClick={() => setAttempt((v) => v + 1)}>{t('ui.retry')}</Button>
            </div>
          ) : (
            <ErrorState error={error} retry={() => setAttempt((v) => v + 1)} />
          )
        ) : (
          <>
            <Alert tone="warning">{t('stackComposeUpgradePanel.warning')}</Alert>
            <ComposeEditor
              key={'docker:' + editorKey}
              label={t('stackComposeUpgradePanel.dockerCompose')}
              value={draft.dockerCompose}
              onChange={(value) => {
                setDraft((v) => ({ ...v, dockerCompose: value }));
                setImpact(false);
              }}
              required
            />
            <ComposeEditor
              key={'rancher:' + editorKey}
              label={t('stackComposeUpgradePanel.rancherCompose')}
              value={draft.rancherCompose}
              onChange={(value) => {
                setDraft((v) => ({ ...v, rancherCompose: value }));
                setImpact(false);
              }}
            />
            <CheckboxField
              label={t('stackComposeUpgradePanel.impact')}
              checked={impact}
              onChange={(e) => setImpact(e.target.checked)}
            />
          </>
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(o) => {
          if (!write.isPending) setReview(o);
        }}
        title={t('stackComposeUpgradePanel.reviewTitle')}
        description={t('stackComposeUpgradePanel.reviewDescription')}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{errorText(write.error)}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title={t('stackComposeUpgradePanel.discardTitle')}
        description={t('stackComposeUpgradePanel.discardDescription')}
        onConfirm={() => {
          setDiscard(false);
          onClose();
        }}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('stackComposeUpgradePanel.leaveTitle')}
        description={t('stackComposeUpgradePanel.leaveDescription')}
        busy={write.isPending}
        onConfirm={() => {
          if (!write.isPending && blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
