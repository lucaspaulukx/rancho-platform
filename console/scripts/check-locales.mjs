import { createServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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
const previewLocales = inventoryCodes.filter((code) => !checkedLocales.includes(code));
const sourceFile = resolve(root, 'src/i18n/preview-sources.json');

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, ordered(value[key])]),
    );
  return value;
}

/** Fingerprints original messages by translated domain, independent of key ordering. */
export function previewSourceSnapshot(englishMessages, previewCatalogs) {
  const catalogs = {};
  for (const [locale, catalog] of Object.entries(previewCatalogs)) {
    const groups = {};
    for (const key of Object.keys(catalog).sort()) {
      if (!Object.hasOwn(englishMessages, key)) throw new Error('Unknown preview source.');
      const domain = key.split('.')[0];
      (groups[domain] ??= []).push([key, englishMessages[key]]);
    }
    catalogs[locale] = Object.fromEntries(
      Object.entries(groups).map(([domain, messages]) => [
        domain,
        createHash('sha256')
          .update(JSON.stringify(ordered(messages)))
          .digest('hex'),
      ]),
    );
  }
  return { version: 1, catalogs };
}

/** Reports only registered messages; it does not discover untranslated interface strings. */
export function checkRegisteredCatalogs({
  englishMessages,
  portugueseMessages,
  previewCatalogs = {},
  previewSources,
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
    if (!previewLocales.includes(locale)) {
      failures.add('invalid-preview-locale');
      continue;
    }
    try {
      const keys = Object.keys(validateCatalog(catalog));
      if (!keys.length) failures.add('empty-preview-catalog');
      if (englishKeys.some((key) => !Object.hasOwn(catalog, key)))
        failures.add('incomplete-preview-catalog');
      previewCatalogKeyCounts[locale] = keys.length;
    } catch {
      failures.add('invalid-preview-message-structure');
    }
  }
  if (previewLocales.some((locale) => !Object.hasOwn(previewCatalogs ?? {}, locale)))
    failures.add('missing-preview-locale');
  try {
    const expected = previewSourceSnapshot(englishMessages, previewCatalogs);
    if (JSON.stringify(ordered(previewSources)) !== JSON.stringify(ordered(expected)))
      failures.add('preview-source-review-required');
  } catch {
    failures.add('invalid-preview-source');
  }
  if (
    locales.length !== inventoryCodes.length ||
    new Set(locales).size !== inventoryCodes.length ||
    inventoryCodes.some((code) => !locales.includes(code))
  )
    failures.add('invalid-original-locale-inventory');
  const missingPreviewKeysByLocale = Object.fromEntries(
    previewLocales.map((locale) => [
      locale,
      Math.max(0, englishKeys.length - (previewCatalogKeyCounts[locale] ?? 0)),
    ]),
  );
  return {
    status: failures.size ? 'failed' : 'passed',
    scope: 'registered-message-domain-only',
    registeredEnglishKeys: englishKeys.length,
    registeredPortugueseKeys: portugueseKeys.length,
    checkedCatalogLocales: checkedLocales,
    previewCatalogKeyCounts,
    missingPreviewKeysByLocale,
    pendingCatalogLocales: previewLocales.filter(
      (locale) => missingPreviewKeysByLocale[locale] > 0,
    ),
    interfaceCoverage: 'not-measured',
    allRoutesTranslated: false,
    failures: [...failures],
  };
}

async function main() {
  let server;
  let report;
  try {
    const recording = process.argv.length === 4 && process.argv[2] === '--record-preview-source';
    if (process.argv.length !== 2 && !recording) throw new Error('Unsupported arguments.');
    server = await createServer({
      root,
      configFile: false,
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    const { englishMessages, portugueseMessages, validateCatalog } =
      await server.ssrLoadModule('/src/i18n/messages.ts');
    const { previewLoaders } = await server.ssrLoadModule('/src/i18n/preview-loaders.ts');
    const previewCatalogs = Object.fromEntries(
      await Promise.all(
        Object.entries(previewLoaders).map(async ([locale, load]) => [locale, await load()]),
      ),
    );
    const { localeInventory } = await server.ssrLoadModule('/src/i18n/locales.ts');
    const previewSources = existsSync(sourceFile)
      ? JSON.parse(readFileSync(sourceFile, 'utf8'))
      : { version: 1, catalogs: {} };
    if (recording) {
      const locale = process.argv[3];
      if (!Object.hasOwn(previewCatalogs, locale)) throw new Error('Unknown preview locale.');
      validateCatalog(englishMessages);
      validateCatalog(previewCatalogs[locale]);
      if (
        previewSources.version !== 1 ||
        !previewSources.catalogs ||
        typeof previewSources.catalogs !== 'object' ||
        Array.isArray(previewSources.catalogs)
      )
        throw new Error('Invalid source manifest.');
      const snapshot = previewSourceSnapshot(englishMessages, {
        [locale]: previewCatalogs[locale],
      });
      previewSources.catalogs[locale] = snapshot.catalogs[locale];
      writeFileSync(sourceFile, JSON.stringify(ordered(previewSources), null, 2) + '\n');
      report = { status: 'passed', scope: 'preview-source-record', locale, failures: [] };
    } else
      report = checkRegisteredCatalogs({
        englishMessages,
        portugueseMessages,
        previewCatalogs,
        previewSources,
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
