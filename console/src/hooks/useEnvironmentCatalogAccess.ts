import { useQuery } from '@tanstack/react-query';
import { api, ApiError, type Collection, type Token } from '../api';
import { useApp, useDataKey } from '../state';
import { sessionAccountId } from '../local-accounts';
import { environmentCatalogWriter } from '../environment-access';
import { ptEnvironmentCatalogs } from '../i18n/domains/environment-catalogs';

type EnvironmentCatalogAccessFailure =
  | {
      key:
        | 'environmentCatalogs.access.disabled'
        | 'environmentCatalogs.access.identityChanged'
        | 'environmentCatalogs.access.denied';
    }
  | { key: 'environmentCatalogs.access.http'; status: number };

export class EnvironmentCatalogAccessError extends Error {
  constructor(readonly failure: EnvironmentCatalogAccessFailure) {
    const message = ptEnvironmentCatalogs[failure.key];
    super(
      failure.key === 'environmentCatalogs.access.http'
        ? message.replace('{status}', String(failure.status))
        : message,
    );
  }
}

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
      if (!enabled)
        throw new EnvironmentCatalogAccessError({ key: 'environmentCatalogs.access.disabled' });
      const token = (await api<Collection<Token>>('token', undefined, undefined, signal)).data?.[0];
      if (!token || !own || sessionAccountId(token) !== own)
        throw new EnvironmentCatalogAccessError({
          key: 'environmentCatalogs.access.identityChanged',
        });
      if (token.userType === 'admin') return;
      if (!delegated || !environmentCatalogWriter(await report(signal), project!, own))
        throw new EnvironmentCatalogAccessError({ key: 'environmentCatalogs.access.denied' });
    } catch (error) {
      if (error instanceof ApiError)
        throw new EnvironmentCatalogAccessError({
          key: 'environmentCatalogs.access.http',
          status: error.status,
        });
      throw error;
    }
  }
  return { allowed, check };
}
