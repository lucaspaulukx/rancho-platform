const { openKeycloakLogin } = require('./auth-flow.cjs');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..');
const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
const name = 'consoleenv' + crypto.randomBytes(6).toString('hex');
const url = 'http://127.0.0.1:1/' + name + '.git';
const project = '1a7',
  origin = 'http://localhost:18090';
const checks = [],
  audits = [];
let browser,
  context,
  page,
  baseline,
  enabled = true;
function check(check, condition = true) {
  assert.ok(condition, check);
  checks.push({ check, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/delegated-catalogs-e2e-results.json'),
    JSON.stringify(checks, null, 2),
  );
  console.log('PASS: ' + check);
}
async function native(method = 'GET', endpoint = '/v1-catalog/catalogs', data) {
  const csrf = (await context.cookies()).find((v) => v.name === 'CSRF')?.value || '';
  const response = await page.request.fetch(origin + endpoint, {
    method,
    data,
    headers: { Accept: 'application/json', 'X-Api-Csrf': csrf, 'X-Api-Project-Id': project },
  });
  assert.ok(
    [200, 201, 202, 204].includes(response.status()),
    'Native catalog request failed: HTTP ' + response.status(),
  );
  return response.status() === 204 ? null : response.json();
}
async function rows() {
  const data = await native();
  return data.data || data;
}
function stable(values) {
  return JSON.stringify(
    values
      .map((v) => [v.id, v.environmentId, v.name, v.url, v.branch, v.kind])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}
async function theme(value) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const toggle = page.getByRole('button', {
    name: value === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
  await page.waitForFunction((v) => document.documentElement.dataset.theme === v, value);
}
async function open() {
  await page.getByRole('button', { name: 'Fontes do environment', exact: true }).click();
  await page
    .getByRole('region', { name: 'Fontes de catálogo do environment', exact: true })
    .waitFor();
}
async function audit(view, requested, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  // Audit the settled theme/layout, after Radix effects and finite CSS transitions.
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  const appliedTheme = await page.locator('html').getAttribute('data-theme');
  assert.equal(appliedTheme, requested);
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
  audits.push({ view, requested, appliedTheme, width, violations, overflow });
  fs.writeFileSync(
    path.join(root, 'console/delegated-catalogs-a11y-results.json'),
    JSON.stringify(audits, null, 2),
  );
  await page.screenshot({
    path: path.join(
      root,
      'evidence/e2e-isolated',
      `delegated-catalogs-${view}-${requested}-${width}.png`,
    ),
    mask: [page.locator('input[type=password]')],
    animations: 'disabled',
  });
  assert.deepEqual(violations, []);
  assert.equal(overflow, false);
  check(`${view}: accessibility/layout ${requested} ${width}`);
}
async function save() {
  await page.getByRole('button', { name: 'Revisar fonte do environment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Salvar fonte do environment?', exact: true })
    .waitFor({ state: 'hidden' });
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'dark',
    locale: 'pt-BR',
  });
  await context.route('**/*', (route) =>
    ['http://localhost:18090', 'http://localhost:18081'].includes(
      new URL(route.request().url()).origin,
    )
      ? route.continue()
      : route.abort(),
  );
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: {
        ...cfg,
        modules: {
          ...cfg.modules,
          environmentCatalogs: true,
          environmentCatalogDelegation: enabled,
        },
      },
    });
  });
  page = await context.newPage();
  await page.goto(origin + '/console/login');
  await openKeycloakLogin(page);
  await page.locator('input[name="username"]').fill('operador');
  await page.locator('input[name="password"]').fill(input.labUserPassword);
  await page.locator('button[type="submit"],input[type="submit"]').click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  baseline = await rows();
  check(
    'isolated environment selected',
    (
      await (
        await page.request.get(origin + '/v2-beta/projects/' + project, {
          headers: { Accept: 'application/json' },
        })
      ).json()
    ).name === 'RBAC-DEV',
  );
  const target = origin + '/console/catalog?env=' + project + '&catalog=library&infra=true';
  await page.goto(target);
  for (const mode of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await theme(mode);
      await open();
      await audit('inventory', mode, width);
      await page
        .getByRole('button', { name: 'Adicionar repositório do environment', exact: true })
        .click();
      await page.getByLabel('Nome do repositório', { exact: true }).fill(name);
      await page.getByLabel('URL Git', { exact: true }).fill(url);
      await audit('editor', mode, width);
      check(
        'URL stays masked',
        (await page.getByLabel('URL Git', { exact: true }).getAttribute('type')) === 'password',
      );
      await page.getByRole('button', { name: 'Cancelar edição', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    }
  await theme('dark');
  await open();
  await page
    .getByRole('button', { name: 'Adicionar repositório do environment', exact: true })
    .click();
  await page.getByLabel('Nome do repositório', { exact: true }).fill(name);
  await page.getByLabel('URL Git', { exact: true }).fill(url);
  await save();
  let value = (await rows()).find((v) => v.name === name);
  check(
    'create persists native environment scope',
    value?.environmentId === project && value.url === url,
  );
  await page.getByRole('button', { name: 'Editar ' + name, exact: true }).click();
  check(
    'existing name remains fixed',
    await page.getByLabel('Nome do repositório', { exact: true }).isDisabled(),
  );
  await page.getByLabel('Branch do repositório', { exact: true }).fill('acceptance-next');
  await save();
  value = (await rows()).find((v) => v.name === name);
  check(
    'edit persists branch and preserves URL',
    value?.branch === 'acceptance-next' && value.url === url,
  );
  check(
    'catalog filters and environment remain in URL',
    new URL(page.url()).search === new URL(target).search,
  );
  await page.getByRole('button', { name: 'Remover ' + name, exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Remover fonte do environment?', exact: true })
    .waitFor({ state: 'hidden' });
  check('removal preserves baseline repositories', stable(await rows()) === stable(baseline));
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  const readerContext = await browser.newContext();
  await readerContext.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      cfg = await response.json();
    await route.fulfill({
      response,
      json: { ...cfg, modules: { ...cfg.modules, environmentCatalogDelegation: true } },
    });
  });
  const reader = await readerContext.newPage();
  await reader.goto(origin + '/console/login');
  await openKeycloakLogin(reader);
  await reader.locator('input[name="username"]').fill('leitor');
  await reader.locator('input[name="password"]').fill(input.labUserPassword);
  await reader.locator('button[type="submit"],input[type="submit"]').click();
  await reader.getByLabel('Navegação principal', { exact: true }).waitFor();
  await reader.goto(target);
  await reader.getByRole('heading', { name: 'Catálogo', exact: true }).waitFor();
  check(
    'readonly cannot see catalog source administration',
    (await reader.getByRole('button', { name: 'Fontes do environment', exact: true }).count()) ===
      0,
  );
  const denied = await reader.request.post(origin + '/v1-catalog/catalogs', {
    headers: {
      'X-Api-Project-Id': project,
      'X-Api-Csrf': (await readerContext.cookies()).find((v) => v.name === 'CSRF')?.value || '',
    },
    data: { name: name + 'denied', url, branch: 'master', kind: 'native' },
  });
  check('readonly native source creation denied', denied.status() === 403);
  await readerContext.close();
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Catálogo', exact: true }).waitFor();
  check(
    'flag disables contextual entry point',
    (await page.getByRole('button', { name: 'Fontes do environment', exact: true }).count()) === 0,
  );
})()
  .catch((error) => {
    console.error('Environment catalog acceptance failed; see sanitized checks.');
    console.error(
      error.name,
      String(error.stack)
        .split('\n')
        .filter((v) => v.includes('delegated-catalogs.cjs'))
        .join('\n'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (baseline && page) {
        for (const row of (await rows()).filter((v) => v.name === name)) {
          assert.equal(row.environmentId, project);
          assert.equal(row.url, url);
          await native('DELETE', '/v1-catalog/catalogs/' + encodeURIComponent(name), {
            name,
            url,
            branch: row.branch,
            kind: 'native',
          });
        }
        check(
          'final cleanup preserves all original source configurations',
          stable(await rows()) === stable(baseline),
        );
      }
    } catch {
      console.error('Owned environment catalog cleanup requires inspection.');
      process.exitCode = 1;
    }
    await browser?.close();
  });
