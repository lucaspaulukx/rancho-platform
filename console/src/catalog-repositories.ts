import type { Schema, Resource } from './api';
import { settingSnapshot, prepareSetting, type SettingSnapshot } from './server-settings';
export interface RepositoryDraft {
  key: string;
  original: string | null;
  name: string;
  url: string;
  branch: string;
}
export interface RepositoryDocument {
  setting: SettingSnapshot;
  document: Record<string, unknown>;
  entries: RepositoryDraft[];
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const repositoryNameValid = (v: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(v) &&
  !['__proto__', 'constructor', 'prototype'].includes(v);
export function repositoryDocument(row: Resource): RepositoryDocument {
  const setting = settingSnapshot(row);
  if (setting.name !== 'catalog.url') throw new Error('Configuração de catálogo inválida.');
  const value = setting.value ?? setting.activeValue ?? '';
  let doc: unknown;
  try {
    if (value.length > 65535) throw new Error();
    doc = JSON.parse(value);
  } catch {
    throw new Error(
      'Este editor exige catalog.url no formato JSON. Preserve o valor e use a configuração do servidor para formatos legados.',
    );
  }
  if (!record(doc) || !record(doc.catalogs) || Object.keys(doc.catalogs).length > 1000)
    throw new Error('Documento de catálogo não suportado.');
  const entries = Object.entries(doc.catalogs).map(([name, value]) => {
    if (
      !repositoryNameValid(name) ||
      !record(value) ||
      typeof value.url !== 'string' ||
      (value.branch != null && typeof value.branch !== 'string')
    )
      throw new Error('Entrada de catálogo não suportada.');
    return {
      key: 'existing:' + name,
      original: name,
      name,
      url: value.url,
      branch: (value.branch as string) ?? '',
    };
  });
  return { setting, document: doc, entries };
}
export function repositoryMetadata(doc: RepositoryDocument) {
  return {
    source: doc.setting.source,
    inDb: doc.setting.inDb,
    entries: doc.entries.map((v) => ({
      name: v.name,
      branch: v.branch || 'Padrão do servidor',
      usesDefaultBranch: !v.branch,
    })),
  };
}
export function repositoryValue(before: RepositoryDocument, entries: RepositoryDraft[]) {
  const names = new Set<string>(),
    originals = new Set<string>();
  if (entries.length > 1000) throw new Error('Quantidade de repositórios excedida.');
  const catalogs = Object.fromEntries(
    entries.map((row) => {
      if (!repositoryNameValid(row.name) || names.has(row.name))
        throw new Error('Use nomes únicos, sem espaços ou chaves reservadas.');
      names.add(row.name);
      const existing =
        row.original !== null ? before.entries.find((v) => v.name === row.original) : undefined;
      if (row.original !== null && (!existing || originals.has(row.original)))
        throw new Error('Reabra o editor de repositórios.');
      if (row.original !== null) originals.add(row.original);
      validateRepositoryLocation(row.url, row.branch, existing?.url);
      const extra = existing
        ? (before.document.catalogs as Record<string, Record<string, unknown>>)[existing.name]
        : {};
      const value: Record<string, unknown> = { ...extra, url: row.url };
      if (!existing || row.branch !== existing.branch) {
        if (row.branch) value.branch = row.branch;
        else delete value.branch;
      }
      return [row.name, value];
    }),
  );
  return JSON.stringify({ ...before.document, catalogs });
}
export function repositoryPayload(
  schema: Schema,
  before: RepositoryDocument,
  fresh: RepositoryDocument,
  entries: RepositoryDraft[],
  allowEmpty: boolean,
) {
  if (!entries.length && !allowEmpty)
    throw new Error('Confirme a remoção de todos os repositórios globais.');
  return prepareSetting(
    schema,
    before.setting,
    fresh.setting,
    repositoryValue(before, entries),
    false,
  );
}

export function validateRepositoryLocation(url: string, branch: string, originalUrl?: string) {
  if (url !== originalUrl) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('URL do repositório inválida.');
    }
    if (
      !['http:', 'https:', 'ssh:', 'git:'].includes(parsed.protocol) ||
      parsed.password ||
      parsed.hash ||
      (['http:', 'https:'].includes(parsed.protocol) && parsed.username)
    )
      throw new Error('Use URL Git, SSH, HTTP ou HTTPS sem senha, fragmento ou credenciais HTTP.');
  }
  if (!url || url.length > 8192 || url.includes('\0'))
    throw new Error('URL do repositório inválida.');
  if (
    branch.length > 255 ||
    /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.startsWith('/') ||
    branch.startsWith('-') ||
    branch === '@' ||
    branch.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock')) ||
    branch.endsWith('.') ||
    branch.endsWith('/') ||
    branch.includes('@{')
  )
    throw new Error('Branch inválida. Use um nome de referência Git.');
}
