import { describe, expect, it } from 'vitest';
import type { Resource, Schema } from '../api';
import {
  policyChanges,
  policyDraft,
  preparePolicy,
  supportedPolicyNetwork,
} from '../network-policy';

const network: Resource = {
  id: '1n18',
  type: 'network',
  name: 'ipsec',
  accountId: '1a12',
  state: 'active',
  defaultPolicyAction: 'allow',
  policy: null,
  links: { self: '/v2-beta/projects/1a12/networks/1n18' },
};
const schema: Schema = {
  id: 'network',
  pluralName: 'networks',
  links: {},
  resourceMethods: ['GET', 'PUT'],
  resourceFields: {
    policy: { type: 'array[networkPolicyRule]', update: true },
    defaultPolicyAction: { type: 'enum', update: true },
  },
};
const manager: Resource = {
  id: '1st99',
  type: 'stack',
  name: 'network-policy-manager',
  accountId: '1a12',
  state: 'active',
  healthState: 'healthy',
  links: {},
};

describe('Políticas nativas de rede', () => {
  it('resume somente alterações reais com valor anterior e posterior', () => {
    const draft = policyDraft(network)!;
    expect(policyChanges(network, draft)).toEqual([]);
    draft.defaultPolicyAction = 'deny';
    expect(policyChanges(network, draft)).toEqual([
      { label: 'Demais comunicações', before: 'allow', after: 'deny' },
    ]);
    expect(
      policyChanges(
        { ...network, policy: [{ from: { selector: 'role=db' }, action: 'deny' }] },
        draft,
      ),
    ).toEqual([]);
  });
  it('restringe redes ao environment, tipo e drivers reconhecidos', () => {
    expect(supportedPolicyNetwork(network, '1a12')).toBe(true);
    for (const patch of [
      { accountId: '1a8' },
      { type: 'stack' },
      { name: 'Docker Host Network Mode' },
      { removed: 'now' },
    ])
      expect(supportedPolicyNetwork({ ...network, ...patch }, '1a12')).toBe(false);
  });
  it('usa o default nativo nas regras ausentes, incluindo deny', () => {
    expect(policyDraft({ ...network, defaultPolicyAction: 'deny' })).toEqual({
      defaultPolicyAction: 'deny',
      within: { linked: 'deny', service: 'deny', stack: 'deny' },
    });
  });
  it('preserva ações individuais e não altera o recurso recebido', () => {
    const resource = { ...network, policy: [{ within: 'service', action: 'deny' }] };
    const draft = policyDraft(resource)!;
    draft.within.stack = 'deny';
    expect(resource.policy).toEqual([{ within: 'service', action: 'deny' }]);
    expect(draft.within.service).toBe('deny');
  });
  it.each(
    (
      [
        [{ from: { selector: 'role=web' }, to: { selector: 'role=db' }, action: 'allow' }],
        [{ within: 'stack', action: 'allow', ports: ['tcp:80'] }],
        [
          { within: 'stack', action: 'allow' },
          { within: 'stack', action: 'deny' },
        ],
        [{ within: 'unknown', action: 'allow' }],
        [{ within: 'stack', action: 'invalid' }],
        [null],
        'invalid',
      ] as unknown[]
    ).map((policy) => [policy]),
  )('recusa substituir regras avançadas ou malformadas: %j', (policy) => {
    expect(policyDraft({ ...network, policy })).toBeNull();
  });
  it('prepara somente campos nativos, com payload independente e default explícito', () => {
    const draft = policyDraft(network)!;
    draft.within.stack = 'deny';
    const payload = preparePolicy(network, network, schema, '1a12', draft, [manager]);
    expect(payload).toEqual({
      defaultPolicyAction: 'allow',
      policy: [
        { type: 'networkPolicyRule', within: 'linked', action: 'allow' },
        { type: 'networkPolicyRule', within: 'service', action: 'allow' },
        { type: 'networkPolicyRule', within: 'stack', action: 'deny' },
      ],
    });
    expect(network.policy).toBeNull();
  });
  it('recusa revogação de PUT ou de permissão de campo', () => {
    for (const patch of [{ resourceMethods: ['GET'] }, { resourceFields: {} }])
      expect(() =>
        preparePolicy(network, network, { ...schema, ...patch }, '1a12', policyDraft(network)!, [
          manager,
        ]),
      ).toThrow('permissão');
  });
  it('rejeita manager ausente, removido, de outro environment ou sem saúde', () => {
    for (const managers of [
      [],
      [{ ...manager, accountId: '1a8' }],
      [{ ...manager, removed: 'now' }],
      [{ ...manager, healthState: 'unhealthy' }],
    ])
      expect(() =>
        preparePolicy(network, network, schema, '1a12', policyDraft(network)!, managers),
      ).toThrow('gerenciador');
  });
  it('recusa conflito e mudança de estado ou escopo antes de qualquer envio', () => {
    expect(() =>
      preparePolicy(
        network,
        { ...network, defaultPolicyAction: 'deny' },
        schema,
        '1a12',
        policyDraft(network)!,
        [manager],
      ),
    ).toThrow('mudaram');
    for (const patch of [{ id: '1n99' }, { accountId: '1a8' }, { state: 'updating-active' }])
      expect(() =>
        preparePolicy(network, { ...network, ...patch }, schema, '1a12', policyDraft(network)!, [
          manager,
        ]),
      ).toThrow('disponível');
  });
});
