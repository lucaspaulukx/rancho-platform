const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  { spawnSync } = require('node:child_process');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090',
  manifest = path.join(root, 'console/local-account-contract-fixture.json');
const name = 'console-account-' + crypto.randomBytes(6).toString('hex'),
  marker = 'Disposable account contract ' + name,
  password = crypto.randomBytes(24).toString('hex'),
  replacement = crypto.randomBytes(24).toString('hex');
const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const checks = [],
  audits = [];
let browser,
  context,
  page,
  userContext,
  userPage,
  enabled = true,
  fixture;
function check(check, ok = true) {
  assert.ok(ok, check);
  checks.push({ check, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/local-accounts-e2e-results.json'),
    JSON.stringify(checks, null, 2),
  );
  console.log('PASS: ' + check);
}
async function read(endpoint) {
  const r = await page.request.get(origin + '/v2-beta/' + endpoint, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(r.status(), 200);
  return r.json();
}
async function rows(endpoint) {
  return (await read(endpoint + '?limit=-1')).data.filter((v) => !v.removed);
}
function pythonHash(rows, fields) {
  return Object.fromEntries(
    rows.map((v) => {
      const value =
        '{' +
        [...fields]
          .sort()
          .map(
            (k) =>
              JSON.stringify(k) +
              ': ' +
              JSON.stringify(v[k] ?? null).replace(
                /[\u007f-\uffff]/g,
                (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
              ),
          )
          .join(', ') +
        '}';
      return [v.id, crypto.createHash('sha256').update(value).digest('hex')];
    }),
  );
}
function save() {
  fs.writeFileSync(manifest, JSON.stringify(fixture, null, 2));
}
async function wait(predicate) {
  for (let i = 0; i < 90; i++) {
    const v = await read('accounts/' + fixture.account);
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Account did not stabilize');
}
async function menu(label) {
  await page
    .getByRole('button', { name: 'Ações da conta ' + fixture.displayName, exact: true })
    .click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await page.getByRole('dialog', { name: label, exact: true }).waitFor();
}
async function apply() {
  await page.getByRole('button', { name: /^Revisar (alterações|operação)$/ }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Aplicar alteração da conta?', exact: true })
    .waitFor({ state: 'hidden' })
    .catch(async (error) => {
      const alerts = await page
        .getByRole('dialog', { name: 'Aplicar alteração da conta?', exact: true })
        .getByRole('alert')
        .allTextContents();
      // Product errors are sanitized; additionally redact both in-memory test secrets.
      console.error(
        'Account review:',
        alerts
          .map((v) => v.replaceAll(password, '[redacted]').replaceAll(replacement, '[redacted]'))
          .join(' | '),
      );
      throw error;
    });
}
async function discard() {
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}
async function theme(mode) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const toggle = page.getByRole('button', {
    name: mode === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
  await page.waitForFunction((v) => document.documentElement.dataset.theme === v, mode);
}
async function audit(view, mode, width) {
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
    ).violations.map((v) => ({ id: v.id, targets: v.nodes.flatMap((n) => n.target).map(String) })),
  );
  const appliedTheme = await page.locator('html').getAttribute('data-theme'),
    overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  audits.push({ view, mode, appliedTheme, width, violations, overflow });
  fs.writeFileSync(
    path.join(root, 'console/local-accounts-a11y-results.json'),
    JSON.stringify(audits, null, 2),
  );
  assert.equal(appliedTheme, mode);
  assert.deepEqual(violations, []);
  assert.equal(overflow, false);
  await page.screenshot({
    path: path.join(root, 'evidence/e2e-isolated', `local-accounts-${view}-${mode}-${width}.png`),
    mask: [page.locator('input[type=password]')],
    animations: 'disabled',
  });
  check(`${view} accessibility/layout ${mode} ${width}`);
}
async function fillCreate() {
  await page.getByLabel('Nome da conta', { exact: true }).fill(name);
  await page.getByLabel('Descrição da conta', { exact: true }).fill(marker);
  await page.getByLabel('Login local', { exact: true }).fill(name);
  await page.getByLabel('Nova senha local', { exact: true }).fill(password);
  await page.getByLabel('Confirmar senha local', { exact: true }).fill(password);
}
async function anonymousLogin(secret) {
  const c = await browser.newContext();
  try {
    const r = await c.request.post(origin + '/v2-beta/token', {
      headers: { Accept: 'application/json' },
      data: { code: name + ':' + secret },
    });
    return r.status();
  } finally {
    await c.close();
  }
}
(async () => {
  assert.equal(fs.existsSync(manifest), false, 'Recover own prior fixture first');
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
      json: { ...cfg, modules: { ...cfg.modules, localAccountAdministration: enabled } },
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
  await page.goto(origin + '/console/users');
  await page.getByRole('heading', { name: 'Usuários', exact: true }).waitFor();
  fixture = {
    name,
    marker,
    account: null,
    credential: null,
    baselineAccounts: pythonHash(await rows('accounts'), [
      'name',
      'description',
      'kind',
      'state',
      'externalId',
      'externalIdType',
    ]),
    baselineCredentials: pythonHash(await rows('passwords'), [
      'accountId',
      'name',
      'kind',
      'state',
      'publicValue',
    ]),
    displayName: name,
  };
  save();
  for (const mode of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await theme(mode);
      await page.getByRole('button', { name: 'Criar conta local', exact: true }).click();
      await fillCreate();
      await audit('create', mode, width);
      await discard();
    }
  await theme('dark');
  await page.getByRole('button', { name: 'Criar conta local', exact: true }).click();
  await fillCreate();
  await apply();
  const created = (await rows('accounts')).filter((v) => v.description === marker);
  assert.equal(created.length, 1);
  fixture.account = created[0].id;
  save();
  await wait((v) => v.state === 'active');
  for (let i = 0; i < 60; i++) {
    const credentials = (await rows('passwords')).filter(
      (v) => v.accountId === fixture.account && v.publicValue === name,
    );
    if (credentials.length) {
      fixture.credential = credentials[0].id;
      save();
      if (credentials[0].state === 'active') break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(fixture.credential);
  await page.getByLabel('Buscar registros', { exact: true }).fill(name);
  check('native account and local credential created once', created[0].kind === 'user');
  userContext = await browser.newContext();
  await userContext.route('**/*', (route) =>
    ['http://localhost:18090', 'http://localhost:18081'].includes(
      new URL(route.request().url()).origin,
    )
      ? route.continue()
      : route.abort(),
  );
  userPage = await userContext.newPage();
  await userPage.goto(origin + '/console/login');
  await userPage.getByLabel('Usuário', { exact: true }).fill(name);
  await userPage.getByLabel('Senha', { exact: true }).fill(password);
  await userPage.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await userPage.waitForURL('**/console/no-access');
  const projects = await userPage.request.get(origin + '/v2-beta/projects', {
    headers: { Accept: 'application/json' },
  });
  check(
    'new local user has zero environments',
    projects.status() === 200 && (await projects.json()).data.length === 0,
  );
  const userCookies = await userContext.cookies(origin);
  const escalation = await userPage.request.put(origin + '/v2-beta/accounts/' + fixture.account, {
    headers: {
      Accept: 'application/json',
      'X-Api-Csrf': decodeURIComponent(userCookies.find((v) => v.name === 'CSRF')?.value || ''),
    },
    data: { kind: 'admin' },
  });
  check(
    'ordinary account cannot promote itself through native API',
    [403, 405].includes(escalation.status()) &&
      (await read('accounts/' + fixture.account)).kind === 'user',
  );
  for (const mode of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await theme(mode);
      await menu('Editar perfil da conta');
      await page.getByLabel('Nome da conta', { exact: true }).fill(name + ' edited');
      await audit('profile', mode, width);
      await discard();
    }
  await theme('dark');
  await menu('Editar perfil da conta');
  await page.getByLabel('Nome da conta', { exact: true }).fill(name + ' edited');
  await page.getByLabel('Perfil global da conta', { exact: true }).selectOption('admin');
  await page
    .getByLabel('Confirmo conceder administração global do Rancher', { exact: true })
    .check();
  await apply();
  fixture.displayName = name + ' edited';
  save();
  await wait((v) => v.kind === 'admin' && v.state === 'active');
  let token = await userPage.request.get(origin + '/v2-beta/token', {
    headers: { Accept: 'application/json' },
  });
  check(
    'current session reflects promoted role',
    (await token.json()).data[0].userType === 'admin',
  );
  await menu('Editar perfil da conta');
  await page.getByLabel('Perfil global da conta', { exact: true }).selectOption('user');
  await apply();
  await wait((v) => v.kind === 'user' && v.state === 'active');
  token = await userPage.request.get(origin + '/v2-beta/token', {
    headers: { Accept: 'application/json' },
  });
  check('current session reflects demotion', (await token.json()).data[0].userType === 'user');
  for (const mode of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await theme(mode);
      await menu('Redefinir senha local');
      await page.getByLabel('Nova senha local', { exact: true }).fill(replacement);
      await page.getByLabel('Confirmar senha local', { exact: true }).fill(replacement);
      await audit('password', mode, width);
      await discard();
    }
  await theme('dark');
  await menu('Redefinir senha local');
  await page.getByLabel('Nova senha local', { exact: true }).fill(replacement);
  await page.getByLabel('Confirmar senha local', { exact: true }).fill(replacement);
  await apply();
  let passwordApplied = false;
  for (let i = 0; i < 60; i++) {
    if ((await anonymousLogin(replacement)) === 201 && (await anonymousLogin(password)) === 401) {
      passwordApplied = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  check('password reset rejects old secret and accepts replacement', passwordApplied);
  check(
    'real password is absent from browser storage',
    !(
      await page.evaluate(() =>
        JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
      )
    ).includes(replacement),
  );
  await menu('Desativar conta');
  await apply();
  await wait((v) => v.state === 'inactive');
  token = await userPage.request.get(origin + '/v2-beta/token', {
    headers: { Accept: 'application/json' },
  });
  check(
    'inactive account session and login denied',
    token.status() === 401 && (await anonymousLogin(replacement)) === 401,
  );
  await menu('Ativar conta');
  await apply();
  await wait((v) => v.state === 'active');
  check('reactivation restores local login', (await anonymousLogin(replacement)) === 201);
  await menu('Desativar conta');
  await apply();
  await wait((v) => v.state === 'inactive');
  await menu('Excluir conta');
  await apply();
  await wait((v) => !!v.removed);
  check('inactive account logically removed');
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Usuários', exact: true }).waitFor();
  check(
    'flag off hides account write controls',
    (await page.getByRole('button', { name: 'Criar conta local', exact: true }).count()) === 0,
  );
  check('no uncaught page errors', errors.length === 0);
})()
  .catch((e) => {
    console.error(
      'Local account acceptance failed:',
      e.name,
      String(e.stack)
        .split('\n')
        .filter((v) => v.includes('local-accounts.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (fixture) {
        const r = spawnSync(
          'python',
          ['-u', path.join(root, 'console/tests/local_account_fixture_cleanup.py')],
          { encoding: 'utf8' },
        );
        assert.equal(r.status, 0, 'Own account cleanup failed; inspect metadata report');
        check('previous accounts and credentials preserved after cleanup');
      }
    } catch {
      console.error('Owned account cleanup requires inspection; no secret output.');
      process.exitCode = 1;
    }
    await userContext?.close();
    await browser?.close();
  });
