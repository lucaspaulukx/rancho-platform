// Artifact loading and shared shell regression. This does not accept CRUD or native feature parity.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090';
const routes = [
  '/',
  '/environments',
  '/stacks',
  '/services',
  '/containers',
  '/hosts',
  '/volumes',
  '/registries',
  '/secrets',
  '/certificates',
  '/catalog',
  '/groups',
  '/users',
  '/audit',
  '/processes',
  '/catalog-repositories',
  '/drivers',
  '/ha',
  '/settings',
  '/api-keys',
  '/webhooks',
];
let browser;
const results = [],
  errors = [],
  assets = [];
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!['GET', 'HEAD'].includes(request.method())) assert.equal(url.pathname, '/v2-beta/token');
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/console/assets/') && !response.ok())
      assets.push(response.status());
  });
  await page.goto(origin + '/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(origin + '/console' + route + '?env=1a12');
      if (width === 390)
        await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
      await page.getByLabel('Navegação principal', { exact: true }).waitFor();
      if (width === 390) {
        await page
          .getByRole('dialog', { name: 'Navegação principal', exact: true })
          .getByRole('button', { name: 'Fechar navegação', exact: true })
          .click();
        await page.getByRole('button', { name: 'Abrir navegação', exact: true }).waitFor();
      }
      await page.locator('main h1').waitFor();
      await page.waitForTimeout(250);
      const title = await page.locator('main h1').innerText();
      assert.ok(title && !/Não foi possível|indisponível|Acesso negado/i.test(title));
      assert.equal(
        await page.getByRole('button', { name: 'Recarregar console', exact: true }).count(),
        0,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.equal(errors.length, 0);
      assert.equal(assets.length, 0);
      results.push({
        route,
        width,
        status: 'passed',
        headingRendered: true,
        sharedNavigation: true,
        noDocumentOverflow: true,
      });
      console.log('PASS: readonly route ' + route + ' ' + width);
    }
  }
  fs.writeFileSync(
    path.join(root, 'console/routes-readonly-results.json'),
    JSON.stringify(
      {
        status: 'passed',
        scope:
          '21 route deep links x desktop/mobile; no business writes; asset/shell/render/layout only',
        checks: results,
        uncaughtErrors: errors,
        failedAssets: assets,
      },
      null,
      2,
    ),
  );
})()
  .catch((error) => {
    console.error(
      'Readonly route regression failed:',
      error.name,
      String(error.stack)
        .split('\n')
        .filter((line) => line.includes('routes-readonly.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
