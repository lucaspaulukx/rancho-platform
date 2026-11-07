const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const origin = 'http://localhost:18090',
  servicePath = '/v2-beta/projects/1a12/services/' + input.serviceId;
const result = {
  status: 'failed',
  checks: [],
  pageErrors: 0,
  upgradeRequests: 0,
  browserClosed: false,
};
const primary = '/dev/null:/dev/primary:r',
  initial = '/dev/null:/dev/helper-base:r',
  mapping = '/dev/null:/dev/helper-new:r';
let browser,
  page,
  devicesEnabled = false,
  sidecarsEnabled = true,
  missingFresh = false;
function check(name, ok = true) {
  assert(ok);
  result.checks.push(name);
}
function helper(value) {
  assert.equal(value.secondaryLaunchConfigs.length, 1);
  const valueHelper = value.secondaryLaunchConfigs[0];
  assert.equal(valueHelper.name, 'helper');
  return valueHelper;
}
async function read() {
  const response = await page.request.get(origin + servicePath, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(response.status(), 200);
  return response.json();
}
async function stable(state) {
  for (let i = 0; i < 120; i++) {
    const value = await read();
    if (value.state === state) return value;
    await page.waitForTimeout(500);
  }
  throw new Error('NativeTransitionTimeout');
}
async function open() {
  await page.getByRole('button', { name: 'Ações de device-web', exact: true }).click();
  await page
    .getByRole('menuitem', { name: 'Atualizar serviço', exact: true })
    .click({ timeout: 20_000 });
  await page.getByLabel('Nova imagem', { exact: true }).waitFor();
}
async function closeDraft() {
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Descartar rascunho?', exact: true });
  await discard.waitFor();
  await discard.getByRole('button', { name: 'Confirmar', exact: true }).click();
}
async function draft(reset = false) {
  await open();
  check(
    'primary device editor remains independently unselected',
    !(await page.getByLabel('Editar dispositivos nesta atualização', { exact: true }).isChecked()),
  );
  await page.getByLabel('Editar sidecars nesta atualização', { exact: true }).check();
  const group = page.getByRole('group', { name: 'Sidecar 1 · helper', exact: true });
  await group.getByText('Segurança', { exact: true }).click();
  if (reset)
    await group.getByRole('button', { name: 'Remover dispositivo 1', exact: true }).click();
  else await group.getByLabel('Caminho no container 1', { exact: true }).fill('/dev/helper-new');
  return group;
}
async function review() {
  const before = result.upgradeRequests;
  await page.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Atualizar dispositivos do serviço?',
    exact: true,
  });
  await dialog.waitFor();
  check('device review precedes native upgrade request', result.upgradeRequests === before);
  return dialog;
}
async function change(reset = false) {
  await draft(reset);
  const dialog = await review();
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  const value = await stable('upgraded');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  return value;
}
async function action(label) {
  await page.getByRole('button', { name: 'Ações de device-web', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Confirmar operação', exact: true }).click();
  const value = await stable('active');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  return value;
}
async function main() {
  assert.match(input.marker, /^console-devices-[a-f0-9]{12}$/);
  assert.match(input.serviceId, /^1s[0-9]+$/);
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
  });
  await context.addCookies(
    input.cookies.map(({ name, value }) => ({ name, value, url: origin, sameSite: 'Lax' })),
  );
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    try {
      assert.equal(url.origin, origin);
      if (!['GET', 'HEAD'].includes(request.method())) {
        assert.equal(request.method(), 'POST');
        assert.equal(url.pathname.replace(/\/$/, ''), servicePath);
        assert(['upgrade', 'rollback', 'finishupgrade'].includes(url.searchParams.get('action')));
        if (url.searchParams.get('action') === 'upgrade') {
          assert(!missingFresh);
          result.upgradeRequests++;
          const strategy = request.postDataJSON().inServiceStrategy;
          assert.deepEqual(strategy.launchConfig.devices, [primary]);
          assert.equal(strategy.launchConfig.environment.DEVICE_FIXTURE, 'preserved');
          assert.equal(strategy.launchConfig.imageUuid, 'docker:alpine:3.20');
          assert.deepEqual(helper(strategy).devices, result.upgradeRequests === 3 ? [] : [mapping]);
          assert.equal(helper(strategy).environment.SIDECAR_DEVICE_FIXTURE, 'preserved');
        }
      }
      if (url.pathname === '/console/console-config.json') {
        const response = await route.fetch(),
          config = await response.json();
        assert(config.modules && typeof config.modules === 'object');
        config.modules.workloadDeviceUpgrades = devicesEnabled;
        config.modules.workloadSidecarUpgrades = sidecarsEnabled;
        await route.fulfill({ response, json: config });
      } else if (
        missingFresh &&
        url.pathname.replace(/\/$/, '') === '/v2-beta/projects/1a12/schemas'
      ) {
        const response = await route.fetch(),
          data = await response.json();
        assert(Array.isArray(data.data));
        const contract = data.data.find((value) => value.id === 'secondaryLaunchConfig');
        assert(contract?.resourceFields?.devices);
        delete contract.resourceFields.devices;
        result.missingFreshResponses = (result.missingFreshResponses || 0) + 1;
        await route.fulfill({ response, json: data });
      } else await route.continue();
    } catch (error) {
      result.routeError = {
        errorType: error?.name || 'Error',
        lines: [
          ...String(error?.stack || '').matchAll(/sidecar-device-upgrades\.cjs:([0-9]+):([0-9]+)/g),
        ].map((m) => Number(m[1])),
      };
      await route.abort();
    }
  });
  page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on('pageerror', () => result.pageErrors++);
  const url = origin + '/console/stacks?env=1a12&q=' + input.marker;
  result.stage = 'device-flag-off';
  await page.goto(url);
  await open();
  check(
    'device flag off hides primary opt-in',
    (await page.getByLabel('Editar dispositivos nesta atualização', { exact: true }).count()) === 0,
  );
  await page.getByLabel('Editar sidecars nesta atualização', { exact: true }).check();
  check(
    'device flag off hides structured helper device controls',
    (await page
      .getByRole('group', { name: 'Sidecar 1 · helper', exact: true })
      .getByLabel('Caminho no container 1', { exact: true })
      .count()) === 0,
  );
  await closeDraft();
  devicesEnabled = true;
  sidecarsEnabled = false;
  result.stage = 'sidecar-flag-off';
  await page.goto(url);
  await open();
  check(
    'sidecar flag off hides sidecar opt-in',
    (await page.getByLabel('Editar sidecars nesta atualização', { exact: true }).count()) === 0,
  );
  check(
    'sidecar flag off retains independent primary opt-in',
    (await page.getByLabel('Editar dispositivos nesta atualização', { exact: true }).count()) === 1,
  );
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  sidecarsEnabled = true;
  await page.goto(url);
  const before = await read();
  assert.equal(before.description, input.marker);
  assert.equal(before.scale, 0);
  assert.deepEqual(before.launchConfig.devices, [primary]);
  assert.deepEqual(helper(before).devices, [initial]);
  function preserved(value) {
    assert.equal(value.scale, 0);
    assert.equal(value.stackId, before.stackId);
    for (const key of ['imageUuid', 'networkMode', 'command', 'environment', 'memory', 'devices'])
      assert.deepEqual(value.launchConfig[key], before.launchConfig[key]);
    for (const key of ['name', 'imageUuid', 'networkMode', 'command', 'environment', 'memory'])
      assert.deepEqual(helper(value)[key], helper(before)[key]);
  }
  result.stage = 'missing-fresh-secondary-device-contract';
  await draft();
  const dialog = await review(),
    count = result.upgradeRequests;
  missingFresh = true;
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: /dispositiv/i })
    .waitFor();
  check(
    'fresh secondary contract without devices rejects without POST',
    result.missingFreshResponses > 0 && result.upgradeRequests === count,
  );
  check(
    'contract rejection preserves helper device draft',
    (await page
      .getByRole('group', { name: 'Sidecar 1 · helper', exact: true })
      .getByLabel('Caminho no container 1', { exact: true })
      .inputValue()) === '/dev/helper-new',
  );
  missingFresh = false;
  preserved(await read());
  await closeDraft();
  result.stage = 'upgrade-and-rollback';
  let value = await change();
  preserved(value);
  assert.deepEqual(helper(value).devices, [mapping]);
  check('native upgrade persisted helper devices and preserved primary');
  value = await action('Reverter atualização');
  preserved(value);
  assert.deepEqual(helper(value).devices, [initial]);
  check('rollback restored helper base devices');
  result.stage = 'upgrade-and-finish';
  value = await change();
  preserved(value);
  value = await action('Concluir atualização');
  preserved(value);
  assert.deepEqual(helper(value).devices, [mapping]);
  check('finish retained helper devices and primary mapping');
  result.stage = 'reset';
  value = await change(true);
  preserved(value);
  assert.deepEqual(helper(value).devices, []);
  value = await action('Concluir atualização');
  preserved(value);
  assert.deepEqual(helper(value).devices, []);
  check('explicit helper empty reset persisted after finish');
  check('no navigation or JavaScript errors', page.url() === url && result.pageErrors === 0);
  check('only three intended upgrades sent', result.upgradeRequests === 3 && !result.routeError);
  result.status = 'passed';
}
main()
  .catch((error) => {
    result.errorType = error?.name || 'Error';
    result.errorLines = [
      ...String(error?.stack || '').matchAll(/sidecar-device-upgrades\.cjs:([0-9]+):([0-9]+)/g),
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
