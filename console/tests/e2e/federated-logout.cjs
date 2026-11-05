// Independent browser only. No trace, HAR, storageState, token or password artifacts.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const lines = readline.createInterface({ input: process.stdin });
let start, release;
const inputPromise = new Promise((resolve) => { start = resolve; });
lines.on('line', (line) => {
  const value = JSON.parse(line);
  if (value.command === 'provider-stopped') release?.();
  else start(value);
});
function emit(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
let browser;
let stage = 'setup';
let visualDiagnostic = null;
(async () => {
  const input = await inputPromise;
  const { chromium } = require('node:module').createRequire(path.join(input.runtimeModules, 'package.json'))('playwright');
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(url.origin)) return route.abort();
    if (url.origin === 'http://localhost:18090' && !['GET', 'HEAD'].includes(route.request().method()) &&
        !['/v2-beta/token', '/v2-beta/token/current', '/oidc/logout'].includes(url.pathname)) {
      throw new Error('Business writes forbidden in logout acceptance');
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  const base = 'http://localhost:18090';
  async function oidcLogin(fill = true) {
    await page.goto(base + '/console/login?signedOut=true');
    await page.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).click();
    if (fill) {
      await page.waitForURL((url) => url.origin === 'http://localhost:18081');
      await page.locator('input[name="username"]').fill(input.username);
      await page.locator('input[name="password"]').fill(input.password);
      await page.locator('#kc-login').click();
    }
    await page.waitForURL((url) => url.origin === base && url.pathname.startsWith('/console') && !url.pathname.endsWith('/login'));
    await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  }
  async function cookie() {
    const value = (await context.cookies(base)).find((c) => c.name === 'token');
    assert.ok(value && value.value); return value;
  }
  async function replayDenied(value) {
    const replay = await browser.newContext();
    await replay.addCookies([value]);
    stage = 'replay-key-denied';
    const response = await replay.request.get(base + '/v2-beta/projects?limit=1', { headers: { Accept: 'application/json' } });
    assert.equal(response.status(), 401);
    await replay.close();
  }
  async function deleteCurrent() {
    const csrf = (await context.cookies(base)).find((c) => c.name === 'CSRF')?.value || '';
    const response = await context.request.delete(base + '/v2-beta/token/current', { headers: { 'X-Api-Csrf': decodeURIComponent(csrf) } });
    assert.ok([200, 204].includes(response.status()));
  }
  async function leave(noAccess = false) {
    if (noAccess) await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    else {
      await page.getByLabel('Menu do usuário', { exact: true }).click();
      await page.getByRole('button', { name: 'Sair', exact: true }).click();
    }
  }
  async function loginPage() {
    await page.waitForURL((url) => url.origin === base && url.pathname === '/console/login');
    await page.getByRole('heading', { name: 'Acesse seu ambiente', exact: true }).waitFor();
    stage = 'login-cookie-cleared';
    assert.equal((await context.cookies(base)).some((c) => c.name === 'token' && c.value), false);
    await page.waitForTimeout(800);
    stage = 'no-auto-relogin';
    assert.equal(new URL(page.url()).pathname, '/console/login');
  }
  stage = 'initial-oidc-login';
  await oidcLogin();
  const previous = await cookie();
  if (input.mode === 'local-preserves-sso') {
    await deleteCurrent();
    await page.goto(base + '/console/login?signedOut=true');
    await page.getByLabel('Usuário', { exact: true }).fill(input.adminUsername);
    await page.getByLabel('Senha', { exact: true }).fill(input.adminPassword);
    await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
    await page.getByLabel('Navegação principal', { exact: true }).waitFor();
    const local = await cookie();
    await leave();
    stage = 'return-to-login';
    await loginPage();
    await replayDenied(local);
    await oidcLogin(false); // Same provider session must bypass the credential form.
    await deleteCurrent();
    emit({ type: 'result', status: 'passed', mode: input.mode, localSessionReplayDenied: true, providerSsoPreserved: true, errors });
  } else if (input.mode === 'provider-down-exclusive') {
    const stopped = new Promise((resolve) => { release = resolve; });
    emit({ type: 'stop-provider' });
    await stopped;
    stage = 'logout-click';
    await leave(input.noAccess);
    stage = 'return-to-login';
    await loginPage();
    await page.getByText('Você saiu desta console. Não foi possível confirmar a saída do provedor de login.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Usuário', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).count(), 0);
    await replayDenied(previous);
    emit({ type: 'result', status: 'passed', mode: input.mode, warningVisible: true, exclusivePreserved: true, noAutoLoginLoop: true, replayDenied: true, errors });
  } else {
    stage = 'logout-click';
    await leave(input.noAccess);
    await page.waitForURL((url) => url.origin === 'http://localhost:18081');
    assert.equal(new URL(page.url()).searchParams.has('id_token_hint'), false);
    stage = 'provider-confirmation';
    await page.locator('#kc-logout').waitFor();
    await page.locator('#kc-logout').click();
    stage = 'return-to-login';
    await loginPage();
    await replayDenied(previous);
    const axe = fs.readFileSync(path.join(input.root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
    const layouts = [];
    for (const theme of ['dark', 'light']) for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true });
      if (await toggle.count()) await toggle.click();
      await page.evaluate(axe);
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map((v) => v.id));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      stage = `logout-accessibility-${theme}-${width}`;
      visualDiagnostic = { theme, width, violations, overflow };
      if (violations.length) {
        const out = path.join(input.root, 'evidence/e2e-isolated'); fs.mkdirSync(out, { recursive: true });
        await page.screenshot({ path: path.join(out, `logout-diagnostic-${theme}-${width}.png`) });
      }
      assert.deepEqual(violations, []); assert.equal(overflow, false);
      layouts.push({ theme, width, violations, overflow });
    }
    await page.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).click();
    await page.waitForURL((url) => url.origin === 'http://localhost:18081');
    await page.locator('input[name="username"]').waitFor();
    await page.locator('input[name="password"]').waitFor();
    emit({ type: 'result', status: 'passed', mode: input.mode, providerConfirmation: true, newLoginRequiresCredentials: true, replayDenied: true, layouts, errors });
  }
  assert.deepEqual(errors, []);
  await context.close();
})().catch((error) => {
  // Never print error messages that might contain URL queries or form input.
  emit({ type: 'result', status: 'failed', errorType: error.name, stage, visualDiagnostic, actual: ['number', 'boolean'].includes(typeof error.actual) ? error.actual : undefined, expected: ['number', 'boolean'].includes(typeof error.expected) ? error.expected : undefined }); process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  lines.close();
});
