import { useI18n } from '../i18n/provider';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allPages, type Resource } from '../api';
import { useApp } from '../state';
import { clusterMemberMetadata, processPoolMetadata } from '../engine-monitoring';
import {
  Alert,
  Button,
  CheckboxField,
  DataTable,
  ErrorState,
  Loading,
  PageHeader,
} from '../components/ui';
import { formatResourceDate } from '../resource-format';
export function ClusterMonitoring() {
  const app = useApp();
  return <ClusterScope key={app.identity} />;
}
function ClusterScope() {
  const { t, locale } = useI18n();
  const app = useApp(),
    [auto, setAuto] = useState(true);
  const query = useQuery({
    queryKey: ['data', app.identity, 'cluster-members'],
    enabled: app.admin && app.config.modules.clusterMonitoring,
    gcTime: 0,
    refetchInterval: auto ? 5000 : false,
    queryFn: async ({ signal }) =>
      (await allPages<Resource>('clustermemberships?limit=100', signal)).map(clusterMemberMetadata),
  });
  if (!app.admin || !app.config.modules.clusterMonitoring)
    return <Alert>{t('engineMonitoring.clusterUnavailable')}</Alert>;
  return (
    <>
      <PageHeader
        title={t('engineMonitoring.clusterTitle')}
        description={t('engineMonitoring.clusterDescription')}
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            {t('engineMonitoring.refresh')}
          </Button>
        }
      />
      <CheckboxField
        label={t('engineMonitoring.autoMembers')}
        checked={auto}
        onChange={(e) => setAuto(e.target.checked)}
      />
      <Alert tone="info">{t('engineMonitoring.clusterNotice')}</Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data?.some((v) => v.configurationIncomplete) && (
            <Alert tone="warning">{t('engineMonitoring.incomplete')}</Alert>
          )}
          <DataTable
            label={t('engineMonitoring.membersLabel')}
            rows={query.data || []}
            rowKey={(v) => v.id || v.uuid}
            searchText={(v) => `${v.uuid} ${v.address} ${v.id}`}
            emptyTitle={t('engineMonitoring.noMembers')}
            emptyDescription={t('engineMonitoring.noMembersDescription')}
            columns={[
              {
                key: 'uuid',
                label: t('engineMonitoring.uuid'),
                render: (v) => v.uuid || '—',
                sortValue: (v) => v.uuid,
              },
              {
                key: 'address',
                label: t('engineMonitoring.address'),
                render: (v) => v.address || '—',
                sortValue: (v) => v.address,
              },
              {
                key: 'port',
                label: t('engineMonitoring.port'),
                render: (v) => v.port ?? '—',
                sortValue: (v) => v.port ?? -1,
              },
              {
                key: 'clustered',
                label: t('engineMonitoring.clustered'),
                render: (v) =>
                  v.clustered === null
                    ? t('engineMonitoring.notProvided')
                    : v.clustered
                      ? t('engineMonitoring.yes')
                      : t('engineMonitoring.no'),
                sortValue: (v) => (v.clustered === true ? 1 : 0),
              },
              {
                key: 'heartbeat',
                label: t('engineMonitoring.heartbeat'),
                render: (v) => formatResourceDate(v.heartbeat, locale),
                sortValue: (v) => v.heartbeat,
              },
            ]}
          />
        </>
      )}
    </>
  );
}
export function ProcessPools({ active = true }: { active?: boolean }) {
  const { t, locale } = useI18n();
  const engineNumber = (value: number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const app = useApp(),
    [auto, setAuto] = useState(true);
  const query = useQuery({
    queryKey: ['data', app.identity, 'engine-pools'],
    enabled: active && app.admin && app.config.modules.processes && app.config.modules.processPools,
    gcTime: 0,
    refetchInterval: active && auto ? 5000 : false,
    queryFn: async ({ signal }) =>
      (await allPages<Resource>('processpools?limit=100', signal)).map(processPoolMetadata),
  });
  if (!app.admin || !app.config.modules.processPools)
    return <Alert>{t('engineMonitoring.poolsUnavailable')}</Alert>;
  return (
    <>
      <div className="panel-heading">
        <h2>{t('engineMonitoring.poolsTitle')}</h2>
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          {t('engineMonitoring.refreshPools')}
        </Button>
      </div>
      <CheckboxField
        label={t('engineMonitoring.autoPools')}
        checked={auto}
        onChange={(e) => setAuto(e.target.checked)}
      />
      <Alert tone="info">{t('engineMonitoring.poolsNotice')}</Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          label={t('engineMonitoring.poolsLabel')}
          paginate={false}
          rows={query.data || []}
          rowKey={(v) => v.key}
          searchText={(v) => v.name}
          emptyTitle={t('engineMonitoring.noPools')}
          emptyDescription={t('engineMonitoring.noPoolsDescription')}
          columns={[
            {
              key: 'name',
              label: t('engineMonitoring.pool'),
              render: (v) => v.name || t('engineMonitoring.notProvided'),
              sortValue: (v) => v.name,
            },
            {
              key: 'active',
              label: t('engineMonitoring.active'),
              render: (v) => engineNumber(v.activeTasks),
              sortValue: (v) => v.activeTasks ?? -1,
            },
            {
              key: 'workers',
              label: t('engineMonitoring.workers'),
              render: (v) => (
                <>
                  {engineNumber(v.poolSize)}{' '}
                  <small className="muted">
                    ({engineNumber(v.minPoolSize)}–{engineNumber(v.maxPoolSize)})
                  </small>
                </>
              ),
              sortValue: (v) => v.poolSize ?? -1,
            },
            {
              key: 'queue',
              label: t('engineMonitoring.queue'),
              render: (v) => engineNumber(v.queueSize),
              sortValue: (v) => v.queueSize ?? -1,
            },
            {
              key: 'capacity',
              label: t('engineMonitoring.capacity'),
              render: (v) => engineNumber(v.queueRemainingCapacity),
              sortValue: (v) => v.queueRemainingCapacity ?? -1,
            },
            {
              key: 'completed',
              label: t('engineMonitoring.completed'),
              render: (v) => engineNumber(v.completedTasks),
              sortValue: (v) => v.completedTasks ?? -1,
            },
            {
              key: 'rejected',
              label: t('engineMonitoring.rejected'),
              render: (v) => engineNumber(v.rejectedTasks),
              sortValue: (v) => v.rejectedTasks ?? -1,
            },
          ]}
        />
      )}
    </>
  );
}
