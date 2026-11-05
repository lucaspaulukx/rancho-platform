const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  checks = [];
let browser;
function check(name) {
  checks.push({ check: name, status: 'passed' });
  console.log('PASS: ' + name);
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const original = fs.readFileSync(path.join(root, 'console/public/console-config.json'));
  const current = JSON.parse(original);
  const { schemaVersion: _, ...legacy } = current;
  const cases = [
    ['legacy', legacy],
    ['version1', current],
    ['rollback-legacy', legacy],
    ['missing-module', { ...legacy, modules: { ...legacy.modules, workloads: undefined } }],
    ['future', { ...current, schemaVersion: 2 }],
    ['invalid', { ...current, modules: { groups: true } }],
  ];
  for (const [name, cfg] of cases) {
    const c = await browser.newContext({ locale: 'pt-BR', colorScheme: 'dark' });
    let authenticatedRequests = 0;
    await c.route('**/*', (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
        return route.abort();
      if (!['GET', 'HEAD'].includes(req.method()) && u.pathname !== '/v2-beta/token')
        throw new Error('Configuration test forbids business writes');
      if (u.pathname === '/v2-beta/token') authenticatedRequests++;
      return route.continue();
    });
    await c.route('**/console/console-config.json', (route) => route.fulfill({ json: cfg }));
    const p = await c.newPage(),
      errors = [];
    p.on('pageerror', (e) => errors.push(e.name));
    await p.goto('http://localhost:18090/console/login');
    if (['future', 'invalid'].includes(name)) {
      await p
        .getByText(
          name === 'future' ? 'Versão da configuração não suportada.' : 'Flag inválida: users.',
          { exact: true },
        )
        .waitFor();
      assert.equal(authenticatedRequests, 0);
      check(name + ': configuration rejected before authentication');
    } else {
      await p.getByLabel('Usuário', { exact: true }).fill(input.username);
      await p.getByLabel('Senha', { exact: true }).fill(input.password);
      await p.getByRole('button', { name: 'Entrar com conta local' }).click();
      await p.getByLabel('Navegação principal', { exact: true }).waitFor();
      await p.goto('http://localhost:18090/console/stacks?env=1a12');
      if (name === 'missing-module')
        await p.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
      else await p.getByLabel('Buscar na operação', { exact: true }).waitFor();
      check(name + ': login and expected module state');
    }
    assert.deepEqual(errors, []);
    await c.close();
  }
  assert.deepEqual(
    fs.readFileSync(path.join(root, 'console/public/console-config.json')),
    original,
  );
  check('shared configuration bytes preserved');
  fs.writeFileSync(
    path.join(root, 'console/config-migration-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
})()
  .catch((e) => {
    console.error('FAILED: config migration (' + e.name + '); private details withheld.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
