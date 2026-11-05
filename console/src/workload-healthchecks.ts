import type { Schema } from './api';
export const healthNumbers = [
  ['interval', 'Intervalo das verificações (ms)', 1, 2000],
  ['responseTimeout', 'Timeout da resposta (ms)', 1, 2000],
  ['initializingTimeout', 'Prazo de inicialização (ms)', 0, 60000],
  ['reinitializingTimeout', 'Prazo de reinicialização (ms)', 0, 60000],
  ['healthyThreshold', 'Sucessos para considerar saudável', 1, 2],
  ['unhealthyThreshold', 'Falhas para considerar indisponível', 1, 3],
] as const;
export const healthMethods = [
  'OPTIONS',
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'TRACE',
  'CONNECT',
];
export interface HealthRequest {
  method: string;
  path: string;
  version: string;
  host: string;
}
export function healthRequestLine(v: HealthRequest) {
  return `${v.method} "${v.path}" "${v.version}${v.version === 'HTTP/1.1' && v.host ? '\\r\\nHost: ' + v.host : ''}"`;
}
export function validateHealthRequest(line: unknown) {
  if (line === '' || line === undefined || line === null) return;
  if (typeof line !== 'string' || line.length > 8192)
    throw new Error('Revise a requisição HTTP da verificação de saúde.');
  if (!decodeHealthRequest(line))
    throw new Error(
      'Use um caminho HTTP iniciado por /, sem espaços, aspas ou quebras de linha, e um Host válido.',
    );
}
export function decodeHealthRequest(line: string): HealthRequest | undefined {
  const parsed =
    /^(OPTIONS|GET|HEAD|POST|PUT|DELETE|TRACE|CONNECT) "(\/[^\s"\\]*)" "(HTTP\/1\.[01])(?:\\r\\nHost: ([a-zA-Z0-9._:\[\]-]+))?"$/.exec(
      line,
    );
  if (!parsed || (parsed[3] === 'HTTP/1.0' && parsed[4])) return undefined;
  return { method: parsed[1], path: parsed[2], version: parsed[3], host: parsed[4] || '' };
}
export function healthDefaults(schema: Schema) {
  const defaults: Record<string, unknown> = { port: '' };
  for (const [name, , , fallback] of healthNumbers)
    if (schema.resourceFields[name]?.create)
      defaults[name] = schema.resourceFields[name].default ?? fallback;
  if (schema.resourceFields.requestLine?.create) defaults.requestLine = '';
  if (schema.resourceFields.strategy?.create)
    defaults.strategy = schema.resourceFields.strategy.default ?? 'recreate';
  return defaults;
}
export function validateHealthCheck(value: unknown, schema?: Schema, quorum?: Schema) {
  if (value == null) return;
  if (!schema || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Contrato da verificação de saúde indisponível.');
  const v = value as Record<string, unknown>;
  for (const name of Object.keys(v))
    if (!schema.resourceFields[name]?.create)
      throw new Error(`O campo de saúde ${name} não está disponível. Reabra o painel.`);
  const integer = (value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER) => {
    if (
      !['string', 'number'].includes(typeof value) ||
      String(value).trim() === '' ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < min ||
      Number(value) > max
    )
      throw new Error(`${label} precisa ser um inteiro entre ${min} e ${max}.`);
  };
  integer(v.port, 'Porta da verificação', 1, 65535);
  for (const [name, label, min] of healthNumbers)
    if (v[name] !== undefined && v[name] !== '') integer(v[name], label, min);
  validateHealthRequest(v.requestLine);
  if (
    v.strategy !== undefined &&
    !schema.resourceFields.strategy?.options?.includes(String(v.strategy))
  )
    throw new Error('Estratégia de saúde indisponível.');
  if (v.strategy === 'recreateOnQuorum') {
    if (
      !schema.resourceFields.recreateOnQuorumStrategyConfig?.create ||
      !quorum?.resourceFields.quorum?.create
    )
      throw new Error('Contrato de quórum indisponível.');
    integer(
      (v.recreateOnQuorumStrategyConfig as Record<string, unknown> | undefined)?.quorum,
      'Quórum de saúde',
      1,
    );
  }
}
export function validateWorkloadHealthChecks(
  schema: Schema,
  values: Record<string, unknown>,
  schemas: Record<string, Schema>,
  depth = 0,
) {
  if (depth > 12) throw new Error('A configuração de saúde tem níveis demais.');
  for (const [name, value] of Object.entries(values)) {
    const type = schema.resourceFields[name]?.type;
    if (name === 'healthCheck' && type === 'instanceHealthCheck')
      validateHealthCheck(value, schemas[type], schemas.recreateOnQuorumStrategyConfig);
    else if (value && typeof value === 'object' && !Array.isArray(value) && schemas[type])
      validateWorkloadHealthChecks(
        schemas[type],
        value as Record<string, unknown>,
        schemas,
        depth + 1,
      );
    else if (Array.isArray(value)) {
      const arrayType = /^array\[([^\]]+)\]$/.exec(type || '')?.[1];
      if (arrayType && schemas[arrayType])
        for (const row of value) {
          if (row && typeof row === 'object' && !Array.isArray(row))
            validateWorkloadHealthChecks(schemas[arrayType], row, schemas, depth + 1);
        }
    }
  }
}
