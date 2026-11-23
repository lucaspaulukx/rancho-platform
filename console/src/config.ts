import { checkThemeContrast, type ThemeOverrides } from './themes/contrast';
export const moduleNames = [
  'groups',
  'users',
  'localAccountAdministration',
  'environments',
  'networkPolicies',
  'workloads',
  'contextActions',
  'workloadUpgrades',
  'workloadScaling',
  'stackComposeEditor',
  'stackComposeUpgrades',
  'customCheckboxes',
  'serviceLinksEditor',
  'balancerRulesEditor',
  'unsavedChangesGuard',
  'workloadCreationSections',
  'workloadBindingEditors',
  'workloadHealthChecks',
  'workloadHealthCheckUpgrades',
  'workloadSidecars',
  'workloadScheduling',
  'workloadResourceEditors',
  'workloadResourceUpgrades',
  'workloadSecurityEditors',
  'workloadSecurityUpgrades',
  'workloadSchedulingUpgrades',
  'workloadSidecarUpgrades',
  'catalogUpgrades',
  'bulkActions',
  'hosts',
  'data',
  'catalog',
  'observability',
  'metrics',
  'admin',
  'api',
  'apiKeys',
  'audit',
  'about',
  'processes',
  'processReplay',
  'settings',
  'workloadConfigUpgrades',
  'webhooks',
  'catalogRepositories',
  'environmentCatalogs',
  'environmentCatalogDelegation',
  'machineDrivers',
  'driverActivation',
  'clusterMonitoring',
  'processPools',
  'optional',
] as const;
export type ModuleName = (typeof moduleNames)[number];
export type ThemeMode = 'light' | 'dark' | 'system';
export interface ConsoleConfig {
  schemaVersion?: 1;
  enabled: boolean;
  branding: boolean;
  classicUrl: string;
  themeDefault: ThemeMode;
  themeSelectable: boolean;
  customTheme: ThemeOverrides;
  modules: Record<ModuleName, boolean>;
}
export interface ServerConfig {
  version: number;
  requested?: Record<string, boolean>;
  effective: Record<string, boolean>;
  available: Record<string, boolean>;
}
const themeTokens = new Set([
  'background',
  'surface',
  'elevated',
  'text',
  'muted',
  'border',
  'control-border',
  'primary',
  'primary-action',
  'primary-foreground',
  'primary-hover',
  'focus',
  'success',
  'warning',
  'danger',
  'info',
  'navigation-accent-start',
  'navigation-accent-end',
]);
export function validateConfig(value: unknown): ConsoleConfig {
  if (!value || typeof value !== 'object') throw new Error('Configuração da console inválida.');
  if (Array.isArray(value)) throw new Error('Configuração da console inválida.');
  const source = value as Record<string, unknown>;
  const legacy = !Object.prototype.hasOwnProperty.call(source, 'schemaVersion');
  if (!legacy && source.schemaVersion !== 1)
    throw new Error('Versão da configuração não suportada.');
  if (!source.modules || typeof source.modules !== 'object' || Array.isArray(source.modules))
    throw new Error('Módulos da console inválidos.');
  const supplied = source.modules as Record<string, unknown>;
  for (const name of Object.keys(supplied))
    if (!(moduleNames as readonly string[]).includes(name))
      throw new Error(`Flag desconhecida: ${name}.`);
  const modules = Object.fromEntries(
    moduleNames.map((name) => [
      name,
      legacy && !Object.prototype.hasOwnProperty.call(supplied, name) ? false : supplied[name],
    ]),
  );
  const c = { ...source, schemaVersion: 1, modules } as unknown as ConsoleConfig;
  for (const key of ['enabled', 'branding', 'themeSelectable'] as const) {
    if (typeof c[key] !== 'boolean') throw new Error(`Configuração inválida: ${key}.`);
  }
  if (!['light', 'dark', 'system'].includes(c.themeDefault))
    throw new Error('Tema padrão inválido.');
  try {
    const classic = new URL(c.classicUrl);
    if (!['http:', 'https:'].includes(classic.protocol) || classic.username || classic.password)
      throw new Error();
  } catch {
    throw new Error('Endereço do Rancher clássico inválido.');
  }
  for (const name of moduleNames)
    if (typeof c.modules?.[name] !== 'boolean') throw new Error(`Flag inválida: ${name}.`);
  if (!c.customTheme || typeof c.customTheme !== 'object' || Array.isArray(c.customTheme))
    throw new Error('Tokens de tema inválidos.');
  for (const [mode, tokens] of Object.entries(c.customTheme)) {
    if (
      !['light', 'dark'].includes(mode) ||
      !tokens ||
      typeof tokens !== 'object' ||
      Array.isArray(tokens)
    )
      throw new Error(`Tema customizado inválido: ${mode}.`);
    for (const [key, color] of Object.entries(tokens)) {
      if (!themeTokens.has(key) || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))
        throw new Error(`Token de tema inválido: ${key}.`);
    }
  }
  checkThemeContrast(c.customTheme);
  return c;
}
export async function loadConfig(signal?: AbortSignal) {
  const [frontend, backend] = await Promise.all([
    fetch('/console/console-config.json', { cache: 'no-store', signal }),
    fetch('/oidc/config', { cache: 'no-store', signal }),
  ]);
  if (!frontend.ok || !backend.ok) throw new Error('Não foi possível carregar a configuração.');
  return {
    console: validateConfig(await frontend.json()),
    server: (await backend.json()) as ServerConfig,
  };
}
