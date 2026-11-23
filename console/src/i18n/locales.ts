/** Production inventory of Rancher UI v1.6.52; inventory is not translation coverage. */
export const localeInventory = [
  { code: 'en-US', name: 'English', direction: 'ltr' },
  { code: 'pt-BR', name: 'Português (Brasil)', direction: 'ltr' },
  { code: 'de-DE', name: 'Deutsch', direction: 'ltr' },
  { code: 'fr-FR', name: 'Français', direction: 'ltr' },
  { code: 'hu-HU', name: 'Magyar', direction: 'ltr' },
  { code: 'ja-JP', name: '日本語', direction: 'ltr' },
  { code: 'fa-IR', name: 'فارسی', direction: 'rtl' },
  { code: 'ru-RU', name: 'Русский', direction: 'ltr' },
  { code: 'uk-UA', name: 'Українська', direction: 'ltr' },
  { code: 'zh-Hans', name: '简体中文', direction: 'ltr' },
] as const;
export type Locale = (typeof localeInventory)[number]['code'];
export const defaultLocale: Locale = 'pt-BR';

/** Accept legacy casing/underscores and regional variants without guessing a different script. */
export function normalizeLocale(value: unknown): Locale | undefined {
  if (typeof value !== 'string' || value.length > 64) return undefined;
  try {
    const requested = new Intl.Locale(value.trim().replaceAll('_', '-'));
    if (requested.language === 'zh') {
      const script = requested.maximize().script;
      return script === 'Hans' ? 'zh-Hans' : undefined;
    }
    const found = localeInventory.find((entry) => {
      const known = new Intl.Locale(entry.code).maximize();
      return known.language === requested.language && known.script === requested.maximize().script;
    });
    return found?.code;
  } catch {
    return undefined;
  }
}

/** Explicit availability is required: a target locale must not appear merely because it exists. */
export function negotiateLocale(
  preferences: readonly unknown[],
  available: readonly Locale[],
  fallback: Locale = defaultLocale,
): Locale {
  if (
    !available.length ||
    !available.includes(fallback) ||
    available.some((code) => !localeInventory.some((entry) => entry.code === code))
  )
    throw new Error('Invalid locale availability policy.');
  for (const preference of preferences) {
    const candidate = normalizeLocale(preference);
    if (candidate && available.includes(candidate)) return candidate;
  }
  return fallback;
}

export function localeDirection(locale: Locale) {
  const entry = localeInventory.find((value) => value.code === locale);
  if (!entry) throw new Error('Unsupported locale.');
  return entry.direction;
}

export function localeFormats(locale: Locale) {
  localeDirection(locale);
  return {
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      Number.isFinite(value) ? new Intl.NumberFormat(locale, options).format(value) : '—',
    date: (
      value: Date | number,
      options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
    ) => {
      const timestamp = value instanceof Date ? value.getTime() : value;
      return Number.isFinite(timestamp) && !Number.isNaN(new Date(timestamp).getTime())
        ? new Intl.DateTimeFormat(locale, options).format(timestamp)
        : '—';
    },
    relativeTime: (
      value: number,
      unit: Intl.RelativeTimeFormatUnit,
      options?: Intl.RelativeTimeFormatOptions,
    ) =>
      Number.isFinite(value)
        ? new Intl.RelativeTimeFormat(locale, options).format(value, unit)
        : '—',
    compare: (a: string, b: string) => new Intl.Collator(locale, { numeric: true }).compare(a, b),
    plural: (count: number) => {
      if (!Number.isFinite(count)) throw new Error('Invalid plural count.');
      return new Intl.PluralRules(locale).select(count);
    },
  };
}
