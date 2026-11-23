const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090';
const state = JSON.parse(
  fs.readFileSync(path.join(root, 'console/healthcheck-fixture.json'), 'utf8'),
);
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-health-'));
const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const checks = [],
  audits = [];
let browser,
  context,
  page,
  enabled = true;
function check(check, ok = true) {
  assert.ok(ok, check);
  checks.push({ check, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/healthcheck-e2e-results.json'),
    JSON.stringify(checks, null, 2),
  );
  console.log('PASS: ' + check);
}
async function open(kind = 'Serviço') {
  await page.getByText('Criar', { exact: true }).click();
  await page.getByRole('button', { name: kind, exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: kind === 'Serviço' ? 'Criar serviço' : 'Criar container avulso',
    exact: true,
  });
  await dialog.waitFor();
  await dialog
    .getByLabel(/^Nome ?\*?$/)
    .first()
    .fill('health-preview');
  await dialog.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
  if (kind === 'Serviço')
    await dialog.getByLabel('Stack *', { exact: true }).selectOption(state.stack);
  await dialog.getByText('Saúde', { exact: true }).click();
  return dialog;
}
async function fill(dialog, mode) {
  await dialog.getByLabel('Tipo de verificação', { exact: true }).selectOption(mode);
  if (mode !== 'none') {
    await dialog.getByLabel('Porta da verificação', { exact: true }).fill('8080');
    if (mode === 'http') {
      await dialog.getByLabel('Caminho da verificação HTTP', { exact: true }).fill('/ready');
      await dialog.getByLabel('Versão HTTP', { exact: true }).selectOption('HTTP/1.1');
      await dialog.getByLabel('Host HTTP (opcional)', { exact: true }).fill('health.invalid');
    }
    await dialog.getByText('Tempos e política de recuperação', { exact: true }).click();
  }
}
async function close() {
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
async function theme(value) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const button = page.getByRole('button', {
    name: value === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await button.count()) await button.click();
  await page.waitForFunction((v) => document.documentElement.dataset.theme === v, value);
}
async function read(path) {
  const r = await page.request.get(origin + '/v2-beta/' + path, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
(async () => {
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
      json: { ...cfg, modules: { ...cfg.modules, workloadHealthChecks: enabled } },
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
  for (const kind of ['Serviço', 'Container avulso'])
    for (const mode of ['dark', 'light'])
      for (const width of [1440, 390]) {
        await theme(mode);
        const dialog = await open(kind);
        await fill(dialog, 'http');
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
            impact: v.impact,
            targets: v.nodes.flatMap((n) => n.target).map(String),
          })),
        );
        const appliedTheme = await page.locator('html').getAttribute('data-theme'),
          overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
        audits.push({ kind, mode, appliedTheme, width, violations, overflow });
        fs.writeFileSync(
          path.join(root, 'console/healthcheck-a11y-results.json'),
          JSON.stringify(audits, null, 2),
        );
        assert.equal(appliedTheme, mode);
        assert.deepEqual(violations, []);
        assert.equal(overflow, false);
        check(`${kind} health form ${mode} ${width}`);
        await page.screenshot({
          path: path.join(
            root,
            'evidence/e2e-isolated',
            `healthcheck-${kind === 'Serviço' ? 'service' : 'container'}-${mode}-${width}.png`,
          ),
          mask: [dialog.locator('input[type=password]')],
          animations: 'disabled',
        });
        await close();
      }
  await theme('dark');
  for (const mode of ['tcp', 'http', 'none']) {
    const dialog = await open();
    await dialog
      .getByLabel(/^Nome ?\*?$/)
      .first()
      .fill('health-' + mode);
    await dialog.getByLabel('Descrição', { exact: true }).fill(state.marker);
    await dialog.getByLabel('Escala', { exact: true }).fill('0');
    await dialog.getByLabel('Iniciar após criação', { exact: true }).uncheck();
    await fill(dialog, mode);
    if (mode === 'http') {
      await dialog
        .getByLabel('Ação quando indisponível', { exact: true })
        .selectOption('recreateOnQuorum');
      await dialog.getByLabel('Quórum de saúde', { exact: true }).fill('2');
    }
    const response = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === '/v2-beta/projects/1a12/services',
    );
    await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
    const r = await response;
    if (![200, 201, 202].includes(r.status())) {
      const failure = await r.json();
      console.log('Native creation rejected:', r.status(), failure.code, failure.fieldName);
    }
    assert.ok([200, 201, 202].includes(r.status()));
    const created = await r.json();
    await dialog.waitFor({ state: 'hidden' });
    let service;
    for (let i = 0; i < 60; i++) {
      service = await read('projects/1a12/services/' + created.id);
      if (service.state === 'inactive') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(service.scale, 0);
    assert.equal(service.state, 'inactive');
    assert.equal(service.stackId, state.stack);
    assert.equal(service.description, state.marker);
    const hc = service.launchConfig.healthCheck;
    if (mode === 'none') assert.ok(hc == null);
    else {
      assert.equal(hc.port, 8080);
      assert.equal(hc.interval, 2000);
      if (mode === 'http') {
        assert.equal(hc.requestLine, 'GET "/ready" "HTTP/1.1\\r\\nHost: health.invalid"');
        assert.equal(hc.strategy, 'recreateOnQuorum');
        assert.equal(hc.recreateOnQuorumStrategyConfig.quorum, 2);
      } else assert.ok(!hc.requestLine);
    }
    assert.equal(
      (await read('projects/1a12/services/' + created.id + '/instances')).data.filter(
        (v) => !v.removed,
      ).length,
      0,
    );
    check(mode + ': native configuration persists without scheduling containers');
  }
  enabled = false;
  await page.reload();
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  const dialog = await open();
  check(
    'flag off retains generic form',
    (await dialog.getByLabel('Tipo de verificação', { exact: true }).count()) === 0,
  );
  await close();
  check('no uncaught page errors', errors.length === 0);
})()
  .catch((e) => {
    console.error(
      'Healthcheck acceptance failed:',
      e.name,
      String(e.stack)
        .split('\n')
        .filter((v) => v.includes('healthchecks.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
