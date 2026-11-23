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
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  let writes = 0;
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(url.origin))
      return route.abort();
    if (!['GET', 'HEAD'].includes(route.request().method()) && url.pathname !== '/v2-beta/token') {
      writes++;
      return route.abort();
    }
    return route.continue();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({
      response,
      json: { ...config, modules: { ...config.modules, workloadBindingEditors: true } },
    });
  });
  const page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto('http://localhost:18090/console/stacks?env=1a12');
      await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
      const toggle = page.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page.getByText('Criar', { exact: true }).click();
      await page.getByRole('button', { name: 'Container avulso', exact: true }).click();
      await page.getByRole('dialog', { name: 'Criar container avulso', exact: true }).waitFor();
      await page.getByLabel(/^Nome ?\*?$/).fill('preview-only');
      await page.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
      await page.getByText('Rede', { exact: true }).click();
      await page.getByRole('button', { name: 'Adicionar porta', exact: true }).click();
      await page.getByLabel('Porta do container 1', { exact: true }).fill('8080');
      await page.getByLabel('Porta no host 1', { exact: true }).fill('18089');
      await page.getByText('Armazenamento', { exact: true }).click();
      await page.getByRole('button', { name: 'Adicionar volume', exact: true }).click();
      await page.getByLabel('Origem do volume 1', { exact: true }).fill('/tmp');
      await page.getByLabel('Destino do volume 1', { exact: true }).fill('/fixture');
      await page.getByLabel('Acesso do volume 1', { exact: true }).selectOption('ro');
      const focusVisible = await page.evaluate(() => {
        const element = document.activeElement;
        const body = element?.closest('.dialog-body');
        if (!body) return false;
        const rect = element.getBoundingClientRect(),
          clip = body.getBoundingClientRect();
        return rect.top >= clip.top + 2 && rect.bottom <= clip.bottom - 2;
      });
      assert.ok(focusVisible, 'Focused field must stay fully inside the scrollable drawer body');
      await page.screenshot({
        path: path.join(root, 'evidence/e2e-isolated', `binding-form-${theme}-${width}.png`),
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
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      reports.push({ theme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/binding-form-themes-results.json'),
        JSON.stringify(reports, null, 2) + '\n',
      );
      assert.equal(violations.length, 0);
      assert.equal(overflow, false);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.getByRole('dialog', { name: 'Descartar rascunho?', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
      console.log(
        'PASS: binding form ' + theme + ' ' + width + ' accessibility layout and discard',
      );
    }
  assert.equal(writes, 0);
  console.log('PASS: preview matrix performed no business writes');
  await context.close();
})()
  .catch((error) => {
    console.error(String(error.message).split(input.password).join('[redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
