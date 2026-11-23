const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  manifest = path.join(root, 'console/catalog-repositories-fixture.json');
const checks = [],
  audits = [],
  name = 'consolecatalog' + crypto.randomBytes(5).toString('hex'),
  url = 'http://127.0.0.1:9/' + name + '.git';
let browser,
  context,
  page,
  baseline,
  changed = false,
  enabled = true;
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  return v;
}
const hash = (v) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/catalog-repositories-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function setting() {
  const r = await page.request.get('http://localhost:18090/v2-beta/settings/catalog.url', {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
const document = (v) => JSON.parse(v.value ?? v.activeValue ?? '');
async function csrf(c = context) {
  return (await c.cookies()).find((v) => v.name === 'CSRF')?.value || '';
}
async function selectTheme(theme) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const button = page.getByRole('button', {
    name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await button.count()) await button.click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
}
async function audit(view, theme, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const toggle = page.getByRole('button', {
    name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
  const appliedTheme = await page.locator('html').getAttribute('data-theme');
  await page.screenshot({
    path: path.join(
      root,
      'evidence/e2e-isolated',
      `catalog-repositories-${view}-${theme}-${width}.png`,
    ),
    animations: 'disabled',
  });
  await page.evaluate(axe);
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      })
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.flatMap((n) => n.target).map(String),
    })),
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  audits.push({ view, theme, appliedTheme, width, violations, overflow });
  fs.writeFileSync(
    path.join(root, 'console/catalog-repositories-a11y-results.json'),
    JSON.stringify(audits, null, 2) + '\n',
  );
  assert.deepEqual(violations, []);
  assert.equal(overflow, false);
  check(`${view} accessibility and layout ${theme} ${width}`);
}
async function save() {
  await page.getByRole('button', { name: 'Revisar repositórios', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Salvar repositórios globais?', exact: true })
    .waitFor({ state: 'hidden' });
}
(async () => {
  assert.equal(
    fs.existsSync(manifest),
    false,
    'Recover prior catalog fixture before running acceptance',
  );
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) =>
    ['http://localhost:18090', 'http://localhost:18081'].includes(
      new URL(route.request().url()).origin,
    )
      ? route.continue()
      : route.abort(),
  );
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, catalogRepositories: enabled } },
    });
  });
  page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  baseline = await setting();
  assert.equal(baseline.inDb, false, 'Acceptance only borrows configuration with no DB override');
  const before = document(baseline),
    count = Object.keys(before.catalogs).length;
  assert.equal(before.catalogs[name], undefined);
  await page.goto('http://localhost:18090/console/catalog-repositories?env=1a12');
  await page
    .getByRole('region', { name: 'Repositórios globais configurados', exact: true })
    .waitFor();
  check('real global catalog setting renders configured sources');
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) await audit('inventory', theme, width);
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await selectTheme(theme);
      await page.getByRole('button', { name: 'Configurar repositórios', exact: true }).click();
      await page.getByRole('button', { name: 'Adicionar repositório', exact: true }).click();
      await page.getByLabel(`Nome do repositório ${count + 1}`, { exact: true }).fill(name);
      await page.getByLabel(`URL do repositório ${count + 1}`, { exact: true }).fill(url);
      await audit('editor', theme, width);
      if (theme !== 'light' || width !== 390) {
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page
          .getByRole('heading', { name: 'Descartar alterações dos repositórios?', exact: true })
          .waitFor();
        await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
      }
    }
  fs.writeFileSync(
    manifest,
    JSON.stringify(
      {
        name,
        baselineHash: hash(before),
        baselineSource: baseline.source,
        baselineValueHash: hash(baseline.value ?? baseline.activeValue),
        beforeInDb: false,
      },
      null,
      2,
    ) + '\n',
  );
  changed = true;
  await save();
  let current = await setting();
  assert.equal(current.inDb, true);
  assert.equal(document(current).catalogs[name].url, url);
  const withoutFixture = structuredClone(document(current));
  delete withoutFixture.catalogs[name];
  check(
    'UI adds only exact global fixture and preserves other fields',
    hash(withoutFixture) === hash(before),
  );
  await page.getByRole('button', { name: 'Configurar repositórios', exact: true }).click();
  await page.getByLabel(`Branch do repositório ${count + 1}`, { exact: true }).fill('fixture/next');
  await save();
  check(
    'UI edits branch through native setting PUT',
    document(await setting()).catalogs[name].branch === 'fixture/next',
  );
  await page.getByRole('button', { name: 'Configurar repositórios', exact: true }).click();
  await page.getByLabel(`Branch do repositório ${count + 1}`, { exact: true }).fill('discard');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Descartar alterações dos repositórios?', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  check(
    'discard does not send repository changes',
    document(await setting()).catalogs[name].branch === 'fixture/next',
  );
  await page.getByRole('button', { name: 'Configurar repositórios', exact: true }).click();
  await page.getByRole('button', { name: `Remover repositório ${count + 1}`, exact: true }).click();
  await save();
  check(
    'UI removes only fixture and restores original document',
    hash(document(await setting())) === hash(before),
  );
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('module flag blocks direct repository management');
  const rc = await browser.newContext(),
    reader = await rc.newPage();
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const method of ['GET', 'PUT']) {
    const r = await reader.request.fetch('http://localhost:18090/v2-beta/settings/catalog.url', {
      method,
      headers: { Accept: 'application/json', 'X-Api-Csrf': await csrf(rc) },
      ...(method === 'PUT' ? { data: { value: JSON.stringify(before) } } : {}),
    });
    check(
      'native non-admin catalog setting ' + method + (method === 'GET' ? ' readable' : ' denied'),
      method === 'GET' ? r.status() === 200 : [401, 403, 404, 405].includes(r.status()),
    );
  }
  await reader.goto('http://localhost:18090/console/catalog-repositories');
  await reader.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
  check('non-admin UI catalog administration denied');
  await rc.close();
})()
  .catch((e) => {
    let message = String(e.message);
    for (const secret of [input.password, input.labUserPassword].filter(Boolean))
      message = message.split(secret).join('[redacted]');
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (changed && baseline && page) {
      try {
        const current = await setting(),
          doc = document(current);
        if (doc.catalogs[name]) {
          assert.equal(doc.catalogs[name].url, url);
          delete doc.catalogs[name];
        }
        assert.equal(
          hash(doc),
          hash(document(baseline)),
          'Concurrent catalog changes detected; do not reset',
        );
        const r = await page.request.delete('http://localhost:18090/v2-beta/settings/catalog.url', {
          headers: { Accept: 'application/json', 'X-Api-Csrf': await csrf() },
        });
        assert.ok([200, 202, 204].includes(r.status()));
        const restored = await setting();
        assert.equal(restored.inDb, false);
        assert.equal(restored.source, baseline.source);
        assert.equal(restored.value, baseline.value);
        assert.equal(restored.activeValue, baseline.activeValue);
        fs.unlinkSync(manifest);
        check('exact original configuration and source restored without fixtures');
      } catch {
        console.error('Catalog override restoration requires verification; retain manifest');
        process.exitCode = 1;
      }
    }
    if (browser) await browser.close();
  });
