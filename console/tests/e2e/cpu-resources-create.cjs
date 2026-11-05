const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090';
const state = JSON.parse(
  fs.readFileSync(path.join(root, 'console/cpu-resources-fixture.json'), 'utf8'),
);
assert.equal(state.environment, '1a12');
assert.ok(state.name.startsWith('console-cpu-resources-'));
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
  });
  await context.route('**/*', (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!['GET', 'HEAD'].includes(request.method())) {
      assert.equal(request.method(), 'POST');
      assert.ok(['/v2-beta/token', '/v2-beta/projects/1a12/services'].includes(url.pathname));
      if (url.pathname.endsWith('/services')) {
        const body = request.postDataJSON();
        assert.equal(body.stackId, state.stack);
        assert.equal(body.description, state.marker);
        assert.equal(body.name, 'cpu-resources-web');
        assert.equal(body.scale, 0);
        assert.equal(body.startOnCreate, false);
      }
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(origin + '/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto(origin + '/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).fill(state.name);
  await page.getByText('Criar', { exact: true }).click();
  await page.getByRole('button', { name: 'Serviço', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar serviço', exact: true });
  await dialog
    .getByLabel(/^Nome ?\*?$/)
    .first()
    .fill('cpu-resources-web');
  await dialog.getByLabel('Descrição', { exact: true }).fill(state.marker);
  await dialog.getByLabel('Imagem *', { exact: true }).fill('alpine:3.20');
  await dialog.getByLabel('Stack *', { exact: true }).selectOption(state.stack);
  await dialog.getByLabel('Escala', { exact: true }).fill('0');
  await dialog.getByLabel('Iniciar após criação', { exact: true }).uncheck();
  await dialog.getByText('Recursos', { exact: true }).click();
  for (const [label, value] of [
    ['Peso de CPU', '512'],
    ['Período de CPU (µs)', '100000'],
    ['Quota de CPU (µs)', '50000'],
    ['CPUs permitidas', '0'],
    ['Peso de I/O', '100'],
    ['Reserva de CPU (millicores)', '250'],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname === '/v2-beta/projects/1a12/services',
  );
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  const created = await response;
  assert.equal(created.status(), 201);
  const service = await created.json();
  assert.equal(service.stackId, state.stack);
  assert.deepEqual(
    Object.fromEntries(
      ['cpuShares', 'cpuPeriod', 'cpuQuota', 'cpuSet', 'blkioWeight', 'milliCpuReservation'].map(
        (key) => [key, service.launchConfig[key]],
      ),
    ),
    {
      cpuShares: 512,
      cpuPeriod: 100000,
      cpuQuota: 50000,
      cpuSet: '0',
      blkioWeight: 100,
      milliCpuReservation: 250,
    },
  );
  await dialog.waitFor({ state: 'hidden' });
  fs.writeFileSync(
    path.join(root, 'console/cpu-resources-create-results.json'),
    JSON.stringify(
      {
        status: 'passed',
        createdThroughSharedForm: true,
        zeroScale: true,
        nativeCpuFieldsMatched: true,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: shared creation form persists all CPU/IO fields in owned inactive zero-scale service',
  );
})()
  .catch((error) => {
    console.error(
      'CPU creation failed:',
      error.name,
      String(error.stack)
        .split('\n')
        .filter((line) => line.includes('cpu-resources-create.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
