import { useEffect, useRef, useState } from 'react';
import { Activity, Download, Pause, Play, RefreshCw } from 'lucide-react';
import { api, type Resource } from '../api';
import {
  appendMetricPoint,
  metricPoint,
  metricPaths,
  metricResourceAllowed,
  metricsLink,
  parseMetricsFrame,
  type MetricCounters,
  type MetricPoint,
} from '../metrics';
import { websocketAddress } from '../streams';
import { useApp } from '../state';
import { Alert, Badge, Button, Empty, Modal } from './ui';

const display = (value?: number) =>
  value === undefined
    ? '—'
    : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
interface MetricsProps {
  resource: Resource;
  onClose: () => void;
}
export function ResourceMetrics(props: MetricsProps) {
  const app = useApp();
  return (
    <MetricsSession key={`${app.identity}:${app.project?.id}:${props.resource.id}`} {...props} />
  );
}
function MetricsSession({ resource, onClose }: MetricsProps) {
  const app = useApp();
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'live' | 'closed' | 'stale'>('connecting');
  const [error, setError] = useState('');
  const received = useRef(0);
  const enabled = app.config.modules.observability && app.config.modules.metrics;
  useEffect(() => {
    if (paused || !enabled) return;
    if (!app.project?.id || resource.accountId !== app.project.id) {
      setError('O recurso não pertence ao environment selecionado.');
      setStatus('closed');
      return;
    }
    const controller = new AbortController();
    let disposed = false,
      socket: WebSocket | undefined,
      previous: MetricCounters | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    setStatus('connecting');
    setError('');
    received.current = 0;
    const denied = () => {
      if (!disposed) {
        setError(
          'As métricas foram encerradas porque o recurso ou a permissão não está mais disponível.',
        );
        setStatus('closed');
        socket?.close();
      }
    };
    async function connect() {
      try {
        const current = await api<Resource>(
          resource.links.self,
          undefined,
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        );
        if (
          !metricResourceAllowed(current, resource, app.project?.id) ||
          !['active', 'running', 'reconnecting', 'updating-active'].includes(current.state || '')
        )
          throw new Error('Unavailable');
        const access = await api<{ url: string; token: string }>(
          metricsLink(current)!,
          undefined,
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        );
        if (disposed) return;
        socket = new WebSocket(websocketAddress(access.url, access.token, app.config.classicUrl));
        socket.onopen = () => {
          if (disposed) socket?.close();
        };
        socket.onmessage = (event) => {
          if (disposed || typeof event.data !== 'string') return;
          try {
            for (const counters of parseMetricsFrame(event.data, current)) {
              const point = metricPoint(counters, previous);
              if (!point) continue;
              previous = counters;
              received.current = Date.now();
              setStatus('live');
              setPoints((values) => appendMetricPoint(values, point));
            }
          } catch {
            setError('O servidor enviou uma amostra de métricas inválida.');
            socket?.close();
          }
        };
        socket.onerror = () => {
          if (!disposed) setError('A conexão de métricas falhou. Tente conectar novamente.');
        };
        socket.onclose = () => {
          if (heartbeat) clearInterval(heartbeat);
          if (!disposed) setStatus('closed');
        };
        heartbeat = setInterval(() => {
          if (!received.current || Date.now() - received.current > 30_000) setStatus('stale');
          void api<Resource>(
            resource.links.self,
            undefined,
            undefined,
            AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          )
            .then((value) => {
              if (
                !metricResourceAllowed(value, current, app.project?.id) ||
                !['active', 'running', 'reconnecting', 'updating-active'].includes(
                  value.state || '',
                )
              )
                denied();
            })
            .catch(denied);
        }, 15_000);
      } catch {
        if (!disposed) {
          setError(
            'Não foi possível obter métricas deste recurso. Confira seu estado, a conectividade do agente e suas permissões.',
          );
          setStatus('closed');
        }
      }
    }
    void connect();
    return () => {
      disposed = true;
      controller.abort();
      if (heartbeat) clearInterval(heartbeat);
      socket?.close();
    };
  }, [resource.id, app.identity, app.project?.id, enabled, paused, attempt]);
  const latest = points.at(-1);
  function download() {
    const fields = [
      'ts',
      'cpuPercent',
      'memoryMiB',
      'memoryLimitMiB',
      'rxKiBs',
      'txKiBs',
      'readKiBs',
      'writeKiBs',
    ] as const;
    const rows = [
      fields.join(','),
      ...points.map((point) =>
        fields
          .map((field) =>
            field === 'ts' ? new Date(point.ts).toISOString() : (point[field] ?? ''),
          )
          .join(','),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.id}-metricas.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      open
      drawer
      title={`Métricas · ${resource.name || resource.hostname || resource.id}`}
      description={`Environment: ${app.project?.name || '—'} · amostras em tempo real do Rancher`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      {!enabled ? (
        <Empty
          title="Métricas desativadas"
          description="Ative o módulo de métricas na configuração da console."
        />
      ) : (
        <>
          <div className="metrics-toolbar">
            <Badge
              state={
                paused
                  ? 'inactive'
                  : status === 'live'
                    ? 'active'
                    : status === 'stale'
                      ? 'warning'
                      : status === 'closed'
                        ? 'error'
                        : 'activating'
              }
            >
              {paused
                ? 'Pausado'
                : status === 'live'
                  ? 'Ao vivo'
                  : status === 'stale'
                    ? 'Sem novas amostras'
                    : status === 'closed'
                      ? 'Conexão encerrada'
                      : 'Conectando…'}
            </Badge>
            <div className="row-actions">
              <Button onClick={() => setPaused((value) => !value)}>
                {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? 'Retomar' : 'Pausar'}
              </Button>
              <Button disabled={!points.length} onClick={download}>
                <Download size={15} />
                CSV
              </Button>
              <Button
                aria-label="Reconectar métricas"
                onClick={() => {
                  setPaused(false);
                  setAttempt((value) => value + 1);
                }}
              >
                <RefreshCw size={15} />
              </Button>
            </div>
          </div>
          {error && <Alert>{error}</Alert>}
          {status === 'stale' && !paused && (
            <Alert tone="warning">
              O agente não enviou novas amostras recentemente. Os últimos valores continuam visíveis
              com seus horários.
            </Alert>
          )}
          <p className="muted metrics-caption">
            Últimos 5 minutos desta conexão · até 300 amostras ·{' '}
            {latest
              ? `última amostra às ${new Date(latest.ts).toLocaleTimeString('pt-BR')}`
              : 'aguardando amostras'}
          </p>
          <div className="resource-metrics-grid">
            <MetricChart
              title="CPU"
              unit="%"
              points={points}
              fields={[{ key: 'cpuPercent', label: 'Uso de CPU', color: 'var(--primary)' }]}
              max={Math.max(
                (latest?.cpus || 1) * 100,
                ...points.map((point) => point.cpuPercent || 0),
              )}
              note={`100% equivale a um núcleo${latest?.cpus ? ` · ${latest.cpus} núcleos reportados` : ''}.`}
            />
            <MetricChart
              title="Memória"
              unit="MiB"
              points={points}
              fields={[{ key: 'memoryMiB', label: 'Memória usada', color: 'var(--info)' }]}
              max={latest?.memoryLimitMiB}
              note={
                latest?.memoryLimitMiB !== undefined
                  ? `Limite reportado: ${display(latest.memoryLimitMiB)} MiB.`
                  : 'O agente não reportou limite de memória.'
              }
            />
            <MetricChart
              title="Rede"
              unit="KiB/s"
              points={points}
              fields={[
                { key: 'rxKiBs', label: 'Recebidos', color: 'var(--success)' },
                { key: 'txKiBs', label: 'Enviados', color: 'var(--primary)' },
              ]}
              note="Taxas calculadas entre amostras das mesmas interfaces."
            />
            <MetricChart
              title="Disco"
              unit="KiB/s"
              points={points}
              fields={[
                { key: 'readKiBs', label: 'Leitura', color: 'var(--info)' },
                { key: 'writeKiBs', label: 'Escrita', color: 'var(--warning)' },
              ]}
              note="Ausência de contadores aparece como indisponível."
            />
          </div>
          <p className="muted metrics-caption">
            Histórico mantido somente enquanto este painel estiver aberto. Permissões revalidadas a
            cada 15 segundos.
          </p>
        </>
      )}
    </Modal>
  );
}
function MetricChart({
  title,
  unit,
  points,
  fields,
  max,
  note,
}: {
  title: string;
  unit: string;
  points: MetricPoint[];
  fields: { key: keyof MetricPoint; label: string; color: string }[];
  max?: number;
  note: string;
}) {
  const ceiling =
    max && max > 0
      ? max
      : Math.max(1, ...points.flatMap((point) => fields.map((field) => point[field.key] || 0))) *
        1.1;
  const available = points.some((point) => fields.some((field) => point[field.key] !== undefined));
  return (
    <section className="panel metric-chart">
      <div className="metric-chart-heading">
        <h3>
          <Activity size={15} />
          {title}
        </h3>
        <span>{unit}</span>
      </div>
      <div className="metric-chart-values">
        {fields.map((field) => (
          <div key={field.key}>
            <span style={{ color: field.color }}>{field.label}</span>
            <strong>
              {display(points.at(-1)?.[field.key])}
              <small>{unit}</small>
            </strong>
          </div>
        ))}
      </div>
      {available ? (
        <svg
          viewBox="0 0 320 100"
          role="img"
          aria-label={`${title}: evolução das amostras recebidas`}
          className="metric-chart-svg"
        >
          <path d="M0 8H320 M0 48H320 M0 88H320" stroke="var(--border)" fill="none" />
          {fields.flatMap((field) =>
            metricPaths(points, field.key, ceiling).map((path, index) => (
              <path
                key={`${field.key}-${index}`}
                d={path}
                stroke={field.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            )),
          )}
        </svg>
      ) : (
        <div className="metric-chart-unavailable">
          {points.length ? 'Contador indisponível' : 'Aguardando dados do agente…'}
        </div>
      )}
      <div className="metric-chart-axis">
        <span>{points.length ? new Date(points[0].ts).toLocaleTimeString('pt-BR') : '—'}</span>
        <span>
          {display(ceiling)} {unit}
        </span>
        <span>{points.length ? new Date(points.at(-1)!.ts).toLocaleTimeString('pt-BR') : '—'}</span>
      </div>
      <p className="muted">{note}</p>
    </section>
  );
}
