import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import contract from '../../webhook-schema-contract.json';
import {
  newWebhookDraft,
  receiverMetadata,
  receiverSecret,
  webhookPath,
  webhookNext,
  webhookWriter,
  webhookSelectors,
  prepareWebhook,
  cloneReceiver,
} from '../webhooks';
const schemas = contract as unknown as Record<string, Schema>;
const service = {
  id: '1s1',
  type: 'service',
  name: 'test',
  accountId: '1a12',
  state: 'active',
  links: {},
} as Resource;
const draft = { ...newWebhookDraft(), name: 'fixture', serviceId: '1s1' };
const receiver = {
  id: '1wh1',
  type: 'receiver',
  name: 'fixture',
  driver: 'scaleService',
  state: 'active',
  links: { self: '/v1-webhooks/receivers/1wh1' },
  url: 'http://localhost:18090/v1-webhooks/endpoint?key=synthetic-private&projectId=1a12',
  scaleServiceConfig: {
    type: 'scaleService',
    serviceId: '1s1',
    action: 'up',
    amount: 1,
    min: 1,
    max: 100,
  },
} as Resource;
describe('Webhooks nativos', () => {
  it('metadata remove URL e configurações opacas antes do cache', () => {
    const metadata = receiverMetadata({
      ...receiver,
      forwardPostConfig: { url: 'synthetic-private' },
      unexpected: 'synthetic-private',
    });
    expect(metadata).toEqual({
      id: '1wh1',
      name: 'fixture',
      driver: 'scaleService',
      state: 'active',
      target: '1s1',
    });
    expect(JSON.stringify(metadata)).not.toContain('synthetic-private');
    expect(metadata).not.toHaveProperty('links');
  });
  it('valida API/projectId e impede cursor de outro environment ou origem', () => {
    expect(webhookPath('1a12', '1wh1')).toBe('/v1-webhooks/receivers/1wh1?projectId=1a12');
    expect(() => webhookPath('bad')).toThrow();
    expect(() => webhookPath('1a12', '../endpoint')).toThrow();
    expect(webhookNext('/v1-webhooks/receivers?projectId=1a12&marker=1', '1a12')).toContain(
      'marker=1',
    );
    for (const next of [
      '/v1-webhooks/receivers?projectId=1a8',
      '/v2-beta/apikeys?projectId=1a12',
      'https://untrusted.example/v1-webhooks/receivers?projectId=1a12',
    ])
      expect(() => webhookNext(next, '1a12')).toThrow();
  });
  it('schemas estáticos não concedem escrita sem relatório de acesso efetivo completo', () => {
    expect(
      webhookWriter(
        { complete: true, accountId: '10', projectId: '12', effectiveRole: 'owner' },
        '1a12',
      ),
    ).toBe(true);
    expect(
      webhookWriter(
        { complete: true, accountId: '10', projectId: '12', effectiveRole: 'member' },
        '1a12',
      ),
    ).toBe(true);
    for (const change of [
      { complete: false },
      { effectiveRole: 'readonly' },
      { effectiveRole: 'restricted' },
      { projectId: '8' },
      { accountId: 'self' },
    ])
      expect(
        webhookWriter(
          { complete: true, accountId: '10', projectId: '12', effectiveRole: 'member', ...change },
          '1a12',
        ),
      ).toBe(false);
  });
  it('escala apenas serviço disponível no environment com campos explícitos do driver', () => {
    expect(prepareWebhook(draft, schemas, '1a12', [service])).toEqual({
      name: 'fixture',
      driver: 'scaleService',
      scaleServiceConfig: {
        type: 'scaleService',
        action: 'up',
        amount: 1,
        min: 1,
        max: 100,
        serviceId: '1s1',
      },
    });
    for (const change of [
      { accountId: '1a8' },
      { removed: 'now' },
      { type: 'loadBalancerService' },
      { state: 'removed' },
    ])
      expect(() => prepareWebhook(draft, schemas, '1a12', [{ ...service, ...change }])).toThrow(
        'disponível',
      );
  });
  it.each([
    { min: '1', max: '1' },
    { min: '2', max: '1' },
    { amount: '1.5' },
    { amount: '0' },
    { min: '' },
    { max: 'Infinity' },
  ])('recusa limites que o contrato nativo não aceita %j', (change) => {
    expect(() => prepareWebhook({ ...draft, ...change }, schemas, '1a12', [service])).toThrow();
  });
  it('seletores exigem chaves únicas sem campos vazios ou controle e preservam valor vazio nativo', () => {
    expect(webhookSelectors([{ id: 'a', key: ' app/name ', value: '' }])).toEqual({
      'app/name': '',
    });
    for (const rows of [
      [],
      [{ id: 'a', key: '', value: 'x' }],
      [
        { id: 'a', key: 'app', value: 'x' },
        { id: 'b', key: 'app', value: 'y' },
      ],
      [{ id: 'a', key: '__proto__', value: 'x' }],
      [{ id: 'a', key: 'app', value: 'x\ny' }],
    ])
      expect(() => webhookSelectors(rows)).toThrow();
  });
  it('host scale down envia seletor e ordem de remoção, sem configuração de outro driver', () => {
    expect(
      prepareWebhook(
        {
          ...draft,
          driver: 'scaleHost',
          action: 'down',
          selectors: [{ id: 'a', key: 'fixture', value: 'yes' }],
        },
        schemas,
        '1a12',
        [service],
      ),
    ).toEqual({
      name: 'fixture',
      driver: 'scaleHost',
      scaleHostConfig: {
        type: 'scaleHost',
        action: 'down',
        amount: 1,
        min: 1,
        max: 100,
        hostSelector: { fixture: 'yes' },
        deleteOption: 'leastRecent',
      },
    });
  });
  it('upgrade usa intervalo em segundos conforme contrato específico dos webhooks', () => {
    const value = prepareWebhook(
      {
        ...draft,
        driver: 'serviceUpgrade',
        tag: 'release',
        selectors: [{ id: 'a', key: 'fixture', value: 'yes' }],
        intervalSeconds: '2',
      },
      schemas,
      '1a12',
      [service],
    );
    expect(value).toEqual({
      name: 'fixture',
      driver: 'serviceUpgrade',
      serviceUpgradeConfig: {
        type: 'serviceUpgrade',
        tag: 'release',
        serviceSelector: { fixture: 'yes' },
        batchSize: 1,
        intervalMillis: 2,
        payloadFormat: 'dockerhub',
        addressType: 'registry',
        startFirst: false,
      },
    });
  });
  it('revalida campos/options no contrato e não habilita forwardPost', () => {
    expect(() =>
      prepareWebhook(
        draft,
        { ...schemas, receiver: { ...schemas.receiver, collectionMethods: ['GET'] } },
        '1a12',
        [service],
      ),
    ).toThrow();
    expect(() =>
      prepareWebhook({ ...draft, driver: 'forwardPost' as never }, schemas, '1a12', [service]),
    ).toThrow();
    expect(() =>
      prepareWebhook(
        draft,
        {
          ...schemas,
          scaleService: {
            ...schemas.scaleService,
            resourceFields: {
              ...schemas.scaleService.resourceFields,
              serviceId: { type: 'string', create: false },
            },
          },
        },
        '1a12',
        [service],
      ),
    ).toThrow('contrato');
  });
  it('URL privada só é extraída em acesso explícito e exige endpoint/projectId, sem invocação', () => {
    expect(receiverSecret(receiver, '1a12')).toEqual({ id: '1wh1', url: receiver.url });
    for (const url of [
      'javascript:alert(1)',
      'http://localhost:18090/v1-webhooks/endpoint?key=private&projectId=1a8',
      'http://localhost:18090/v1-webhooks/receivers?key=private&projectId=1a12',
      'http://user:password@localhost/v1-webhooks/endpoint?key=private&projectId=1a12',
      'http://localhost/v1-webhooks/endpoint?key=private&projectId=1a12#private',
    ])
      expect(() => receiverSecret({ ...receiver, url }, '1a12')).toThrow();
  });
  it('clone copia somente opções e cria rascunho sem URL/token/id', () => {
    const cloned = cloneReceiver(receiver);
    expect(cloned.name).toBe('fixture - cópia');
    expect(cloned.serviceId).toBe('1s1');
    expect(JSON.stringify(cloned)).not.toContain('synthetic-private');
    expect(cloned).not.toHaveProperty('id');
    expect(cloned).not.toHaveProperty('url');
    expect(() => cloneReceiver({ ...receiver, driver: 'forwardPost' })).toThrow();
  });
});
