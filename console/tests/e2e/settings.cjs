const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  fixture = JSON.parse(fs.readFileSync(path.join(root, 'console/settings-fixture.json'), 'utf8')),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  checks = [],
  a11y = [];
assert.ok(/^console\.lab\.fixture\.[a-f0-9]+$/.test(fixture.name));
let browser,
  page,
  enabled = true;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/settings-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function context() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await c.route('**/*', (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (
      !['GET', 'HEAD'].includes(req.method()) &&
      u.origin === 'http://localhost:18090' &&
      u.pathname !== '/v2-beta/token'
    ) {
      assert.ok(enabled);
      assert.ok(['PUT', 'DELETE'].includes(req.method()));
      assert.equal(decodeURIComponent(u.pathname), '/v2-beta/settings/' + fixture.name);
      if (req.method() === 'PUT')
        assert.deepEqual(req.postDataJSON(), { value: fixture.updatedValue });
    }
    return route.continue();
  });
  await c.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, settings: enabled } },
    });
  });
  return c;
}
async function read(page) {
  const r = await page.request.get('http://localhost:18090/v2-beta/settings/' + fixture.name, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await context(),
    p = await c.newPage();
  page = p;
  await p.goto('http://localhost:18090/console/login');
  await p.getByLabel('Usuário', { exact: true }).fill(input.username);
  await p.getByLabel('Senha', { exact: true }).fill(input.password);
  await p.getByRole('button', { name: 'Entrar com conta local' }).click();
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  await p.goto('http://localhost:18090/console/settings?env=1a12');
  await p.getByRole('heading', { name: 'Configuração do servidor', exact: true }).waitFor();
  await p.getByPlaceholder('Buscar nesta lista…', { exact: true }).fill(fixture.name);
  await p
    .getByRole('button', { name: 'Abrir configuração ' + fixture.name, exact: true })
    .waitFor();
  check(
    'settings list contains metadata without rendering configuration values',
    !(await p.locator('main').innerText()).includes(fixture.value),
  );
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = p.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await p
        .getByRole('button', { name: 'Abrir configuração ' + fixture.name, exact: true })
        .click();
      assert.equal(
        await p.getByLabel('Valor configurado', { exact: true }).getAttribute('type'),
        'password',
      );
      await p.screenshot({
        path: path.join(root, 'evidence/e2e-isolated', `settings-${theme}-${width}.png`),
        animations: 'disabled',
        mask: [
          p.getByLabel('Valor configurado', { exact: true }),
          p.getByLabel('Valor efetivo atual', { exact: true }),
        ],
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
      a11y.push({ theme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/settings-a11y-results.json'),
        JSON.stringify(a11y, null, 2) + '\n',
      );
      assert.equal(violations.length, 0);
      assert.equal(overflow, false);
      await p.getByRole('button', { name: 'Cancelar', exact: true }).click();
      check(`settings editor masked accessibility and layout ${theme} ${width}`);
    }
  await p.getByRole('button', { name: 'Abrir configuração ' + fixture.name, exact: true }).click();
  await p.getByRole('button', { name: 'Mostrar valores', exact: true }).click();
  assert.equal(
    await p.getByLabel('Valor configurado', { exact: true }).inputValue(),
    fixture.value,
  );
  await p.getByLabel('Valor configurado', { exact: true }).fill(fixture.updatedValue);
  await p.getByRole('button', { name: 'Revisar alteração', exact: true }).click();
  await p.getByRole('dialog', { name: 'Alterar configuração do servidor?', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await p
    .getByRole('dialog', { name: 'Alterar configuração do servidor?', exact: true })
    .waitFor({ state: 'hidden' });
  for (let i = 0; i < 40; i++) {
    const value = await read(p);
    if (value.activeValue === fixture.updatedValue) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const updated = await read(p);
  check(
    'multiline setting edit persists configured and effective values',
    updated.value === fixture.updatedValue &&
      updated.activeValue === fixture.updatedValue &&
      updated.inDb === true,
  );
  await p.getByRole('button', { name: 'Abrir configuração ' + fixture.name, exact: true }).click();
  await p.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
  await p.getByRole('dialog', { name: 'Restaurar padrão da configuração?', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await p
    .getByRole('dialog', { name: 'Restaurar padrão da configuração?', exact: true })
    .waitFor({ state: 'hidden' });
  for (let i = 0; i < 40; i++) {
    const value = await read(p);
    if (!value.inDb && value.activeValue == null) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const reset = await read(p);
  check(
    'restore default deletes only fixture DB override',
    !reset.inDb && reset.activeValue == null,
  );
  enabled = false;
  await p.reload();
  await p.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('settings flag blocks direct route');
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
  const denied = await reader.request.get(
    'http://localhost:18090/v2-beta/settings/' + fixture.name,
    { headers: { Accept: 'application/json' } },
  );
  check(
    'native reader cannot read private setting fixture',
    [401, 403, 404].includes(denied.status()),
  );
  await reader.goto('http://localhost:18090/console/settings');
  await reader.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
  check('non-admin direct settings route denied');
  await rc.close();
})()
  .catch(async (e) => {
    if (page)
      await page
        .screenshot({
          path: path.join(root, 'evidence/e2e-isolated/settings-failure.png'),
          animations: 'disabled',
          mask: [
            page.getByLabel('Valor configurado', { exact: true }),
            page.getByLabel('Valor efetivo atual', { exact: true }),
          ],
        })
        .catch(() => {});
    let text = String(e.message);
    for (const s of [input.password, input.labUserPassword].filter(Boolean))
      text = text.split(s).join('[redacted]');
    console.error(text);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
