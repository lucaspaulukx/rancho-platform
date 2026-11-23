import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Server } from 'lucide-react';
import { allPages, type Resource } from '../api';
import { useApp, useDataKey } from '../state';
import { useSchemas, canManageResource } from '../hooks/useSchemas';
import { activeResources, imageName } from '../workloads';
import { containersOnHost, hostSummary } from '../hosts';
import { metricsLink } from '../metrics';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  Empty,
  ErrorState,
  Field,
  Loading,
  PageHeader,
} from '../components/ui';
import { HostRegistration } from '../components/HostRegistration';
import { ResourcePanel, type ResourceSelection } from '../components/ResourcePanel';

export function HostsPage() {
  const app = useApp();
  return <HostsContext key={`${app.identity}-${app.project?.id}`} />;
}
function HostsContext() {
  const app = useApp();
  const { id } = useParams();
  const schemas = useSchemas(true);
  const [search, setSearch] = useState('');
  const [registration, setRegistration] = useState(false);
  const [selection, setSelection] = useState<ResourceSelection | null>(null);
  const query = useQuery({
    queryKey: useDataKey('host-inventory', app.config.modules.workloads),
    queryFn: async ({ signal }) => {
      const base = `projects/${encodeURIComponent(app.project!.id)}`;
      const [hosts, containers] = await Promise.all([
        allPages<Resource>(`${base}/hosts?limit=100`, signal),
        app.config.modules.workloads
          ? allPages<Resource>(`${base}/containers?limit=100`, signal)
          : Promise.resolve([]),
      ]);
      return { hosts: activeResources(hosts), containers: activeResources(containers) };
    },
    enabled: !!app.project,
    refetchInterval: 15_000,
  });
  if (!app.project)
    return (
      <Empty
        title="Selecione um environment"
        description="Os hosts pertencem ao environment selecionado."
      />
    );
  if (query.isPending || schemas.isPending) return <Loading />;
  if (query.error || schemas.error)
    return (
      <ErrorState
        error={query.error || schemas.error}
        retry={() => {
          void query.refetch();
          void schemas.refetch();
        }}
      />
    );
  const host = id ? query.data.hosts.find((value) => value.id === id) : undefined;
  const filtered = query.data.hosts.filter((value) =>
    `${value.name || ''} ${value.hostname || ''} ${value.agentIpAddress || ''} ${value.state || ''}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const writable = canManageResource(schemas.data?.host);
  const suffix = `?env=${encodeURIComponent(app.project.id)}`;
  return (
    <>
      <PageHeader
        title={id ? String(host?.name || host?.hostname || id) : 'Hosts'}
        eyebrow={app.project.name}
        description="Infraestrutura, capacidade e containers por host."
        action={
          <>
            {id && (
              <Link className="button" to={`/hosts${suffix}`}>
                Voltar aos hosts
              </Link>
            )}
            {!id && schemas.data?.registrationToken?.collectionMethods?.includes('POST') && (
              <Button variant="primary" onClick={() => setRegistration(true)}>
                <Plus size={16} />
                Adicionar host
              </Button>
            )}
            {host && writable && (
              <Button onClick={() => setSelection({ resource: host, mode: 'detail' })}>
                Gerenciar host
              </Button>
            )}
            {host &&
              app.config.modules.observability &&
              app.config.modules.metrics &&
              metricsLink(host) && (
                <Button onClick={() => setSelection({ resource: host, mode: 'metrics' })}>
                  Métricas do host
                </Button>
              )}
            <Button aria-label="Atualizar hosts" onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
            </Button>
          </>
        }
      />
      {id && !host ? (
        <Empty
          title="Host indisponível"
          description="O host não existe neste environment ou foi removido."
        />
      ) : (
        <>
          {!id && (
            <Field label="Buscar hosts">
              {(field) => (
                <input
                  id={field}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, endereço ou estado…"
                />
              )}
            </Field>
          )}
          {!id && !filtered.length && (
            <Empty
              title="Nenhum host encontrado"
              description="Registre um host ou ajuste sua busca."
            />
          )}
          <div className="host-grid">
            {(host ? [host] : filtered).map((value) => {
              const summary = hostSummary(value);
              const containers = containersOnHost(value, query.data.containers);
              return (
                <section className="panel host-card" key={value.id}>
                  <div className="panel-heading">
                    <h2>
                      <Server size={18} /> {String(value.name || value.hostname || value.id)}
                    </h2>
                    <Badge state={value.state}>{value.state}</Badge>
                  </div>
                  <dl className="details-grid">
                    <div>
                      <dt>Endereço do agente</dt>
                      <dd>{summary.address || '—'}</dd>
                    </div>
                    <div>
                      <dt>Agente</dt>
                      <dd>{String(value.agentState || '—')}</dd>
                    </div>
                    <div>
                      <dt>CPUs</dt>
                      <dd>{summary.cpu ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Memória total</dt>
                      <dd>
                        {summary.memoryGiB === undefined
                          ? '—'
                          : `${summary.memoryGiB.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GiB`}
                      </dd>
                    </div>
                    <div>
                      <dt>Sistema</dt>
                      <dd>{summary.os || '—'}</dd>
                    </div>
                    <div>
                      <dt>Docker</dt>
                      <dd>{summary.docker || '—'}</dd>
                    </div>
                  </dl>
                  {value.transitioning === 'error' && (
                    <Alert>
                      {String(
                        value.transitioningMessage || 'O Rancher informou uma falha neste host.',
                      )}
                    </Alert>
                  )}
                  <div className="row-actions">
                    {!id && (
                      <Link className="button primary" to={`/hosts/${value.id}${suffix}`}>
                        Ver containers {app.config.modules.workloads && `(${containers.length})`}
                      </Link>
                    )}
                    <Button onClick={() => setSelection({ resource: value, mode: 'detail' })}>
                      Detalhes e ações
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
          {host &&
            (app.config.modules.workloads ? (
              <section style={{ marginTop: 24 }}>
                <h2>Containers neste host</h2>
                <DataTable
                  rows={containersOnHost(host, query.data.containers)}
                  rowKey={(value) => value.id}
                  searchText={(value) =>
                    `${value.name || ''} ${imageName(value)} ${value.state || ''}`
                  }
                  columns={[
                    {
                      key: 'name',
                      label: 'Container',
                      render: (value) => (
                        <Button
                          variant="ghost"
                          onClick={() => setSelection({ resource: value, mode: 'detail' })}
                        >
                          {value.name || value.id}
                        </Button>
                      ),
                    },
                    {
                      key: 'state',
                      label: 'Estado',
                      render: (value) => <Badge state={value.state}>{value.state}</Badge>,
                    },
                    { key: 'image', label: 'Imagem', render: (value) => imageName(value) },
                    {
                      key: 'actions',
                      label: 'Ações',
                      render: (value) => (
                        <div className="row-actions">
                          {app.config.modules.observability && value.actions?.logs && (
                            <Button onClick={() => setSelection({ resource: value, mode: 'logs' })}>
                              Logs
                            </Button>
                          )}
                          {app.config.modules.observability &&
                            canManageResource(schemas.data?.container) &&
                            value.actions?.execute && (
                              <Button
                                onClick={() => setSelection({ resource: value, mode: 'execute' })}
                              >
                                Terminal
                              </Button>
                            )}
                        </div>
                      ),
                    },
                  ]}
                />
              </section>
            ) : (
              <Alert tone="info">
                Ative o módulo de workloads para consultar os containers deste host.
              </Alert>
            ))}
        </>
      )}
      {registration && <HostRegistration onClose={() => setRegistration(false)} />}
      {selection && (
        <ResourcePanel
          key={`${selection.resource.id}-${selection.mode}`}
          selection={selection}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  );
}
