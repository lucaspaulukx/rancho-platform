const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  state = JSON.parse(
    fs.readFileSync(path.join(root, 'console/config-upgrade-fixture.json'), 'utf8'),
  ),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  checks = [],
  a11y = [];
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-config-upgrade-'));
assert.equal(state.marker, 'Disposable zero-scale config upgrade ' + state.name);
let browser,
  page,
  enabled = true;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/scheduling-upgrade-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
const servicePath = '/v2-beta/projects/1a12/services/' + state.service;
async function read() {
  const response = await page.request.get('http://localhost:18090' + servicePath, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(response.status(), 200);
  return response.json();
}
async function wait(predicate) {
  for (let i = 0; i < 120; i++) {
    const v = await read();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Native configuration upgrade did not stabilize');
}
async function open() {
  await page.getByRole('button', { name: 'Ações de config-web', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Atualizar serviço', exact: true }).click();
  await page.getByLabel('Nova imagem', { exact: true }).waitFor();
}
async function draft() {
  await open();
  await page.getByLabel('Editar afinidades nesta atualização', { exact: true }).check();
  await page.getByRole('button', { name: 'Adicionar afinidade', exact: true }).click();
  const row = page.getByRole('group', { name: 'Afinidade 1', exact: true });
  await row.getByLabel('Chave da label', { exact: true }).fill('disk');
  await row.getByLabel('Valor da label', { exact: true }).fill('ssd');
}
async function closeDraft() {
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Descartar rascunho?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
}
async function upgrade() {
  await draft();
  await page.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Atualizar configuração do serviço?', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await wait((v) => v.state === 'upgraded');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
}
async function native(label) {
  await page.getByRole('button', { name: 'Ações de config-web', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  await wait((v) => v.state === 'active');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) => {
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
      assert.equal(u.pathname.replace(/\/$/, ''), servicePath);
      assert.ok(['upgrade', 'rollback', 'finishupgrade'].includes(u.searchParams.get('action')));
    }
    return route.continue();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, workloadSchedulingUpgrades: enabled } },
    });
  });
  page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = page.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await draft();
      await page.screenshot({
        path: path.join(root, 'evidence/e2e-isolated', `scheduling-upgrade-${theme}-${width}.png`),
        animations: 'disabled',
      });
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
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      const appliedTheme = await page.locator('html').getAttribute('data-theme');
      assert.equal(appliedTheme, theme);
      a11y.push({ theme, appliedTheme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/scheduling-upgrade-a11y-results.json'),
        JSON.stringify(a11y, null, 2) + '\n',
      );
      assert.equal(violations.length, 0);
      assert.equal(overflow, false);
      await closeDraft();
      check(`structured upgrade form themes accessibility and discard ${theme} ${width}`);
    }
  const before = await read();
  assert.equal(before.scale, 0);
  assert.equal(before.state, 'active');
  assert.equal(before.description, state.marker);
  await upgrade();
  const after = await read();
  check(
    'native scheduling upgrade keeps image and persists affinity',
    after.launchConfig.imageUuid === before.launchConfig.imageUuid &&
      after.launchConfig.labels?.['io.rancher.scheduler.affinity:host_label'] === 'disk=ssd',
  );
  check(
    'upgrade preserves environment command network mode sidecars and zero scale',
    ['environment', 'command', 'networkMode', 'ports', 'dataVolumes'].every(
      (k) => JSON.stringify(after.launchConfig[k]) === JSON.stringify(before.launchConfig[k]),
    ) &&
      JSON.stringify(after.secondaryLaunchConfigs) ===
        JSON.stringify(before.secondaryLaunchConfigs) &&
      after.scale === 0,
  );
  check(
    'operation context preserves environment search and route',
    (await page.getByLabel('Buscar na operação', { exact: true }).inputValue()) === state.name &&
      new URL(page.url()).searchParams.get('env') === '1a12' &&
      new URL(page.url()).pathname === '/console/stacks',
  );
  await native('Reverter atualização');
  const rolled = await read();
  check(
    'native rollback restores prior labels and bindings',
    ['ports', 'dataVolumes', 'imageUuid', 'labels'].every(
      (k) => JSON.stringify(rolled.launchConfig[k]) === JSON.stringify(before.launchConfig[k]),
    ),
  );
  await upgrade();
  await native('Concluir atualização');
  const finished = await read();
  check(
    'finish upgrade commits configuration with unchanged scale',
    finished.scale === 0 &&
      finished.state === 'active' &&
      finished.launchConfig.labels?.['io.rancher.scheduler.affinity:host_label'] === 'disk=ssd',
  );
  await open();
  await page.getByLabel('Editar afinidades nesta atualização', { exact: true }).check();
  check(
    'existing affinity is decoded without resetting rule',
    (await page.getByLabel('Chave da label', { exact: true }).inputValue()) === 'disk' &&
      (await page.getByLabel('Valor da label', { exact: true }).inputValue()) === 'ssd',
  );
  await page.getByRole('button', { name: 'Remover afinidade 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await wait((v) => v.state === 'upgraded');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  check(
    'native upgrade removes affinity from persisted labels',
    !(await read()).launchConfig.labels?.['io.rancher.scheduler.affinity:host_label'],
  );
  await native('Concluir atualização');
  const removed = await read();
  check(
    'affinity removal preserves ports volumes image and zero scale',
    ['ports', 'dataVolumes', 'imageUuid'].every(
      (k) => JSON.stringify(removed.launchConfig[k]) === JSON.stringify(before.launchConfig[k]),
    ) &&
      removed.scale === 0 &&
      !removed.launchConfig.labels?.['io.rancher.scheduler.affinity:host_label'],
  );
  assert.deepEqual(removed.launchConfig.labels || {}, before.launchConfig.labels || {});
  check('other labels are preserved exactly after affinity removal');
  enabled = false;
  await page.reload();
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  await open();
  check(
    'flag off retains original image upgrade and hides scheduling editor',
    (await page.getByLabel('Editar afinidades nesta atualização', { exact: true }).count()) === 0,
  );
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await context.close();
  const rc = await browser.newContext(),
    reader = await rc.newPage();
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  const denied = await reader.request.post(
    'http://localhost:18090' + servicePath + '?action=upgrade',
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
      data: {},
    },
  );
  check(
    'user without fixture environment cannot submit configuration upgrade',
    [403, 404].includes(denied.status()),
  );
  await rc.close();
})()
  .catch(async (e) => {
    if (page)
      await page
        .screenshot({
          path: path.join(root, 'evidence/e2e-isolated/scheduling-upgrade-failure.png'),
          animations: 'disabled',
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
