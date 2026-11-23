const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  checks = [],
  a11y = [];
let browser,
  enabled = true;
function check(label, ok = true) {
  assert.ok(ok, label);
  checks.push({ check: label, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/audit-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + label);
}
async function context() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await c.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (
      !['GET', 'HEAD'].includes(route.request().method()) &&
      u.pathname !== '/v2-beta/token' &&
      u.origin !== 'http://localhost:18081'
    )
      throw new Error('Audit acceptance forbids business writes');
    return route.continue();
  });
  await c.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, audit: enabled } },
    });
  });
  return c;
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await context(),
    page = await c.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/audit?env=1a12');
  await page.getByRole('heading', { name: 'Auditoria', exact: true }).waitFor();
  await page
    .getByRole('button', { name: /Detalhes do evento/ })
    .first()
    .waitFor();
  check('admin loads real audit page and records without fetching entire history');
  const more = page.getByRole('button', { name: 'Mais eventos', exact: true });
  assert.ok(await more.isEnabled());
  await more.click();
  await page.getByText('Página 2', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: /Detalhes do evento/ })
    .first()
    .waitFor();
  check('native audit cursor advances and preserves bounded page');
  await page.getByRole('button', { name: 'Eventos anteriores', exact: true }).click();
  await page.getByText('Página 1', { exact: true }).waitFor();
  await page.getByLabel('Filtrar por conta autenticada', { exact: true }).fill('1a1');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  const filtered = await page.request.get(
    'http://localhost:18090/v2-beta/auditlogs?authenticatedAsAccountId=1a1&limit=100',
    { headers: { Accept: 'application/json' } },
  );
  assert.equal(filtered.status(), 200);
  const data = await filtered.json();
  check(
    'native authenticated account filter returns only matching audit events',
    data.data.every((v) => v.authenticatedAsAccountId === '1a1'),
  );
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = page.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page
        .getByRole('button', { name: /Detalhes do evento/ })
        .first()
        .click();
      await page.getByRole('dialog', { name: 'Detalhes do evento', exact: true }).waitFor();
      check(
        `no opaque audit bodies rendered ${theme} ${width}`,
        !(await page.getByRole('dialog').innerText()).match(/requestObject|responseObject/),
      );
      await page.screenshot({
        path: path.join(root, 'evidence/e2e-isolated', `audit-${theme}-${width}.png`),
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
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      a11y.push({ theme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/audit-a11y-results.json'),
        JSON.stringify(a11y, null, 2) + '\n',
      );
      assert.equal(violations.length, 0);
      assert.equal(overflow, false);
      await page.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
      check(`audit keyboard themes accessibility and layout ${theme} ${width}`);
    }
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('audit flag blocks direct URL');
  await c.close();
  enabled = true;
  const rc = await context(),
    reader = await rc.newPage();
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  const own = await reader.request.get('http://localhost:18090/v2-beta/auditlogs?limit=100', {
    headers: { Accept: 'application/json' },
  });
  assert.equal(own.status(), 200);
  const ownPage = await own.json();
  check(
    'native reader audit is restricted to its account',
    !ownPage.pagination?.next && ownPage.data.every((v) => v.accountId === '1a10'),
  );
  const other = await reader.request.get(
    'http://localhost:18090/v2-beta/auditlogs?accountId=1a1&limit=100',
    { headers: { Accept: 'application/json' } },
  );
  check(
    'native reader cannot filter into administrator audit',
    other.status() === 200 && (await other.json()).data.length === 0,
  );
  await reader.goto('http://localhost:18090/console/audit');
  await reader.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
  check('non-admin direct audit route denied');
  await rc.close();
})()
  .catch((e) => {
    let msg = String(e.message);
    for (const s of [input.password, input.labUserPassword].filter(Boolean))
      msg = msg.split(s).join('[redacted]');
    console.error(msg);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
