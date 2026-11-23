import { usePageLeaveGuard } from '../hooks/usePageLeaveGuard';
import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { allPages, api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { useActionScope } from '../hooks/useActionScope';
import {
  assertBalancerUnchanged,
  canEditBalancer,
  editableBalancerRules,
  prepareBalancerRules,
  type BalancerRuleDraft,
} from '../balancer-rules';
import {
  Alert,
  Button,
  CheckboxField,
  Confirm,
  ErrorState,
  Field,
  Loading,
  Modal,
  useToast,
} from './ui';

const metadata = (v: Resource): Resource =>
  Object.fromEntries(
    [
      'id',
      'type',
      'accountId',
      'stackId',
      'name',
      'state',
      'removed',
      'system',
      'links',
      'actions',
    ].map((k) => [k, v[k]]),
  ) as Resource;
export default function BalancerRulesPanel({
  resource,
  onClose,
  onSaved,
}: {
  resource: Resource;
  onClose: () => void;
  onSaved: (value: Resource) => void;
}) {
  const app = useApp(),
    scope = useActionScope(),
    client = useQueryClient(),
    toast = useToast();
  const [data, setData] = useState<{
    source: Resource;
    services: Resource[];
    stacks: Resource[];
    schemas: Record<string, Schema>;
  } | null>(null);
  const [error, setError] = useState<unknown>(null),
    [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<BalancerRuleDraft[] | null>(null);
  const [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false),
    [published, setPublished] = useState(false);
  const [validation, setValidation] = useState(''),
    [nextId, setNextId] = useState(1000);
  async function load(signal: AbortSignal) {
    const base = `projects/${scope.environment}/`;
    const [source, services, stacks, contracts] = await Promise.all([
      api<Resource>(resource.links.self, undefined, undefined, signal),
      allPages<Resource>(base + 'services?limit=100', signal),
      allPages<Resource>(base + 'stacks?limit=100', signal),
      allPages<Schema>(base + 'schemas', signal),
    ]);
    scope.resource(source, resource);
    return {
      source,
      services: services.map(metadata),
      stacks: stacks.map(metadata),
      schemas: Object.fromEntries(contracts.map((v) => [v.id, v])),
    };
  }
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setData(null);
    setError(null);
    setDraft(null);
    setReview(false);
    setPublished(false);
    void load(AbortSignal.any([scope.signal(), controller.signal]))
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [resource.id, app.identity, app.project?.id, retry]);
  let original: BalancerRuleDraft[] = [];
  let unsupported = '';
  try {
    if (data) original = editableBalancerRules(data.source);
  } catch (e) {
    unsupported = e instanceof Error ? e.message : 'Configuração não suportada.';
  }
  const rows = draft || original;
  const allowed =
    !!data &&
    canEditBalancer(
      data.source,
      data.schemas.loadBalancerService,
      app.config.modules.balancerRulesEditor,
    ) &&
    !unsupported;
  const targets =
    data?.services.filter(
      (v) =>
        v.accountId === scope.environment &&
        v.type === 'service' &&
        !v.removed &&
        ['active', 'inactive'].includes(v.state || '') &&
        data.stacks.some(
          (s) =>
            s.id === v.stackId &&
            s.accountId === scope.environment &&
            !s.removed &&
            !s.system &&
            s.state === 'active',
        ),
    ) || [];
  function display(id: string) {
    const s = data?.services.find((v) => v.id === id),
      stack = data?.stacks.find((v) => v.id === s?.stackId);
    return s ? `${stack?.name || s.stackId} / ${s.name || s.id}` : `Destino indisponível (${id})`;
  }
  function change(value: BalancerRuleDraft[]) {
    setDraft(value);
    setPublished(false);
    setReview(false);
    setValidation('');
  }
  function update(key: number, patch: Partial<BalancerRuleDraft>) {
    change(rows.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }
  function validate() {
    if (!data || !draft || !allowed) throw new Error('Reabra o editor do balanceador.');
    const payload = prepareBalancerRules(
      data.source,
      draft,
      data.schemas,
      data.services,
      data.stacks,
      scope.environment!,
    );
    if (draft.some((v) => v.access === 'public') && !published)
      throw new Error('Confirme o impacto das portas publicadas.');
    return payload;
  }
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      validate();
      if (!data || !draft || !app.config.modules.balancerRulesEditor)
        throw new Error('Editor desativado.');
      const signal = scope.signal(),
        fresh = await load(signal);
      scope.assertCurrent();
      assertBalancerUnchanged(data.source, fresh.source);
      const payload = prepareBalancerRules(
        fresh.source,
        draft,
        fresh.schemas,
        fresh.services,
        fresh.stacks,
        scope.environment!,
      );
      const value = await api<Resource>(fresh.source.links.self, payload, 'PUT', signal);
      scope.resource(value, resource);
      return metadata(value);
    },
    onError: () => setReview(false),
    onSuccess: async (value) => {
      setDraft(null);
      setReview(false);
      await client.invalidateQueries({
        queryKey: ['data', app.identity, 'project', app.project?.id],
      });
      toast('Regras enviadas ao Rancher. Acompanhe o estado do balanceador.');
      onSaved(value);
    },
  });
  const dirty = draft !== null,
    blocker = useBlocker(dirty || mutation.isPending);
  usePageLeaveGuard(dirty || mutation.isPending, app.config.modules.unsavedChangesGuard);
  function close() {
    if (mutation.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function requestReview() {
    try {
      validate();
      setValidation('');
      setReview(true);
    } catch (e) {
      setValidation(e instanceof Error ? e.message : 'Revise as regras.');
    }
  }
  const summary = (entries: BalancerRuleDraft[]) => (
    <ul>
      {entries.map((v) => (
        <li key={v.key}>
          {v.protocol.toUpperCase()} :{v.sourcePort} → {display(v.serviceId)} :{v.targetPort} ·{' '}
          {v.access === 'public' ? 'Publicado' : 'Interno'}
          {v.hostname ? ` · ${v.hostname}` : ''}
          {v.path ? ` · ${v.path}` : ''}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <Modal
        open
        drawer
        title={`Balanceador · ${resource.name || resource.id}`}
        description={`Environment: ${app.project?.name}`}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        footer={
          <>
            <Button onClick={close} disabled={mutation.isPending}>
              Fechar
            </Button>
            <Button
              variant="primary"
              disabled={!allowed || !dirty || mutation.isPending}
              onClick={requestReview}
            >
              Revisar alterações
            </Button>
          </>
        }
      >
        {error ? (
          <ErrorState error={error} retry={() => setRetry((v) => v + 1)} />
        ) : !data ? (
          <Loading />
        ) : (
          <>
            <Alert tone="info">
              Organize as rotas e os destinos deste balanceador. Portas publicadas ficam acessíveis
              pela rede dos hosts. A alteração pode interromper conexões; o serviço não será
              iniciado automaticamente.
            </Alert>
            {unsupported ? (
              <Alert tone="warning">
                {unsupported} A configuração existente foi mantida. Feche este painel e escolha
                Editar configuração para usar o formulário nativo.
              </Alert>
            ) : !allowed ? (
              <Alert tone="warning">
                Sua conta ou o estado atual não permite alterar estas regras.
              </Alert>
            ) : null}
            {unsupported && (
              <section className="compose-editor" aria-label="Regras preservadas">
                <h3>Regras preservadas</h3>
                <p className="muted">Nenhuma regra ou porta será convertida por este editor.</p>
                <ul>
                  {Array.isArray((data.source.lbConfig as Record<string, unknown>)?.portRules) &&
                    (
                      (data.source.lbConfig as Record<string, unknown>).portRules as Record<
                        string,
                        unknown
                      >[]
                    ).map((rule, index) => (
                      <li key={index}>
                        {String(rule.protocol || 'Nativo').toUpperCase()} :
                        {String(rule.sourcePort || '—')} →{' '}
                        {rule.serviceId
                          ? display(String(rule.serviceId))
                          : 'Destino por configuração avançada'}
                        {rule.targetPort ? ` :${String(rule.targetPort)}` : ''}
                      </li>
                    ))}
                </ul>
              </section>
            )}
            <fieldset className="form-fieldset" disabled={!allowed || mutation.isPending}>
              {rows.map((row, index) => (
                <section className="compose-editor" key={row.key}>
                  <div className="compose-editor-heading">
                    <strong>Regra {index + 1}</strong>
                    <Button
                      aria-label={`Remover regra ${index + 1}`}
                      onClick={() => change(rows.filter((v) => v.key !== row.key))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="form-grid">
                    <Field label={`Protocolo ${index + 1}`}>
                      {(id) => (
                        <select
                          id={id}
                          value={row.protocol}
                          onChange={(e) =>
                            update(row.key, {
                              protocol: e.target.value as 'http' | 'tcp',
                              hostname: '',
                              path: '',
                            })
                          }
                        >
                          <option value="http">HTTP</option>
                          <option value="tcp">TCP</option>
                        </select>
                      )}
                    </Field>
                    <Field label={`Acesso ${index + 1}`}>
                      {(id) => (
                        <select
                          id={id}
                          value={row.access}
                          onChange={(e) =>
                            update(row.key, { access: e.target.value as 'internal' | 'public' })
                          }
                        >
                          <option value="internal">Interno</option>
                          <option value="public">Publicado nos hosts</option>
                        </select>
                      )}
                    </Field>
                    <Field label={`Porta de entrada ${index + 1}`}>
                      {(id) => (
                        <input
                          id={id}
                          inputMode="numeric"
                          value={row.sourcePort}
                          onChange={(e) => update(row.key, { sourcePort: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={`Porta de destino ${index + 1}`}>
                      {(id) => (
                        <input
                          id={id}
                          inputMode="numeric"
                          value={row.targetPort}
                          onChange={(e) => update(row.key, { targetPort: e.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                  {row.sourceIp && (
                    <p className="muted">IP de publicação preservado: {row.sourceIp}</p>
                  )}
                  <Field label={`Serviço de destino ${index + 1}`}>
                    {(id) => (
                      <select
                        id={id}
                        value={row.serviceId}
                        onChange={(e) => update(row.key, { serviceId: e.target.value })}
                      >
                        <option value="">Selecionar serviço…</option>
                        {targets.map((v) => (
                          <option key={v.id} value={v.id}>
                            {display(v.id)}
                          </option>
                        ))}
                        {row.serviceId && !targets.some((v) => v.id === row.serviceId) && (
                          <option value={row.serviceId}>{display(row.serviceId)}</option>
                        )}
                      </select>
                    )}
                  </Field>
                  {row.protocol === 'http' && (
                    <div className="form-grid">
                      <Field
                        label={`Hostname ${index + 1}`}
                        hint="Opcional. Vazio aceita qualquer hostname."
                      >
                        {(id) => (
                          <input
                            id={id}
                            value={row.hostname}
                            maxLength={255}
                            autoComplete="off"
                            onChange={(e) => update(row.key, { hostname: e.target.value })}
                          />
                        )}
                      </Field>
                      <Field label={`Caminho ${index + 1}`} hint="Opcional. Exemplo: /api">
                        {(id) => (
                          <input
                            id={id}
                            value={row.path}
                            maxLength={2048}
                            autoComplete="off"
                            onChange={(e) => update(row.key, { path: e.target.value })}
                          />
                        )}
                      </Field>
                    </div>
                  )}
                </section>
              ))}
              <Button
                disabled={rows.length >= 100}
                onClick={() => {
                  change([
                    ...rows,
                    {
                      key: nextId,
                      protocol: 'http',
                      sourcePort: '80',
                      targetPort: '80',
                      serviceId: '',
                      hostname: '',
                      path: '',
                      access: 'internal',
                      sourceIp: '',
                    },
                  ]);
                  setNextId(nextId + 1);
                }}
              >
                <Plus size={16} />
                Adicionar regra
              </Button>
              {!!draft?.some((v) => v.access === 'public') && (
                <CheckboxField
                  label="Revisei as portas publicadas e o impacto na conectividade"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
              )}
            </fieldset>
            {(validation || mutation.error) && (
              <Alert>{validation || mutation.error?.message}</Alert>
            )}
          </>
        )}
      </Modal>
      <Confirm
        open={review}
        onOpenChange={setReview}
        title="Aplicar regras do balanceador?"
        description={`As regras de ${resource.name || resource.id} serão atualizadas somente em ${app.project?.name}. Conexões podem ser afetadas.`}
        busy={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      >
        <h3>Antes · {original.length} regra(s)</h3>
        {summary(original)}
        <h3>Depois · {rows.length} regra(s)</h3>
        {summary(rows)}
      </Confirm>
      <Confirm
        open={discard}
        onOpenChange={setDiscard}
        title="Descartar regras não salvas?"
        description="A configuração do Rancher não será alterada."
        onConfirm={onClose}
      />
      <Confirm
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Mudar de contexto?"
        description="Há regras não salvas. Aguarde qualquer envio pendente."
        busy={mutation.isPending}
        onConfirm={() => {
          if (!mutation.isPending && blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
