const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8')),
  state = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../stack-compose-upgrade-fixture.json'), 'utf8'),
  );
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  stackPath = '/v2-beta/projects/1a12/stacks/' + state.stack,
  servicePath = '/v2-beta/projects/1a12/services/' + state.service,
  checks = [],
  audits = [];
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-stack-compose-'));
let browser,
  page,
  enabled = true;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/stack-compose-upgrade-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function read(target = stackPath) {
  const r = await page.request.get('http://localhost:18090' + target, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
async function wait(target, test) {
  for (let i = 0; i < 90; i++) {
    const v = await read(target);
    if (test(v)) return v;
    await page.waitForTimeout(400);
  }
  throw new Error('Native Compose transition did not complete');
}
async function open() {
  await page.getByRole('button', { name: 'Ações de ' + state.name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Atualizar stack', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Atualizar Compose · ' + state.name, exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Mostrar Docker Compose', exact: true }).waitFor();
}
async function draft() {
  await open();
  await page.getByRole('button', { name: 'Mostrar Docker Compose', exact: true }).click();
  const field = page.getByLabel('Docker Compose', { exact: true }),
    text = await field.inputValue();
  assert.ok(text.includes('alpine:3.20'));
  await field.fill(text.replaceAll('alpine:3.20', 'alpine:3.19'));
  await page
    .getByLabel('Entendo que o upgrade pode iniciar serviços e substituir containers', {
      exact: true,
    })
    .check();
}
async function closeDraft() {
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('heading', { name: 'Descartar alterações Compose?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
}
async function upgrade() {
  await draft();
  await page.getByRole('button', { name: 'Revisar atualização', exact: true }).click();
  check(
    'review hides exported files before confirmation',
    (await page.locator('textarea').count()) === 0,
  );
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Atualizar a stack por Compose?', exact: true })
    .waitFor({ state: 'hidden' });
  await wait(stackPath, (v) => v.state === 'upgraded');
  await wait(servicePath, (v) => v.launchConfig.imageUuid === 'docker:alpine:3.19');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
}
async function native(label) {
  await page.getByRole('button', { name: 'Ações de ' + state.name, exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  await wait(stackPath, (v) => v.state === 'active');
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
      assert.equal(u.pathname.replace(/\/$/, ''), stackPath);
      assert.ok(
        ['exportconfig', 'upgrade', 'rollback', 'finishupgrade'].includes(
          u.searchParams.get('action'),
        ),
      );
    }
    return route.continue();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, stackComposeUpgrades: enabled } },
    });
  });
  page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  const before = await read(servicePath);
  assert.equal(before.scale, 0);
  assert.equal(before.launchConfig.imageUuid, 'docker:alpine:3.20');
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = page.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        theme,
      );
      const appliedTheme = await page.locator('html').getAttribute('data-theme');
      await draft();
      await page.screenshot({
        path: path.join(
          root,
          'evidence/e2e-isolated',
          `stack-compose-upgrade-${theme}-${width}.png`,
        ),
        animations: 'disabled',
        mask: [page.locator('textarea')],
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
      audits.push({ theme, appliedTheme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/stack-compose-upgrade-a11y-results.json'),
        JSON.stringify(audits, null, 2) + '\n',
      );
      assert.deepEqual(violations, []);
      assert.equal(overflow, false);
      check('Compose editor accessibility and layout ' + theme + ' ' + width);
      await closeDraft();
    }
  check(
    'discard leaves fixture unchanged',
    (await read(servicePath)).launchConfig.imageUuid === 'docker:alpine:3.20',
  );
  await upgrade();
  let current = await read(servicePath);
  check(
    'contextual Compose changes actual service configuration',
    current.scale === 0 && current.launchConfig.imageUuid === 'docker:alpine:3.19',
  );
  check(
    'native stack parameters preserved',
    (await read()).environment.STACK_PARAMETER === 'preserved',
  );
  check(
    'environment search and route stay in operation',
    (await page.getByLabel('Buscar na operação', { exact: true }).inputValue()) === state.name &&
      new URL(page.url()).pathname === '/console/stacks' &&
      new URL(page.url()).searchParams.get('env') === '1a12',
  );
  await native('Reverter atualização');
  await wait(servicePath, (v) => v.launchConfig.imageUuid === 'docker:alpine:3.20');
  check('native rollback restores original image');
  await upgrade();
  await native('Concluir atualização');
  current = await read(servicePath);
  check(
    'finish commits changed image with zero scale',
    current.state === 'active' &&
      current.scale === 0 &&
      current.launchConfig.imageUuid === 'docker:alpine:3.19',
  );
  const instances = await read(servicePath + '/instances');
  check('no physical containers created for actual acceptance', instances.data.length === 0);
  enabled = false;
  await page.reload();
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  await page.getByRole('button', { name: 'Ações de ' + state.name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Atualizar stack', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Atualizar stack · ' + state.name, exact: true })
    .waitFor();
  check(
    'flag off restores previous native action form',
    (await page
      .getByRole('heading', { name: 'Atualizar Compose · ' + state.name, exact: true })
      .count()) === 0,
  );
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  const rc = await browser.newContext(),
    reader = await rc.newPage();
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  const token = (await rc.cookies()).find((v) => v.name === 'CSRF')?.value || '';
  const r = await reader.request.post('http://localhost:18090' + stackPath + '?action=upgrade', {
    headers: { Accept: 'application/json', 'X-Api-Csrf': token },
    data: {
      dockerCompose: "version: '2'\nservices: {}\n",
      rancherCompose: "version: '2'\nservices: {}\n",
    },
  });
  check(
    'native write denied without fixture environment access',
    [401, 403, 404, 405].includes(r.status()),
  );
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
    if (browser) await browser.close();
  });
