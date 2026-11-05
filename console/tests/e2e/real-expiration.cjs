const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const checks = [],
  contexts = [];
let browser;
function check(name) {
  checks.push({ check: name, status: 'passed' });
  console.log('PASS: ' + name);
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  for (const session of input.sessions) {
    const c = await browser.newContext({ locale: 'pt-BR' });
    contexts.push(c);
    await c.route('**/*', (route) => {
      const req = route.request(),
        u = new URL(req.url());
      if (u.origin !== 'http://localhost:18090' || !['GET', 'HEAD'].includes(req.method()))
        return route.abort();
      return route.continue();
    });
    await c.addCookies([
      {
        name: 'token',
        value: session.token,
        url: 'http://localhost:18090',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    const p = await c.newPage();
    await p.goto('http://localhost:18090/console/');
    // OIDC reader may have no operational environment, but still has authenticated shell.
    await p.getByLabel('Menu do usuário', { exact: true }).waitFor();
    check(session.kind + ': issued session initially authenticates browser');
    session.page = p;
  }
  for (const session of input.sessions) {
    const deadline = Date.now() + 90000;
    let status;
    while (Date.now() < deadline) {
      status = (
        await session.page.request.get('http://localhost:18090/v2-beta/projects?limit=1')
      ).status();
      if (status === 401) break;
      assert.equal(status, 200);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.equal(status, 401);
    check(session.kind + ': native API rejects actual expired token');
    await session.page.goto('http://localhost:18090/console/stacks?env=1a12');
    await session.page
      .getByRole('button', { name: 'Entrar com conta local', exact: true })
      .waitFor();
    check(session.kind + ': protected route returns to login after expiration');
  }
  fs.writeFileSync(
    path.join(input.root, 'console/real-expiration-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
})()
  .catch((e) => {
    console.error('FAILED: real expiration (' + e.name + '); credentials withheld.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
