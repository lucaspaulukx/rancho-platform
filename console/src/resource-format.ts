import { defaultLocale, localeFormats, type Locale } from './i18n/locales';
import { createTranslator } from './i18n/messages';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function resourceDate(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const native = /^\w{3} (\w{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(value);
  const timestamp =
    native && months.includes(native[1])
      ? Date.UTC(
          Number(native[6]),
          months.indexOf(native[1]),
          Number(native[2]),
          Number(native[3]),
          Number(native[4]),
          Number(native[5]),
        )
      : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
export function formatResourceDate(value: unknown, locale: Locale = defaultLocale) {
  const timestamp = resourceDate(value);
  return timestamp === undefined ? '—' : localeFormats(locale).date(timestamp);
}
const defaultTranslator = createTranslator(defaultLocale).t;

export function certificateValidity(value: unknown, now = Date.now(), t = defaultTranslator) {
  const expires = resourceDate(value);
  if (expires === undefined) return { label: t('details.certificate.unknown'), state: 'unknown' };
  const days = Math.ceil((expires - now) / 86_400_000);
  if (expires <= now) return { label: t('details.certificate.expired'), state: 'error' };
  if (days <= 30)
    return { label: t('details.certificate.expiring', { count: days }), state: 'warning' };
  return { label: t('details.certificate.valid'), state: 'active' };
}
