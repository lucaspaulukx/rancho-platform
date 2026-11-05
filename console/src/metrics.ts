import { safeApiUrl, type Resource } from './api';
import type { ConsoleConfig } from './config';
export interface MetricCounters {
  ts: number;
  cpu?: number;
  cpus?: number;
  memory?: number;
  memoryLimit?: number;
  network?: Record<string, { rx?: number; tx?: number }>;
  disk?: { read?: number; write?: number };
}
export interface MetricPoint {
  ts: number;
  cpus?: number;
  cpuPercent?: number;
  memoryMiB?: number;
  memoryLimitMiB?: number;
  rxKiBs?: number;
  txKiBs?: number;
  readKiBs?: number;
  writeKiBs?: number;
}
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
const object = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
export function metricsLink(resource: Resource, serviceMetrics = false) {
  return resource.type === 'host'
    ? resource.links.hostStats || resource.links.stats
    : resource.type === 'container'
      ? resource.links.stats || resource.links.containerStats
      : serviceMetrics && resource.type === 'service' && resource.links.instances
        ? resource.links.containerStats
        : undefined;
}
export function metricResourceAllowed(
  current: Resource,
  expected: Resource,
  environment?: string,
  serviceMetrics = false,
) {
  return (
    current.id === expected.id &&
    current.type === expected.type &&
    (!environment || current.accountId === environment) &&
    !!metricsLink(current, serviceMetrics)
  );
}
function metricRows(frame: string): unknown[] {
  if (frame.length > 1_048_576) throw new Error('Amostra de métricas acima do limite.');
  const rows: unknown = JSON.parse(frame);
  if (!Array.isArray(rows) || rows.length > 32) throw new Error('Amostra de métricas inválida.');
  return rows;
}
function countersFromRow(
  row: Record<string, any>,
  type: 'host' | 'container',
): MetricCounters | undefined {
  const ts = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : NaN;
  if (!Number.isFinite(ts)) return undefined;
  const cpu = object(object(row.cpu).usage);
  const user = number(cpu.user),
    system = number(cpu.system);
  const usage =
    user !== undefined && system !== undefined
      ? user + system
      : type === 'container'
        ? number(cpu.total)
        : undefined;
  const cpus =
    Array.isArray(cpu.per_cpu_usage) &&
    cpu.per_cpu_usage.length > 0 &&
    cpu.per_cpu_usage.length <= 256
      ? cpu.per_cpu_usage.length
      : undefined;
  const memory = object(row.memory);
  const network = object(row.network);
  let interfaces: Record<string, { rx?: number; tx?: number }> | undefined;
  if (Array.isArray(network.interfaces) && network.interfaces.length <= 128)
    interfaces = Object.fromEntries(
      network.interfaces.flatMap((value: unknown) => {
        const item = object(value);
        return typeof item.name === 'string'
          ? [[item.name, { rx: number(item.rx_bytes), tx: number(item.tx_bytes) }]]
          : [];
      }),
    );
  else if (number(network.rx_bytes) !== undefined || number(network.tx_bytes) !== undefined)
    interfaces = { all: { rx: number(network.rx_bytes), tx: number(network.tx_bytes) } };
  const disks = object(row.diskio).io_service_bytes;
  let disk: MetricCounters['disk'];
  if (Array.isArray(disks) && disks.length > 0 && disks.length <= 128) {
    const values = disks.map((value: unknown) => object(object(value).stats));
    const reads = values.map((value) => number(value.Read)),
      writes = values.map((value) => number(value.Write));
    disk = {
      read: reads.every((value) => value !== undefined)
        ? reads.reduce<number>((sum, value) => sum + value!, 0)
        : undefined,
      write: writes.every((value) => value !== undefined)
        ? writes.reduce<number>((sum, value) => sum + value!, 0)
        : undefined,
    };
  }
  return {
    ts,
    cpu: usage,
    cpus,
    memory: number(memory.usage),
    memoryLimit: number(memory.limit),
    network: interfaces,
    disk,
  };
}
const metricIdentifiers = (resource: Resource) =>
  [resource.id, resource.uuid, resource.externalId].filter(
    (value): value is string => typeof value === 'string' && !!value,
  );
