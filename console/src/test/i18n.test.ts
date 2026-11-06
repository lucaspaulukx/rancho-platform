import { describe, expect, it } from 'vitest';
import {
  localeDirection,
  localeFormats,
  localeInventory,
  negotiateLocale,
  normalizeLocale,
  type Locale,
} from '../i18n/locales';
import {
  createTranslator,
  englishMessages,
  portugueseMessages,
  validateCatalog,
} from '../i18n/messages';
import { formatResourceDate } from '../resource-format';

describe('Original Rancher locale contract', () => {
  it('contains exactly ten production locales, with Persian RTL and no diagnostic locale', () => {
    expect(localeInventory.map((entry) => entry.code)).toEqual([
      'en-US',
      'pt-BR',
      'de-DE',
      'fr-FR',
      'hu-HU',
      'ja-JP',
      'fa-IR',
      'ru-RU',
      'uk-UA',
      'zh-Hans',
    ]);
    expect(
      localeInventory
        .filter((entry) => localeDirection(entry.code) === 'rtl')
        .map((entry) => entry.code),
    ).toEqual(['fa-IR']);
  });
  it('normalizes legacy casing/underscores and regional browser preferences', () => {
    for (const entry of localeInventory)
      expect(normalizeLocale(entry.code.toLowerCase())).toBe(entry.code);
    expect(normalizeLocale(' PT_br ')).toBe('pt-BR');
    expect(normalizeLocale('en-GB')).toBe('en-US');
    expect(normalizeLocale('fr-CA')).toBe('fr-FR');
    expect(normalizeLocale('zh-CN')).toBe('zh-Hans');
    expect(normalizeLocale('zh-SG')).toBe('zh-Hans');
  });
  it('does not confuse simplified/traditional Chinese or a different script', () => {
    for (const value of ['zh-TW', 'zh-HK', 'zh-Hant', 'ru-Latn', 'en-Cyrl'])
      expect(normalizeLocale(value)).toBeUndefined();
    expect(normalizeLocale('zh-Hans-TW')).toBe('zh-Hans');
  });
  it('rejects malformed, unknown and diagnostic preferences safely', () => {
    for (const value of [
      null,
      {},
      [],
      42,
      '',
      'none',
      'es-ES',
      '../../pt-BR',
      'en_US,fr',
      'x'.repeat(1000),
    ])
      expect(normalizeLocale(value)).toBeUndefined();
  });
  it('selects only explicitly available languages in preference order', () => {
    const available: Locale[] = ['pt-BR', 'en-US'];
    expect(negotiateLocale(['de-DE', 'en-GB', 'pt-BR'], available)).toBe('en-US');
    expect(negotiateLocale(['de-DE', 'none'], available)).toBe('pt-BR');
    expect(negotiateLocale(['fa-IR'], available, 'en-US')).toBe('en-US');
    expect(negotiateLocale(['fa-IR'], ['fa-IR'], 'fa-IR')).toBe('fa-IR');
    expect(() => negotiateLocale([], [], 'pt-BR')).toThrow();
    expect(() => negotiateLocale([], ['en-US'])).toThrow();
    expect(() => negotiateLocale([], ['none' as Locale, 'pt-BR'])).toThrow();
  });
  it.each(localeInventory.map((entry) => entry.code))(
    'formats numbers, dates, relative time and ordering in %s',
    (locale) => {
      const formats = localeFormats(locale);
      const instant = Date.UTC(2026, 10, 5, 13, 45);
      const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } as const;
      expect(formats.number(1234.5)).toBe(new Intl.NumberFormat(locale).format(1234.5));
      expect(formats.date(instant, options)).toBe(
        new Intl.DateTimeFormat(locale, options).format(instant),
      );
      expect(formats.date(new Date(instant), options)).toBe(formats.date(instant, options));
      expect(formats.relativeTime(-1, 'day', { numeric: 'auto' })).toBe(
        new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day'),
      );
      expect(formats.compare('host2', 'host10')).toBeLessThan(0);
      expect(formats.plural(0)).toBe(new Intl.PluralRules(locale).select(0));
    },
  );
  it('does not fabricate dates, zero counters or plural counts for invalid data', () => {
    const formats = localeFormats('pt-BR');
    expect(formats.date(new Date('invalid'))).toBe('—');
    expect(formats.date(1e20)).toBe('—');
    expect(formats.number(NaN)).toBe('—');
    expect(formats.number(Infinity)).toBe('—');
    expect(formats.relativeTime(NaN, 'day')).toBe('—');
    expect(() => formats.plural(NaN)).toThrow();
    expect(() => localeFormats('none' as Locale)).toThrow();
  });
  it('keeps existing resource-date behavior and accepts an explicit locale without changing native data', () => {
    const input = 'Thu Nov 05 13:45:00 UTC 2026';
    const timestamp = Date.UTC(2026, 10, 5, 13, 45);
    expect(formatResourceDate(input)).toBe(localeFormats('pt-BR').date(timestamp));
    expect(formatResourceDate(input, 'en-US')).toBe(localeFormats('en-US').date(timestamp));
    expect(formatResourceDate('invalid', 'fa-IR')).toBe('—');
    expect(input).toBe('Thu Nov 05 13:45:00 UTC 2026');
  });
});

