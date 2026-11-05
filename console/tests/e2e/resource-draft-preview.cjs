const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  origin = 'http://localhost:18090',
  checks = [];
let browser,
  writes = 0;
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
    if (!['GET', 'HEAD'].includes(request.method()) && url.pathname != '/v2-beta/token') {
      writes++;
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.name));
  await page.goto(origin + '/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local', exact: true }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto(origin + '/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  for (const kind of ['Serviço', 'Container avulso'])
    for (const label of ['Quota de CPU (µs)', 'Limite de memória: valor']) {
      await page.getByText('Criar', { exact: true }).click();
      await page.getByRole('button', { name: kind, exact: true }).click();
      const dialog = page.getByRole('dialog', {
        name: kind === 'Serviço' ? 'Criar serviço' : 'Criar container avulso',
        exact: true,
      });
      await dialog.getByText('Recursos', { exact: true }).click();
      const field = dialog.getByLabel(label, { exact: true });
      await field.fill('x');
      assert.equal(await field.evaluate((el) => el.checkValidity()), false);
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      const discard = page.getByRole('dialog', { name: 'Descartar rascunho?', exact: true });
      await discard.waitFor();
      await discard.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await field.inputValue(), 'x');
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await discard.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      checks.push({
        kind,
        field: label,
        status: 'passed',
        firstInvalidEditGuarded: true,
        cancelPreservesText: true,
        confirmDiscards: true,
      });
      console.log('PASS: first invalid resource edit guarded ' + kind + ' ' + label);
    }
  assert.equal(writes, 0);
  assert.equal(errors.length, 0);
  fs.writeFileSync(
    path.join(root, 'console/resource-draft-preview-results.json'),
    JSON.stringify(
      { status: 'passed', checks, businessWrites: writes, pageErrors: errors },
      null,
      2,
    ),
  );
})()
  .catch((error) => {
    console.error(
      'Resource draft preview failed:',
      error.name,
      String(error.stack)
        .split('\n')
        .filter((line) => line.includes('resource-draft-preview.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
