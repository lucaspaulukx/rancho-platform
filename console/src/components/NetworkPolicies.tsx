import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allPages, api, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import {
  policyDraft,
  policyChanges,
  policyLabels,
  policyScopes,
  preparePolicy,
  supportedPolicyNetwork,
  type PolicyAction,
  type PolicyDraft,
} from '../network-policy';
import { Alert, Badge, Button, Confirm, Empty, ErrorState, Field, Loading, Modal } from './ui';

export function NetworkPolicies({ project }: { project: Resource }) {
  const app = useApp();
  const [opened, setOpened] = useState(false);
  if (!app.config.modules.environments || !app.config.modules.networkPolicies) return null;
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>Políticas de rede</h2>
      <p className="muted">
        Controle a comunicação entre stacks, serviços e containers deste environment.
      </p>
      <Button onClick={() => setOpened(true)}>Consultar políticas de rede</Button>
      {opened && (
        <PolicyPanel
          key={`${app.identity}:${project.id}`}
          project={project}
          onClose={() => setOpened(false)}
        />
      )}
    </section>
  );
}
function PolicyPanel({ project, onClose }: { project: Resource; onClose: () => void }) {
  const app = useApp();
  const scope = `${app.identity}:${project.id}:${app.config.modules.networkPolicies}`;
  const live = useRef(scope);
  live.current = scope;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const base = `/v2-beta/projects/${encodeURIComponent(project.id)}/`;
  const headers = { 'X-Api-Project-Id': project.id };
  const client = useQueryClient();
  const [editing, setEditing] = useState<{ resource: Resource; draft: PolicyDraft } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [discard, setDiscard] = useState(false);
  const query = useQuery({
    queryKey: ['data', app.identity, 'network-policies', project.id],
    refetchInterval: editing ? false : 5_000,
    queryFn: async ({ signal }) => {
      const [networks, managers, schema] = await Promise.all([
        allPages<Resource>(base + 'networks', signal, headers),
        allPages<Resource>(base + 'stacks?name=network-policy-manager', signal, headers),
        api<Schema>(base + 'schemas/network', undefined, undefined, signal, headers),
      ]);
      return {
        networks: networks.filter((value) => supportedPolicyNetwork(value, project.id)),
        managers,
        schema,
      };
    },
  });
  const save = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!editing) throw new Error('Reabra a política antes de salvar.');
      const signal = AbortSignal.timeout(20_000);
      const [current, schema, managers] = await Promise.all([
        api<Resource>(editing.resource.links.self, undefined, undefined, signal, headers),
        api<Schema>(base + 'schemas/network', undefined, undefined, signal, headers),
        allPages<Resource>(base + 'stacks?name=network-policy-manager', signal, headers),
      ]);
      if (!mounted.current || live.current !== scope || !app.config.modules.environments)
        throw new Error('O contexto mudou. Reabra o painel.');
      const body = preparePolicy(
        editing.resource,
        current,
        schema,
        project.id,
        editing.draft,
        managers,
      );
      return api<Resource>(current.links.self, body, 'PUT', signal, headers);
    },
    onSuccess: async () => {
      setEditing(null);
      setConfirm(false);
      await client.invalidateQueries({
        queryKey: ['data', app.identity, 'network-policies', project.id],
      });
    },
  });
  const blocker = useBlocker(!!editing || save.isPending);
  useEffect(() => {
    if (!editing && !save.isPending) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [editing, save.isPending]);
  const ready = query.data?.managers.some(
    (value) =>
      value.accountId === project.id &&
      value.name === 'network-policy-manager' &&
      !value.removed &&
      value.state === 'active' &&
      value.healthState === 'healthy',
  );
  const writable =
    query.data?.schema.resourceMethods?.includes('PUT') &&
    query.data.schema.resourceFields.policy?.update &&
    query.data.schema.resourceFields.defaultPolicyAction?.update;
  const changes = editing ? policyChanges(editing.resource, editing.draft) : [];
  function close() {
    if (save.isPending) return;
    if (editing) setDiscard(true);
    else onClose();
  }
  return (
    <>
      <Modal
        open
        drawer
        title="Políticas de rede"
        description={project.name || project.id}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        footer={
          <Button disabled={save.isPending} onClick={close}>
            Fechar
          </Button>
        }
      >
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            {!ready && (
              <Alert tone="warning">
                O network-policy-manager não está ativo e saudável. As regras podem ser consultadas;
                alterações ficam indisponíveis até validar essa infraestrutura.
              </Alert>
            )}
            {!query.data?.networks.length && (
              <Empty
                title="Nenhuma rede compatível"
                description="As políticas nativas exigem uma rede ipsec ou vxlan neste environment."
              />
            )}
            {query.data?.networks.map((resource) => {
              const draft = policyDraft(resource);
              const current = editing?.resource.id === resource.id ? editing.draft : draft;
              return (
                <section key={resource.id} className="panel" style={{ marginTop: 20 }}>
                  <h3>
                    {resource.name} <Badge state={resource.state}>{resource.state}</Badge>
                  </h3>
                  {!draft ? (
                    <Alert tone="info">
                      Esta rede possui regras avançadas ou não reconhecidas. O editor simplificado
                      não as substitui.
                    </Alert>
                  ) : (
                    <>
                      {(['default', ...policyScopes] as const).map((scope) => (
                        <Field
                          key={scope}
                          label={scope === 'default' ? 'Demais comunicações' : policyLabels[scope]}
                        >
                          {(id) => (
                            <select
                              id={id}
                              value={
                                scope === 'default'
                                  ? current!.defaultPolicyAction
                                  : current!.within[scope]
                              }
                              disabled={
                                !ready ||
                                !writable ||
                                resource.state !== 'active' ||
                                save.isPending ||
                                (!!editing && editing.resource.id !== resource.id)
                              }
                              onChange={(event) => {
                                save.reset();
                                const value = event.target.value as PolicyAction;
                                setEditing({
                                  resource,
                                  draft:
                                    scope === 'default'
                                      ? { ...current!, defaultPolicyAction: value }
                                      : {
                                          ...current!,
                                          within: { ...current!.within, [scope]: value },
                                        },
                                });
                              }}
                            >
                              <option value="allow">Permitir</option>
                              <option value="deny">Bloquear</option>
                            </select>
                          )}
                        </Field>
                      ))}
                      {editing?.resource.id === resource.id && (
                        <div className="page-actions">
                          <Button
                            disabled={save.isPending}
                            onClick={() => {
                              setEditing(null);
                              save.reset();
                            }}
                          >
                            Descartar alterações
                          </Button>
                          <Button
                            variant="primary"
                            busy={save.isPending}
                            disabled={!changes.length}
                            onClick={() => setConfirm(true)}
                          >
                            Revisar alteração
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              );
            })}
          </>
        )}
        {save.error && <ErrorState error={save.error} />}
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={(value) => {
          if (!save.isPending) setConfirm(value);
        }}
        title="Aplicar políticas de rede?"
        description={`A alteração pode interromper conexões existentes em ${project.name || project.id}. O Rancher receberá a configuração; a aplicação depende do gerenciador de políticas.`}
        footer={
          <>
            <Button disabled={save.isPending} onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              busy={save.isPending}
              disabled={!changes.length}
              onClick={() => {
                setConfirm(false);
                save.mutate();
              }}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <dl className="details-grid">
          {changes.map((change) => (
            <div key={change.label}>
              <dt>{change.label}</dt>
              <dd>
                {change.before === 'allow' ? 'Permitir' : 'Bloquear'} →{' '}
                <strong>{change.after === 'allow' ? 'Permitir' : 'Bloquear'}</strong>
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
      <Confirm
        open={discard || blocker.state === 'blocked'}
        busy={save.isPending}
        onOpenChange={(value) => {
          if (!value && !save.isPending) {
            setDiscard(false);
            if (blocker.state === 'blocked') blocker.reset();
          }
        }}
        title="Descartar alterações de rede?"
        description="As alterações ainda não foram enviadas ao Rancher."
        onConfirm={() => {
          if (save.isPending) return;
          setEditing(null);
          setDiscard(false);
          if (blocker.state === 'blocked') blocker.proceed();
          else onClose();
        }}
      />
    </>
  );
}
