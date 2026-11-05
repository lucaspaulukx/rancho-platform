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
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  let businessWrites = 0;
  await c.route('**/*', (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (!['GET', 'HEAD'].includes(req.method()) && u.pathname !== '/v2-beta/token') {
      businessWrites++;
      return route.abort();
    }
    return route.continue();
  });
  const p = await c.newPage();
  await p.goto('http://localhost:18090/console/login');
  await p.getByLabel('Usuário', { exact: true }).fill(input.username);
  await p.getByLabel('Senha', { exact: true }).fill(input.password);
  await p.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await p.getByLabel('Navegação principal', { exact: true }).waitFor();
  await p.goto('http://localhost:18090/console/stacks?env=1a12');
  await p.getByText('Criar', { exact: true }).click();
  await p.getByRole('button', { name: 'Serviço', exact: true }).click();
  const dialog = p.getByRole('dialog', { name: 'Criar serviço', exact: true });
  await dialog.waitFor();
  await dialog
    .getByLabel(/^Nome ?\*?$/)
    .first()
    .fill('preview-web');
  await dialog.getByLabel('Imagem *', { exact: true }).first().fill('alpine:3.20');
  const stack = dialog.getByLabel('Stack *', { exact: true }),
    first = await stack.locator('option').evaluateAll((rows) => rows.find((v) => v.value)?.value);
  assert.ok(first);
  await stack.selectOption(first);
  await dialog.getByLabel('Escala', { exact: true }).fill('0');
  await dialog.getByLabel('Iniciar após criação', { exact: true }).uncheck();
  await dialog
    .locator('summary')
    .filter({ hasText: /^Sidecars/ })
    .click();
  await dialog.getByRole('button', { name: 'Adicionar sidecar', exact: true }).click();
  const group = dialog.getByRole('group', { name: /^Sidecar 1/ });
  await group.getByLabel('Nome *', { exact: true }).fill('worker');
  await group.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
  const network = group
    .locator('details')
    .filter({ has: p.getByLabel('Rede de outro container deste serviço', { exact: true }) });
  await network.locator('summary').click();
  await group
    .getByLabel('Rede de outro container deste serviço', { exact: true })
    .fill('preview-web');
  check('sidecar network reference is grouped under Rede');
  const storage = group.locator('details').filter({
    has: p.getByLabel('Volumes de outros containers deste serviço', { exact: true }),
  });
  await storage.locator('summary').click();
  check('sidecar volume reference is grouped under Armazenamento');
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  await dialog.getByText(/use o modo de rede container/).waitFor();
  assert.equal(businessWrites, 0);
  check('incomplete network mode is rejected before business write');
  await group.getByLabel('Modo de rede', { exact: true }).fill('container');
  assert.equal(
    await group.getByLabel('Rede de outro container deste serviço', { exact: true }).inputValue(),
    'preview-web',
  );
  check('operator corrects mode in the same form without losing reference');
  for (const width of [1440, 390]) {
    await p.setViewportSize({ width, height: 1000 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    check('sidecar reference editor fits viewport ' + width);
  }
  assert.equal(businessWrites, 0);
  check('preview never creates or changes a workload');
  fs.writeFileSync(
    path.join(root, 'console/sidecar-network-preview-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
})()
  .catch((e) => {
    console.error('FAILED: sidecar network preview (' + e.name + '); private details withheld.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
