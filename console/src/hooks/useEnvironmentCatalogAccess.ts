import { useQuery } from '@tanstack/react-query';
import { api, ApiError, type Collection, type Token } from '../api';
import { useApp, useDataKey } from '../state';
import { sessionAccountId } from '../local-accounts';
import { environmentCatalogWriter } from '../environment-access';
export function useEnvironmentCatalogAccess() {
  const app = useApp(),
    project = app.project?.id,
    own = sessionAccountId(app.token);
  const delegated = app.config.modules.environmentCatalogDelegation;
  const enabled = app.config.modules.environmentCatalogs && !!project;
  async function report(signal?: AbortSignal) {
    return (
      await api<Collection<Record<string, unknown>>>(
        'localAccessReports?targetAccount=self&targetEnvironment=' + project,
        undefined,
        undefined,
        signal,
      )
    ).data?.[0];
  }
  const authorization = useQuery({
    queryKey: useDataKey('environment-catalog-access'),
    enabled: enabled && delegated && !app.admin,
    queryFn: ({ signal }) => report(signal),
    refetchInterval: 10000,
    retry: false,
  });
  const allowed =
    enabled &&
    (app.admin ||
      (delegated &&
        authorization.isSuccess &&
        environmentCatalogWriter(authorization.data, project!, own)));
  async function check(signal: AbortSignal) {
    try {
      if (!enabled) throw new Error('A administração de fontes está desativada.');
      const token = (await api<Collection<Token>>('token', undefined, undefined, signal)).data?.[0];
      if (!token || !own || sessionAccountId(token) !== own)
        throw new Error('A identidade da sessão mudou.');
      if (token.userType === 'admin') return;
      if (!delegated || !environmentCatalogWriter(await report(signal), project!, own))
        throw new Error('Seu acesso não permite gerenciar fontes neste environment.');
    } catch (error) {
      if (error instanceof ApiError)
        throw new Error(`Não foi possível validar seu acesso às fontes (HTTP ${error.status}).`);
      throw error;
    }
  }
  return { allowed, check };
}
