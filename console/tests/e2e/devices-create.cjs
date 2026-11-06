// One marked local container creation. Only the current context's device-editor flag is overridden.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(path.join(input.runtimeModules, 'package.json'))('playwright');
const origin = 'http://localhost:18090';
const result = { status: 'failed', checks: [], browserClosed: false, pageErrors: 0, mutations: 0, blockedRequests: 0 };
let browser;
const budget = setTimeout(() => { result.timedOut = true; void browser?.close(); }, 90_000);
function check(name, condition = true) { assert(condition); result.checks.push(name); }

async function main() {
  assert.match(input.marker, /^console-devices-[a-f0-9]{12}$/);
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
  await context.addCookies(input.cookies.map(({ name, value }) => ({ name, value, url: origin, sameSite: 'Lax' })));
  let enabled = false;
  await context.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { result.blockedRequests++; await route.abort('blockedbyclient'); return; }
    if (!['GET', 'HEAD'].includes(request.method())) {
      let valid = false;
      if (request.method() === 'POST' && url.pathname === '/v2-beta/projects/1a12/containers') {
        const body = request.postDataJSON();
        valid = body.name === input.marker && body.description === input.marker &&
          body.requestedHostId === '1h1' && body.networkMode === 'bridge' &&
          body.labels?.['rancher.console.devices-fixture'] === input.marker &&
          JSON.stringify(body.devices) === JSON.stringify(['/dev/null:/dev/rancho-null:r']) &&
          body.privileged !== true && (!body.securityOpt || body.securityOpt.length === 0) && result.mutations === 0;
      }
      if (!valid) { result.blockedRequests++; await route.abort('blockedbyclient'); return; }
      result.mutations++;
    }
    await route.continue();
  });
  await context.route(origin + '/console/console-config.json', async (route) => {
    const response = await route.fetch(), config = await response.json();
    config.modules.workloadDeviceEditors = enabled;
    config.localization = { enabled: false };
    await route.fulfill({ response, json: config });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', () => result.pageErrors++);
  async function open() {
    await page.goto(origin + '/console/stacks?env=1a12');
    await page.locator('details.creation-menu > summary').filter({ hasText: /^Criar$/ }).click();
    await page.getByRole('button', { name: 'Container avulso', exact: true }).click();
    return page.getByRole('dialog', { name: 'Criar container avulso', exact: true });
  }
  result.stage = 'flag-off';
  let dialog = await open();
  await dialog.getByText('Segurança', { exact: true }).click();
  check('flag off retains the native device field', await dialog.getByRole('button', { name: 'Adicionar dispositivo', exact: true }).count() === 0);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  enabled = true;
  result.stage = 'real-device-creation';
  dialog = await open();
  await dialog.getByLabel(/^Nome ?\*?$/).first().fill(input.marker);
  await dialog.getByLabel('Descrição', { exact: true }).fill(input.marker);
  await dialog.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
  await dialog.getByLabel('Comando', { exact: true }).fill('/bin/sh\n-c\nwhile :; do sleep 5; done');
  await dialog.getByText('Rede', { exact: true }).click();
  const mode = dialog.getByLabel('Modo de rede', { exact: true });
  if (await mode.evaluate((node) => node.tagName) === 'SELECT') await mode.selectOption('bridge'); else await mode.fill('bridge');
  await dialog.getByText('Agendamento', { exact: true }).click();
  const host = dialog.getByLabel('Host solicitado', { exact: true });
  if (await host.evaluate((node) => node.tagName) === 'SELECT') await host.selectOption('1h1'); else await host.fill('1h1');
  await dialog.getByText('Outras labels e regras nativas', { exact: true }).click();
  const scheduling = dialog.locator('details.workload-form-section').filter({ has: page.getByText('Agendamento', { exact: true }) });
  await scheduling.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await dialog.getByLabel('Labels: chave 1', { exact: true }).fill('rancher.console.devices-fixture');
  await dialog.getByLabel('Labels: valor 1', { exact: true }).fill(input.marker);
  await dialog.getByText('Segurança', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Adicionar dispositivo', exact: true }).click();
  await dialog.getByLabel('Caminho no host 1', { exact: true }).fill('/dev/null');
  await dialog.getByLabel('Caminho no container 1', { exact: true }).fill('/dev/rancho-null');
  await dialog.getByRole('checkbox', { name: 'Dispositivo 1: escrita (w)', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: 'Dispositivo 1: criar nós (m)', exact: true }).uncheck();
  check('only read permission remains selected', await dialog.getByRole('checkbox', { name: 'Dispositivo 1: leitura (r)', exact: true }).isChecked());
  const pending = page.waitForResponse((response) => response.request().method() === 'POST' &&
    new URL(response.url()).pathname === '/v2-beta/projects/1a12/containers');
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 201);
  const resource = await response.json();
  assert.match(resource.id, /^1i[0-9]+$/);
  result.containerId = resource.id;
  check('shared UI persists the exact native device mapping', JSON.stringify(resource.devices) === JSON.stringify(['/dev/null:/dev/rancho-null:r']));
  check('native container remains nonprivileged', resource.privileged === false);
  await dialog.waitFor({ state: 'hidden' });
  check('no JavaScript errors or unexpected browser mutations', result.pageErrors === 0 && result.mutations === 1 && result.blockedRequests === 0);
  result.status = 'passed';
}

main().catch((error) => {
  result.errorType = error?.name || 'Error';
  result.errorLines = [...String(error?.stack || '').matchAll(/devices-create\.cjs:([0-9]+):([0-9]+)/g)].map((match) => Number(match[1]));
}).finally(async () => {
  clearTimeout(budget);
  if (result.timedOut) result.status = 'failed';
  if (browser) {
    try { await browser.close(); result.browserClosed = true; } catch { result.status = 'failed'; }
  }
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'passed' ? 0 : 1;
});
