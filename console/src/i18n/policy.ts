import { defaultLocale, localeInventory, type Locale } from './locales';

export interface LocalizationPolicy {
  enabled: boolean;
  defaultLocale: Locale;
  availableLocales: Locale[];
  selectable: boolean;
  detectBrowser: boolean;
  preview: boolean;
}

export function normalizeLocalizationPolicy(value?: unknown): LocalizationPolicy {
  const defaults: LocalizationPolicy = {
    enabled: false,
    defaultLocale,
    availableLocales: [defaultLocale],
    selectable: false,
    detectBrowser: false,
    preview: false,
  };
  if (value === undefined) return defaults;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Política de idiomas inválida.');
  const supplied = value as Record<string, unknown>;
  if (Object.keys(supplied).some((key) => !Object.hasOwn(defaults, key)))
    throw new Error('Opção de idiomas desconhecida.');
  const policy = { ...defaults, ...supplied } as LocalizationPolicy;
  for (const key of ['enabled', 'selectable', 'detectBrowser', 'preview'] as const)
    if (typeof policy[key] !== 'boolean') throw new Error('Flag de idiomas inválida.');
  const known = (code: unknown): code is Locale =>
    localeInventory.some((entry) => entry.code === code);
  if (
    !known(policy.defaultLocale) ||
    !Array.isArray(policy.availableLocales) ||
    !policy.availableLocales.length ||
    policy.availableLocales.length > localeInventory.length ||
    policy.availableLocales.some((code) => !known(code)) ||
    new Set(policy.availableLocales).size !== policy.availableLocales.length ||
    !policy.availableLocales.includes(policy.defaultLocale)
  )
    throw new Error('Lista ou idioma padrão inválido.');
  // Non-Portuguese interface extraction/review is incomplete. Preview must be explicit.
  if (!policy.preview && policy.availableLocales.some((code) => code !== defaultLocale))
    throw new Error('Traduções incompletas exigem preview explícito.');
  return { ...policy, availableLocales: [...policy.availableLocales] };
}
