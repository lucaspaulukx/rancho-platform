import type { Resource } from './api';
const identifier = (v: unknown) =>
  typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,254}$/.test(v) ? v : '';
const count = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
export interface ClusterMember {
  id: string;
  uuid: string;
  address: string;
  port: number | null;
  clustered: boolean | null;
  heartbeat: string;
  configurationIncomplete: boolean;
}
export function clusterMemberMetadata(row: Resource): ClusterMember {
  let data: Record<string, unknown> = {},
    incomplete = false;
  if (row.config != null) {
    try {
      if (typeof row.config !== 'string' || row.config.length > 1024 * 1024) throw new Error();
      const parsed = JSON.parse(row.config);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      data = parsed;
    } catch {
      incomplete = true;
    }
  }
  const address =
    typeof data.advertiseAddress === 'string' &&
    /^[a-zA-Z0-9_.:[\]-]{1,255}$/.test(data.advertiseAddress)
      ? data.advertiseAddress
      : '';
  const rawPort =
    typeof data.httpPort === 'string' && /^\d+$/.test(data.httpPort)
      ? Number(data.httpPort)
      : data.httpPort;
  const port = count(rawPort);
  let heartbeat = '';
  if (
    typeof row.heartbeat === 'number' &&
    Number.isSafeInteger(row.heartbeat) &&
    row.heartbeat > 0 &&
    Number.isFinite(new Date(row.heartbeat).getTime())
  )
    heartbeat = new Date(row.heartbeat).toISOString();
  return {
    id: identifier(row.id),
    uuid: identifier(row.uuid),
    address,
    port: port !== null && port > 0 && port <= 65535 ? port : null,
    clustered:
      typeof data.clustered === 'boolean'
        ? data.clustered
        : typeof row.clustered === 'boolean'
          ? row.clustered
          : null,
    heartbeat,
    configurationIncomplete: incomplete,
  };
}
export interface ProcessPool {
  key: string;
  name: string;
  activeTasks: number | null;
  poolSize: number | null;
  minPoolSize: number | null;
  maxPoolSize: number | null;
  queueSize: number | null;
  queueRemainingCapacity: number | null;
  completedTasks: number | null;
  rejectedTasks: number | null;
}
export function processPoolMetadata(row: Resource, index: number): ProcessPool {
  const name = identifier(row.name);
  return {
    key: `${index}:${name}`,
    name,
    activeTasks: count(row.activeTasks),
    poolSize: count(row.poolSize),
    minPoolSize: count(row.minPoolSize),
    maxPoolSize: count(row.maxPoolSize),
    queueSize: count(row.queueSize),
    queueRemainingCapacity: count(row.queueRemainingCapacity),
    completedTasks: count(row.completedTasks),
    rejectedTasks: count(row.rejectedTasks),
  };
}
export const engineNumber = (value: number | null) =>
  value === null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
