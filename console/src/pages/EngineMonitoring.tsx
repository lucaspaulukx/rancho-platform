import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allPages, type Resource } from '../api';
import { useApp } from '../state';
import { clusterMemberMetadata, processPoolMetadata, engineNumber } from '../engine-monitoring';
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
    return <Alert>Monitoramento do cluster indisponível neste acesso.</Alert>;
  return (
    <>
      <PageHeader
        title="HA e membros do cluster"
        description="Membros reportados pelo servidor e seus últimos heartbeats."
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            Atualizar
          </Button>
        }
      />
      <CheckboxField
        label="Atualizar membros automaticamente (5 s)"
        checked={auto}
        onChange={(e) => setAuto(e.target.checked)}
      />
      <Alert tone="info">
        Os registros não comprovam quórum ou disponibilidade do cluster. A configuração de HA
        pertence ao processo de implantação; consultar esta tela não altera o servidor.
      </Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data?.some((v) => v.configurationIncomplete) && (
            <Alert tone="warning">
              Há metadados de membro incompletos. Os campos não disponíveis são indicados abaixo.
            </Alert>
          )}
          <DataTable
            label="Membros reportados do cluster"
            rows={query.data || []}
            rowKey={(v) => v.id || v.uuid}
            searchText={(v) => `${v.uuid} ${v.address} ${v.id}`}
            emptyTitle="Nenhum membro reportado"
            emptyDescription="O servidor não retornou membros nesta consulta."
            columns={[
              {
                key: 'uuid',
                label: 'UUID',
                render: (v) => v.uuid || '—',
                sortValue: (v) => v.uuid,
              },
              {
                key: 'address',
                label: 'Endereço informado',
                render: (v) => v.address || '—',
                sortValue: (v) => v.address,
              },
              {
                key: 'port',
                label: 'Porta HTTP',
                render: (v) => v.port ?? '—',
                sortValue: (v) => v.port ?? -1,
              },
              {
                key: 'clustered',
                label: 'Clustering informado',
                render: (v) =>
                  v.clustered === null ? 'Não informado' : v.clustered ? 'Sim' : 'Não',
                sortValue: (v) => (v.clustered === true ? 1 : 0),
              },
              {
                key: 'heartbeat',
                label: 'Último heartbeat',
                render: (v) => formatResourceDate(v.heartbeat),
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
    return <Alert>Pools indisponíveis neste acesso.</Alert>;
  return (
    <>
      <div className="panel-heading">
        <h2>Pools do engine</h2>
        <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
          Atualizar pools
        </Button>
      </div>
      <CheckboxField
        label="Atualizar pools automaticamente (5 s)"
        checked={auto}
        onChange={(e) => setAuto(e.target.checked)}
      />
      <Alert tone="info">
        Ativas, workers e fila são medidas da consulta atual. Concluídas e rejeitadas são contadores
        acumulados no processo do servidor, sem indicar falhas da última atualização.
      </Alert>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <DataTable
          label="Pools de execução do engine"
          paginate={false}
          rows={query.data || []}
          rowKey={(v) => v.key}
          searchText={(v) => v.name}
          emptyTitle="Nenhum pool reportado"
          emptyDescription="O servidor não retornou executores nesta consulta."
          columns={[
            {
              key: 'name',
              label: 'Pool',
              render: (v) => v.name || 'Não informado',
              sortValue: (v) => v.name,
            },
            {
              key: 'active',
              label: 'Ativas',
              render: (v) => engineNumber(v.activeTasks),
              sortValue: (v) => v.activeTasks ?? -1,
            },
            {
              key: 'workers',
              label: 'Workers (mínimo–máximo)',
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
              label: 'Fila',
              render: (v) => engineNumber(v.queueSize),
              sortValue: (v) => v.queueSize ?? -1,
            },
            {
              key: 'capacity',
              label: 'Capacidade restante da fila',
              render: (v) => engineNumber(v.queueRemainingCapacity),
              sortValue: (v) => v.queueRemainingCapacity ?? -1,
            },
            {
              key: 'completed',
              label: 'Concluídas (acumulado)',
              render: (v) => engineNumber(v.completedTasks),
              sortValue: (v) => v.completedTasks ?? -1,
            },
            {
              key: 'rejected',
              label: 'Rejeitadas (acumulado)',
              render: (v) => engineNumber(v.rejectedTasks),
              sortValue: (v) => v.rejectedTasks ?? -1,
            },
          ]}
        />
      )}
    </>
  );
}
