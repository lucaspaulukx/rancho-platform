const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090';
const state = JSON.parse(fs.readFileSync(path.join(root, 'console/sidecars-fixture.json'), 'utf8'));
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-sidecars-'));
const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const checks = [],
  audits = [];
let browser,
  page,
  enabled = true;
function check(check, ok = true) {
  assert.ok(ok, check);
  checks.push({ check, status: 'passed' });
  console.log('PASS: ' + check);
  fs.writeFileSync(
    path.join(root, 'console/sidecars-e2e-results.json'),
    JSON.stringify(checks, null, 2),
  );
}
async function open() {
  await page.getByText('Criar', { exact: true }).click();
  await page.getByRole('button', { name: 'Serviço', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar serviço', exact: true });
  await dialog.waitFor();
  await dialog
    .getByLabel(/^Nome ?\*?$/)
    .first()
    .fill('sidecar-web');
  await dialog.getByLabel('Imagem *', { exact: true }).first().fill('alpine:3.20');
  await dialog.getByLabel('Stack *', { exact: true }).selectOption(state.stack);
  await dialog.getByLabel('Descrição', { exact: true }).fill(state.marker);
  await dialog.getByLabel('Escala', { exact: true }).fill('0');
  await dialog.getByLabel('Iniciar após criação', { exact: true }).uncheck();
  await dialog
    .locator('summary')
    .filter({ hasText: /^Sidecars/ })
    .click();
  return dialog;
}
async function fill(dialog) {
  for (const [index, name, image] of [
    [1, 'worker', 'busybox:1.36'],
    [2, 'cache', 'alpine:3.20'],
  ]) {
    await dialog.getByRole('button', { name: 'Adicionar sidecar', exact: true }).click();
    const group = dialog.getByRole('group', {
      name: new RegExp('^Sidecar ' + index + '(?: · .*)?$'),
    });
    await group.getByLabel('Nome *', { exact: true }).fill(name);
    await group.getByLabel('Imagem *', { exact: true }).fill(image);
    if (index === 1) {
      await group.getByText('Saúde', { exact: true }).click();
      await group.getByLabel('Tipo de verificação', { exact: true }).selectOption('http');
      await group.getByLabel('Porta da verificação', { exact: true }).fill('8080');
      await group.getByLabel('Caminho da verificação HTTP', { exact: true }).fill('/worker');
    }
  }
}
async function close() {
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
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
      json: { ...cfg, modules: { ...cfg.modules, workloadSidecars: enabled } },
    });
  });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.name));
  await page.goto(origin + '/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto(origin + '/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  for (const mode of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const toggle = page.getByRole('button', {
        name: mode === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page.waitForFunction((v) => document.documentElement.dataset.theme === v, mode);
      const dialog = await open();
      await fill(dialog);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
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
        ).violations.map((v) => ({
          id: v.id,
          targets: v.nodes.flatMap((n) => n.target).map(String),
        })),
      );
      const appliedTheme = await page.locator('html').getAttribute('data-theme'),
        overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      audits.push({ mode, appliedTheme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/sidecars-a11y-results.json'),
        JSON.stringify(audits, null, 2),
      );
      assert.equal(appliedTheme, mode);
      assert.deepEqual(violations, []);
      assert.equal(overflow, false);
      check(`sidecars accessibility/layout ${mode} ${width}`);
      await page.screenshot({
        path: path.join(root, 'evidence/e2e-isolated', `sidecars-${mode}-${width}.png`),
        mask: [dialog.locator('input[type=password]')],
        animations: 'disabled',
      });
      await close();
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const dialog = await open();
  await fill(dialog);
  const worker = dialog.getByRole('group', { name: 'Sidecar 1 · worker', exact: true }),
    cache = dialog.getByRole('group', { name: /^Sidecar 2(?: · .*)?$/ });
  await cache.getByLabel('Nome *', { exact: true }).fill('worker');
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  await dialog.getByText(/Use nomes únicos de sidecar/).waitFor();
  check('duplicate sidecar names rejected before native write');
  await cache.getByLabel('Nome *', { exact: true }).fill('cache');
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === '/v2-beta/projects/1a12/services',
  );
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  const r = await response;
  assert.ok([200, 201, 202].includes(r.status()));
  const created = await r.json();
  await dialog.waitFor({ state: 'hidden' });
  let service;
  for (let i = 0; i < 60; i++) {
    const rr = await page.request.get(origin + '/v2-beta/projects/1a12/services/' + created.id, {
      headers: { Accept: 'application/json' },
    });
    assert.equal(rr.status(), 200);
    service = await rr.json();
    if (service.state === 'inactive') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  check(
    'two sidecars persisted on inactive zero-scale service',
    service.state === 'inactive' &&
      service.scale === 0 &&
      service.secondaryLaunchConfigs.length === 2 &&
      service.stackId === state.stack,
  );
  const persisted = service.secondaryLaunchConfigs.find((v) => v.name === 'worker');
  check(
    'nested healthcheck persists with normalized image',
    persisted.imageUuid === 'docker:busybox:1.36' &&
      persisted.healthCheck.port === 8080 &&
      persisted.healthCheck.requestLine === 'GET "/worker" "HTTP/1.0"',
  );
  check(
    'environment and stack search preserved',
    new URL(page.url()).searchParams.get('env') === '1a12' &&
      (await page.getByLabel('Buscar na operação', { exact: true }).inputValue()) === state.name,
  );
  enabled = false;
  await page.reload();
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  const disabled = await open();
  check(
    'flag off keeps native JSON fallback',
    (await disabled.getByRole('button', { name: 'Adicionar sidecar', exact: true }).count()) === 0,
  );
  await close();
  check('no uncaught page errors', errors.length === 0);
})()
  .catch((e) => {
    console.error(
      'Sidecar acceptance failed:',
      e.name,
      String(e.stack)
        .split('\n')
        .filter((v) => v.includes('sidecars.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
