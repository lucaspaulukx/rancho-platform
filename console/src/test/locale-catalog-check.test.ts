import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  englishMessages,
  portugueseMessages,
  previewCatalogs,
  validateCatalog,
} from '../i18n/messages';
import { localeInventory } from '../i18n/locales';

// The CLI is an ES module; a computed URL avoids claiming a generated declaration exists.
const root = process.cwd();
const { checkRegisteredCatalogs, previewSourceSnapshot } = await import(
  /* @vite-ignore */ pathToFileURL(resolve(root, 'scripts/check-locales.mjs')).href
);
const inputs = {
  englishMessages,
  portugueseMessages,
  previewCatalogs,
  validateCatalog,
  localeInventory,
  previewSources: JSON.parse(readFileSync(resolve(root, 'src/i18n/preview-sources.json'), 'utf8')),
};

describe('Registered locale catalog gate', () => {
  it('requires preview review when source wording changes without changing placeholders', () => {
    const changed = { ...englishMessages, 'auth.loginTitle': 'Open your environment' };
    const report = checkRegisteredCatalogs({ ...inputs, englishMessages: changed });
    expect(report.failures).toContain('preview-source-review-required');
    expect(report.status).toBe('failed');
    const refreshed = previewSourceSnapshot(changed, previewCatalogs);
    expect(
      checkRegisteredCatalogs({ ...inputs, englishMessages: changed, previewSources: refreshed })
        .status,
    ).toBe('passed');
    expect(refreshed.catalogs['fr-FR'].shell).toBe(inputs.previewSources.catalogs['fr-FR'].shell);
    expect(refreshed.catalogs['fr-FR'].auth).not.toBe(inputs.previewSources.catalogs['fr-FR'].auth);
  });

  it('ignores source order and untranslated domains but rejects a missing source manifest', () => {
    const reordered = Object.fromEntries(Object.entries(englishMessages).reverse());
    expect(checkRegisteredCatalogs({ ...inputs, englishMessages: reordered }).status).toBe(
      'passed',
    );
    const unrelated = { ...englishMessages, 'resourceCreator.kind.service': 'Workload service' };
    expect(checkRegisteredCatalogs({ ...inputs, englishMessages: unrelated }).status).toBe(
      'passed',
    );
    expect(checkRegisteredCatalogs({ ...inputs, previewSources: undefined }).failures).toContain(
      'preview-source-review-required',
    );
  });
  it('checks equal registered catalogs without claiming complete interface translation', () => {
    const report = checkRegisteredCatalogs(inputs);
    expect(report.status).toBe('passed');
    expect(report.scope).toBe('registered-message-domain-only');
    expect(report.registeredEnglishKeys).toBe(Object.keys(englishMessages).length);
    expect(report.registeredPortugueseKeys).toBe(report.registeredEnglishKeys);
    expect(report.checkedCatalogLocales).toEqual(['en-US', 'pt-BR']);
    const previewScope = Object.keys(englishMessages).filter(
      (key) =>
        /^(auth|ui|common|language|runtime|shell|recovery|resourceState)\./.test(key) ||
        key.startsWith('groups.role.') ||
        /^operations\.(search|searchPlaceholder|state|allStates|includeSystem|empty|emptyHint|stacks|services|containers|view|expandAll|collapseAll|topology|stackMetric|serviceMetric|containerMetric|totals|visibleStacks|visibleServices|visibleContainers|hiddenSystem|resourceActions|details|logs|terminal|metrics|edit|scale|balancer|createService|logsUnavailable|terminalUnavailable)$/.test(
          key,
        ) ||
        key === 'environment.selected' ||
        key === 'selection.count',
    );
    const previewLocales = [
      'de-DE',
      'fr-FR',
      'hu-HU',
      'ja-JP',
      'fa-IR',
      'ru-RU',
      'uk-UA',
      'zh-Hans',
    ] as const;
    expect(Object.keys(previewCatalogs)).toEqual(previewLocales);
    for (const locale of previewLocales)
      expect(Object.keys(previewCatalogs[locale]!).sort()).toEqual(previewScope.sort());
    expect(report.previewCatalogKeyCounts).toEqual(
      Object.fromEntries(previewLocales.map((locale) => [locale, previewScope.length])),
    );
    expect(report.pendingCatalogLocales).toEqual([
      'de-DE',
      'fr-FR',
      'hu-HU',
      'ja-JP',
      'fa-IR',
      'ru-RU',
      'uk-UA',
      'zh-Hans',
    ]);
    expect(report.interfaceCoverage).toBe('not-measured');
    expect(report.allRoutesTranslated).toBe(false);
    expect(report.failures).toEqual([]);
  });
  it('reports invalid preview structure without exposing submitted content', () => {
    const report = checkRegisteredCatalogs({
      ...inputs,
      previewCatalogs: { 'fr-FR': { 'environment.selected': 'private-preview' } },
    });
    expect(report.status).toBe('failed');
    expect(report.failures).toContain('invalid-preview-message-structure');
    expect(JSON.stringify(report)).not.toContain('private-preview');
  });

  it('fails when a Portuguese key is missing or an unregistered key is added', () => {
    const { 'common.cancel': _cancel, ...missing } = portugueseMessages;
    expect(checkRegisteredCatalogs({ ...inputs, portugueseMessages: missing }).failures).toContain(
      'catalog-key-set-mismatch',
    );
    const extra = checkRegisteredCatalogs({
      ...inputs,
      portugueseMessages: { ...portugueseMessages, 'private-unknown-key': 'private-content' },
    });
    expect(extra.status).toBe('failed');
    expect(extra.failures).toContain('catalog-key-set-mismatch');
    expect(extra.failures).toContain('invalid-message-structure');
    expect(JSON.stringify(extra)).not.toMatch(/private-unknown-key|private-content/);
  });

  it('rejects changed placeholders, malformed plurals and corrupted canonical entries', () => {
    for (const catalog of [
      { ...portugueseMessages, 'environment.selected': 'Environment sem parâmetro' },
      { ...portugueseMessages, 'selection.count': { one: '{count} item' } },
      { ...portugueseMessages, 'selection.count': { other: '{count} itens', invalid: '{count}' } },
    ]) {
      const report = checkRegisteredCatalogs({ ...inputs, portugueseMessages: catalog });
      expect(report.status).toBe('failed');
      expect(report.failures).toContain('invalid-message-structure');
    }
    const report = checkRegisteredCatalogs({
      ...inputs,
      englishMessages: { ...englishMessages, 'common.cancel': '' },
    });
    expect(report.failures).toContain('invalid-message-structure');
  });

  it('does not pass two empty catalogs or a missing/duplicated/diagnostic inventory', () => {
    expect(
      checkRegisteredCatalogs({ ...inputs, englishMessages: {}, portugueseMessages: {} }).failures,
    ).toContain('empty-registered-domain');
    for (const inventory of [
      [],
      localeInventory.slice(1),
      [...localeInventory, { code: 'none' }],
      [...localeInventory.slice(1), localeInventory[1]],
    ]) {
      expect(checkRegisteredCatalogs({ ...inputs, localeInventory: inventory }).failures).toContain(
        'invalid-original-locale-inventory',
      );
    }
  });

  it('does not expose validator exceptions or catalog contents in failure reports', () => {
    const report = checkRegisteredCatalogs({
      ...inputs,
      validateCatalog() {
        throw new Error('private-error-payload');
      },
    });
    expect(report.status).toBe('failed');
    expect(JSON.stringify(report)).not.toContain('private-error-payload');
  });

  it('loads actual TypeScript catalogs through the packaged CLI and exits nonzero for unsupported arguments', () => {
    const stdout = execFileSync(process.execPath, ['scripts/check-locales.mjs'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15_000,
    });
    const report = JSON.parse(stdout);
    expect(report.status).toBe('passed');
    expect(report.interfaceCoverage).toBe('not-measured');
    const rejected = spawnSync(
      process.execPath,
      ['scripts/check-locales.mjs', 'private-cli-value'],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    expect(rejected.status).toBe(1);
    expect(JSON.parse(rejected.stdout).status).toBe('failed');
    expect(rejected.stdout + rejected.stderr).not.toContain('private-cli-value');
  });
});
