import type { Resource } from './api';
import { repositoryNameValid, validateRepositoryLocation } from './catalog-repositories';
import { ptEnvironmentCatalogs } from './i18n/domains/environment-catalogs';

type EnvironmentRepositoryValidationKey = Extract<
  keyof typeof ptEnvironmentCatalogs,
  `environmentCatalogs.validation.${string}`
>;

export class EnvironmentRepositoryValidationError extends Error {
  constructor(readonly key: EnvironmentRepositoryValidationKey) {
    super(ptEnvironmentCatalogs[key]);
  }
}

export interface EnvironmentRepository {
  id: string;
  name: string;
  branch: string;
  kind: string;
  environmentId: string;
}
export interface EnvironmentRepositoryDraft {
  name: string;
  url: string;
  branch: string;
  kind: string;
}
export function environmentRepositoryMetadata(value: Resource): EnvironmentRepository {
  return {
    id: value.id,
    name: String(value.name || value.id),
    branch: typeof value.branch === 'string' ? value.branch : '',
    kind: typeof value.kind === 'string' ? value.kind : '',
    environmentId: typeof value.environmentId === 'string' ? value.environmentId : '',
  };
}
export function repositoryDraft(value: Resource): EnvironmentRepositoryDraft {
  if (typeof value.url !== 'string')
    throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.configuration');
  return { ...environmentRepositoryMetadata(value), url: value.url };
}
export function environmentRepositorySnapshot(value: Resource) {
  return JSON.stringify([
    value.id,
    value.environmentId,
    value.name,
    value.url,
    value.branch,
    value.kind,
  ]);
}
export function environmentRepositoryPath(name: string) {
  if (!repositoryNameValid(name))
    throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.name');
  return '/v1-catalog/catalogs/' + encodeURIComponent(name);
}
export function prepareEnvironmentRepository(
  environment: string,
  draft: EnvironmentRepositoryDraft,
  rows: Resource[],
  before?: Resource,
  removing = false,
) {
  if (!/^1a\d+$/.test(environment))
    throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.environment');
  environmentRepositoryPath(draft.name);
  const own = rows.find((v) => v.name === draft.name && v.environmentId === environment);
  if (before) {
    if (
      before.environmentId !== environment ||
      before.name !== draft.name ||
      !own ||
      environmentRepositorySnapshot(before) !== environmentRepositorySnapshot(own)
    )
      throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.changed');
    if (before.kind !== 'native')
      throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.readOnly');
  } else if (rows.some((v) => v.name === draft.name)) {
    throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.duplicate');
  }
  if (!removing) {
    validateRepositoryLocation(draft.url, draft.branch, before?.url as string | undefined);
    if (draft.kind !== 'native')
      throw new EnvironmentRepositoryValidationError('environmentCatalogs.validation.native');
  }
  return { name: draft.name, url: draft.url, branch: draft.branch, kind: draft.kind };
}
