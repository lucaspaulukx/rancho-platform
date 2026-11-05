const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  checks = [],
  a11y = [];
let browser,
  enabled = true,
  page;
const requests = { members: 0, pools: 0 };
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/engine-monitoring-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function audit(name, theme, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const toggle = page.getByRole('button', {
    name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
  await page.screenshot({
    path: path.join(root, 'evidence/e2e-isolated', `engine-${name}-${theme}-${width}.png`),
    animations: 'disabled',
  });
  await page.evaluate(axe);
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  let keyboard = null;
  if (width === 390) {
    const region = page.getByRole('region', {
      name: name === 'pools' ? 'Pools de execução do engine' : 'Membros reportados do cluster',
      exact: true,
    });
    await region.focus();
    const bounds = await region.evaluate((e) => ({
      left: e.scrollLeft,
      width: e.clientWidth,
      scroll: e.scrollWidth,
    }));
    if (bounds.scroll > bounds.width + 1) {
      await region.press('ArrowRight');
      let moved = false;
      for (let i = 0; i < 20; i++) {
        if ((await region.evaluate((e) => e.scrollLeft)) > bounds.left) {
          moved = true;
          break;
        }
        await page.waitForTimeout(50);
      }
      assert.ok(moved, 'Horizontal table scroll must work from keyboard focus');
      keyboard = { scrollRequired: true, moved: true };
    } else keyboard = { scrollRequired: false, focusable: true };
  }
  a11y.push({ name, theme, width, violations, overflow, keyboard });
  fs.writeFileSync(
    path.join(root, 'console/engine-monitoring-a11y-results.json'),
    JSON.stringify(a11y, null, 2) + '\n',
  );
  assert.equal(violations.length, 0);
  assert.equal(overflow, false);
  check(`${name} accessibility keyboard scroll and layout ${theme} ${width}`);
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await c.route('**/*', (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (u.pathname.toLowerCase().includes('/haconfigs'))
      throw new Error('Monitor acceptance forbids HA configuration, script and dump requests');
    if (!['http://localhost:18090', 'http://localhost:18081'].includes(u.origin))
      return route.abort();
    if (!['GET', 'HEAD'].includes(req.method()) && u.pathname !== '/v2-beta/token')
      throw new Error('Engine monitor acceptance forbids writes');
    if (u.pathname === '/v2-beta/clustermemberships') requests.members++;
    if (u.pathname === '/v2-beta/processpools') requests.pools++;
    return route.continue();
  });
  await c.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: {
        ...cfg,
        modules: { ...cfg.modules, clusterMonitoring: enabled, processPools: enabled },
      },
    });
  });
  page = await c.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  await page.goto('http://localhost:18090/console/ha?env=1a12');
  await page.getByRole('heading', { name: 'HA e membros do cluster', exact: true }).waitFor();
  await page.getByRole('region', { name: 'Membros reportados do cluster', exact: true }).waitFor();
  check('HA loads real membership metadata without querying script or dump');
  await page.getByLabel('Atualizar membros automaticamente (5 s)', { exact: true }).uncheck();
  await page.waitForLoadState('networkidle');
  const membersBefore = requests.members;
  await page.waitForTimeout(5500);
  check('HA pause stops scheduled polling', requests.members === membersBefore);
  let request = page.waitForRequest(
    (r) => new URL(r.url()).pathname === '/v2-beta/clustermemberships',
  );
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await request;
  check('HA manual refresh remains available while paused');
  request = page.waitForRequest(
    (r) => new URL(r.url()).pathname === '/v2-beta/clustermemberships',
    { timeout: 7000 },
  );
  await page.getByLabel('Atualizar membros automaticamente (5 s)', { exact: true }).check();
  await request;
  check('HA polling resumes after explicit enable');
  await page.getByLabel('Atualizar membros automaticamente (5 s)', { exact: true }).uncheck();
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) await audit('members', theme, width);
  await page.goto('http://localhost:18090/console/processes?env=1a12');
  await page.getByRole('heading', { name: 'Processos', exact: true }).waitFor();
  await page.getByLabel('Nome do processo', { exact: true }).fill('credential.deactivate');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  check('inactive pool tab does not fetch engine counters', requests.pools === 0);
  await page.getByRole('tab', { name: 'Pools do engine', exact: true }).click();
  await page.getByRole('region', { name: 'Pools de execução do engine', exact: true }).waitFor();
  check('pool tab reads real native counters in same processes page');
  await page.getByLabel('Atualizar pools automaticamente (5 s)', { exact: true }).uncheck();
  await page.waitForLoadState('networkidle');
  const poolsBefore = requests.pools;
  await page.waitForTimeout(5500);
  check('pool pause stops scheduled polling', requests.pools === poolsBefore);
  request = page.waitForRequest((r) => new URL(r.url()).pathname === '/v2-beta/processpools');
  await page.getByRole('button', { name: 'Atualizar pools', exact: true }).click();
  await request;
  check('pool manual refresh works while paused');
  request = page.waitForRequest((r) => new URL(r.url()).pathname === '/v2-beta/processpools', {
    timeout: 7000,
  });
  await page.getByLabel('Atualizar pools automaticamente (5 s)', { exact: true }).check();
  await request;
  check('pool polling resumes explicitly');
  await page.getByLabel('Atualizar pools automaticamente (5 s)', { exact: true }).uncheck();
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) await audit('pools', theme, width);
  await page.getByRole('tab', { name: 'Execuções', exact: true }).click();
  check(
    'switching engine tab preserves process filter',
    (await page.getByLabel('Nome do processo', { exact: true }).inputValue()) ===
      'credential.deactivate',
  );
  enabled = false;
  await page.reload();
  check(
    'pool flag off preserves executions and removes pool tab',
    (await page.getByRole('tab', { name: 'Pools do engine', exact: true }).count()) === 0,
  );
  await page.goto('http://localhost:18090/console/ha');
  await page.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('HA flag blocks direct route');
  await c.close();
  enabled = true;
  const rc = await browser.newContext(),
    reader = await rc.newPage();
  await rc.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, clusterMonitoring: true, processPools: true } },
    });
  });
  await reader.goto('http://localhost:18090/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const resource of ['clustermemberships', 'processpools']) {
    const denied = await reader.request.get('http://localhost:18090/v2-beta/' + resource, {
      headers: { Accept: 'application/json' },
    });
    check(`native non-admin ${resource} denied`, [401, 403, 404, 405].includes(denied.status()));
  }
  await reader.goto('http://localhost:18090/console/ha');
  await reader.getByRole('heading', { name: 'Acesso restrito', exact: true }).waitFor();
  check('non-admin direct HA page denied');
  await rc.close();
})()
  .catch(async (e) => {
    if (page)
      await page
        .screenshot({
          path: path.join(root, 'evidence/e2e-isolated/engine-monitoring-failure.png'),
          animations: 'disabled',
        })
        .catch(() => {});
    let text = String(e.message);
    for (const s of [input.password, input.labUserPassword].filter(Boolean))
      text = text.split(s).join('[redacted]');
    console.error(text);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
