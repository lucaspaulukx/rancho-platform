import { rawId } from './api';
export function environmentCatalogWriter(report: unknown, project: string, account?: string) {
  if (
    !account ||
    !/^1a[1-9]\d*$/.test(account) ||
    !/^1a[1-9]\d*$/.test(project) ||
    !report ||
    typeof report !== 'object'
  )
    return false;
  const r = report as Record<string, unknown>;
  return (
    r.complete === true &&
    r.accountId === rawId(account) &&
    r.projectId === rawId(project) &&
    ['owner', 'member'].includes(String(r.effectiveRole))
  );
}
