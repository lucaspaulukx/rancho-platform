import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { api, allPages, ApiError, type Resource, type Schema, type Collection } from '../api';
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
const names: Record<string, string> = {
  scaleService: 'Escala de serviço',
  serviceUpgrade: 'Atualização de serviços',
  scaleHost: 'Escala de hosts',
  forwardPost: 'Encaminhamento HTTP',
};
async function request<T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) {
  try {
    return await api<T>(path, body, method, signal);
  } catch (e) {
    throw new Error(
      e instanceof ApiError
        ? `Operação de webhook indisponível (HTTP ${e.status}).`
        : 'Não foi possível concluir a operação de webhook.',
    );
  }
}
async function contracts(project: string, signal?: AbortSignal) {
  const rows = await request<Collection<Schema>>(
    '/v1-webhooks/schemas?projectId=' + project,
    undefined,
    undefined,
    signal,
  );
  if (!Array.isArray(rows.data)) throw new Error('Contrato de webhooks inválido.');
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
  const app = useApp();
  return app.project ? (
    <WebhookScope key={app.identity + ':' + app.project.id} project={app.project.id} />
  ) : (
    <Empty
      title="Selecione um environment"
      description="Os webhooks pertencem ao environment selecionado."
    />
  );
}
function WebhookScope({ project }: { project: string }) {
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
    [error, setError] = useState(''),
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
          throw new Error('A coleção é muito grande ou retornou paginação inválida.');
        seen.add(next);
        const page = await request<Collection<Resource>>(next, undefined, undefined, signal);
        if (!Array.isArray(page.data)) throw new Error('Lista de webhooks inválida.');
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
    setError('');
    write.reset();
  }
  async function freshPermission(signal: AbortSignal) {
    const [s, r] = await Promise.all([contracts(project, signal), access(project, signal)]);
    scope.assertCurrent();
    if (!webhookWriter(r, project))
      throw new Error('Seu acesso não permite gerenciar webhooks neste environment.');
    return s;
  }
  async function open(row: ReceiverMetadata, clone = false) {
    if (opening) return;
    setOpening(row.id);
    setError('');
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
      if (receiverMetadata(value).id !== row.id) throw new Error('Receiver indisponível.');
      if (clone) {
        setDraft(cloneReceiver(value));
        setEditor(true);
        setDirty(true);
      } else {
        setSecret(receiverSecret(value, project));
        setRevealed(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Receiver indisponível.');
    } finally {
      setOpening(null);
    }
  }
  const write = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!app.config.modules.webhooks) throw new Error('O módulo de webhooks está desativado.');
      const signal = scope.signal(),
        current = await freshPermission(signal);
      if (remove) {
        if (!current.receiver?.resourceMethods?.includes('DELETE'))
          throw new Error('A exclusão não está disponível.');
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
          throw new Error('O receiver mudou. Atualize e revise novamente.');
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
        setError(
          'O webhook foi criado. A URL não foi exibida; consulte-a novamente pelo menu do receiver.',
        );
      }
    },
    onSuccess: () => {
      setRemove(null);
      setReview(false);
      void client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', project, 'webhooks'],
      });
      toast('Operação de webhook concluída. Nenhum evento foi enviado.');
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
                    up: 'Aumentar',
                    down: 'Reduzir',
                    leastRecent: 'Menos recente',
                    mostRecent: 'Mais recente',
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
        title="Webhooks"
        description="Webhooks por environment. Criar, consultar ou excluir não dispara o evento."
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
              Atualizar
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
                Criar webhook
              </Button>
            )}
          </>
        }
      />
      <Alert tone="info">
        A URL de invocação contém uma credencial. Ela é consultada separadamente e fica protegida.
        Esta tela não envia eventos de teste nem abre a URL automaticamente.
      </Alert>
      {!authorization.isPending && !writer && (
        <Alert tone="info">
          Seu perfil pode consultar os metadados disponíveis. Criação, clonagem, exclusão e URL
          exigem acesso de gerenciamento comprovado.
        </Alert>
      )}
      {authorization.error && (
        <Alert>
          Não foi possível confirmar o acesso de gerenciamento. Atualize para tentar novamente.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {list.isPending || schema.isPending ? (
        <Loading />
      ) : list.error || schema.error ? (
        <ErrorState
          error={list.error || schema.error}
          retry={() => {
            void list.refetch();
            void schema.refetch();
          }}
        />
      ) : (
        <DataTable
          rows={list.data || []}
          rowKey={(v) => v.id}
          searchText={(v) => `${v.name} ${v.driver} ${v.target}`}
          columns={[
            { key: 'name', label: 'Nome', render: (v) => v.name },
            { key: 'driver', label: 'Função', render: (v) => names[v.driver] || v.driver },
            {
              key: 'target',
              label: 'Alvo',
              render: (v) => services.data?.find((s) => s.id === v.target)?.name || v.target,
            },
            { key: 'state', label: 'Estado', render: (v) => v.state || '—' },
            {
              key: 'actions',
              label: 'Ações',
              render: (v) => (
                <ActionMenu
                  label={`Ações do webhook ${v.name}`}
                  actions={
                    writer
                      ? [
                          {
                            id: 'url',
                            label: 'Consultar URL protegida',
                            disabled: pending,
                            onSelect: () => void open(v),
                          },
                          ...(webhookDrivers.includes(v.driver as WebhookDraft['driver']) &&
                          webhookCreateAllowed(schema.data?.receiver)
                            ? [
                                {
                                  id: 'clone',
                                  label: 'Clonar configuração',
                                  disabled: pending,
                                  onSelect: () => void open(v, true),
                                },
                              ]
                            : []),
                          ...(schema.data?.receiver.resourceMethods?.includes('DELETE')
                            ? [
                                {
                                  id: 'remove',
                                  label: 'Excluir webhook',
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
        title="Criar webhook"
        description={`Environment: ${app.project?.name || project}`}
        footer={
          <>
            <Button onClick={close} disabled={write.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={write.isPending || !writer}
              onClick={() => {
                try {
                  prepareWebhook(draft, schema.data || {}, project, services.data || []);
                  setError('');
                  setReview(true);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Revise os campos.');
                }
              }}
            >
              Revisar webhook
            </Button>
          </>
        }
      >
        <fieldset disabled={write.isPending} className="form-fieldset">
          <legend>Configuração e destino</legend>
          <Field label="Nome do webhook">
            {(id) => (
              <input
                id={id}
                value={draft.name}
                onChange={(e) => change({ name: e.target.value })}
                maxLength={255}
              />
            )}
          </Field>
          <Field label="Função do webhook">
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
            <Field label="Serviço de destino">
              {(id) => (
                <select
                  id={id}
                  value={draft.serviceId}
                  onChange={(e) => change({ serviceId: e.target.value })}
                >
                  <option value="">Selecionar…</option>
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
              label={draft.driver === 'scaleHost' ? 'Labels dos hosts' : 'Labels dos serviços'}
            />
          )}
          {draft.driver === 'serviceUpgrade' ? (
            <>
              <Field label="Tag da imagem">
                {(id) => (
                  <input
                    id={id}
                    value={draft.tag}
                    onChange={(e) => change({ tag: e.target.value })}
                    placeholder="Ex.: release"
                  />
                )}
              </Field>
              <div className="form-grid">
                {selectField('Formato do evento', 'payloadFormat', options?.payloadFormat.options)}
                {selectField(
                  'Tipo de endereço da imagem',
                  'addressType',
                  options?.addressType.options,
                )}
                {numberField('Containers por lote', 'batchSize')}
                {numberField('Intervalo entre lotes (segundos)', 'intervalSeconds')}
              </div>
              <CheckboxField
                label="Iniciar novos containers antes de parar os atuais"
                checked={draft.startFirst}
                onChange={(e) => change({ startFirst: e.target.checked })}
              />
            </>
          ) : (
            <>
              <div className="form-grid">
                {selectField('Ação da escala', 'action', options?.action.options)}
                {numberField('Quantidade por evento', 'amount')}
                {numberField('Mínimo de instâncias', 'min')}
                {numberField('Máximo de instâncias', 'max')}
              </div>
              {draft.driver === 'scaleHost' &&
                draft.action === 'down' &&
                selectField(
                  'Host a remover primeiro',
                  'deleteOption',
                  options?.deleteOption.options,
                )}
            </>
          )}
          {draft.driver === 'scaleHost' && (
            <Alert tone="warning">
              {draft.action === 'up'
                ? 'Aumentar hosts usa os hosts correspondentes como modelo para provisionar novas máquinas pelo driver configurado.'
                : 'Reduzir hosts pode remover máquinas correspondentes às labels e interromper seus workloads. Revise o seletor e a ordem de remoção.'}
            </Alert>
          )}
          {draft.driver === 'serviceUpgrade' && (
            <Alert tone="info">
              Somente eventos de publicação da tag informada serão usados para atualizar os serviços
              correspondentes às labels. O intervalo deste driver é informado em segundos.
            </Alert>
          )}
          <Alert tone="warning">
            Ao receber um evento válido, o webhook poderá alterar workloads ou hosts. Revise o alvo,
            os limites e quem terá acesso à URL. O Rancher executa o driver; criar o receiver não
            comprova a entrega futura de eventos.
          </Alert>
          {(error || write.error) && <Alert>{error || write.error?.message}</Alert>}
        </fieldset>
      </Modal>
      <Confirm
        open={review}
        onOpenChange={(open) => {
          if (!write.isPending) setReview(open);
        }}
        title="Criar webhook?"
        description={`${draft.name}. Função: ${names[draft.driver]}. Alvo: ${draft.driver === 'scaleService' ? `${services.data?.find((v) => v.id === draft.serviceId)?.name || draft.serviceId} (${draft.serviceId})` : draft.selectors.map((v) => `${v.key}=${v.value}`).join(', ')}. ${draft.driver === 'serviceUpgrade' ? `Tag ${draft.tag}, lote ${draft.batchSize}, intervalo ${draft.intervalSeconds}s.` : `${draft.action === 'up' ? 'Aumentar' : 'Reduzir'} ${draft.amount} por evento; mínimo ${draft.min}, máximo ${draft.max}.`} Um evento futuro poderá executar esta operação no environment ${app.project?.name || project}. Nenhum evento será enviado ao criar.`}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      />
      <Confirm
        open={!!remove}
        onOpenChange={(open) => {
          if (!open && !write.isPending) setRemove(null);
        }}
        title="Excluir webhook?"
        description={`${remove?.name || ''}. Integrações que usam esta URL deixarão de funcionar. Excluir o receiver não desfaz eventos já executados.`}
        busy={write.isPending}
        onConfirm={() => write.mutate()}
      >
        {write.error && <Alert>{write.error.message}</Alert>}
      </Confirm>
      <Modal
        open={!!secret}
        onOpenChange={(open) => {
          if (!open) {
            setSecret(null);
            setRevealed(false);
          }
        }}
        title="URL protegida do webhook"
        description="Quem possui esta URL pode disparar a operação. Compartilhe somente com a integração autorizada."
      >
        <Field label="URL de invocação">
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
            {revealed ? 'Ocultar URL' : 'Mostrar URL'}
          </Button>
          <Button
            onClick={async () => {
              if (secret)
                try {
                  await navigator.clipboard.writeText(secret.url);
                  toast('URL copiada.');
                } catch {
                  toast('Não foi possível copiar a URL.');
                }
            }}
          >
            <Copy size={16} />
            Copiar URL
          </Button>
        </div>
      </Modal>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar webhook não salvo?"
        description="As alterações ainda não foram enviadas."
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
        title="Mudar de contexto?"
        description="Há um webhook não salvo ou uma operação em andamento."
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
