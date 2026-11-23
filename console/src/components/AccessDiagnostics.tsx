import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { History, RefreshCw } from 'lucide-react';
import { api, rawId, roles, type Account, type Collection, type Group, type Project } from '../api';
import { useApp } from '../state';
import { Alert, Badge, Button, DataTable, Empty, ErrorState, Field, Loading, Modal } from './ui';

interface AccessReport {
  accountId: string;
  projectId: string;
  effectiveRole?: string | null;
  complete: boolean;
  identityScope: string;
  sources: { kind: string; name?: string; groupId?: string; memberId?: string; role: string }[];
}
interface Snapshot {
  id: string;
  name: string;
  revision: number;
  members: string[];
  grants: Record<string, string>;
}
interface AuditEvent {
  id: string;
  actorId: string;
  groupId: string;
  operation: string;
  created: string;
  before?: Snapshot | null;
  after?: Snapshot | null;
}
const roleName = (role: string) => roles.find((value) => value.value === role)?.label || role;

export function AccessDiagnostics({
  account,
  projects,
  onClose,
}: {
  account: Account;
  projects: Project[];
  onClose: () => void;
}) {
  const app = useApp();
  const [environment, setEnvironment] = useState(app.project?.id || projects[0]?.id || '');
  const query = useQuery({
    queryKey: ['data', app.identity, 'access', 'effective', account.id, environment],
    enabled: !!environment,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        targetAccount: account.id,
        targetEnvironment: environment,
      });
      const result = await api<Collection<AccessReport>>(
        `localAccessReports?${params}`,
        undefined,
        undefined,
        signal,
      );
      const report = result.data[0];
      if (
        !report ||
        (account.id === 'self'
          ? !/^[1-9]\d*$/.test(report.accountId)
          : report.accountId !== rawId(account.id)) ||
        report.projectId !== rawId(environment)
      )
        throw new Error(
          'O diagnóstico retornado não corresponde à conta e ao environment selecionados.',
        );
      return report;
    },
    retry: false,
  });
  return (
    <Modal
      open
      drawer
      title={`Acesso efetivo · ${account.name || account.id}`}
      description="Grants e papel calculados pelo backend Rancher."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      <Field label="Environment">
        {(id) => (
          <select
            id={id}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
          >
            {!projects.length && <option value="">Nenhum environment</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {!!environment && (
        <Button aria-label="Atualizar acesso efetivo" onClick={() => void query.refetch()}>
          <RefreshCw size={15} />
        </Button>
      )}
      {!environment ? (
        <Empty
          title="Nenhum environment"
          description="Não há environment disponível para consultar."
        />
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.complete && (
            <Alert tone="warning">
              Diagnóstico parcial: identidades de provedores externos podem conceder acesso
              adicional. O papel efetivo não foi determinado.
            </Alert>
          )}
          <dl className="details-grid">
            <div>
              <dt>Papel efetivo</dt>
              <dd>
                <Badge>
                  {!query.data.complete
                    ? 'Não determinado'
                    : query.data.effectiveRole
                      ? roleName(query.data.effectiveRole)
                      : 'Sem acesso'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Escopo de identidade</dt>
              <dd>{query.data.identityScope}</dd>
            </div>
          </dl>
          <DataTable
            rows={query.data.sources}
            rowKey={(source) => `${source.kind}:${source.groupId || source.memberId || 'global'}`}
            searchText={(source) => `${source.name || ''} ${source.kind} ${source.role}`}
            emptyTitle="Nenhum grant local"
            emptyDescription="Não há fonte de acesso local para esta conta neste environment."
            columns={[
              {
                key: 'kind',
                label: 'Origem',
                render: (source) =>
                  source.kind === 'group'
                    ? 'Grupo local'
                    : source.kind === 'direct'
                      ? 'Vínculo direto'
                      : 'Administrador global',
              },
              {
                key: 'source',
                label: 'Fonte',
                render: (source) => source.name || source.memberId || account.name || account.id,
              },
              { key: 'role', label: 'Papel concedido', render: (source) => roleName(source.role) },
            ]}
          />
        </>
      )}
    </Modal>
  );
}

export function GroupAudit({
  group,
  users,
  projects,
  onClose,
}: {
  group?: Group | null;
  users: Account[];
  projects: Project[];
  onClose: () => void;
}) {
  const app = useApp();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['data', app.identity, 'access', 'audit', group?.id || 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) => {
      const params = new URLSearchParams();
      if (group) params.set('groupId', group.id);
      if (pageParam) params.set('before', pageParam);
      return api<Collection<AuditEvent>>(
        `localGroupAudits?${params}`,
        undefined,
        undefined,
        signal,
      );
    },
    getNextPageParam: (last, pages) => {
      const cursor = last.data.at(-1)?.id;
      return last.data.length === 100 &&
        pages.length < 10 &&
        !pages.slice(0, -1).some((page) => page.data.some((event) => event.id === cursor))
        ? cursor
        : undefined;
    },
    retry: false,
  });
  return (
    <Modal
      open
      drawer
      title={`Histórico · ${group?.name || 'Grupos locais'}`}
      description="Auditoria de grupos locais registrada pelo servidor."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      <Alert tone="info">
        Snapshots detalhados estão disponíveis somente para alterações posteriores à ativação desta
        auditoria. Registros legados foram preservados.
      </Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <DataTable
            rows={query.data.pages.flatMap((page) => page.data)}
            rowKey={(event) => event.id}
            searchText={(event) => `${event.operation} ${event.actorId} ${event.created}`}
            emptyTitle="Nenhuma alteração registrada"
            emptyDescription="Este grupo ainda não tem snapshots detalhados."
            columns={[
              {
                key: 'group',
                label: 'Grupo',
                render: (event) => event.after?.name || event.before?.name || event.groupId,
              },
              {
                key: 'created',
                label: 'Data',
                render: (event) => new Date(event.created).toLocaleString('pt-BR'),
              },
              {
                key: 'actor',
                label: 'Ator',
                render: (event) =>
                  users.find((user) => rawId(user.id) === event.actorId)?.name || event.actorId,
              },
              {
                key: 'operation',
                label: 'Operação',
                render: (event) =>
                  ({ create: 'Criação', update: 'Atualização', delete: 'Exclusão' })[
                    event.operation
                  ] || event.operation,
              },
              {
                key: 'details',
                label: 'Detalhes',
                render: (event) => (
                  <Button
                    onClick={() => setSelected(event)}
                    aria-label={`Revisar evento ${event.id}`}
                  >
                    <History size={15} />
                    Antes e depois
                  </Button>
                ),
              },
            ]}
          />
          {query.hasNextPage && (
            <Button busy={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              Carregar anteriores
            </Button>
          )}
          {query.data.pages.length === 10 && query.data.pages.at(-1)?.data.length === 100 && (
            <Alert tone="warning">
              Limite de 1.000 eventos nesta consulta. O servidor pode ter registros anteriores.
            </Alert>
          )}
          {selected && (
            <section aria-label="Alteração auditada">
              <h2>Evento {selected.id}</h2>
              {(['before', 'after'] as const).map((side) => {
                const value = selected[side];
                return (
                  <section key={side}>
                    <h3>{side === 'before' ? 'Antes' : 'Depois'}</h3>
                    {!value ? (
                      <p className="muted">Grupo inexistente</p>
                    ) : (
                      <dl className="details-grid">
                        <div>
                          <dt>Nome</dt>
                          <dd>{value.name}</dd>
                        </div>
                        <div>
                          <dt>Revisão</dt>
                          <dd>{value.revision}</dd>
                        </div>
                        <div>
                          <dt>Membros</dt>
                          <dd>
                            {value.members
                              .map(
                                (member) =>
                                  users.find((user) => rawId(user.id) === member)?.name || member,
                              )
                              .join(', ') || 'Nenhum'}
                          </dd>
                        </div>
                        <div>
                          <dt>Grants</dt>
                          <dd>
                            {Object.entries(value.grants)
                              .map(
                                ([project, role]) =>
                                  `${projects.find((item) => rawId(item.id) === project)?.name || project}: ${roleName(role)}`,
                              )
                              .join('; ') || 'Nenhum'}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </section>
                );
              })}
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
