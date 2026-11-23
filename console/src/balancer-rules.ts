import type { Resource, Schema } from './api';

export interface BalancerRuleDraft {
  key: number;
  protocol: 'http' | 'tcp';
  sourcePort: string;
  targetPort: string;
  serviceId: string;
  hostname: string;
  path: string;
  access: 'internal' | 'public';
  sourceIp: string;
}
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Configuração do balanceador indisponível.');
  return value as ObjectValue;
};
export function canEditBalancer(resource: Resource, schema?: Schema, enabled = false) {
  return (
    enabled &&
    resource.type === 'loadBalancerService' &&
    !resource.removed &&
    ['active', 'inactive'].includes(resource.state || '') &&
    schema?.id === resource.type &&
    !!schema.resourceMethods?.includes('PUT') &&
    schema.resourceFields.lbConfig?.update === true &&
    schema.resourceFields.launchConfig?.update === true
  );
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function balancerSnapshot(resource: Resource) {
  const launch = object(resource.launchConfig);
  return JSON.stringify(
    canonical({
      lbConfig: resource.lbConfig,
      ports: launch.ports ?? [],
      expose: launch.expose ?? [],
    }),
  );
}
export function assertBalancerUnchanged(before: Resource, after: Resource) {
  if (
    before.id !== after.id ||
    before.accountId !== after.accountId ||
    before.type !== after.type ||
    balancerSnapshot(before) !== balancerSnapshot(after)
  )
    throw new Error('O balanceador foi alterado por outro cliente. Feche e reabra o painel.');
}
interface Binding {
  port: number;
  protocol: string;
  access: 'public' | 'internal';
  ip: string;
}
function bindings(launch: ObjectValue) {
  const result: Binding[] = [];
  for (const access of ['public', 'internal'] as const) {
    const values = launch[access === 'public' ? 'ports' : 'expose'] ?? [];
    if (!Array.isArray(values))
      throw new Error('Formato de portas não suportado. Use a edição nativa.');
    for (const value of values) {
      if (typeof value !== 'string') throw new Error('Binding de porta inválido.');
      const match = /^(?:(\[[0-9a-fA-F:.]+\]|[0-9.]+):)?(\d+):(\d+)\/(tcp|udp)$/.exec(value);
      if (!match || match[2] !== match[3] || (access === 'internal' && match[1]))
        throw new Error('Este binding exige a edição nativa. Nenhuma porta será convertida.');
      result.push({ port: port(match[2]), protocol: match[4], access, ip: match[1] || '' });
    }
  }
  return result;
}
function port(value: string) {
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > 65535
  )
    throw new Error('Informe portas inteiras entre 1 e 65535.');
  return Number(value);
}
export function editableBalancerRules(source: Resource): BalancerRuleDraft[] {
  const config = object(source.lbConfig),
    launch = object(source.launchConfig);
  const rules = config.portRules ?? [];
  if (!Array.isArray(rules) || rules.length > 100)
    throw new Error('Este balanceador exige a edição nativa.');
  const ports = bindings(launch);
  const used = new Set<Binding>();
  const rows = rules.map((value, key): BalancerRuleDraft => {
    const rule = object(value);
    if (
      !['http', 'tcp'].includes(String(rule.protocol)) ||
      !rule.serviceId ||
      ['selector', 'environment', 'region', 'backendName', 'weight'].some(
        (k) => rule[k] !== undefined && rule[k] !== null && rule[k] !== '',
      )
    )
      throw new Error(
        'Há regras avançadas. Use a edição nativa para preservar todos os protocolos e destinos.',
      );
    if (rule.protocol === 'tcp' && (rule.hostname || rule.path))
      throw new Error('Regra TCP avançada: use a edição nativa.');
    const sourcePort = port(String(rule.sourcePort));
    const found = ports.filter((v) => v.port === sourcePort && v.protocol === 'tcp');
    if (found.length !== 1)
      throw new Error('Listener ambíguo ou sem binding. Use a edição nativa.');
    used.add(found[0]);
    return {
      key,
      protocol: rule.protocol as 'http' | 'tcp',
      sourcePort: String(sourcePort),
      targetPort: String(rule.targetPort ?? sourcePort),
      serviceId: String(rule.serviceId),
      hostname: String(rule.hostname || ''),
      path: String(rule.path || ''),
      access: found[0].access,
      sourceIp: found[0].ip,
    };
  });
  if (ports.some((v) => !used.has(v)))
    throw new Error('Há portas sem regra correspondente. Use a edição nativa.');
  return rows;
}
// Known immutable fields are server metadata. Unknown fields block the edit instead of being discarded.
function nativeObject(
  value: ObjectValue,
  schema: Schema | undefined,
  schemas: Record<string, Schema>,
  depth = 0,
): ObjectValue {
  if (!schema || depth > 12)
    throw new Error('Contrato incompleto. Reabra o painel ou use a edição nativa.');
  const result: ObjectValue = {};
  for (const [name, entry] of Object.entries(value)) {
    if (['type', 'links', 'actions', 'id'].includes(name) || entry === undefined) continue;
    const field = schema.resourceFields[name];
    if (!field)
      throw new Error(
        `Campo não reconhecido: ${name}. Use a edição nativa para preservar a configuração.`,
      );
    if (!field.create) continue;
    const array = /^array\[(.+)\]$/.exec(field.type)?.[1];
    if (entry === null) result[name] = null;
    else if (schemas[field.type])
      result[name] = nativeObject(object(entry), schemas[field.type], schemas, depth + 1);
    else if (array && Array.isArray(entry))
      result[name] = entry.map((v) =>
        v && typeof v === 'object'
          ? nativeObject(object(v), schemas[array], schemas, depth + 1)
          : v,
      );
    else if (
      typeof entry === 'object' &&
      !field.type.startsWith('map[') &&
      !['json', 'object'].includes(field.type)
    )
      throw new Error(`Schema indisponível: ${name}.`);
    else result[name] = structuredClone(entry);
  }
  return result;
}
export function prepareBalancerRules(
  source: Resource,
  rows: BalancerRuleDraft[],
  schemas: Record<string, Schema>,
  services: Resource[],
  stacks: Resource[],
  environment: string,
) {
  if (
    source.accountId !== environment ||
    !canEditBalancer(source, schemas.loadBalancerService, true)
  )
    throw new Error('A alteração do balanceador não está disponível neste contexto.');
  const eligibleStack = (id: unknown) =>
    stacks.some(
      (s) =>
        s.id === id &&
        s.accountId === environment &&
        !s.removed &&
        !s.system &&
        s.state === 'active',
    );
  if (!eligibleStack(source.stackId))
    throw new Error('A stack do balanceador não está disponível.');
  const original = editableBalancerRules(source);
  if (!rows.length || rows.length > 100) throw new Error('Mantenha entre 1 e 100 regras.');
  for (const key of [
    'protocol',
    'sourcePort',
    'targetPort',
    'serviceId',
    'hostname',
    'path',
    'priority',
  ])
    if (!schemas.portRule?.resourceFields[key]?.create)
      throw new Error('O contrato de regras mudou. Reabra o painel.');
  if (
    !schemas.lbConfig?.resourceFields.portRules?.create ||
    !schemas.launchConfig?.resourceFields.ports?.create ||
    !schemas.launchConfig?.resourceFields.expose?.create
  )
    throw new Error('Contrato de portas indisponível.');
  const config = object(source.lbConfig),
    launch = object(source.launchConfig);
  const oldRules = (config.portRules || []) as ObjectValue[];
  const priorities = oldRules.map((v) => Number(v.priority) || 0);
  const nextPriority = Math.max(0, ...priorities) + 1;
  const keys = new Set<number>(),
    routes = new Set<string>();
  const listeners = new Map<number, string>();
  const published = new Set<string>(),
    exposed = new Set<string>();
  const rules = rows.map((row, index) => {
    if (!Number.isSafeInteger(row.key) || row.key < 0 || keys.has(row.key))
      throw new Error('Identificador de regra duplicado ou inválido.');
    keys.add(row.key);
    if (!['http', 'tcp'].includes(row.protocol) || !['public', 'internal'].includes(row.access))
      throw new Error('Protocolo ou acesso inválido.');
    const previous = original.find((v) => v.key === row.key);
    if (row.sourceIp !== (previous?.sourceIp || ''))
      throw new Error('O IP de publicação existente deve ser preservado.');
    const src = port(row.sourcePort),
      target = port(row.targetPort);
    const ruleFields = schemas.portRule.resourceFields;
    if (ruleFields.protocol.options && !ruleFields.protocol.options.includes(row.protocol))
      throw new Error('O protocolo não está mais disponível no contrato atual.');
    for (const [name, value] of [
      ['sourcePort', src],
      ['targetPort', target],
    ] as const) {
      const field = ruleFields[name];
      if (
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      )
        throw new Error('A porta está fora dos limites do contrato atual.');
    }

    const service = services.find((v) => v.id === row.serviceId);
    if (
      !service ||
      service.type !== 'service' ||
      service.accountId !== environment ||
      service.removed ||
      !['active', 'inactive'].includes(service.state || '') ||
      service.id === source.id ||
      !eligibleStack(service.stackId)
    )
      throw new Error('Escolha um serviço de aplicação disponível neste environment.');
    const hostname = row.hostname.trim(),
      path = row.path.trim();
    if (
      (row.protocol === 'tcp' && (hostname || path)) ||
      /[\s\x00-\x1f]/.test(hostname) ||
      /[\x00-\x1f]/.test(path) ||
      hostname.length > 255 ||
      path.length > 2048 ||
      (path && !path.startsWith('/'))
    )
      throw new Error('Revise hostname e caminho HTTP. O caminho deve começar com /.');
    const listener = JSON.stringify([
      row.protocol,
      row.access,
      row.access === 'public' ? row.sourceIp : '',
    ]);
    if (listeners.has(src) && listeners.get(src) !== listener)
      throw new Error('Regras na mesma porta precisam usar o mesmo protocolo, acesso e IP.');
    listeners.set(src, listener);
    const route = JSON.stringify([src, hostname.toLowerCase(), path]);
    if (routes.has(route)) throw new Error('Não repita a mesma rota de entrada.');
    routes.add(route);
    const binding = `${src}:${src}/tcp`;
    if (row.access === 'public') published.add((row.sourceIp ? row.sourceIp + ':' : '') + binding);
    else exposed.add(binding);
    return {
      ...(previous ? oldRules[previous.key] : {}),
      protocol: row.protocol,
      sourcePort: src,
      targetPort: target,
      serviceId: row.serviceId,
      hostname: hostname || null,
      path: path || null,
      priority: previous
        ? (oldRules[previous.key].priority ?? previous.key + 1)
        : nextPriority + index,
    };
  });
  return {
    lbConfig: nativeObject({ ...config, portRules: rules }, schemas.lbConfig, schemas),
    launchConfig: nativeObject(
      { ...launch, ports: [...published], expose: [...exposed] },
      schemas.launchConfig,
      schemas,
    ),
  };
}
