const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
let browser;
const checks = [];
function check(name) {
  checks.push({ check: name, status: 'passed' });
  console.log('PASS: ' + name);
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await browser.newContext({ locale: 'pt-BR' });
  await c.route('**/*', (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (
      !['GET', 'HEAD'].includes(req.method()) &&
      !(
        (u.origin === 'http://localhost:18081' &&
          u.pathname.startsWith('/realms/rancher-lab/login-actions/')) ||
        u.pathname === '/v2-beta/token'
      )
    )
      throw new Error('OIDC preview forbids business writes');
    return route.continue();
  });
  const p = await c.newPage();
  await p.goto('http://localhost:18090/console/login');
  await p.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).waitFor();
  assert.equal(await p.getByLabel('Usuário', { exact: true }).count(), input.exclusive ? 0 : 1);
  check(input.mode + ': login policy renders expected methods');
  await openKeycloakLogin(p);
  await p.locator('input[name="username"]').fill(input.username);
  await p.locator('input[name="password"]').fill(input.password);
  await p.locator('button[type="submit"],input[type="submit"]').click();
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  assert.ok(!p.url().includes('oidc_ticket'));
  check(input.mode + ': Keycloak button authenticates application administrator without refresh');
  await p.goto('http://localhost:18090/console/users');
  await p.getByRole('heading', { name: 'Usuários', exact: true }).waitFor();
  const r = await p.request.get('http://localhost:18090/v2-beta/localGroups');
  assert.equal(r.status(), 200);
  check(input.mode + ': OIDC administrator opens users and native group administration');
  fs.writeFileSync(
    path.join(input.root, 'console/oidc-administrator-' + input.mode + '-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
})()
  .catch((e) => {
    console.error('FAILED: OIDC administrator (' + e.name + '); private details withheld.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
