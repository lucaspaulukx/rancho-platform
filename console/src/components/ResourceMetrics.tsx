import { useEffect, useRef, useState } from 'react';
import { Activity, Download, Pause, Play, RefreshCw } from 'lucide-react';
import { api, type Collection, type Resource } from '../api';
import {
  appendMetricPoint,
  metricPoint,
  metricPaths,
  metricResourceAllowed,
  metricsLink,
  parseMetricsFrame,
  scopedServiceMetricLink,
  serviceMetricMembership,
  serviceMetricsEnabled,
  serviceMetricTargets,
  ServiceMetricHistory,
  MetricsError,
  type MetricsErrorKey,
  type MetricCounters,
  type MetricPoint,
  type ServiceMetricTarget,
} from '../metrics';
import { metricsConnection, type MetricsAccess } from '../streams';
import { useI18n } from '../i18n/provider';
import { useApp } from '../state';
import { Alert, Badge, Button, Empty, Field, Modal } from './ui';

interface MetricsProps {
  resource: Resource;
  onClose: () => void;
}
export function ResourceMetrics(props: MetricsProps) {
  const app = useApp();
  return (
    <MetricsSession
      key={`${app.identity}:${app.project?.id}:${props.resource.type}:${props.resource.id}`}
      {...props}
    />
  );
}
function MetricsSession({ resource, onClose }: MetricsProps) {
  const { t, formats } = useI18n();
  const app = useApp();
  const [individualPoints, setPoints] = useState<MetricPoint[]>([]);
  const [targets, setTargets] = useState<ServiceMetricTarget[]>([]);
  const [targetId, setTargetId] = useState('');
  const [series, setSeries] = useState(() => new Map<string, MetricPoint[]>());
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'live' | 'closed' | 'stale'>('connecting');
  const [error, setError] = useState<MetricsErrorKey | null>(null);
  const received = useRef(0);
  const service = resource.type === 'service';
  const enabled =
    app.config.modules.observability &&
    app.config.modules.metrics &&
    (!service || serviceMetricsEnabled(app.config.modules));
  const usePayload =
    app.config.modules.metricsPayloadTransport === true &&
    app.server?.effective?.METRICS_PAYLOAD_TRANSPORT_ENABLED === true;
  useEffect(() => {
    if (paused || !enabled) return;
    if (!app.project?.id || resource.accountId !== app.project.id) {
      setError('resourceMetrics.wrongEnvironment');
      setStatus('closed');
      return;
    }
    const controller = new AbortController();
    const environment = app.project.id;
    let disposed = false,
      ended = false,
      checking = false,
      socket: WebSocket | undefined,
      previous: MetricCounters | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let pendingPayload: string | undefined;
    let history: ServiceMetricHistory | undefined;
    setStatus('connecting');
    setError(null);
    received.current = 0;
    if (service) {
      setTargets([]);
      setSeries(new Map());
    }
    const denied = (message: MetricsErrorKey = 'resourceMetrics.resourceDenied') => {
      if (!disposed && !ended) {
        setError(message);
        setStatus('closed');
        socket?.close();
      }
    };
    const readTargets = async (current: Resource) => {
      const page = await api<Collection<Resource>>(
        scopedServiceMetricLink(current, environment, 'instances'),
        undefined,
        undefined,
        AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      );
      if (!Array.isArray(page.data) || page.pagination?.partial)
        throw new MetricsError('resourceMetrics.incomplete');
      if (page.pagination?.next) throw new MetricsError('resourceMetrics.targetLimit');
      return serviceMetricTargets(current, page.data, environment);
    };
    async function connect() {
      try {
        const resourcePath = service
          ? scopedServiceMetricLink(resource, environment, 'self')
          : resource.links.self;
        const current = await api<Resource>(
          resourcePath,
          undefined,
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        );
        if (
          !metricResourceAllowed(current, resource, environment, service) ||
          !['active', 'running', 'reconnecting', 'updating-active'].includes(current.state || '')
        )
          throw new Error('Unavailable');
        let membership: string | undefined;
        if (service) {
          const currentTargets = await readTargets(current);
          if (disposed) return;
          if (!currentTargets.length) throw new MetricsError('resourceMetrics.noTargets');
          membership = serviceMetricMembership(currentTargets);
          history = new ServiceMetricHistory(currentTargets);
          setTargets(currentTargets);
        }
        const access = await api<MetricsAccess>(
          service
            ? scopedServiceMetricLink(current, environment, 'containerStats')
            : metricsLink(current)!,
          undefined,
          undefined,
          AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
          usePayload ? { 'X-Rancher-Stats-Payload': '1' } : undefined,
        );
        if (disposed) return;
        const connection = metricsConnection(access, app.config.classicUrl, usePayload);
        pendingPayload = connection.payload;
        socket = new WebSocket(connection.address);
        socket.onopen = () => {
          const payload = pendingPayload;
          pendingPayload = undefined;
          if (disposed || ended) {
            socket?.close();
            return;
          }
          if (payload) {
            try {
              socket?.send(payload);
            } catch {
              setError('resourceMetrics.negotiation');
              socket?.close();
            }
          }
        };
        socket.onmessage = (event) => {
          if (disposed || ended || typeof event.data !== 'string') return;
          try {
            if (service) {
              const changed = history?.read(event.data);
              if (history && changed?.size) {
                const updates = [...changed].map((id) => [id, history!.pointsFor(id)] as const);
                received.current = Date.now();
                setStatus('live');
                setSeries((value) => new Map([...value, ...updates]));
              }
              return;
            }
            for (const counters of parseMetricsFrame(event.data, current)) {
              const point = metricPoint(counters, previous);
              if (!point) continue;
              previous = counters;
              received.current = Date.now();
              setStatus('live');
              setPoints((values) => appendMetricPoint(values, point));
            }
          } catch {
            setError('resourceMetrics.invalidSample');
            socket?.close();
          }
        };
        socket.onerror = () => {
          pendingPayload = undefined;
          if (!disposed) setError('resourceMetrics.connectionFailed');
        };
        socket.onclose = (event) => {
          ended = true;
          controller.abort();
          pendingPayload = undefined;
          if (heartbeat) clearInterval(heartbeat);
          if (!disposed) {
            setStatus('closed');
            if (event?.code === 1008) setError('resourceMetrics.sessionDenied');
          }
        };
        heartbeat = setInterval(() => {
          if (checking || disposed || ended) return;
          checking = true;
          if (!received.current || Date.now() - received.current > 30_000) setStatus('stale');
          void api<Resource>(
            resourcePath,
            undefined,
            undefined,
            AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          )
            .then(async (value) => {
              if (disposed || ended) return;
              if (
                !metricResourceAllowed(value, current, environment, service) ||
                !['active', 'running', 'reconnecting', 'updating-active'].includes(
                  value.state || '',
                )
              ) {
                denied();
                return;
              }
              if (service) {
                const updated = await readTargets(value);
                if (disposed || ended) return;
                if (serviceMetricMembership(updated) !== membership) {
                  denied('resourceMetrics.membershipChanged');
                  return;
                }
                setTargets(updated);
              }
            })
            .catch(() => denied())
            .finally(() => {
              checking = false;
            });
        }, 15_000);
      } catch (error) {
        pendingPayload = undefined;
        if (!disposed) {
          setError(error instanceof MetricsError ? error.key : 'resourceMetrics.failed');
          setStatus('closed');
        }
      }
    }
    void connect();
    return () => {
      disposed = true;
      pendingPayload = undefined;
      controller.abort();
      if (heartbeat) clearInterval(heartbeat);
      socket?.close();
    };
  }, [resource.id, app.identity, app.project?.id, enabled, usePayload, paused, attempt, service]);
  const target = targets.find((item) => item.id === targetId) || targets[0];
  const points = service ? (target && series.get(target.id)) || [] : individualPoints;
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
      [...(target ? ['containerId'] : []), ...fields].join(','),
      ...points.map((point) =>
        [
          ...(target ? [target.id] : []),
          ...fields.map((field) =>
            field === 'ts' ? new Date(point.ts).toISOString() : (point[field] ?? ''),
          ),
        ].join(','),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${resource.id}${target ? `-${target.id}` : ''}-metricas.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      open
      drawer
      title={t('resourceMetrics.title', {
        name: String(resource.name || resource.hostname || resource.id),
      })}
      description={t('resourceMetrics.description', { name: app.project?.name || '—' })}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      footer={<Button onClick={onClose}>{t('resourceMetrics.close')}</Button>}
    >
      {!enabled ? (
        <Empty title={t('resourceMetrics.disabled')} description={t('resourceMetrics.enable')} />
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
                ? t('resourceMetrics.paused')
                : status === 'live'
                  ? t('resourceMetrics.live')
                  : status === 'stale'
                    ? t('resourceMetrics.stale')
                    : status === 'closed'
                      ? t('resourceMetrics.closed')
                      : t('resourceMetrics.connecting')}
            </Badge>
            <div className="row-actions">
              <Button onClick={() => setPaused((value) => !value)}>
                {paused ? <Play size={15} /> : <Pause size={15} />}{' '}
                {paused ? t('resourceMetrics.resume') : t('resourceMetrics.pause')}
              </Button>
              <Button disabled={!points.length} onClick={download}>
                <Download size={15} />
                {t('resourceMetrics.csv')}
              </Button>
              <Button
                aria-label={t('resourceMetrics.reconnect')}
                onClick={() => {
                  setPaused(false);
                  setAttempt((value) => value + 1);
                }}
              >
                <RefreshCw size={15} />
              </Button>
            </div>
          </div>
          {error && <Alert>{t(error)}</Alert>}
          {service && !!targets.length && (
            <Field
              label={t('resourceMetrics.container')}
              hint={t('resourceMetrics.containerHint', {
                sampled: series.size,
                total: targets.length,
              })}
            >
              {(id, descriptionId) => (
                <select
                  id={id}
                  aria-describedby={descriptionId}
                  value={target?.id || ''}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  {targets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {status === 'stale' && !paused && (
            <Alert tone="warning">{t('resourceMetrics.staleWarning')}</Alert>
          )}
          <p className="muted metrics-caption">
            {t('resourceMetrics.caption', {
              status: latest
                ? t('resourceMetrics.lastSample', {
                    time: formats.date(latest.ts, { timeStyle: 'medium' }),
                  })
                : t('resourceMetrics.awaiting'),
            })}
          </p>
          <div className="resource-metrics-grid">
            <MetricChart
              title={t('resourceMetrics.cpu')}
              unit="%"
              points={points}
              fields={[
                {
                  key: 'cpuPercent',
                  label: t('resourceMetrics.cpuUsage'),
                  color: 'var(--primary)',
                },
              ]}
              max={Math.max(
                (latest?.cpus || 1) * 100,
                ...points.map((point) => point.cpuPercent || 0),
              )}
              note={
                latest?.cpus
                  ? t('resourceMetrics.cpuNoteReported', { cores: latest.cpus })
                  : t('resourceMetrics.cpuNote')
              }
            />
            <MetricChart
              title={t('resourceMetrics.memory')}
              unit="MiB"
              points={points}
              fields={[
                { key: 'memoryMiB', label: t('resourceMetrics.memoryUsed'), color: 'var(--info)' },
              ]}
              max={latest?.memoryLimitMiB}
              note={
                latest?.memoryLimitMiB !== undefined
                  ? t('resourceMetrics.memoryLimit', {
                      limit: formats.number(latest.memoryLimitMiB, { maximumFractionDigits: 1 }),
                    })
                  : t('resourceMetrics.noMemoryLimit')
              }
            />
            <MetricChart
              title={t('resourceMetrics.network')}
              unit="KiB/s"
              points={points}
              fields={[
                { key: 'rxKiBs', label: t('resourceMetrics.received'), color: 'var(--success)' },
                { key: 'txKiBs', label: t('resourceMetrics.sent'), color: 'var(--primary)' },
              ]}
              note={t('resourceMetrics.networkNote')}
            />
            <MetricChart
              title={t('resourceMetrics.disk')}
              unit="KiB/s"
              points={points}
              fields={[
                { key: 'readKiBs', label: t('resourceMetrics.read'), color: 'var(--info)' },
                { key: 'writeKiBs', label: t('resourceMetrics.write'), color: 'var(--warning)' },
              ]}
              note={t('resourceMetrics.diskNote')}
            />
          </div>
          <p className="muted metrics-caption">{t('resourceMetrics.history')}</p>
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
  const { t, formats } = useI18n();
  const display = (value?: number) =>
    value === undefined ? '—' : formats.number(value, { maximumFractionDigits: 1 });
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
          aria-label={t('resourceMetrics.chartLabel', { title })}
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
          {points.length
            ? t('resourceMetrics.unavailableCounter')
            : t('resourceMetrics.waitingAgent')}
        </div>
      )}
      <div className="metric-chart-axis">
        <span>{points.length ? formats.date(points[0].ts, { timeStyle: 'medium' }) : '—'}</span>
        <span>
          {display(ceiling)} {unit}
        </span>
        <span>
          {points.length ? formats.date(points.at(-1)!.ts, { timeStyle: 'medium' }) : '—'}
        </span>
      </div>
      <p className="muted">{note}</p>
    </section>
  );
}
