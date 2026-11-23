import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import { operationCommands } from '../operation-actions';
import {
  canEditBalancer,
  editableBalancerRules,
  prepareBalancerRules,
  assertBalancerUnchanged,
} from '../balancer-rules';
const schema = (id: string, fields: Record<string, string>): Schema => ({
  id,
  pluralName: id + 's',
  links: {},
  resourceMethods: ['GET', 'PUT'],
  resourceFields: Object.fromEntries(
    Object.entries(fields).map(([k, type]) => [k, { type, create: true, update: true }]),
  ),
});
const schemas: Record<string, Schema> = {
  loadBalancerService: schema('loadBalancerService', {
    lbConfig: 'lbConfig',
    launchConfig: 'launchConfig',
  }),
  lbConfig: schema('lbConfig', {
    portRules: 'array[portRule]',
    config: 'string',
    certificateIds: 'array[reference[certificate]]',
    defaultCertificateId: 'reference[certificate]',
    stickinessPolicy: 'stickiness',
  }),
  portRule: schema('portRule', {
    protocol: 'enum',
    sourcePort: 'int',
    targetPort: 'int',
    serviceId: 'reference[service]',
    hostname: 'string',
    path: 'string',
    priority: 'int',
  }),
  launchConfig: schema('launchConfig', {
    imageUuid: 'string',
    ports: 'array[string]',
    expose: 'array[string]',
    environment: 'map[string]',
    labels: 'map[string]',
    privileged: 'boolean',
    memory: 'long',
    version: 'string',
  }),
  stickiness: schema('stickiness', { mode: 'string', indirect: 'boolean' }),
};
schemas.launchConfig.resourceFields.version.create = false;
const source: Resource = {
  id: 'lb',
  type: 'loadBalancerService',
  accountId: 'p1',
  stackId: 'st',
  state: 'inactive',
  links: { self: 'native' },
  lbConfig: {
    type: 'lbConfig',
    config: 'private config',
    certificateIds: ['c1'],
    defaultCertificateId: 'c1',
    stickinessPolicy: { type: 'stickiness', mode: 'insert', indirect: false },
    portRules: [
      {
        type: 'portRule',
        protocol: 'http',
        sourcePort: 8080,
        targetPort: 80,
        serviceId: 'svc',
        priority: 9,
      },
    ],
  },
  launchConfig: {
    type: 'launchConfig',
    imageUuid: 'docker:haproxy',
    ports: ['127.0.0.1:8080:8080/tcp'],
    expose: [],
    environment: { SECRET: 'preserved' },
    labels: { x: 'y' },
    privileged: false,
    memory: 0,
    version: 'server-only',
  },
};
const service: Resource = {
  id: 'svc',
  type: 'service',
  accountId: 'p1',
  stackId: 'st',
  state: 'inactive',
  links: {},
};
const stack: Resource = { id: 'st', type: 'stack', accountId: 'p1', state: 'active', links: {} };
const prepare = (
  rows = editableBalancerRules(source),
  value = source,
  contracts = schemas,
  targets = [service],
  stacks = [stack],
) => prepareBalancerRules(value, rows, contracts, targets, stacks, 'p1');
describe('Regras contextuais de balanceadores', () => {
  it('exige flag, schema correto, PUT, campos graváveis e estado estável', () => {
    expect(canEditBalancer(source, schemas.loadBalancerService, true)).toBe(true);
    expect(canEditBalancer(source, schemas.loadBalancerService, false)).toBe(false);
    expect(
      canEditBalancer({ ...source, state: 'updating-active' }, schemas.loadBalancerService, true),
    ).toBe(false);
    expect(
      canEditBalancer(source, { ...schemas.loadBalancerService, resourceMethods: ['GET'] }, true),
    ).toBe(false);
    expect(canEditBalancer({ ...source, type: 'service' }, schemas.loadBalancerService, true)).toBe(
      false,
    );
  });
  it('preserva IP, prioridade, certificados, configuração, sessão e configuração do container', () => {
    const rows = editableBalancerRules(source);
    rows[0].targetPort = '8081';
    const result = prepare(rows);
    expect(result.lbConfig).toMatchObject({
      config: 'private config',
      certificateIds: ['c1'],
      defaultCertificateId: 'c1',
      stickinessPolicy: { mode: 'insert', indirect: false },
      portRules: [{ priority: 9, targetPort: 8081 }],
    });
    expect(result.launchConfig).toEqual({
      imageUuid: 'docker:haproxy',
      ports: ['127.0.0.1:8080:8080/tcp'],
      expose: [],
      environment: { SECRET: 'preserved' },
      labels: { x: 'y' },
      privileged: false,
      memory: 0,
    });
    expect(source.launchConfig).toHaveProperty('version', 'server-only');
  });
  it('gera bindings internos/publicados e deduplica listener com rotas HTTP diferentes', () => {
    const original = editableBalancerRules(source)[0];
    const result = prepare([
      { ...original, access: 'internal', hostname: 'one.example' },
      { ...original, key: 1000, sourceIp: '', hostname: 'two.example', access: 'internal' },
    ]);
    expect(result.launchConfig).toHaveProperty('ports', []);
    expect(result.launchConfig).toHaveProperty('expose', ['8080:8080/tcp']);
    expect(result.lbConfig.portRules as unknown[]).toHaveLength(2);
  });
  it('bloqueia portas vazias, fracionárias, exponenciais, negativas e fora da faixa', () => {
    for (const sourcePort of ['', '1.5', '1e3', '-1', '65536'])
      expect(() => prepare([{ ...editableBalancerRules(source)[0], sourcePort }])).toThrow(
        'portas inteiras',
      );
  });
  it('recusa destinos removidos, fora do environment, tipo incorreto e stack de sistema', () => {
    for (const target of [
      { ...service, accountId: 'p2' },
      { ...service, removed: 'now' },
      { ...service, type: 'loadBalancerService' },
      { ...service, state: 'removing' },
    ])
      expect(() => prepare(undefined, source, schemas, [target])).toThrow('serviço de aplicação');
    expect(() =>
      prepare(undefined, source, schemas, [service], [{ ...stack, system: true }]),
    ).toThrow('stack');
  });
  it('impede rota duplicada, mistura de listener e IP alterado', () => {
    const row = editableBalancerRules(source)[0];
    expect(() => prepare([row, { ...row, key: 1000, sourceIp: '' }])).toThrow('mesmo protocolo');
    expect(() =>
      prepare([
        row,
        { ...row, key: 1000, sourceIp: '', sourcePort: '8081' },
        { ...row, key: 1001, sourceIp: '', sourcePort: '8081' },
      ]),
    ).toThrow('mesma rota');
    expect(() => prepare([{ ...row, sourceIp: '0.0.0.0' }])).toThrow('IP de publicação');
    expect(() => prepare([row, { ...row }])).toThrow('duplicado');
  });
  it('valida hostname/caminho e não aceita HTTP em regra TCP', () => {
    const row = editableBalancerRules(source)[0];
    for (const patch of [
      { hostname: 'bad host' },
      { path: 'missing-slash' },
      { protocol: 'tcp' as const, path: '/' },
    ])
      expect(() => prepare([{ ...row, ...patch }])).toThrow('hostname');
  });
  it('protege regras avançadas e bindings não suportados sem converter configuração', () => {
    for (const patch of [{ protocol: 'https' }, { selector: 'app=x' }, { weight: 10 }]) {
      const value = structuredClone(source);
      (value.lbConfig as { portRules: object[] }).portRules = [
        { protocol: 'http', sourcePort: 8080, targetPort: 80, serviceId: 'svc', ...patch },
      ];
      expect(() => editableBalancerRules(value)).toThrow('avançadas');
    }
    for (const binding of ['8080:80/tcp', '8080/tcp', '8080:8080/udp']) {
      const value = structuredClone(source);
      (value.launchConfig as { ports: string[] }).ports = [binding];
      expect(() => editableBalancerRules(value)).toThrow();
    }
  });
  it('preserva IPv6 e recusa bindings extras/ambíguos', () => {
    const value = structuredClone(source);
    (value.launchConfig as { ports: string[] }).ports = ['[::1]:8080:8080/tcp'];
    expect(prepare(editableBalancerRules(value), value).launchConfig.ports).toEqual([
      '[::1]:8080:8080/tcp',
    ]);
    (value.launchConfig as { ports: string[] }).ports.push('8080:8080/tcp');
    expect(() => editableBalancerRules(value)).toThrow('ambíguo');
  });
  it('detecta concorrência sem depender da ordem de chaves; preserva campos frescos independentes', () => {
    const current = structuredClone(source);
    current.launchConfig = { ...(source.launchConfig as object), environment: { NEW: 'fresh' } };
    expect(() => assertBalancerUnchanged(source, current)).not.toThrow();
    expect(prepare(undefined, current).launchConfig.environment).toEqual({ NEW: 'fresh' });
    (current.lbConfig as { config: string }).config = 'external';
    expect(() => assertBalancerUnchanged(source, current)).toThrow('outro cliente');
  });
  it('recusa perda de contrato e campo desconhecido em vez de apagar silenciosamente', () => {
    const missing = { ...schemas, portRule: undefined } as unknown as Record<string, Schema>;
    expect(() => prepare(undefined, source, missing)).toThrow('contrato');
    const value = structuredClone(source);
    (value.lbConfig as Record<string, unknown>).futureSetting = 'preserve';
    expect(() => prepare(undefined, value)).toThrow('não reconhecido');
    expect(() =>
      prepare(undefined, source, { ...schemas, stickiness: undefined } as unknown as Record<
        string,
        Schema
      >),
    ).toThrow('Schema');
  });
  it('exige uma regra e isola a origem no environment', () => {
    expect(() => prepare([])).toThrow('1 e 100');
    expect(() => prepare(undefined, { ...source, accountId: 'p2' })).toThrow('contexto');
  });
  it('oferece o comando no menu somente com a flag e capacidade nativa', () => {
    const options = {
      environment: 'p1',
      observability: false,
      metrics: false,
      containers: [],
      containerWritable: false,
      createService: false,
      restartServices: 0,
      balancerRules: true,
    };
    expect(operationCommands(source, schemas.loadBalancerService, options)).toContainEqual({
      id: 'balancer',
      label: 'Configurar balanceador',
      kind: 'balancer',
    });
    expect(
      operationCommands(source, schemas.loadBalancerService, {
        ...options,
        balancerRules: false,
      }).some((v) => v.id === 'balancer'),
    ).toBe(false);
    expect(
      operationCommands(
        source,
        { ...schemas.loadBalancerService, resourceMethods: ['GET'] },
        options,
      ).some((v) => v.id === 'balancer'),
    ).toBe(false);
  });
  it('respeita mudanças nas opções de protocolo e limites do schema fresco', () => {
    const contracts = structuredClone(schemas);
    contracts.portRule.resourceFields.protocol.options = ['tcp'];
    expect(() => prepare(undefined, source, contracts)).toThrow(
      'protocolo não está mais disponível',
    );
    contracts.portRule.resourceFields.protocol.options = ['http', 'tcp'];
    contracts.portRule.resourceFields.sourcePort.max = 8000;
    expect(() => prepare(undefined, source, contracts)).toThrow('limites do contrato');
  });
});
