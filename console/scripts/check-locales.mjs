import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inventoryCodes = [
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
];
const checkedLocales = ['en-US', 'pt-BR'];

/** Reports only registered messages; it does not discover untranslated interface strings. */
export function checkRegisteredCatalogs({
  englishMessages,
  portugueseMessages,
  previewCatalogs = {},
  validateCatalog,
  localeInventory,
}) {
  const failures = new Set();
  const isRecord = (value) =>
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [null, Object.prototype].includes(Object.getPrototypeOf(value));
  const englishKeys = isRecord(englishMessages) ? Object.keys(englishMessages).sort() : [];
  const portugueseKeys = isRecord(portugueseMessages) ? Object.keys(portugueseMessages).sort() : [];
  if (!englishKeys.length) failures.add('empty-registered-domain');
  if (JSON.stringify(englishKeys) !== JSON.stringify(portugueseKeys))
    failures.add('catalog-key-set-mismatch');
  try {
    validateCatalog(englishMessages);
    validateCatalog(portugueseMessages);
  } catch {
    failures.add('invalid-message-structure');
  }
  const locales = Array.isArray(localeInventory) ? localeInventory.map((entry) => entry?.code) : [];
  const previewCatalogKeyCounts = {};
  const previews = isRecord(previewCatalogs) ? Object.entries(previewCatalogs) : [];
  if (!isRecord(previewCatalogs)) failures.add('invalid-preview-registry');
  for (const [locale, catalog] of previews) {
    if (!inventoryCodes.includes(locale) || checkedLocales.includes(locale)) {
      failures.add('invalid-preview-locale');
      continue;
    }
    try {
      const keys = Object.keys(validateCatalog(catalog));
      if (!keys.length) failures.add('empty-preview-catalog');
      previewCatalogKeyCounts[locale] = keys.length;
    } catch {
      failures.add('invalid-preview-message-structure');
    }
  }
  if (
    locales.length !== inventoryCodes.length ||
    new Set(locales).size !== inventoryCodes.length ||
    inventoryCodes.some((code) => !locales.includes(code))
  )
    failures.add('invalid-original-locale-inventory');
  return {
    status: failures.size ? 'failed' : 'passed',
    scope: 'registered-message-domain-only',
    registeredEnglishKeys: englishKeys.length,
    registeredPortugueseKeys: portugueseKeys.length,
    checkedCatalogLocales: checkedLocales,
    previewCatalogKeyCounts,
    pendingCatalogLocales: inventoryCodes.filter((code) => !checkedLocales.includes(code)),
    interfaceCoverage: 'not-measured',
    allRoutesTranslated: false,
    failures: [...failures],
  };
}

async function main() {
  let server;
  let report;
  try {
    if (process.argv.length !== 2) throw new Error('Unsupported arguments.');
    server = await createServer({
      root,
      configFile: false,
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    const { englishMessages, portugueseMessages, previewCatalogs, validateCatalog } =
      await server.ssrLoadModule('/src/i18n/messages.ts');
    const { localeInventory } = await server.ssrLoadModule('/src/i18n/locales.ts');
    report = checkRegisteredCatalogs({
      englishMessages,
      portugueseMessages,
      previewCatalogs,
      validateCatalog,
      localeInventory,
    });
  } catch {
    report = {
      status: 'failed',
      scope: 'registered-message-domain-only',
      interfaceCoverage: 'not-measured',
      allRoutesTranslated: false,
      failures: ['catalog-check-unavailable'],
    };
  } finally {
    try {
      await server?.close();
    } catch {
      report.status = 'failed';
      report.failures.push('catalog-check-cleanup-failed');
    }
  }
  console.log(JSON.stringify(report, null, 2));
  return report.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main();
