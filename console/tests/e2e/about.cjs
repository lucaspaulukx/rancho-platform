const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  reports = [];
let browser,
  enabled = true;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await c.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (!['GET', 'HEAD'].includes(route.request().method()) && u.pathname !== '/v2-beta/token')
      throw new Error('About preview forbids business writes');
    return route.continue();
  });
  await c.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, about: enabled } },
    });
  });
  const p = await c.newPage();
  await p.goto('http://localhost:18090/console/login');
  await p.getByLabel('Usuário', { exact: true }).fill(input.username);
  await p.getByLabel('Senha', { exact: true }).fill(input.password);
  await p.getByRole('button', { name: 'Entrar com conta local' }).click();
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const route of ['/stacks?env=1a12', '/audit?env=1a12']) {
    await p.goto('http://localhost:18090/console' + route);
    await p.getByLabel('Menu do usuário', { exact: true }).click();
    await p.getByRole('button', { name: 'Sobre esta console', exact: true }).click();
    await p.getByRole('dialog', { name: 'Sobre esta console', exact: true }).waitFor();
    await p.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
  }
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390])
      for (const tab of ['Produto', 'Capacidades']) {
        await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        const toggle = p.getByRole('button', {
          name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
          exact: true,
        });
        if (await toggle.count()) await toggle.click();
        const menu = p.getByLabel('Menu do usuário', { exact: true });
        if (!(await p.getByRole('button', { name: 'Sobre esta console', exact: true }).isVisible()))
          await menu.click();
        await p.getByRole('button', { name: 'Sobre esta console', exact: true }).click();
        await p.getByRole('tab', { name: tab, exact: true }).click();
        await p.screenshot({
          path: path.join(root, 'evidence/e2e-isolated', `about-${tab}-${theme}-${width}.png`),
          animations: 'disabled',
        });
        await p.evaluate(axe);
        const violations = await p.evaluate(async () =>
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
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        reports.push({ theme, width, tab, violations, overflow });
        fs.writeFileSync(
          path.join(root, 'console/about-e2e-results.json'),
          JSON.stringify(reports, null, 2) + '\n',
        );
        assert.equal(violations.length, 0);
        assert.equal(overflow, false);
        await p.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
        console.log(`PASS: shared about ${tab} ${theme} ${width}`);
      }
  enabled = false;
  await p.reload();
  await p.getByLabel('Menu do usuário', { exact: true }).click();
  assert.equal(await p.getByRole('button', { name: 'Sobre esta console', exact: true }).count(), 0);
  console.log('PASS: about flag removes shared entry point');
  await c.close();
})()
  .catch((e) => {
    console.error(String(e.message).split(input.password).join('[redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
