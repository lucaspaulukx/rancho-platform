import type { Locale } from './locales';

export const previewLoaders = {
  'de-DE': () => import('./catalogs/de-DE').then(({ deDE }) => deDE),
  'fr-FR': () => import('./catalogs/fr-FR').then(({ frFR }) => frFR),
  'hu-HU': () => import('./catalogs/hu-HU').then(({ huHU }) => huHU),
  'ja-JP': () => import('./catalogs/ja-JP').then(({ jaJP }) => jaJP),
  'fa-IR': () => import('./catalogs/fa-IR').then(({ faIR }) => faIR),
  'ru-RU': () => import('./catalogs/ru-RU').then(({ ruRU }) => ruRU),
  'uk-UA': () => import('./catalogs/uk-UA').then(({ ukUA }) => ukUA),
  'zh-Hans': () => import('./catalogs/zh-Hans').then(({ zhHans }) => zhHans),
} satisfies Record<Exclude<Locale, 'pt-BR' | 'en-US'>, () => Promise<unknown>>;

export function isPreviewLocale(locale: Locale): locale is keyof typeof previewLoaders {
  return Object.hasOwn(previewLoaders, locale);
}
