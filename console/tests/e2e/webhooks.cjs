const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  fixturePath = path.join(root, 'console/webhooks-fixture.json'),
  state = JSON.parse(fs.readFileSync(fixturePath, 'utf8')),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  checks = [],
  a11y = [],
  redact = [input.password, input.labUserPassword];
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-webhooks-'));
assert.equal(state.marker, 'Disposable native webhooks ' + state.name);
let browser,
  page,
  enabled = true,
  invocations = 0;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/webhooks-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function secret() {
  const field = page.getByLabel('URL de invocação', { exact: true });
  await field.waitFor();
  assert.equal(await field.getAttribute('type'), 'password');
  const value = await field.inputValue();
  redact.push(value);
  const u = new URL(value);
  redact.push(u.searchParams.get('key'));
  assert.equal(u.searchParams.get('projectId'), '1a12');
  return value;
}
async function finishCreate(name) {
  await page.getByRole('button', { name: 'Revisar webhook', exact: true }).click();
  await page.getByRole('dialog', { name: 'Criar webhook?', exact: true }).waitFor();
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && new URL(r.url()).pathname === '/v1-webhooks/receivers',
  );
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const r = await response;
  assert.ok(r.ok());
  const value = await r.json();
  if (value.url) {
    redact.push(value.url);
    redact.push(new URL(value.url).searchParams.get('key'));
  }
  const current = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(current.name, state.name);
  current.receivers.push({ id: value.id, name: value.name, driver: value.driver });
  fs.writeFileSync(fixturePath, JSON.stringify(current, null, 2) + '\n');
  const url = await secret();
  await page.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
  check(name + ' receiver created with protected URL');
  return { id: value.id, name: value.name, url };
}
async function configure(driver) {
  await page.getByRole('button', { name: 'Criar webhook', exact: true }).click();
  await page.getByLabel('Nome do webhook', { exact: true }).fill(state.name + '-' + driver);
  await page.getByLabel('Função do webhook', { exact: true }).selectOption(driver);
  if (driver === 'scaleService')
    await page.getByLabel('Serviço de destino', { exact: true }).selectOption(state.service);
  else {
    await page.getByRole('button', { name: 'Adicionar label', exact: true }).click();
    await page.getByLabel('Label 1: chave', { exact: true }).fill('console.webhook.fixture');
    await page.getByLabel('Label 1: valor', { exact: true }).fill(state.name);
    if (driver === 'serviceUpgrade')
      await page.getByLabel('Tag da imagem', { exact: true }).fill('fixture-never-dispatch');
  }
}
async function remove(row) {
  await page.getByRole('button', { name: 'Ações do webhook ' + row.name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Excluir webhook', exact: true }).click();
  await page.getByRole('dialog', { name: 'Excluir webhook?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Excluir webhook?', exact: true })
    .waitFor({ state: 'hidden' });
  await page
    .getByRole('button', { name: 'Ações do webhook ' + row.name, exact: true })
    .waitFor({ state: 'hidden' });
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await c.route('**/*', (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (u.pathname.replace(/\/$/, '') === '/v1-webhooks/endpoint') {
      invocations++;
      throw new Error('Webhook invocation is forbidden during acceptance');
    }
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (
      !['GET', 'HEAD'].includes(req.method()) &&
      u.origin === 'http://localhost:18090' &&
      u.pathname !== '/v2-beta/token'
    ) {
      assert.equal(u.searchParams.get('projectId'), '1a12');
      assert.ok(
        (req.method() === 'POST' &&
          u.pathname === '/v1-webhooks/receivers' &&
          req.postDataJSON().name.startsWith(state.name + '-')) ||
          (req.method() === 'DELETE' && u.pathname.startsWith('/v1-webhooks/receivers/')),
      );
    }
    return route.continue();
  });
  await c.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, webhooks: enabled } },
    });
  });
  page = await c.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/webhooks?env=1a12');
  await page.getByRole('heading', { name: 'Webhooks', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Criar webhook', exact: true }).waitFor();
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390])
      for (const driver of ['scaleService', 'serviceUpgrade', 'scaleHost']) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        const toggle = page.getByRole('button', {
          name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
          exact: true,
        });
        if (await toggle.count()) await toggle.click();
        await configure(driver);
        await page.screenshot({
          path: path.join(root, 'evidence/e2e-isolated', `webhook-${driver}-${theme}-${width}.png`),
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
        a11y.push({ driver, theme, width, violations, overflow });
        fs.writeFileSync(
          path.join(root, 'console/webhooks-a11y-results.json'),
          JSON.stringify(a11y, null, 2) + '\n',
        );
        assert.equal(violations.length, 0);
        assert.equal(overflow, false);
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page
          .getByRole('dialog', { name: 'Descartar webhook não salvo?', exact: true })
          .waitFor();
        await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
        check(`webhook ${driver} form accessibility layout discard ${theme} ${width}`);
      }
  const rows = [];
  for (const driver of ['scaleService', 'serviceUpgrade', 'scaleHost']) {
    await configure(driver);
    rows.push(await finishCreate(driver));
  }
  const original = rows[0];
  await page
    .getByRole('button', { name: 'Ações do webhook ' + original.name, exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Clonar configuração', exact: true }).click();
  await page.getByLabel('Nome do webhook', { exact: true }).fill(state.name + '-clone');
  rows.push(await finishCreate('cloned'));
  check(
    'clone creates independent receiver credential without reusing the original URL',
    new URL(original.url).searchParams.get('key') !==
      new URL(rows[3].url).searchParams.get('key') && original.id !== rows[3].id,
  );
  await page
    .getByRole('button', { name: 'Ações do webhook ' + original.name, exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Consultar URL protegida', exact: true }).click();
  assert.equal(await secret(), original.url);
  await page.screenshot({
    path: path.join(root, 'evidence/e2e-isolated/webhook-protected-url.png'),
    animations: 'disabled',
    mask: [page.getByLabel('URL de invocação', { exact: true })],
  });
  await page.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
  check('authorized URL lookup is explicit and remains masked');
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  check(
    'invocation credentials are absent from browser storage',
    rows.every(
      (r) => !storage.includes(r.url) && !storage.includes(new URL(r.url).searchParams.get('key')),
    ),
  );
  for (const row of rows) await remove(row);
  check('all exact fixture receivers deleted through the UI');
  check('no webhook invocation was made', invocations === 0);
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('webhooks flag blocks direct route');
  await c.close();
  const rc = await browser.newContext(),
    reader = await rc.newPage();
  await rc.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, webhooks: true } },
    });
  });
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  await reader.goto('http://localhost:18090/console/webhooks?env=1a7');
  await reader
    .getByText(
      'Seu perfil pode consultar os metadados disponíveis. Criação, clonagem, exclusão e URL exigem acesso de gerenciamento comprovado.',
      { exact: true },
    )
    .waitFor();
  check(
    'readonly UI does not expose creation despite static write schemas',
    (await reader.getByRole('button', { name: 'Criar webhook', exact: true }).count()) === 0,
  );
  const denied = await reader.request.post(
    'http://localhost:18090/v1-webhooks/receivers?projectId=1a12',
    {
      headers: {
        Accept: 'application/json',
        'X-Api-Csrf': await reader.evaluate(() =>
          decodeURIComponent(
            document.cookie
              .split('; ')
              .find((v) => v.startsWith('CSRF='))
              ?.slice(5) || '',
          ),
        ),
      },
      data: {
        name: state.name + '-scaleService',
        driver: 'scaleService',
        scaleServiceConfig: {
          type: 'scaleService',
          serviceId: state.service,
          action: 'up',
          amount: 1,
          min: 1,
          max: 2,
        },
      },
    },
  );
  check(
    'user without environment cannot register a receiver with valid payload and CSRF',
    [403, 404, 405].includes(denied.status()),
  );
  await rc.close();
})()
  .catch(async (e) => {
    if (page)
      await page
        .screenshot({
          path: path.join(root, 'evidence/e2e-isolated/webhook-failure.png'),
          animations: 'disabled',
          mask: [page.getByLabel('URL de invocação', { exact: true })],
        })
        .catch(() => {});
    let text = String(e.message);
    for (const s of redact.filter(Boolean)) text = text.split(s).join('[redacted]');
    console.error(text);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
