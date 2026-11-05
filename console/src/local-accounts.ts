import type { Resource, Schema, Token } from './api';
import { preparePayload } from './components/SchemaForm';
export type AccountOperation =
  'create' | 'profile' | 'password' | 'activate' | 'deactivate' | 'remove';
export interface LocalAccount extends Resource {
  kind: string;
}
export function sessionAccountId(token: Token): string | undefined {
  if (token.accountId && /^1a[1-9]\d*$/.test(token.accountId)) return token.accountId;
  const identity = token.userIdentity;
  if (identity?.externalIdType === 'rancher_id' && /^[1-9]\d*$/.test(identity.externalId))
    return '1a' + identity.externalId;
  return undefined;
}
export function localAccountMetadata(row: Resource): LocalAccount {
  if (!['user', 'admin'].includes(String(row.kind)))
    throw new Error('Conta indisponível para administração de usuários.');
  return {
    id: row.id,
    type: 'account',
    name: row.name,
    description: row.description,
    kind: String(row.kind),
    state: row.state,
    removed: row.removed,
    links: { self: `/v2-beta/accounts/${row.id}` },
    actions: Object.fromEntries(
      ['activate', 'deactivate', 'remove'].flatMap((k) =>
        row.actions?.[k] ? [[k, row.actions[k]]] : [],
      ),
    ),
  };
}
export function accountPath(id: string) {
  if (!/^1a[1-9]\d*$/.test(id)) throw new Error('Conta inválida.');
  return 'accounts/' + id;
}
export function accountSnapshot(row: Resource) {
  return JSON.stringify([
    row.id,
    row.name,
    row.description ?? null,
    row.kind,
    row.state,
    row.removed ?? null,
  ]);
}
export function validateAccountChange(
  before: Resource,
  fresh: Resource,
  own: string,
  mode: AccountOperation,
  kind: string,
  rows: Resource[],
) {
  accountPath(before.id);
  if (
    !['user', 'admin'].includes(String(fresh.kind)) ||
    fresh.removed ||
    accountSnapshot(before) !== accountSnapshot(fresh)
  )
    throw new Error('A conta mudou. Reabra o painel.');
  const loss =
    (mode === 'profile' && kind !== 'admin') || mode === 'deactivate' || mode === 'remove';
  if (loss && fresh.id === own && fresh.kind === 'admin')
    throw new Error(
      'Use outro administrador para alterar os privilégios ou desativar sua própria conta.',
    );
  if (
    loss &&
    fresh.kind === 'admin' &&
    fresh.state === 'active' &&
    !rows.some((v) => v.id !== fresh.id && v.kind === 'admin' && v.state === 'active' && !v.removed)
  )
    throw new Error('Mantenha pelo menos um administrador ativo.');
  if (mode === 'remove' && fresh.state !== 'inactive')
    throw new Error('Desative a conta antes de excluí-la.');
  if (['activate', 'deactivate', 'remove'].includes(mode) && !fresh.actions?.[mode])
    throw new Error('Esta operação não está disponível no estado atual.');
}
export function accountProfile(
  schema: Schema,
  name: string,
  description: string,
  kind: string,
  creating = false,
) {
  if (
    schema.id !== 'account' ||
    !(creating
      ? schema.collectionMethods?.includes('POST')
      : schema.resourceMethods?.includes('PUT'))
  )
    throw new Error('Contrato de conta indisponível.');
  if (!name.trim() || /[\x00-\x1f\x7f]/.test(name) || !['user', 'admin'].includes(kind))
    throw new Error('Informe nome e perfil válidos.');
  for (const field of ['name', 'description', 'kind'])
    if (!(creating ? schema.resourceFields[field]?.create : schema.resourceFields[field]?.update))
      throw new Error('Os campos da conta mudaram. Reabra o painel.');
  const values = { name: name.trim(), description, kind };
  // The same value shape is writable; using the native create validators applies lengths/types.
  const prepared = preparePayload(
    {
      ...schema,
      resourceFields: Object.fromEntries(
        Object.entries(schema.resourceFields).map(([k, v]) => [
          k,
          { ...v, create: creating ? v.create : v.update },
        ]),
      ),
    },
    values,
  );
  // Empty is intentional here: omission on PUT would preserve an old description.
  if (!creating && description === '') prepared.description = '';
  return prepared;
}
export function credentialMetadata(row: Resource) {
  return {
    id: row.id,
    accountId: String(row.accountId),
    login: typeof row.publicValue === 'string' ? row.publicValue : '',
    state: String(row.state),
    removed: !!row.removed,
  };
}
export function passwordCreate(schema: Schema, account: string, login: string, password: string) {
  accountPath(account);
  if (schema.id !== 'password' || !schema.collectionMethods?.includes('POST'))
    throw new Error('Criação de credencial indisponível.');
  if (
    schema.resourceFields.secretValue?.type !== 'password' ||
    schema.resourceFields.secretValue.readOnCreateOnly !== true
  )
    throw new Error('Contrato de proteção da senha indisponível.');
  if (!login.trim() || /[\x00-\x20\x7f:]/.test(login) || !password)
    throw new Error('Informe login sem espaços/dois pontos e uma senha.');
  for (const key of ['accountId', 'publicValue', 'secretValue'])
    if (!schema.resourceFields[key]?.create) throw new Error('Contrato de credencial alterado.');
  return preparePayload(schema, {
    accountId: account,
    publicValue: login.trim(),
    secretValue: password,
  });
}
export function passwordReset(schema: Schema, password: string) {
  if (
    schema.id !== 'changeSecretInput' ||
    !schema.resourceFields.newSecret?.create ||
    !schema.resourceFields.oldSecret?.create ||
    !password
  )
    throw new Error('Informe a nova senha local.');
  return { oldSecret: '', newSecret: password };
}
