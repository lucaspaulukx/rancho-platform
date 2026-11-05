import { safeApiUrl, type Resource, type Schema } from './api';
export interface ProcessRecord {
  id: string;
  processName: string;
  resourceType: string;
  resourceId: string;
  accountId: string;
  phase: string;
  exitReason: string;
  executionCount: number | null;
  startTime: string;
  endTime: string;
  runAfter: string;
  runningProcessServerId: string;
  links: { self?: string };
  actions: { replay?: string };
}
const identifier = (v: unknown) =>
  typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(v) ? v : '';
const date = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : '';
export function processMetadata(v: Resource): ProcessRecord {
  return {
    id: identifier(v.id),
    processName: identifier(v.processName),
    resourceType: identifier(v.resourceType),
    resourceId: identifier(v.resourceId),
    accountId: identifier(v.accountId),
    phase: identifier(v.phase),
    exitReason: identifier(v.exitReason),
    executionCount:
      typeof v.executionCount === 'number' &&
      Number.isSafeInteger(v.executionCount) &&
      v.executionCount >= 0
        ? v.executionCount
        : null,
    startTime: date(v.startTime),
    endTime: date(v.endTime),
    runAfter: date(v.runAfter),
    runningProcessServerId: identifier(v.runningProcessServerId),
    links: { self: v.links?.self },
    actions: { replay: v.actions?.replay },
  };
}
export interface ProcessFilters {
  state: 'all' | 'running' | 'waiting' | 'completed';
  process: string;
  resource: string;
  id: string;
}
export function processQuery(f: ProcessFilters) {
  const p = new URLSearchParams({ limit: '100', sort: 'id', order: 'desc' });
  for (const [key, value] of [
    ['processName', f.process],
    ['resourceType', f.resource],
    ['resourceId', f.id],
  ]) {
    if (!value.trim()) continue;
    if (!identifier(value.trim()))
      throw new Error('Use identificadores válidos nos filtros de processo e recurso.');
    p.set(key, value.trim());
  }
  if (f.state === 'running') {
    p.set('runningProcessServerId_notnull', 'true');
    p.set('endTime_null', 'true');
  } else if (f.state === 'waiting') {
    p.set('runningProcessServerId_null', 'true');
    p.set('endTime_null', 'true');
  } else if (f.state === 'completed') p.set('endTime_notnull', 'true');
  else if (f.state !== 'all') throw new Error('Situação de processo inválida.');
  return '/v2-beta/processinstances?' + p.toString();
}
export function processNext(value: unknown) {
  if (!value) return null;
  if (typeof value !== 'string') throw new Error('Paginação de processos inválida.');
  const path = safeApiUrl(value);
  if (new URL(path, location.origin).pathname !== '/v2-beta/processinstances')
    throw new Error('Paginação fora da coleção de processos.');
  return path;
}
export function processReplayTarget(schema: Schema | undefined, v: ProcessRecord) {
  if (
    schema?.id !== 'processInstance' ||
    !schema.resourceActions?.replay ||
    schema.resourceActions.replay.input ||
    !v.id ||
    !v.actions.replay
  )
    return;
  try {
    const path = safeApiUrl(v.actions.replay),
      url = new URL(path, location.origin);
    if (
      url.pathname.replace(/\/$/, '') !== '/v2-beta/processinstances/' + v.id ||
      url.searchParams.get('action') !== 'replay' ||
      [...url.searchParams.keys()].some((k) => k !== 'action')
    )
      return;
    return path;
  } catch {
    return;
  }
}
export function prepareReplay(schema: Schema, before: ProcessRecord, fresh: ProcessRecord) {
  const target = processReplayTarget(schema, fresh);
  if (!target) throw new Error('O replay não está mais disponível.');
  if (
    [
      'id',
      'processName',
      'resourceType',
      'resourceId',
      'accountId',
      'phase',
      'exitReason',
      'executionCount',
      'startTime',
      'endTime',
      'runAfter',
      'runningProcessServerId',
    ].some((k) => before[k as keyof ProcessRecord] !== fresh[k as keyof ProcessRecord])
  )
    throw new Error('O processo mudou. Atualize e revise novamente.');
  return target;
}
