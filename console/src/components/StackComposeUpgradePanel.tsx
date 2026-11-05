import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Resource, type Schema } from '../api';
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
async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  try {
    return await api<T>(path, body, method, signal);
  } catch (e) {
    throw new Error(
      e instanceof ApiError
        ? `Operação Compose não concluída (HTTP ${e.status}). Revise o arquivo ou consulte os processos da stack.`
        : 'Não foi possível concluir a operação Compose.',
    );
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
      throw new Error('Editor Compose indisponível para esta stack.');
    const base = `projects/${scope.environment}/`,
      [stack, permission] = await Promise.all([
        request<Resource>(base + 'stacks/' + resource.id, undefined, undefined, signal),
        request<Schema>(base + 'schemas/stack', undefined, undefined, signal),
      ]);
    scope.resource(stack, resource);
    if (!composeStackPermission(permission))
      throw new Error('Sua permissão de exportar ou atualizar não está disponível.');
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
          setError(e instanceof Error ? e : new Error('Compose indisponível.'));
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
      if (!baseline || !enabled) throw new Error('Reabra o editor Compose.');
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
      toast(
        'Upgrade recebido. Acompanhe a stack e escolha finalizar ou rollback nas ações nativas.',
      );
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
        title={`Atualizar Compose · ${resource.name || resource.id}`}
        description={`Environment: ${app.project?.name || '—'}. Arquivos exportados da configuração atual.`}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setEditorKey((v) => v + 1);
                setReview(true);
              }}
              disabled={loading || !!error || !dirty || !impact}
            >
              Revisar atualização
            </Button>
          </>
        }
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} retry={() => setAttempt((v) => v + 1)} />
        ) : (
          <>
            <Alert tone="warning">
              Atualizar Compose pode iniciar serviços e recriar containers. O Rancher preserva a
              escala dos serviços existentes; use Escalar serviço para alterá-la. Novos serviços
              podem iniciar com escala 1 mesmo com scale: 0 no arquivo. A exportação não é um backup
              completo do ambiente. Confirme a escala e os arquivos antes de continuar.
            </Alert>
            <ComposeEditor
              key={'docker:' + editorKey}
              label="Docker Compose"
              value={draft.dockerCompose}
              onChange={(value) => {
                setDraft((v) => ({ ...v, dockerCompose: value }));
                setImpact(false);
              }}
              required
            />
            <ComposeEditor
              key={'rancher:' + editorKey}
              label="Rancher Compose"
              value={draft.rancherCompose}
              onChange={(value) => {
                setDraft((v) => ({ ...v, rancherCompose: value }));
                setImpact(false);
              }}
            />
            <CheckboxField
              label="Entendo que o upgrade pode iniciar serviços e substituir containers"
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
        title="Atualizar a stack por Compose?"
        description="Os arquivos foram ocultados na revisão. A stack e sua exportação serão conferidas novamente antes do envio. Parâmetros existentes serão preservados; o servidor valida o YAML e executa a atualização."
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar alterações Compose?"
        description="Os arquivos editados ainda não foram enviados ao Rancher."
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
        title="Sair com Compose pendente?"
        description="Os arquivos ainda não foram enviados. Aguarde qualquer atualização em andamento."
        busy={write.isPending}
        onConfirm={() => {
          if (!write.isPending && blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
