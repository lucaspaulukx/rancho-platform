import type { Resource } from './api';

/** Native serviceRestart requires this object, unlike container restart. */
export function lifecyclePayload(
  resource: Resource,
  action: string,
  payload: Record<string, unknown> = {},
) {
  if (
    action === 'restart' &&
    ['service', 'loadBalancerService'].includes(resource.type) &&
    payload.rollingRestartStrategy === undefined
  ) {
    return { ...payload, rollingRestartStrategy: { batchSize: 1, intervalMillis: 2000 } };
  }
  return payload;
}