export function parseMetricsFrame(frame: string, resource: Resource): MetricCounters[] {
  const rows = metricRows(frame);
  const identifiers = new Set(metricIdentifiers(resource));
  return rows.flatMap((value) => {
    const row = object(value);
    const type = resource.type;
    if (
      row.resourceType !== type ||
      (type === 'container'
        ? !identifiers.has(row.id)
        : type !== 'host' || (row.id != null && !identifiers.has(row.id)))
    )
      return [];
    if (type !== 'host' && type !== 'container') return [];
    const counters = countersFromRow(row, type);
    return counters ? [counters] : [];
  });
}

export function serviceMetricsEnabled(modules: ConsoleConfig['modules']) {
  return !!(
    modules.serviceMetrics &&
    modules.metrics &&
    modules.observability &&
    modules.workloads &&
    modules.contextActions
  );
}
export class ServiceMetricsError extends Error {}
export const MAX_SERVICE_METRIC_TARGETS = 64;
export function scopedServiceMetricLink(
  service: Resource,
  environment: string,
  link: 'self' | 'instances' | 'containerStats',
) {
  if (service.type !== 'service' || service.accountId !== environment || !service.links[link])
    throw new ServiceMetricsError('O servidor não disponibiliza métricas para este serviço.');
  const path = safeApiUrl(service.links[link]).replace(/\/$/, '');
  const base = `/v2-beta/projects/${encodeURIComponent(environment)}/services/${encodeURIComponent(service.id)}`;
  const expected = link === 'self' ? base : `${base}/${link.toLowerCase()}`;
  if (path !== expected)
    throw new ServiceMetricsError('O endereço de métricas não pertence ao serviço selecionado.');
  return link === 'instances' ? `${path}?limit=${MAX_SERVICE_METRIC_TARGETS + 1}` : path;
}

export interface ServiceMetricTarget {
  id: string;
  name: string;
  identifiers: readonly string[];
}
export function serviceMetricTargets(
  service: Resource,
  instances: Resource[],
  environment: string,
) {
  if (service.type !== 'service' || service.accountId !== environment)
    throw new ServiceMetricsError('O serviço não pertence ao environment selecionado.');
  if (instances.length > MAX_SERVICE_METRIC_TARGETS)
    throw new ServiceMetricsError('O painel suporta até 64 containers por serviço.');
  const aliases = new Map<string, string>();
  const targets: ServiceMetricTarget[] = [];
  for (const instance of instances) {
    if (instance.removed || instance.state !== 'running') continue;
    if (
      instance.type !== 'container' ||
      instance.accountId !== environment ||
      !Array.isArray(instance.serviceIds) ||
      !instance.serviceIds.includes(service.id) ||
      typeof instance.id !== 'string' ||
      !/^1i[0-9]+$/.test(instance.id)
    )
      throw new ServiceMetricsError(
        'A lista de containers não corresponde ao serviço selecionado.',
      );
    const identifiers = [...new Set(metricIdentifiers(instance))];
    if (identifiers.some((value) => value.length > 128 || aliases.has(value)))
      throw new ServiceMetricsError('A lista de containers contém identidades conflitantes.');
    for (const value of identifiers) aliases.set(value, instance.id);
    targets.push({ id: instance.id, name: instance.name || instance.id, identifiers });
  }
  return targets.sort(
    (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }) || a.id.localeCompare(b.id),
  );
}
export function serviceMetricMembership(targets: readonly ServiceMetricTarget[]) {
  return JSON.stringify(targets.map(({ id, identifiers }) => [id, [...identifiers].sort()]).sort());
}

/** One independent counter baseline and bounded history per authorized container. */
export class ServiceMetricHistory {
  private aliases = new Map<string, string>();
  private previous = new Map<string, MetricCounters>();
  private points = new Map<string, MetricPoint[]>();

