const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const checks = [],
  audits = [];
let browser,
  page,
  context,
  enabled = true,
  activation = true,
  driverId = null,
  genericTouched = false;
const name = 'consolefixture' + require('node:crypto').randomBytes(5).toString('hex'),
  url = 'http://127.0.0.1:9/docker-machine-driver-' + name;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/machine-drivers-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function readDrivers() {
  const r = await page.request.get('http://localhost:18090/v2-beta/machinedrivers?limit=100', {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return (await r.json()).data;
}
async function selectTheme(theme) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const button = page.getByRole('button', {
    name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await button.count()) await button.click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
}
async function audit(view, theme, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const button = page.getByRole('button', {
    name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await button.count()) await button.click();
  await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
  const appliedTheme = await page.locator('html').getAttribute('data-theme');
  await page.screenshot({
    path: path.join(root, 'evidence/e2e-isolated', `drivers-${view}-${theme}-${width}.png`),
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  audits.push({ view, theme, appliedTheme, width, violations, overflow });
  fs.writeFileSync(
    path.join(root, 'console/machine-drivers-a11y-results.json'),
    JSON.stringify(audits, null, 2) + '\n',
  );
  assert.deepEqual(violations, []);
  assert.equal(overflow, false);
  check(`${view} accessibility and layout ${theme} ${width}`);
}
async function csrf() {
  return (await context.cookies()).find((c) => c.name === 'CSRF')?.value || '';
}
async function waitDriver(test) {
  for (let i = 0; i < 40; i++) {
    const rows = await readDrivers(),
      row = rows.find((v) => v.name === name);
    if (test(row)) return row;
    await page.waitForTimeout(300);
  }
  throw new Error('Fixture transition did not complete');
}
async function menu(label) {
  await page.getByRole('button', { name: 'Ações do driver ' + name, exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    return ['http://localhost:18090', 'http://localhost:18081'].includes(u.origin)
      ? route.continue()
      : route.abort();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: {
        ...cfg,
        modules: { ...cfg.modules, machineDrivers: enabled, driverActivation: activation },
      },
    });
  });
  page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/drivers?env=1a12');
  await page.getByRole('region', { name: 'Drivers de máquinas', exact: true }).waitFor();
  const before = await readDrivers();
  check('real driver inventory matches native API', before.length >= 14);
  await page.getByLabel('Atualizar drivers automaticamente (5 s)', { exact: true }).uncheck();
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) await audit('inventory', theme, width);
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await selectTheme(theme);
      await page.getByRole('button', { name: 'Adicionar driver', exact: true }).click();
      await page.getByLabel('Mostrar URLs e checksum', { exact: true }).check();
      await page.getByLabel('URL do binário', { exact: true }).fill(url);
      await page.getByLabel('Descrição (opcional)', { exact: true }).fill(name);
      await page.getByLabel('Mostrar URLs e checksum', { exact: true }).uncheck();
      await audit('editor', theme, width);
      if (theme !== 'light' || width !== 390) {
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page
          .getByRole('heading', { name: 'Descartar alterações do driver?', exact: true })
          .waitFor();
        await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
      }
    }
  await page.getByRole('button', { name: 'Revisar driver', exact: true }).click();
  check(
    'review remasks binary URL',
    (await page.getByLabel('URL do binário', { exact: true }).getAttribute('type')) === 'password',
  );
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Salvar driver?', exact: true })
    .waitFor({ state: 'hidden' });
  let row = await waitDriver((v) => v && ['inactive', 'error'].includes(v.state));
  driverId = row.id;
  check(
    'UI creates custom driver with inactive requested',
    row.builtin === false && row.name === name,
  );
  // Search and contextual edit in place, without traversing detail routes.
  const search = page.getByPlaceholder('Buscar nesta lista…');
  await search.fill(name);
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await menu('Editar driver');
  await page.getByLabel('Descrição (opcional)', { exact: true }).fill(name + ' edited');
  await page.getByRole('button', { name: 'Revisar driver', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Salvar driver?', exact: true })
    .waitFor({ state: 'hidden' });
  row = await waitDriver(
    (v) => v && v.description === name + ' edited' && ['inactive', 'error'].includes(v.state),
  );
  check(
    'UI edit persists metadata in same environment route',
    new URL(page.url()).searchParams.get('env') === '1a12',
  );
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await menu('Editar driver');
  await page.getByLabel('Descrição (opcional)', { exact: true }).fill('discard me');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Descartar alterações do driver?', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  check(
    'discard keeps persisted description',
    (await readDrivers()).find((v) => v.id === driverId).description === name + ' edited',
  );
  await menu('Remover driver');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Remover driver?', exact: true })
    .waitFor({ state: 'hidden' });
  await waitDriver((v) => !v);
  ((driverId = null), (genericTouched = false));
  check('UI removes exact custom fixture');
  const after = await readDrivers(),
    fields = [
      'id',
      'name',
      'state',
      'builtin',
      'url',
      'uiUrl',
      'checksum',
      'description',
      'externalId',
    ];
  const signature = (rows) =>
    JSON.stringify(
      rows
        .map((v) => Object.fromEntries(fields.map((k) => [k, v[k]])))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  check('all preexisting drivers preserved', signature(before) === signature(after));
  const machines = await page.request.get('http://localhost:18090/v2-beta/machines?limit=100', {
    headers: { Accept: 'application/json' },
  });
  assert.equal(machines.status(), 200);
  assert.equal((await machines.json()).data.length, 0);
  await page.getByPlaceholder('Buscar nesta lista…').fill('generic');
  const genericBefore = (await readDrivers()).find((v) => v.id === '1md8');
  assert.equal(genericBefore.name, 'generic');
  assert.equal(genericBefore.builtin, true);
  assert.equal(genericBefore.state, 'inactive');
  genericTouched = true;
  for (const [label, state] of [
    ['Ativar driver', 'active'],
    ['Reativar driver', 'active'],
    ['Desativar driver', 'inactive'],
  ]) {
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await page.getByRole('button', { name: 'Ações do driver generic', exact: true }).click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page
      .getByRole('heading', { name: label.replace(' driver', '') + ' driver?', exact: true })
      .waitFor({ state: 'hidden' });
    let current;
    for (let i = 0; i < 30; i++) {
      current = (await readDrivers()).find((v) => v.id === '1md8');
      if (current.state === state) break;
      await page.waitForTimeout(300);
    }
    assert.equal(current.state, state);
    check('UI ' + label + ' builtin generic');
  }
  check(
    'generic configuration and initial state restored',
    signature([genericBefore]) === signature([(await readDrivers()).find((v) => v.id === '1md8')]),
  );
  genericTouched = false;
  activation = false;
  await page.reload();
  await page.getByRole('region', { name: 'Drivers de máquinas', exact: true }).waitFor();
  await page.getByPlaceholder('Buscar nesta lista…').fill('generic');
  check(
    'activation flag removes write actions',
    await page.getByRole('button', { name: 'Ações do driver generic', exact: true }).isDisabled(),
  );
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('module flag blocks direct driver route');
  const rc = await browser.newContext(),
    reader = await rc.newPage();
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  await reader.goto('http://localhost:18090/console/drivers');
  await reader.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
  check('non-admin UI driver management denied');
  await rc.close();
})()
  .catch((e) => {
    let message = String(e.message);
    for (const secret of [input.password, input.labUserPassword].filter(Boolean))
      message = message.split(secret).join('[redacted]');
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (page && context) {
      try {
        if (genericTouched) {
          const v = (await readDrivers()).find((v) => v.id === '1md8');
          assert.equal(v.name, 'generic');
          assert.equal(v.builtin, true);
          if (v.state !== 'inactive') {
            assert.ok(v.actions.deactivate);
            const r = await page.request.post(
              'http://localhost:18090/v2-beta/machinedrivers/1md8?action=deactivate',
              { headers: { Accept: 'application/json', 'X-Api-Csrf': await csrf() }, data: {} },
            );
            assert.ok([200, 201, 202].includes(r.status()));
          }
          for (let i = 0; i < 30; i++) {
            if ((await readDrivers()).find((v) => v.id === '1md8').state === 'inactive') {
              genericTouched = false;
              break;
            }
            await page.waitForTimeout(300);
          }
          assert.equal(genericTouched, false);
        }

        const rows = await readDrivers();
        for (const v of rows.filter((v) => v.name === name)) {
          assert.equal(v.url, url);
          assert.equal(v.builtin, false);
          const r = await page.request.delete(
            'http://localhost:18090/v2-beta/machinedrivers/' + v.id,
            { headers: { Accept: 'application/json', 'X-Api-Csrf': await csrf() } },
          );
          assert.ok([200, 202, 204].includes(r.status()));
        }
        await waitDriver((v) => !v);
      } catch {
        console.error('Exact fixture cleanup requires verification: ' + name);
        process.exitCode = 1;
      }
    }
    if (browser) await browser.close();
  });
