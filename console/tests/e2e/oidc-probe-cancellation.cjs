const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..');
let browser;
const checks = [];
function check(name) {
  checks.push({ check: name, status: 'passed' });
  console.log('PASS: ' + name);
}
async function context(preflight) {
  const c = await browser.newContext({ locale: 'pt-BR' });
  await c.route('**/*', (r) => {
    const req = r.request(),
      u = new URL(req.url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin)) return r.abort();
    if (!['GET', 'HEAD'].includes(req.method()) && u.pathname !== '/v2-beta/token')
      throw new Error('Cancellation preview forbids business writes');
    return r.continue();
  });
  await c.route('**/oidc/status', async (r) => {
    const response = await r.fetch(),
      cfg = await response.json();
    await r.fulfill({ response, json: { ...cfg, preflight, only: false, autoLogin: false } });
  });
  return c;
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  let c = await context(true),
    p = await c.newPage(),
    held,
    lateFulfilled = false,
    aborted = false,
    idpRequests = 0;
  p.on('requestfailed', (r) => {
    if (new URL(r.url()).pathname === '/oidc/readiness') aborted = true;
  });
  p.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin === 'http://localhost:18081' || u.pathname === '/oidc/login') idpRequests++;
  });
  await c.route('**/oidc/readiness', (r) => {
    held = r;
  });
  await p.goto('http://localhost:18090/console/login');
  await p.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).click();
  const deadline = Date.now() + 5000;
  while (!held && Date.now() < deadline) await p.waitForTimeout(25);
  assert.ok(held);
  check('readiness request can remain in flight without leaving login');
  await p.getByLabel('Usuário', { exact: true }).fill(input.username);
  await p.getByLabel('Senha', { exact: true }).fill(input.password);
  await p.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  check('switching to local login authenticates while probe is pending');
  try {
    await held.fulfill({ json: { ready: true, checked: true } });
    lateFulfilled = true;
  } catch {}
  await p.waitForTimeout(1000);
  assert.ok(aborted || lateFulfilled);
  assert.equal(idpRequests, 0);
  assert.ok(p.url().startsWith('http://localhost:18090/console'));
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  check('cancelled or late probe cannot redirect the new authenticated session');
  await c.close();
  c = await context(false);
  p = await c.newPage();
  let probes = 0;
  await c.route('**/oidc/readiness', (r) => {
    probes++;
    return r.fulfill({ status: 503, json: { ready: false, checked: true } });
  });
  await p.goto('http://localhost:18090/console/login');
  await p.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).click();
  await p.locator('input[name="username"]').waitFor();
  assert.equal(probes, 0);
  check('feature off uses direct OIDC navigation without a readiness request');
  await c.close();
  fs.writeFileSync(
    path.join(root, 'console/oidc-probe-cancellation-results.json'),
    JSON.stringify(
      {
        checks,
        scope:
          'controlled browser transport for race/flag-off; real provider outage tested separately',
      },
      null,
      2,
    ) + '\n',
  );
})()
  .catch((e) => {
    console.error('FAILED: OIDC probe cancellation (' + e.name + '); private details withheld.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
