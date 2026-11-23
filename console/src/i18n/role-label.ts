import type { Role } from '../api';
import type { createTranslator, MessageKey } from './messages';

const roleMessages = {
  readonly: 'groups.role.readonly',
  restricted: 'groups.role.restricted',
  member: 'groups.role.member',
  owner: 'groups.role.owner',
} as const satisfies Record<Role, MessageKey>;

export function roleLabel(t: ReturnType<typeof createTranslator>['t'], role: string) {
  return Object.hasOwn(roleMessages, role) ? t(roleMessages[role as Role]) : role;
}
