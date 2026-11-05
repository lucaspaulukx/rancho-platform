import { safeApiUrl, type Resource, type Schema } from './api';
export const keyActions = ['activate', 'deactivate', 'remove', 'purge'] as const;
export type KeyAction = (typeof keyActions)[number];
export function keyMetadata(value: Resource): Resource {
  return {
    id: value.id,
    type: value.type,
    ...Object.fromEntries(
      [
        'id',
        'type',
        'name',
        'description',
        'accountId',
        'state',
        'created',
        'removed',
        'publicValue',
      ].map((k) => [k, value[k]]),
    ),
    links: { self: value.links?.self },
    actions: Object.fromEntries(
      keyActions.flatMap((k) => (value.actions?.[k] ? [[k, value.actions[k]]] : [])),
    ),
  } as Resource;
}
export function canCreateKey(schema?: Schema, project?: string) {
  let serverBound = false;
  if (project && schema?.links.collection) {
    try {
      serverBound =
        safeApiUrl(schema.links.collection).split('?')[0] ===
        `/v2-beta/projects/${project}/apikeys`;
    } catch {
      return false;
    }
  }
  return (
    schema?.id === 'apiKey' &&
    !!schema.collectionMethods?.includes('POST') &&
    schema.resourceFields.name?.create === true &&
    schema.resourceFields.secretValue?.type === 'password' &&
    (!project || schema.resourceFields.accountId?.create === true || serverBound)
  );
}
function fields(schema: Schema, name: string, description: string) {
  const title = name.trim();
  if (
    !title ||
    title.length > (schema.resourceFields.name?.maxLength ?? 255) ||
    /[\x00-\x1f\x7f]/.test(title)
  )
    throw new Error('Informe um nome válido para identificar a chave.');
  if (
    description.length > (schema.resourceFields.description?.maxLength ?? 1024) ||
    description.includes('\0')
  )
    throw new Error('A descrição excede os limites do servidor.');
  return { name: title, description };
}
export function prepareKeyCreate(
  schema: Schema,
  name: string,
  description: string,
  project?: string,
) {
  if (!canCreateKey(schema, project) || !schema.resourceFields.description?.create)
    throw new Error('A criação de chaves não está disponível neste escopo.');
  if (project && !/^1a[1-9]\d*$/.test(project)) throw new Error('Selecione um environment válido.');
  return {
    ...fields(schema, name, description),
    ...(project && schema.resourceFields.accountId?.create ? { accountId: project } : {}),
  };
}
export function assertKeyScope(value: Resource, project?: string, expected?: Resource) {
  if (
    value.type !== 'apiKey' ||
    !value.id ||
    value.removed ||
    (project && value.accountId !== project) ||
    (expected && (value.id !== expected.id || value.accountId !== expected.accountId))
  )
    throw new Error('A chave não está disponível neste escopo.');
}
export function prepareKeyEdit(
  schema: Schema,
  before: Resource,
  fresh: Resource,
  name: string,
  description: string,
  project?: string,
) {
  assertKeyScope(fresh, project, before);
  if (
    schema.id !== 'apiKey' ||
    !schema.resourceMethods?.includes('PUT') ||
    !schema.resourceFields.name?.update ||
    !schema.resourceFields.description?.update
  )
    throw new Error('A edição de chaves não está mais disponível.');
  if (['name', 'description', 'state'].some((k) => (before[k] ?? '') !== (fresh[k] ?? '')))
    throw new Error('A chave foi alterada por outro cliente. Reabra o editor.');
  return fields(schema, name, description);
}
export function keyActionTarget(
  schema: Schema | undefined,
  value: Resource,
  action: KeyAction,
): { url: string; method: 'POST' | 'DELETE' } | undefined {
  if (schema?.id !== 'apiKey') return;
  if (
    action === 'remove' &&
    value.state === 'inactive' &&
    !value.removed &&
    schema.resourceMethods?.includes('DELETE') &&
    value.links.self &&
    !value.actions?.remove
  )
    return { url: value.links.self, method: 'DELETE' };
  if (
    schema.resourceMethods?.some((v) => ['PUT', 'POST', 'DELETE'].includes(v)) &&
    schema.resourceActions?.[action] &&
    !schema.resourceActions[action].input &&
    value.actions?.[action]
  )
    return { url: value.actions[action], method: 'POST' };
}
export function keyActionAllowed(schema: Schema | undefined, value: Resource, action: KeyAction) {
  return !!keyActionTarget(schema, value, action);
}
export function keySecret(value: Resource) {
  if (
    typeof value.publicValue !== 'string' ||
    !value.publicValue ||
    typeof value.secretValue !== 'string' ||
    !value.secretValue
  )
    throw new Error('O Rancher não retornou a credencial completa. Revogue a chave e crie outra.');
  return { publicValue: value.publicValue, secretValue: value.secretValue };
}
