const fs = require('node:fs'),
  path = require('node:path');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..');
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await c.route('**/*', (r) =>
    new URL(r.request().url()).origin === 'http://localhost:18090' && r.request().method() === 'GET'
      ? r.continue()
      : r.abort(),
  );
  await c.route('**/oidc/status', async (r) => {
    const response = await r.fetch(),
      cfg = await response.json();
    await r.fulfill({ response, json: { ...cfg, preflight: true, only: false, autoLogin: false } });
  });
  await c.route('**/oidc/readiness', (r) =>
    r.fulfill({ status: 503, json: { ready: false, checked: true } }),
  );
  const p = await c.newPage();
  await p.goto('http://localhost:18090/console/login');
  await p.getByRole('button', { name: 'Entrar com Keycloak', exact: true }).click();
  await p
    .getByRole('alert')
    .getByText('Não foi possível acessar o provedor de login. Tente novamente.', { exact: true })
    .waitFor();
  await p.waitForTimeout(1500);
  await p.evaluate(
    fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8'),
  );
  const findings = await p.evaluate(async () => ({
    violations: (
      await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      })
    ).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    theme: document.documentElement.dataset.theme,
  }));
  await p.screenshot({
    path: path.join(root, 'evidence/e2e-isolated/oidc-outage-diagnostic.png'),
    animations: 'disabled',
  });
  fs.writeFileSync(
    path.join(root, 'console/oidc-outage-visual-diagnostic.json'),
    JSON.stringify(findings, null, 2),
  );
  console.log(JSON.stringify(findings));
})()
  .catch((e) => {
    console.error('FAILED diagnostic ' + e.name);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
