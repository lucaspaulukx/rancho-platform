const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  output = path.join(root, 'console/accessibility-browser-results.json');
const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const reports = [];
let browser, page;
const routes = [
  '/',
  '/stacks',
  '/environments',
  '/groups',
  '/users',
  '/hosts',
  '/volumes',
  '/registries',
  '/secrets',
  '/certificates',
  '/catalog',
];
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(url.origin))
      return route.abort();
    if (!['GET', 'HEAD'].includes(route.request().method()) && url.pathname !== '/v2-beta/token')
      return route.abort();
    return route.continue();
  });
  page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const width of [1440, 390])
    for (const theme of ['dark', 'light'])
      for (const route of routes) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.goto('http://localhost:18090/console' + route + '?env=1a12');
        await page.locator('main h1').waitFor();
        await page.locator('.loading:visible').waitFor({ state: 'hidden', timeout: 20000 });
        const toggle = page.getByRole('button', {
          name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
          exact: true,
        });
        if (await toggle.count()) await toggle.click();
        await page.screenshot({
          path: path.join(
            root,
            'evidence/e2e-isolated',
            `a11y-${route === '/' ? 'overview' : route.slice(1)}-${theme}-${width}.png`,
          ),
          animations: 'disabled',
        });
        await page.evaluate(axe);
        const scan = await page.evaluate(async () => {
          const report = await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          });
          return {
            violations: report.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              targets: v.nodes.flatMap((n) => n.target).map(String),
            })),
            incomplete: report.incomplete.map((v) => ({ id: v.id, count: v.nodes.length })),
          };
        });
        const result = {
          route,
          theme,
          width,
          overflow: await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          ),
          loadErrors: await page.locator('.error-state:visible').count(),
          ...scan,
        };
        reports.push(result);
        fs.writeFileSync(output, JSON.stringify(reports, null, 2) + '\n');
        console.log(
          `${result.violations.length || result.overflow || result.loadErrors ? 'FINDING' : 'PASS'}: ${route} ${theme} ${width} (${result.violations.map((v) => v.id).join(',') || 'no automated violations'})`,
        );
      }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:18090/console/stacks?env=1a12');
  const selector = page.getByRole('button', { name: 'Environment: UI-OPS-LAB', exact: true });
  await selector.click();
  const search = page.getByRole('combobox', { name: 'Buscar environment' });
  await search.fill('RBAC-DEV');
  await search.press('Enter');
  await page.getByRole('button', { name: 'Environment: RBAC-DEV', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Environment: RBAC-DEV', exact: true }).click();
  await page.getByRole('combobox', { name: 'Buscar environment' }).press('Escape');
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Environment: RBAC-DEV',
  );
  reports.push({
    check: 'environment search Enter selection Escape and focus restoration',
    status: 'passed',
  });
  fs.writeFileSync(output, JSON.stringify(reports, null, 2) + '\n');
  console.log('PASS: environment keyboard selection and focus restoration');
  const failed = reports.filter((v) => v.overflow || v.loadErrors || v.violations?.length);
  if (failed.length)
    throw new Error(
      failed.length + ' accessibility/layout scenarios need correction; see sanitized report',
    );
  await context.close();
})()
  .catch((e) => {
    console.error(String(e.message).split(input.password).join('[redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
