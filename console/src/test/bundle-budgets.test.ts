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
  totalJavaScriptGzip: 130,
};
describe('Production bundle budgets', () => {
  it('counts initial imports and shared CSS once, including cyclic imports', () => {
    expect(checkBundleBudgets(manifest, (file: string) => sizes[file], budgets)).toEqual({
      status: 'passed',
      scope: 'gzip-build-artifacts',
      measured: budgets,
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
      'totalJavaScriptGzip',
    ]);
  });
  it('rejects incomplete manifests and invalid thresholds', () => {
    expect(() => checkBundleBudgets({}, () => 1, budgets)).toThrow();
    expect(() =>
      checkBundleBudgets({ ...manifest, shared: undefined }, () => 1, budgets),
    ).toThrow();
    expect(() =>
      checkBundleBudgets(manifest, () => 1, { ...budgets, totalJavaScriptGzip: 0 }),
    ).toThrow();
  });
  it('requires each preview catalog to stay outside the initial import graph', () => {
    const sizeOf = (file: string) => sizes[file];
    const preview = { ...manifest, lazy: { ...manifest.lazy, isDynamicEntry: true } };
    expect(checkBundleBudgets(preview, sizeOf, budgets, ['lazy']).status).toBe('passed');
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
  });
});
