import type { Resource, Schema } from './api';

export const policyScopes = ['linked', 'service', 'stack'] as const;
export type PolicyScope = (typeof policyScopes)[number];
export type PolicyAction = 'allow' | 'deny';
export interface PolicyDraft {
  defaultPolicyAction: PolicyAction;
  within: Record<PolicyScope, PolicyAction>;
}
export const policyLabels: Record<PolicyScope, string> = {
  linked: 'Serviços vinculados',
  service: 'Containers do mesmo serviço',
  stack: 'Serviços da mesma stack',
};
function action(value: unknown): value is PolicyAction {
  return value === 'allow' || value === 'deny';
}
export function supportedPolicyNetwork(value: Resource, environment: string) {
  return (
    value.type === 'network' &&
    value.accountId === environment &&
    !value.removed &&
    ['ipsec', 'vxlan'].includes(value.name || '')
  );
}
export function policyDraft(resource: Resource): PolicyDraft | null {
  const fallback = resource.defaultPolicyAction ?? 'allow';
  if (!action(fallback) || (resource.policy != null && !Array.isArray(resource.policy)))
    return null;
  const within: PolicyDraft['within'] = { linked: fallback, service: fallback, stack: fallback };
  const seen = new Set<string>();
  for (const row of (resource.policy || []) as unknown[]) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const rule = row as Record<string, unknown>;
    if (
      Object.entries(rule).some(
        ([key, value]) => !['type', 'within', 'action'].includes(key) && value != null,
      )
    )
      return null;
    if (
      !policyScopes.includes(rule.within as PolicyScope) ||
      !action(rule.action) ||
      seen.has(String(rule.within))
    )
      return null;
    seen.add(String(rule.within));
    within[rule.within as PolicyScope] = rule.action;
  }
  return { defaultPolicyAction: fallback, within };
}
export function policySnapshot(value: Resource) {
  return JSON.stringify([value.id, value.accountId, value.defaultPolicyAction, value.policy]);
}
export function policyChanges(
  original: Resource,
  draft: PolicyDraft,
  labels = { default: 'Demais comunicações', ...policyLabels },
) {
  const before = policyDraft(original);
  if (!before) return [];
  const rows = [
    {
      label: labels.default,
      before: before.defaultPolicyAction,
      after: draft.defaultPolicyAction,
    },
    ...policyScopes.map((scope) => ({
      label: labels[scope],
      before: before.within[scope],
      after: draft.within[scope],
    })),
  ];
  return rows.filter((row) => row.before !== row.after);
}
export function preparePolicy(
  original: Resource,
  current: Resource,
  schema: Schema,
  environment: string,
  draft: PolicyDraft,
  managers: Resource[],
) {
  if (
    !supportedPolicyNetwork(current, environment) ||
    original.id !== current.id ||
    current.state !== 'active' ||
    !current.links.self
  )
    throw new Error('A rede não está disponível neste environment.');
  if (
    schema.id !== 'network' ||
    !schema.resourceMethods?.includes('PUT') ||
    !schema.resourceFields.policy?.update ||
    !schema.resourceFields.defaultPolicyAction?.update
  )
    throw new Error('Sua permissão de alterar políticas não está mais disponível.');
  if (
    !managers.some(
      (value) =>
        value.accountId === environment &&
        !value.removed &&
        value.name === 'network-policy-manager' &&
        value.state === 'active' &&
        value.healthState === 'healthy',
    )
  )
    throw new Error('O gerenciador de políticas precisa estar ativo e saudável.');
  if (!policyDraft(current))
    throw new Error('Esta rede contém regras avançadas que devem ser preservadas.');
  if (policySnapshot(original) !== policySnapshot(current))
    throw new Error('As políticas mudaram. Reabra o painel antes de salvar.');
  if (
    !action(draft.defaultPolicyAction) ||
    policyScopes.some((scope) => !action(draft.within[scope]))
  )
    throw new Error('Selecione permitir ou bloquear para cada regra.');
  return {
    defaultPolicyAction: draft.defaultPolicyAction,
    policy: policyScopes.map((within) => ({
      type: 'networkPolicyRule',
      within,
      action: draft.within[within],
    })),
  };
}
