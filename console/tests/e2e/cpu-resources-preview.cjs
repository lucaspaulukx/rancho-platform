const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  checks = [],
  audits = [],
  origin = 'http://localhost:18090';
let browser,
  enabled = true,
  writes = 0;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  console.log('PASS: ' + name);
}
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
    if (!['GET', 'HEAD'].includes(request.method()) && url.pathname !== '/v2-beta/token') {
      writes++;
      return route.abort();
    }
    return route.continue();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      config = await response.json();
    await route.fulfill({
      response,
      json: { ...config, modules: { ...config.modules, workloadResourceEditors: enabled } },
    });
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await page.goto(origin + '/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto(origin + '/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  async function open(kind) {
    await page.getByText('Criar', { exact: true }).click();
    await page.getByRole('button', { name: kind, exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: kind === 'Serviço' ? 'Criar serviço' : 'Criar container avulso',
      exact: true,
    });
    await dialog
      .getByLabel(/^Nome ?\*?$/)
      .first()
      .fill('cpu-preview');
    await dialog.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
    await dialog.getByText('Recursos', { exact: true }).click();
    return dialog;
  }
  async function close() {
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
  for (const kind of ['Serviço', 'Container avulso'])
    for (const theme of ['dark', 'light'])
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const toggle = page.getByRole('button', {
          name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
          exact: true,
        });
        if (await toggle.count()) await toggle.click();
        await page.waitForFunction(
          (mode) => document.documentElement.dataset.theme === mode,
          theme,
        );
        const dialog = await open(kind);
        await dialog.getByLabel('Período de CPU (µs)', { exact: true }).fill('999');
        assert.equal(
          await dialog
            .getByLabel('Período de CPU (µs)', { exact: true })
            .evaluate((el) => el.checkValidity()),
          false,
        );
        await dialog.getByLabel('Período de CPU (µs)', { exact: true }).fill('100000');
        await dialog.getByLabel('Quota de CPU (µs)', { exact: true }).fill('50000');
        await dialog.getByLabel('Peso de CPU', { exact: true }).fill('512');
        await dialog.getByLabel('CPUs permitidas', { exact: true }).fill('0');
        await dialog.getByLabel('Peso de I/O', { exact: true }).fill('100');
        await dialog.getByLabel('Reserva de CPU (millicores)', { exact: true }).fill('250');
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document
              .getAnimations()
              .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
              .map((a) => a.finished.catch(() => {})),
          );
        });
        await page.evaluate(axe);
        const violations = await page.evaluate(async () =>
          (
            await window.axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
            })
          ).violations.map((v) => ({ id: v.id, impact: v.impact })),
        );
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        audits.push({ kind, theme, width, violations, overflow });
        assert.deepEqual(violations, []);
        assert.equal(overflow, false);
        check(`${kind} CPU/IO fields validation and accessible layout ${theme} ${width}`);
        await page.screenshot({
          path: path.join(
            root,
            'evidence/e2e-isolated',
            `cpu-${kind === 'Serviço' ? 'service' : 'container'}-${theme}-${width}.png`,
          ),
          animations: 'disabled',
        });
        await close();
      }
  enabled = false;
  await page.reload();
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  const dialog = await open('Serviço');
  check(
    'flag off restores generic resource fields without CPU editor hints',
    (await dialog
      .getByText(
        'Peso relativo de 10 a 1.000; zero usa o padrão. Depende do suporte do kernel e não define uma taxa em MB/s.',
        { exact: true },
      )
      .count()) === 0,
  );
  await close();
  check(
    'CPU preview performs no business writes or uncaught errors',
    writes === 0 && errors.length === 0,
  );
  fs.writeFileSync(
    path.join(root, 'console/cpu-resources-preview-results.json'),
    JSON.stringify({ status: 'passed', checks, accessibility: audits }, null, 2),
  );
})()
  .catch((error) => {
    console.error(
      'CPU preview failed:',
      error.name,
      String(error.stack)
        .split('\n')
        .filter((line) => line.includes('cpu-resources-preview.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