describe('Typed message catalogs', () => {
  it('uses the initial pt-BR and en-US shared catalogs with typed interpolation and plural rules', () => {
    const pt = createTranslator('pt-BR'),
      en = createTranslator('en-US');
    expect(pt.t('common.cancel')).toBe('Cancelar');
    expect(en.t('common.cancel')).toBe('Cancel');
    expect(pt.t('environment.selected', { name: 'UI-OPS-LAB' })).toBe('Environment: UI-OPS-LAB');
    expect(en.t('selection.count', { count: 1 })).toBe('1 selected item');
    expect(en.t('selection.count', { count: 0 })).toBe('0 selected items');
    expect(pt.t('selection.count', { count: 2 })).toBe('2 itens selecionados');
    expect(pt.t('selection.count', { count: 0 })).toBe('0 item selecionado');
    expect(validateCatalog(portugueseMessages)).toEqual(portugueseMessages);
  });
  it('reports fallback and applies the fallback grammar rather than the requested locale grammar', () => {
    const french = createTranslator('fr-FR', {});
    expect(french.translatedKeys).toEqual([]);
    expect(french.resolvedLocale('selection.count')).toBe('en-US');
    expect(french.t('selection.count', { count: 0 })).toBe('0 selected items');
    const partial = createTranslator('fr-FR', { 'common.cancel': 'Annuler' });
    expect(partial.t('common.cancel')).toBe('Annuler');
    expect(partial.resolvedLocale('common.cancel')).toBe('fr-FR');
    expect(partial.t('common.save')).toBe('Save');
    expect(partial.translatedKeys).toEqual(['common.cancel']);
  });
  it('uses registered French preview messages with English fallback outside the preview', () => {
    const french = createTranslator('fr-FR');
    expect(french.t('common.cancel')).toBe('Annuler');
    expect(french.resolvedLocale('selection.count')).toBe('fr-FR');
    expect(french.resolvedLocale('shell.nav.stacks.title')).toBe('en-US');
    expect(french.t('shell.nav.stacks.title')).toBe(
      createTranslator('en-US').t('shell.nav.stacks.title'),
    );
  });
  it('supports language-specific plural forms and requires an other form', () => {
    const russian = createTranslator('ru-RU', {
      'selection.count': {
        one: '{count} элемент',
        few: '{count} элемента',
        many: '{count} элементов',
        other: '{count} элемента',
      },
    });
    expect(russian.t('selection.count', { count: 1 })).toBe('1 элемент');
    expect(russian.t('selection.count', { count: 3 })).toBe('3 элемента');
    expect(russian.t('selection.count', { count: 5 })).toBe('5 элементов');
    expect(() => validateCatalog({ 'selection.count': { one: '{count} item' } })).toThrow();
  });
  it('rejects corrupted catalog shapes, unknown keys, empty text and changed placeholders', () => {
    for (const value of [
      null,
      [],
      new Date(),
      { 'unknown.secret-payload': 'private' },
      { 'common.cancel': '' },
      { 'common.cancel': () => 'Cancel' },
      { 'common.cancel': { other: 'Cancel' } },
      { 'environment.selected': 'Environment' },
      { 'environment.selected': '{name} {token}' },
      { 'environment.selected': '{ name }' },
      { 'selection.count': '{count} items' },
      { 'selection.count': { other: '{count} items', invalid: '{count} items' } },
      JSON.parse('{"__proto__":"invalid"}'),
    ])
      expect(() => validateCatalog(value)).toThrow();
  });
  it('copies untrusted catalog data and retains parameter text literally without evaluating markup', () => {
    const source = { 'common.cancel': 'Annuler' };
    const translator = createTranslator('fr-FR', source);
    source['common.cancel'] = 'Changed';
    expect(translator.t('common.cancel')).toBe('Annuler');
    expect(translator.t('environment.selected', { name: '<script>{count}</script>' })).toBe(
      'Environment: <script>{count}</script>',
    );
    expect(validateCatalog(englishMessages)).toEqual(englishMessages);
    expect(Object.keys(portugueseMessages).sort()).toEqual(Object.keys(englishMessages).sort());
  });
  it('rejects missing/extra/nonfinite parameters at the runtime boundary without echoing them', () => {
    const translator = createTranslator('en-US');
    // Deliberately bypass compile-time guards to exercise untrusted runtime boundaries.
    const t = translator.t as (key: string, params?: unknown) => string;
    for (const params of [
      undefined,
      {},
      { token: 'private-value' },
      { name: {}, token: 'private-value' },
    ])
      expect(() => t('environment.selected', params)).toThrow('Invalid message parameters.');
    for (const count of [NaN, Infinity, '2'])
      expect(() => t('selection.count', { count })).toThrow('Invalid message parameters.');
    expect(() => t('private-unknown-key')).toThrow('Unknown message key.');
  });
});

// Compiled by the required TypeScript gate; never executed at runtime.
function messageTypeChecks() {
  const translator = createTranslator('pt-BR');
  // @ts-expect-error unknown message key
  translator.t('unknown');
  // @ts-expect-error a named message requires its parameters
  translator.t('environment.selected');
  // @ts-expect-error unexpected interpolation parameter
  translator.t('environment.selected', { token: 'value' });
  // @ts-expect-error count must remain numeric
  translator.t('selection.count', { count: '2' });
  // @ts-expect-error parameterless message cannot receive parameters
  translator.t('common.cancel', { name: 'ignored' });
}
void messageTypeChecks;
