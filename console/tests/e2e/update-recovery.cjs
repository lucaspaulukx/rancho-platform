const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090';
const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const checks = [],
  failures = [];
let browser;
function check(check, condition = true) {
  assert.ok(condition, check);
  checks.push({ check, status: 'passed' });
  console.log('PASS: ' + check);
  fs.writeFileSync(
    path.join(root, 'console/update-recovery-e2e-results.json'),
    JSON.stringify(checks, null, 2),
  );
}
async function session(blocked, legacy = false) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (!['GET', 'HEAD'].includes(route.request().method()) && u.pathname !== '/v2-beta/token')
      return route.abort();
    if (legacy && u.pathname === '/console/login') {
      const response = await route.fetch();
      const prior = JSON.parse(
        fs.readFileSync(path.join(root, 'console/update-prior-assets.json'), 'utf8'),
      );
      const html = (await response.text()).replace(
        /\/console\/assets\/index-[^"\s]+\.js/,
        prior.entry,
      );
      return route.fulfill({ response, body: html });
    }
    if (blocked.current && new RegExp('/' + blocked.module + '-[\\w-]+\\.js$').test(u.pathname))
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(e.name));
  await page.goto(origin + '/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  return { context, page };
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  for (const test of [
    { module: 'Groups', route: '/groups', title: 'Grupos e permissões' },
    { module: 'ApiKeys', route: '/api-keys', title: 'Chaves de API' },
  ]) {
    const blocked = { module: test.module, current: true };
    const { context, page } = await session(blocked);
    await page.goto(origin + '/console' + test.route + '?env=1a12&keep=recovery');
    await page
      .getByRole('heading', { name: 'Não foi possível carregar esta página', exact: true })
      .waitFor();
    check(
      test.module + ': failed module preserves navigation',
      await page.getByLabel('Navegação principal', { exact: true }).isVisible(),
    );
    check(
      test.module + ': sanitized recovery replaces developer stack',
      !(await page.locator('body').innerText()).includes('Unexpected Application Error'),
    );
    await page.evaluate(axe);
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        })
      ).violations.map((v) => v.id),
    );
    check(test.module + ': recovery accessibility', violations.length === 0);
    const before = page.url();
    await page
      .getByLabel('Navegação principal', { exact: true })
      .locator('a[href*="/audit"]')
      .click();
    await page.getByRole('heading', { name: 'Auditoria', exact: true }).waitFor();
    check(test.module + ': another page remains usable');
    // Revisit the exact scoped URL while the module remains unavailable.
    await page.goto(before);
    await page.getByRole('button', { name: 'Recarregar console', exact: true }).waitFor();
    blocked.current = false;
    const recoveryUrl = page.url();
    await page.getByRole('button', { name: 'Recarregar console', exact: true }).click();
    await page.getByRole('heading', { name: test.title, exact: true }).waitFor();
    check(
      test.module + ': explicit reload restores page and context',
      page.url() === recoveryUrl && new URL(page.url()).searchParams.get('env') === '1a12',
    );
    check(
      test.module + ': initial failed page retained requested context',
      new URL(before).searchParams.get('keep') === 'recovery',
    );
    await context.close();
  }
  const { context, page } = await session({ current: false, module: '' });
  const routes = [
    ['/groups', 'Grupos e permissões'],
    ['/users', 'Usuários'],
    ['/audit', 'Auditoria'],
    ['/processes', 'Processos'],
    ['/catalog-repositories', 'Repositórios de catálogo'],
    ['/drivers', 'Drivers de máquinas'],
    ['/ha', 'HA e membros do cluster'],
    ['/settings', 'Configuração do servidor'],
    ['/api-keys', 'Chaves de API'],
    ['/webhooks', 'Webhooks'],
  ];
  for (const [route, title] of routes) {
    await page
      .getByLabel('Navegação principal', { exact: true })
      .locator('a[href*="' + route + '"]')
      .click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    check(
      'client navigation loads ' + route,
      (await page.getByRole('button', { name: 'Recarregar console', exact: true }).count()) === 0,
    );
  }
  check('no uncaught page errors', failures.length === 0);
  await context.close();
  const previous = await session({ current: false, module: '' }, true);
  for (const [route, title] of [
    ['/groups', 'Grupos e permissões'],
    ['/api-keys', 'Chaves de API'],
  ]) {
    await previous.page
      .getByLabel('Navegação principal', { exact: true })
      .locator('a[href*="' + route + '"]')
      .click();
    await previous.page.getByRole('heading', { name: title, exact: true }).waitFor();
    check(
      'previous build client still loads ' + route,
      !(await previous.page.locator('body').innerText()).includes('Unexpected Application Error'),
    );
  }
  check('previous build has no uncaught page errors', failures.length === 0);
  await previous.context.close();
})()
  .catch((e) => {
    console.error(
      'Recovery acceptance failed:',
      e.name,
      String(e.stack)
        .split('\n')
        .filter((v) => v.includes('update-recovery.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
