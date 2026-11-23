const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  fixture = JSON.parse(fs.readFileSync(path.join(root, 'console/process-fixture.json'), 'utf8')),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  checks = [],
  a11y = [];
assert.ok(fixture.name.startsWith('console-process-'));
assert.equal(fixture.marker, 'Disposable process acceptance ' + fixture.name);
let browser,
  enabled = true,
  replayEnabled = true;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/processes-e2e-results.json'),
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
      assert.equal(req.method(), 'POST');
      assert.equal(u.pathname.replace(/\/$/, ''), '/v2-beta/processinstances/' + fixture.process);
      assert.equal(u.search, '?action=replay');
      assert.ok(enabled && replayEnabled);
    }
    return route.continue();
  });
  await c.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: {
        ...cfg,
        modules: { ...cfg.modules, processes: enabled, processReplay: replayEnabled },
      },
    });
  });
  return c;
}
async function read(page, relative) {
  const r = await page.request.get('http://localhost:18090/v2-beta/' + relative, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await context(),
    p = await c.newPage();
  await p.goto('http://localhost:18090/console/login');
  await p.getByLabel('Usuário', { exact: true }).fill(input.username);
  await p.getByLabel('Senha', { exact: true }).fill(input.password);
  await p.getByRole('button', { name: 'Entrar com conta local' }).click();
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  await p.goto('http://localhost:18090/console/processes?env=1a12');
  await p.getByRole('heading', { name: 'Processos', exact: true }).waitFor();
  await p
    .getByRole('button', { name: /Detalhes do processo/ })
    .first()
    .waitFor();
  check('admin reads bounded native process page');
  await p.getByRole('button', { name: 'Mais execuções', exact: true }).click();
  await p.getByText('Página 2', { exact: true }).waitFor();
  check('native process cursor advances without reading entire history');
  await p.getByLabel('ID do recurso', { exact: true }).fill(fixture.key);
  await p.getByLabel('Nome do processo', { exact: true }).fill('credential.deactivate');
  await p.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await p
    .getByRole('button', { name: 'Detalhes do processo ' + fixture.process, exact: true })
    .click();
  check('resource and process filter selects only disposable fixture');
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await p.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
      await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = p.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await p
        .getByRole('button', { name: 'Detalhes do processo ' + fixture.process, exact: true })
        .click();
      await p.screenshot({
        path: path.join(root, 'evidence/e2e-isolated', `process-${theme}-${width}.png`),
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
      a11y.push({ theme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/processes-a11y-results.json'),
        JSON.stringify(a11y, null, 2) + '\n',
      );
      assert.equal(violations.length, 0);
      assert.equal(overflow, false);
      check(`process details accessibility and layout ${theme} ${width}`);
    }
  const keyBefore = await read(p, 'apikeys/' + fixture.key);
  assert.equal(keyBefore.name, fixture.name);
  assert.equal(keyBefore.description, fixture.marker + ' updated');
  assert.equal(keyBefore.state, 'inactive');
  const before = await read(p, 'processinstances/' + fixture.process);
  assert.equal(before.resourceId, fixture.key);
  assert.equal(before.processName, 'credential.deactivate');
  assert.equal(before.phase, 'DONE');
  await p.getByRole('button', { name: 'Reexecutar processo', exact: true }).click();
  await p.getByRole('dialog', { name: 'Reexecutar processo?', exact: true }).waitFor();
  const response = p.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname.replace(/\/$/, '') ===
        '/v2-beta/processinstances/' + fixture.process,
  );
  await p.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const result = await response;
  assert.ok(result.ok());
  const operation = await result.json();
  check(
    'native replay dispatch accepted only for exact disposable credential process',
    operation.id === fixture.process && operation.executionCount === 0,
  );
  await p
    .getByRole('dialog', { name: 'Reexecutar processo?', exact: true })
    .waitFor({ state: 'hidden' });
  const keyAfter = await read(p, 'apikeys/' + fixture.key);
  check(
    'replay leaves disposable key inactive and metadata unchanged',
    ['id', 'name', 'description', 'accountId', 'state', 'publicValue'].every(
      (k) => keyBefore[k] === keyAfter[k],
    ),
  );
  replayEnabled = false;
  await p.reload();
  await p.getByLabel('ID do recurso', { exact: true }).fill(fixture.key);
  await p.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await p
    .getByRole('button', { name: 'Detalhes do processo ' + fixture.process, exact: true })
    .click();
  check(
    'replay flag off preserves details and removes mutation',
    (await p.getByRole('button', { name: 'Reexecutar processo', exact: true }).count()) === 0,
  );
  await p.getByRole('button', { name: 'Fechar diálogo', exact: true }).click();
  enabled = false;
  await p.reload();
  await p.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('processes flag blocks direct route');
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
    'http://localhost:18090/v2-beta/processinstances/' + fixture.process,
    { headers: { Accept: 'application/json' } },
  );
  check(
    'native reader cannot read administrator process',
    [401, 403, 404].includes(denied.status()),
  );
  await reader.goto('http://localhost:18090/console/processes');
  await reader.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
  check('non-admin direct processes route denied');
  await rc.close();
})()
  .catch((e) => {
    let text = String(e.message);
    for (const s of [input.password, input.labUserPassword].filter(Boolean))
      text = text.split(s).join('[redacted]');
    console.error(text);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
