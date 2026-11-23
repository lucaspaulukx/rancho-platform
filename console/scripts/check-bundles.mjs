import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function checkBundleBudgets(manifest, sizeOf, budgets, previewEntries = []) {
  const chunks = Object.values(manifest);
  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
  if (!entries.length) throw new Error('Missing entry.');
  const initial = new Set();
  const initialCss = new Set();
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk || typeof chunk.file !== 'string') throw new Error('Invalid chunk.');
    if (chunk.file.endsWith('.js')) initial.add(chunk.file);
    for (const css of chunk.css ?? []) initialCss.add(css);
    for (const imported of chunk.imports ?? []) visit(imported);
  }
  entries.forEach(visit);
  const all = new Set(
    chunks.filter((chunk) => chunk.file?.endsWith('.js')).map((chunk) => chunk.file),
  );
  const sum = (files) => [...files].reduce((total, file) => total + sizeOf(file), 0);
  const measured = {
    initialJavaScriptGzip: sum(initial),
    initialCssGzip: sum(initialCss),
    largestLazyJavaScriptGzip: Math.max(
      0,
      ...[...all].filter((file) => !initial.has(file)).map(sizeOf),
    ),
    totalJavaScriptGzip: sum(all),
  };
  if (Object.keys(budgets).sort().join() !== Object.keys(measured).sort().join())
    throw new Error('Invalid budget keys.');
  const failures = Object.entries(measured)
    .filter(([key, bytes]) => {
      if (!Number.isSafeInteger(budgets[key]) || budgets[key] <= 0)
        throw new Error('Invalid budget.');
      return bytes > budgets[key];
    })
    .map(([key]) => key);
  if (previewEntries.some((key) => !manifest[key]?.isDynamicEntry || seen.has(key)))
    failures.push('preview-catalog-loading');
  return {
    status: failures.length ? 'failed' : 'passed',
    scope: 'gzip-build-artifacts',
    measured,
    limits: budgets,
    failures,
  };
}

function main() {
  let report;
  try {
    if (process.argv.length !== 2) throw new Error('Unsupported arguments.');
    const dist = resolve(root, 'dist');
    const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
    const budgets = JSON.parse(readFileSync(resolve(root, 'scripts/bundle-budgets.json'), 'utf8'));
    const catalogDirectory = 'src/i18n/catalogs';
    const previewEntries = readdirSync(resolve(root, catalogDirectory))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => `${catalogDirectory}/${name}`);
    const sizes = new Map();
    report = checkBundleBudgets(
      manifest,
      (file) => {
        if (!sizes.has(file)) {
          const path = resolve(dist, file);
          const inside = relative(dist, path);
          if (!inside || inside.startsWith('..') || isAbsolute(inside))
            throw new Error('Invalid asset path.');
          sizes.set(file, gzipSync(readFileSync(path)).length);
        }
        return sizes.get(file);
      },
      budgets,
      previewEntries,
    );
  } catch {
    report = {
      status: 'failed',
      scope: 'gzip-build-artifacts',
      failures: ['bundle-check-unavailable'],
    };
  }
  console.log(JSON.stringify(report, null, 2));
  return report.status === 'passed' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main();
