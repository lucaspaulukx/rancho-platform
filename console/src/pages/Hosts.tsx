import { useI18n } from '../i18n/provider';
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
  ResourceStateBadge,
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
  const { t, locale, formats } = useI18n();
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
        title={t('hostsPage.selectEnvironment')}
        description={t('hostsPage.environmentDescription')}
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
      .toLocaleLowerCase(locale)
      .includes(search.toLocaleLowerCase(locale)),
  );
  const writable = canManageResource(schemas.data?.host);
  const suffix = `?env=${encodeURIComponent(app.project.id)}`;
  return (
    <>
      <PageHeader
        title={id ? String(host?.name || host?.hostname || id) : t('hostsPage.title')}
        eyebrow={app.project.name}
        description={t('hostsPage.description')}
        action={
          <>
            {id && (
              <Link className="button" to={`/hosts${suffix}`}>
                {t('hostsPage.back')}
              </Link>
            )}
            {!id && schemas.data?.registrationToken?.collectionMethods?.includes('POST') && (
              <Button variant="primary" onClick={() => setRegistration(true)}>
                <Plus size={16} />
                {t('hostsPage.add')}
              </Button>
            )}
            {host && writable && (
              <Button onClick={() => setSelection({ resource: host, mode: 'detail' })}>
                {t('hostsPage.manage')}
              </Button>
            )}
            {host &&
              app.config.modules.observability &&
              app.config.modules.metrics &&
              metricsLink(host) && (
                <Button onClick={() => setSelection({ resource: host, mode: 'metrics' })}>
                  {t('hostsPage.metrics')}
                </Button>
              )}
            <Button aria-label={t('hostsPage.refresh')} onClick={() => void query.refetch()}>
              <RefreshCw size={16} />
            </Button>
          </>
        }
      />
      {id && !host ? (
        <Empty
          title={t('hostsPage.unavailable')}
          description={t('hostsPage.unavailableDescription')}
        />
      ) : (
        <>
          {!id && (
            <Field label={t('hostsPage.search')}>
              {(field) => (
                <input
                  id={field}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('hostsPage.searchPlaceholder')}
                />
              )}
            </Field>
          )}
          {!id && !filtered.length && (
            <Empty title={t('hostsPage.empty')} description={t('hostsPage.emptyDescription')} />
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
                    <ResourceStateBadge state={value.state} />
                  </div>
                  <dl className="details-grid">
                    <div>
                      <dt>{t('hostsPage.agentAddress')}</dt>
                      <dd>{summary.address || '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('hostsPage.agent')}</dt>
                      <dd>{String(value.agentState || '—')}</dd>
                    </div>
                    <div>
                      <dt>{t('hostsPage.cpus')}</dt>
                      <dd>{summary.cpu === undefined ? '—' : formats.number(summary.cpu)}</dd>
                    </div>
                    <div>
                      <dt>{t('hostsPage.memory')}</dt>
                      <dd>
                        {summary.memoryGiB === undefined
                          ? '—'
                          : `${formats.number(summary.memoryGiB, { maximumFractionDigits: 1 })} GiB`}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('hostsPage.system')}</dt>
                      <dd>{summary.os || '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('hostsPage.docker')}</dt>
                      <dd>{summary.docker || '—'}</dd>
                    </div>
                  </dl>
                  {value.transitioning === 'error' && (
                    <Alert>
                      {String(value.transitioningMessage || t('hostsPage.hostFailure'))}
                    </Alert>
                  )}
                  <div className="row-actions">
                    {!id && (
                      <Link className="button primary" to={`/hosts/${value.id}${suffix}`}>
                        {t('hostsPage.viewContainers')}{' '}
                        {app.config.modules.workloads && `(${formats.number(containers.length)})`}
                      </Link>
                    )}
                    <Button onClick={() => setSelection({ resource: value, mode: 'detail' })}>
                      {t('hostsPage.detailsActions')}
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
          {host &&
            (app.config.modules.workloads ? (
              <section style={{ marginTop: 24 }}>
                <h2>{t('hostsPage.containersTitle')}</h2>
                <DataTable
                  rows={containersOnHost(host, query.data.containers)}
                  rowKey={(value) => value.id}
                  searchText={(value) =>
                    `${value.name || ''} ${imageName(value)} ${value.state || ''}`
                  }
                  columns={[
                    {
                      key: 'name',
                      label: t('hostsPage.container'),
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
                      label: t('hostsPage.state'),
                      render: (value) => <ResourceStateBadge state={value.state} />,
                    },
                    {
                      key: 'image',
                      label: t('hostsPage.image'),
                      render: (value) => imageName(value),
                    },
                    {
                      key: 'actions',
                      label: t('hostsPage.actions'),
                      render: (value) => (
                        <div className="row-actions">
                          {app.config.modules.observability && value.actions?.logs && (
                            <Button onClick={() => setSelection({ resource: value, mode: 'logs' })}>
                              {t('hostsPage.logs')}
                            </Button>
                          )}
                          {app.config.modules.observability &&
                            canManageResource(schemas.data?.container) &&
                            value.actions?.execute && (
                              <Button
                                onClick={() => setSelection({ resource: value, mode: 'execute' })}
                              >
                                {t('hostsPage.terminal')}
                              </Button>
                            )}
                        </div>
                      ),
                    },
                  ]}
                />
              </section>
            ) : (
              <Alert tone="info">{t('hostsPage.enableWorkloads')}</Alert>
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
