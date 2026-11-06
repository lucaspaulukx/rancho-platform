const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const origin = 'http://localhost:18090',
  result = { status: 'failed', checks: [], browserClosed: false, pageErrors: 0 };
let browser;
const mapping = (role) => '/dev/null:/dev/rancho-' + role + '-device:r';
async function main() {
  assert.match(input.marker, /^console-devices-[a-f0-9]{12}$/);
  assert.match(input.stackId, /^1st[0-9]+$/);
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
  });
  await context.addCookies(
    input.cookies.map(({ name, value }) => ({ name, value, url: origin, sameSite: 'Lax' })),
  );
  await context.route(origin + '/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      config = await response.json();
    config.modules.workloadDeviceEditors = true;
    config.modules.workloadSidecars = true;
    config.modules.workloadCreationSections = true;
    config.modules.workloadScheduling = true;
    await route.fulfill({ response, json: config });
  });
  await context.route('**/v2-beta/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    try {
      assert.equal(url.origin, origin);
      if (!['GET', 'HEAD'].includes(request.method())) {
        assert.equal(request.method(), 'POST');
        assert.equal(url.pathname.replace(/\/$/, ''), '/v2-beta/projects/1a12/services');
        const body = request.postDataJSON();
        assert.equal(body.stackId, input.stackId);
        assert.equal(body.name, 'devices-primary');
        assert.equal(body.description, input.marker);
        assert.equal(body.scale, 1);
        assert.deepEqual(body.launchConfig.devices, [mapping('primary')]);
        assert.equal(body.launchConfig.labels['rancher.console.devices-fixture'], input.marker);
        assert.equal(body.secondaryLaunchConfigs.length, 1);
        assert.equal(body.secondaryLaunchConfigs[0].name, 'helper');
        assert.deepEqual(body.secondaryLaunchConfigs[0].devices, [mapping('sidecar')]);
        for (const launch of [body.launchConfig, ...body.secondaryLaunchConfigs]) {
          assert.equal(launch.imageUuid, 'docker:alpine:3.20');
          assert.equal(launch.networkMode, 'none');
          assert.notEqual(launch.privileged, true);
        }
      }
      await route.continue();
    } catch (error) {
      result.routeError = true;
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', () => result.pageErrors++);
  result.stage = 'open';
  await page.goto(origin + '/console/stacks?env=1a12&q=' + input.marker);
  await page.getByText('Criar', { exact: true }).click();
  await page.getByRole('button', { name: 'Serviço', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar serviço', exact: true });
  await dialog
    .getByLabel(/^Nome ?\*?$/)
    .first()
    .fill('devices-primary');
  await dialog.getByLabel('Descrição', { exact: true }).fill(input.marker);
  await dialog.getByLabel('Stack *', { exact: true }).selectOption(input.stackId);
  await dialog.getByLabel('Escala', { exact: true }).fill('1');
  await dialog.getByLabel('Iniciar após criação', { exact: true }).check();
  async function nativeChoice(control, value) {
    if ((await control.evaluate((node) => node.tagName)) === 'SELECT')
      await control.selectOption(value);
    else await control.fill(value);
  }
  async function configure(group, role) {
    await group.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
    await group
      .getByLabel('Comando', { exact: true })
      .fill('/bin/sh\n-c\nwhile :; do sleep 5; done');
    await group.getByText('Rede', { exact: true }).click();
    await nativeChoice(group.getByLabel('Modo de rede', { exact: true }), 'none');
    await group.getByText('Agendamento', { exact: true }).click();
    const host = group.getByLabel('Host solicitado', { exact: true });
    if (await host.count()) await nativeChoice(host, '1h1');
    await group.getByText('Outras labels e regras nativas', { exact: true }).click();
    const scheduling = group
      .locator('details.workload-form-section')
      .filter({ has: page.getByText('Agendamento', { exact: true }) });
    await scheduling.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await group
      .getByLabel('Labels: chave 1', { exact: true })
      .fill('rancher.console.devices-fixture');
    await group.getByLabel('Labels: valor 1', { exact: true }).fill(input.marker);
    await group.getByText('Segurança', { exact: true }).click();
    await group.getByRole('button', { name: 'Adicionar dispositivo', exact: true }).click();
    await group.getByLabel('Caminho no host 1', { exact: true }).fill('/dev/null');
    await group
      .getByLabel('Caminho no container 1', { exact: true })
      .fill('/dev/rancho-' + role + '-device');
    await group
      .getByRole('checkbox', { name: 'Dispositivo 1: escrita (w)', exact: true })
      .uncheck();
    await group
      .getByRole('checkbox', { name: 'Dispositivo 1: criar nós (m)', exact: true })
      .uncheck();
  }
  result.stage = 'primary';
  await configure(
    dialog.getByRole('group', { name: 'Configuração do container *', exact: true }),
    'primary',
  );
  result.stage = 'sidecar';
  await dialog.getByText('Sidecars', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Adicionar sidecar', exact: true }).click();
  const sidecar = dialog.getByRole('group', { name: /^Sidecar 1/ });
  await sidecar.getByLabel(/^Nome ?\*?$/).fill('helper');
  await configure(sidecar, 'sidecar');
  result.stage = 'create';
  const pending = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname.replace(/\/$/, '') === '/v2-beta/projects/1a12/services',
  );
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 201);
  const value = await response.json();
  assert.match(value.id, /^1s[0-9]+$/);
  result.serviceId = value.id;
  assert.deepEqual(value.launchConfig.devices, [mapping('primary')]);
  assert.deepEqual(value.secondaryLaunchConfigs[0].devices, [mapping('sidecar')]);
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(result.pageErrors, 0);
  assert(!result.routeError);
  result.checks.push(
    'primary and sidecar created through shared UI with independent mappings',
    'real payload and response matched',
    'no JavaScript errors',
  );
  result.status = 'passed';
}
main()
  .catch((error) => {
    result.errorType = error?.name || 'Error';
    result.errorLines = [
      ...String(error?.stack || '').matchAll(/devices-sidecar-create\.cjs:([0-9]+):([0-9]+)/g),
    ].map((m) => Number(m[1]));
  })
  .finally(async () => {
    if (browser) {
      try {
        await browser.close();
        result.browserClosed = true;
      } catch {
        result.status = 'failed';
      }
    }
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'passed' ? 0 : 1;
  });
