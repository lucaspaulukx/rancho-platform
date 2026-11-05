const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = createRequire(path.join(input.runtimeModules, 'package.json'))('playwright');
const root = path.resolve(__dirname, '../../..'),
  out = path.join(root, 'evidence/e2e-isolated');
const fixturePath = path.join(root, 'console/balancer-rules-fixture.json');
const state = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-lb-'));
assert.equal(state.marker, 'Disposable LB rules ' + state.name);
const checks = [];
const axeSource = fs.readFileSync(
  path.join(root, 'console/node_modules/axe-core/axe.min.js'),
  'utf8',
);
const a11y = [];
let browser, page;
let baselineCustom;
let flags = { balancerRulesEditor: true, workloadBindingEditors: true };
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/context-editors-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
const sourcePath = '/v2-beta/projects/1a12/loadBalancerServices/' + state.source;
async function readSource() {
  const response = await page.request.get('http://localhost:18090' + sourcePath, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(response.status(), 200);
  return response.json();
}
async function openBalancer() {
  await page.getByRole('button', { name: 'Ações de balancer', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Configurar balanceador', exact: true }).click();
  await page.getByLabel('Porta de destino 1', { exact: true }).waitFor();
}
async function screenshot(name) {
  await page.screenshot({
    path: path.join(out, name + '.png'),
    fullPage: false,
    animations: 'disabled',
  });
  if (name !== 'context-editor-failure') {
    await page.evaluate(axeSource);
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
    a11y.push({ name, violations });
    fs.writeFileSync(
      path.join(root, 'console/context-editors-a11y-results.json'),
      JSON.stringify(a11y, null, 2) + '\n',
    );
    assert.equal(
      violations.length,
      0,
      'Automated accessibility findings: ' + name + ' ' + violations.map((v) => v.id).join(','),
    );
  }
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http://localhost:18090', 'http://localhost:18081'].includes(url.origin)
      ? route.continue()
      : route.abort();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({
      response,
      json: { ...config, modules: { ...config.modules, ...flags } },
    });
  });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.name));
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  baselineCustom = (await readSource()).lbConfig.config;
  await openBalancer();
  await screenshot('balancer-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('balancer-mobile');
  check(
    'balancer drawer fits 390px viewport',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Usar tema claro', exact: true }).click();
  await openBalancer();
  await screenshot('balancer-light');
  await page.getByLabel('Protocolo 1', { exact: true }).selectOption('http');
  await page.getByLabel('Porta de entrada 1', { exact: true }).fill('8088');
  await page.getByLabel('Porta de destino 1', { exact: true }).fill('8081');
  await page.getByLabel('Hostname 1', { exact: true }).fill('fixture.example');
  await page.getByLabel('Caminho 1', { exact: true }).fill('/api');
  await page.getByLabel('Acesso 1', { exact: true }).selectOption('internal');
  await page.getByRole('button', { name: 'Revisar alterações', exact: true }).click();
  await page.getByRole('dialog', { name: 'Aplicar regras do balanceador?', exact: true }).waitFor();
  await screenshot('balancer-review');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Aplicar regras do balanceador?', exact: true })
    .waitFor({ state: 'hidden' });
  let native = await readSource();
  assert.equal(native.lbConfig.portRules[0].targetPort, 8081);
  assert.equal(native.lbConfig.portRules[0].hostname, 'fixture.example');
  assert.equal(native.lbConfig.portRules[0].path, '/api');
  assert.deepEqual(native.launchConfig.expose, ['8088:8088/tcp']);
  assert.equal(native.lbConfig.config, baselineCustom);
  check('UI saves HTTP route through native PUT with custom configuration preserved');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  assert.equal(
    await page.getByLabel('Buscar na operação', { exact: true }).inputValue(),
    state.name,
  );
  check(
    'closing saved drawer preserves operation search and environment',
    new URL(page.url()).searchParams.get('env') === '1a12',
  );
  await openBalancer();
  await page.getByLabel('Protocolo 1', { exact: true }).selectOption('tcp');
  await page.getByLabel('Porta de entrada 1', { exact: true }).fill('8099');
  await page.getByLabel('Porta de destino 1', { exact: true }).fill('9090');
  await page.getByLabel('Acesso 1', { exact: true }).selectOption('public');
  await page.getByRole('button', { name: 'Revisar alterações', exact: true }).click();
  await page.getByText('Confirme o impacto das portas publicadas.', { exact: true }).waitFor();
  await page
    .getByRole('checkbox', {
      name: 'Revisei as portas publicadas e o impacto na conectividade',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Revisar alterações', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Aplicar regras do balanceador?', exact: true })
    .waitFor({ state: 'hidden' });
  native = await readSource();
  assert.equal(native.lbConfig.portRules[0].protocol, 'tcp');
  assert.equal(native.lbConfig.portRules[0].targetPort, 9090);
  assert.ok(!native.lbConfig.portRules[0].hostname);
  assert.ok(!native.lbConfig.portRules[0].path);
  assert.deepEqual(native.launchConfig.ports, ['8099:8099/tcp']);
  check('UI saves TCP publication only after explicit impact acknowledgement');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await openBalancer();
  await page.getByLabel('Porta de destino 1', { exact: true }).fill('8082');
  let dialogSeen = false;
  page.once('dialog', async (dialog) => {
    assert.equal(dialog.type(), 'beforeunload');
    dialogSeen = true;
    await dialog.dismiss();
  });
  try {
    await page.reload({ timeout: 10000 });
  } catch (error) {
    if (!dialogSeen) throw error;
  }
  check('real beforeunload dialog protects dirty balancer draft', dialogSeen);
  assert.equal(await page.getByLabel('Porta de destino 1', { exact: true }).inputValue(), '8082');
  native = await readSource();
  const cookies = await context.cookies('http://localhost:18090');
  const csrf = cookies.find((v) => v.name === 'CSRF');
  const externalComment = '# external E2E synthetic ' + require('node:crypto').randomUUID();
  const changed = await page.request.put('http://localhost:18090' + sourcePath, {
    headers: {
      Accept: 'application/json',
      'X-Api-Csrf': csrf ? decodeURIComponent(csrf.value) : '',
    },
    data: { lbConfig: { ...native.lbConfig, config: externalComment } },
  });
  assert.ok(changed.ok());
  await page
    .getByRole('checkbox', {
      name: 'Revisei as portas publicadas e o impacto na conectividade',
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'Revisar alterações', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByText('O balanceador foi alterado por outro cliente. Feche e reabra o painel.', {
      exact: true,
    })
    .waitFor();
  check(
    'UI refuses concurrent external configuration without losing draft',
    (await page.getByLabel('Porta de destino 1', { exact: true }).inputValue()) === '8082',
  );
  assert.equal((await readSource()).lbConfig.config, externalComment);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Descartar regras não salvas?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  check('dirty drawer requires explicit discard');
  flags = { balancerRulesEditor: false, workloadBindingEditors: false };
  await page.reload();
  await page.getByRole('button', { name: 'Ações de balancer', exact: true }).click();
  assert.equal(
    await page.getByRole('menuitem', { name: 'Configurar balanceador', exact: true }).count(),
    0,
  );
  await page.keyboard.press('Escape');
  check('flag off removes contextual balancer command and retains native editing');
  flags = { balancerRulesEditor: true, workloadBindingEditors: true };
  await page.reload();
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Usar tema escuro', exact: true }).click();
  await page.getByRole('button', { name: 'Ações de ' + state.name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Adicionar serviço', exact: true }).click();
  await page.getByRole('dialog', { name: 'Criar serviço', exact: true }).waitFor();
  await page.getByLabel('Nome *', { exact: true }).fill(state.name + '-ui-service');
  await page.getByLabel('Descrição', { exact: true }).fill(state.marker);
  await page.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
  await page.getByLabel(/^Escala ?\*?$/).fill('0');
  await page.getByRole('checkbox', { name: 'Iniciar após criação', exact: true }).uncheck();
  await page.getByText('Rede', { exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar porta', exact: true }).click();
  await page.getByLabel('Porta do container 1', { exact: true }).fill('8080');
  await page.getByLabel('Porta no host 1', { exact: true }).fill('18089');
  await page.getByLabel('IP de publicação 1', { exact: true }).fill('127.0.0.1');
  await screenshot('bindings-ports-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('bindings-ports-mobile');
  check(
    'structured binding form fits 390px viewport',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByText('Armazenamento', { exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar volume', exact: true }).click();
  await page.getByLabel('Origem do volume 1', { exact: true }).fill('/tmp');
  await page.getByLabel('Destino do volume 1', { exact: true }).fill('/fixture');
  await page.getByLabel('Acesso do volume 1', { exact: true }).selectOption('ro');
  await screenshot('bindings-volumes-dark');
  const createdResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === '/v2-beta/projects/1a12/services',
  );
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  const saved = await createdResponse;
  assert.ok(saved.ok());
  const created = await saved.json();
  assert.equal(created.accountId, '1a12');
  assert.equal(created.stackId, state.stack);
  assert.equal(created.name, state.name + '-ui-service');
  assert.equal(created.description, state.marker);
  const current = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(current.name, state.name);
  current.uiServices = [...new Set([...(current.uiServices || []), created.id])];
  fs.writeFileSync(fixturePath, JSON.stringify(current, null, 2) + '\n');
  await page
    .getByRole('dialog', { name: 'Criar serviço', exact: true })
    .waitFor({ state: 'hidden' });
  const readback = await page.request.get(
    'http://localhost:18090/v2-beta/projects/1a12/services/' + created.id,
    { headers: { Accept: 'application/json' } },
  );
  assert.equal(readback.status(), 200);
  const workload = await readback.json();
  assert.deepEqual(workload.launchConfig.ports, ['127.0.0.1:18089:8080/tcp']);
  assert.deepEqual(workload.launchConfig.dataVolumes, ['/tmp:/fixture:ro']);
  assert.equal(workload.scale, 0);
  assert.equal(workload.state, 'inactive');
  check(
    'real service creation UI persists structured port and readonly bind volume at inactive scale zero',
  );
  flags = { balancerRulesEditor: false, workloadBindingEditors: false };
  await page.reload();
  await page.getByRole('button', { name: 'Ações de ' + state.name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Adicionar serviço', exact: true }).click();
  await page.getByText('Rede', { exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Adicionar porta', exact: true }).count(), 0);
  assert.equal(
    await page.getByRole('textbox', { name: 'Portas publicadas', exact: true }).count(),
    1,
  );
  check('binding flag off restores native textarea in workload creation');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  check('no uncaught page errors', errors.length === 0);
  fs.writeFileSync(
    path.join(root, 'console/context-editors-e2e-browser.json'),
    JSON.stringify(
      {
        fixture: state.name,
        browser: browser.version(),
        playwright: require(path.join(input.runtimeModules, 'playwright/package.json')).version,
      },
      null,
      2,
    ) + '\n',
  );
  await context.close();
})()
  .catch(async (error) => {
    if (page) await screenshot('context-editor-failure').catch(() => {});
    console.error(String(error.message).split(input.password).join('[redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
