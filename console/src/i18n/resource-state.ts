import { enResourceStates } from './domains/resource-states';
import type { createTranslator } from './messages';

export function resourceStateLabel(t: ReturnType<typeof createTranslator>['t'], state?: string) {
  const key = `resourceState.${state}`;
  return Object.hasOwn(enResourceStates, key)
    ? t(key as keyof typeof enResourceStates)
    : state || '—';
}