  constructor(targets: readonly ServiceMetricTarget[]) {
    if (targets.length > MAX_SERVICE_METRIC_TARGETS)
      throw new Error('Limite de containers excedido.');
    for (const target of targets) {
      for (const alias of target.identifiers) {
        if (this.aliases.has(alias)) throw new Error('Identidade de container ambígua.');
        this.aliases.set(alias, target.id);
      }
    }
  }

  read(frame: string) {
    const changed = new Set<string>();
    for (const value of metricRows(frame)) {
      const row = object(value);
      if (row.resourceType !== 'container' || typeof row.id !== 'string') continue;
      const id = this.aliases.get(row.id);
      if (!id) continue;
      const counters = countersFromRow(row, 'container');
      if (!counters) continue;
      const point = metricPoint(counters, this.previous.get(id));
      if (!point) continue;
      this.previous.set(id, counters);
      this.points.set(id, appendMetricPoint(this.points.get(id) || [], point));
      changed.add(id);
    }
    return changed;
  }

  pointsFor(id: string): MetricPoint[] {
    return this.points.get(id) || [];
  }
}
function delta(current?: number, previous?: number) {
  return current !== undefined && previous !== undefined && current >= previous
    ? current - previous
    : undefined;
}
export function metricPoint(
  current: MetricCounters,
  previous?: MetricCounters,
): MetricPoint | undefined {
  if (previous && current.ts <= previous.ts) return undefined;
  const result: MetricPoint = {
    ts: current.ts,
    cpus: current.cpus,
    memoryMiB: current.memory === undefined ? undefined : current.memory / 1048576,
    memoryLimitMiB: current.memoryLimit === undefined ? undefined : current.memoryLimit / 1048576,
  };
  if (!previous) return result;
  const seconds = (current.ts - previous.ts) / 1000;
  const cpu = delta(current.cpu, previous.cpu);
  if (cpu !== undefined)
    result.cpuPercent = Math.min((cpu / (seconds * 1e9)) * 100, (current.cpus || 256) * 100);
  const rates: Record<string, number[]> = { rx: [], tx: [] };
  if (current.network && previous.network)
    for (const [name, value] of Object.entries(current.network)) {
      const before = previous.network[name];
      if (!before) continue;
      for (const field of ['rx', 'tx'] as const) {
        const difference = delta(value[field], before[field]);
        if (difference !== undefined) rates[field].push(difference / (seconds * 1024));
      }
    }
  if (rates.rx.length) result.rxKiBs = rates.rx.reduce((sum, value) => sum + value, 0);
  if (rates.tx.length) result.txKiBs = rates.tx.reduce((sum, value) => sum + value, 0);
  const read = delta(current.disk?.read, previous.disk?.read),
    write = delta(current.disk?.write, previous.disk?.write);
  if (read !== undefined) result.readKiBs = read / (seconds * 1024);
  if (write !== undefined) result.writeKiBs = write / (seconds * 1024);
  return result;
}
export function appendMetricPoint(points: MetricPoint[], next: MetricPoint, windowMs = 300_000) {
  return [
    ...points.filter((point) => point.ts >= next.ts - windowMs && point.ts < next.ts),
    next,
  ].slice(-300);
}
export function metricPaths(points: MetricPoint[], key: keyof MetricPoint, max: number) {
  if (!points.length || !Number.isFinite(max) || max <= 0) return [];
  const first = points[0].ts,
    last = points.at(-1)!.ts,
    span = Math.max(last - first, 1);
  const paths: string[] = [];
  let path = '';
  for (const point of points) {
    const value = point[key];
    if (value === undefined || !Number.isFinite(value)) {
      if (path) paths.push(path);
      path = '';
      continue;
    }
    const x = ((point.ts - first) / span) * 320,
      y = 88 - Math.min(Math.max(value, 0) / max, 1) * 80;
    path += `${path ? ' L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  if (path) paths.push(path);
  return paths;
}
