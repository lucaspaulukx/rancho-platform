import type { Resource, Schema } from './api';
import { ptNetworkPoliciesPage } from './i18n/domains/network-policies-page';

type PolicyValidationKey = Extract<
  keyof typeof ptNetworkPoliciesPage,
  `networkPoliciesPage.validation.${string}`
>;

export class NetworkPolicyValidationError extends Error {
  constructor(readonly key: PolicyValidationKey) {
    super(ptNetworkPoliciesPage[key]);
  }
}

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
    throw new NetworkPolicyValidationError('networkPoliciesPage.validation.networkUnavailable');
  if (
    schema.id !== 'network' ||
    !schema.resourceMethods?.includes('PUT') ||
    !schema.resourceFields.policy?.update ||
    !schema.resourceFields.defaultPolicyAction?.update
  )
    throw new NetworkPolicyValidationError('networkPoliciesPage.validation.permissionChanged');
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
    throw new NetworkPolicyValidationError('networkPoliciesPage.validation.managerUnavailable');
  if (!policyDraft(current))
    throw new NetworkPolicyValidationError('networkPoliciesPage.validation.advancedRules');
  if (policySnapshot(original) !== policySnapshot(current))
    throw new NetworkPolicyValidationError('networkPoliciesPage.validation.rulesChanged');
  if (
    !action(draft.defaultPolicyAction) ||
    policyScopes.some((scope) => !action(draft.within[scope]))
  )
    throw new NetworkPolicyValidationError('networkPoliciesPage.validation.action');
  return {
    defaultPolicyAction: draft.defaultPolicyAction,
    policy: policyScopes.map((within) => ({
      type: 'networkPolicyRule',
      within,
      action: draft.within[within],
    })),
  };
}
