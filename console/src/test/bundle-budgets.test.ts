import { describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { checkBundleBudgets } = await import(
  /* @vite-ignore */ pathToFileURL(resolve(process.cwd(), 'scripts/check-bundles.mjs')).href
);
const manifest = {
  'index.html': {
    isEntry: true,
    file: 'assets/entry.js',
    imports: ['shared'],
    css: ['assets/main.css'],
  },
  shared: { file: 'assets/shared.js', imports: ['cycle'], css: ['assets/main.css'] },
  cycle: { file: 'assets/cycle.js', imports: ['shared'] },
  lazy: { file: 'assets/lazy.js' },
};
const sizes: Record<string, number> = {
  'assets/entry.js': 40,
  'assets/shared.js': 30,
  'assets/cycle.js': 10,
  'assets/lazy.js': 50,
  'assets/main.css': 5,
};
const budgets = {
  initialJavaScriptGzip: 80,
  initialCssGzip: 5,
  largestLazyJavaScriptGzip: 50,
  applicationJavaScriptGzip: 130,
  largestPreviewCatalogGzip: 50,
};
describe('Production bundle budgets', () => {
  it('counts initial imports and shared CSS once, including cyclic imports', () => {
    expect(checkBundleBudgets(manifest, (file: string) => sizes[file], budgets)).toEqual({
      status: 'passed',
      scope: 'gzip-build-artifacts',
      measured: { ...budgets, largestPreviewCatalogGzip: 0 },
      packageJavaScriptGzip: 130,
      limits: budgets,
      failures: [],
    });
  });
  it('fails for larger initial or lazy chunks instead of counting only the entry file', () => {
    const report = checkBundleBudgets(
      manifest,
      (file: string) => sizes[file] + (file.endsWith('.js') ? 1 : 0),
      budgets,
    );
    expect(report.status).toBe('failed');
    expect(report.failures).toEqual([
      'initialJavaScriptGzip',
      'largestLazyJavaScriptGzip',
      'applicationJavaScriptGzip',
    ]);
  });
  it('rejects incomplete manifests and invalid thresholds', () => {
    expect(() => checkBundleBudgets({}, () => 1, budgets)).toThrow();
    expect(() =>
      checkBundleBudgets({ ...manifest, shared: undefined }, () => 1, budgets),
    ).toThrow();
    expect(() =>
      checkBundleBudgets(manifest, () => 1, { ...budgets, applicationJavaScriptGzip: 0 }),
    ).toThrow();
  });
  it('requires each preview catalog to stay outside the initial import graph', () => {
    const sizeOf = (file: string) => sizes[file];
    const preview = { ...manifest, lazy: { ...manifest.lazy, isDynamicEntry: true } };
    const report = checkBundleBudgets(preview, sizeOf, budgets, ['lazy']);
    expect(report.status).toBe('passed');
    expect(report.measured.applicationJavaScriptGzip).toBe(80);
    expect(report.measured.largestPreviewCatalogGzip).toBe(50);
    expect(report.packageJavaScriptGzip).toBe(130);
    expect(
      checkBundleBudgets(preview, sizeOf, { ...budgets, largestPreviewCatalogGzip: 49 }, ['lazy'])
        .failures,
    ).toEqual(['largestPreviewCatalogGzip']);
    expect(checkBundleBudgets(preview, sizeOf, budgets, ['missing']).failures).toContain(
      'preview-catalog-loading',
    );
    const eager = {
      ...preview,
      shared: { ...preview.shared, imports: ['cycle', 'lazy'] },
    };
    expect(checkBundleBudgets(eager, sizeOf, budgets, ['lazy']).failures).toContain(
      'preview-catalog-loading',
    );
    const staticallyImportedByLazyRoute = {
      ...preview,
      route: { isDynamicEntry: true, file: 'assets/route.js', imports: ['lazy'] },
    };
    expect(
      checkBundleBudgets(
        staticallyImportedByLazyRoute,
        (file: string) => sizes[file] ?? 1,
        budgets,
        ['lazy'],
      ).failures,
    ).toContain('preview-catalog-loading');
  });
});
