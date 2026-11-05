const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const runtimeRequire = createRequire(path.join(input.runtimeModules, 'package.json'));
const { chromium } = runtimeRequire('playwright');
const root = path.resolve(__dirname, '../../..'),
  out = path.join(root, 'evidence/e2e-isolated');
fs.mkdirSync(out, { recursive: true });
let browser;
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
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.name));
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/stacks?env=1a12');
  await page.getByLabel('Buscar na operação', { exact: true }).waitFor();
  await page.screenshot({
    path: path.join(out, 'stacks-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Usar tema claro', exact: true }).click();
  await page.screenshot({
    path: path.join(out, 'stacks-light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Usar tema escuro', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(out, 'stacks-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (overflow) throw new Error('Horizontal document overflow at 390px');
  if (errors.length) throw new Error('Application page errors: ' + errors.join(','));
  const checks = [
    'local UI login restores authenticated shell',
    'stacks operation loads in independent session',
    'dark and light screenshots captured',
    '390px mobile layout has no document overflow',
    'no uncaught application page errors',
  ].map((check) => ({ check, status: 'passed' }));
  fs.writeFileSync(
    path.join(root, 'console/isolated-browser-smoke-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  for (const item of checks) console.log('PASS: ' + item.check);
  await context.close();
})()
  .catch((e) => {
    console.error(String(e.message).split(input.password).join('[redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
