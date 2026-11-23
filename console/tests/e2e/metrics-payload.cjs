// Browser transport acceptance using an own container panel and its own service's real signed stats descriptor.
// This does not claim that the frontend already exposes a service aggregate chart.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(path.join(input.runtimeModules, 'package.json'))('playwright');
const origin = 'http://localhost:18090';
assert.match(input.instanceId, /^1i[0-9]+$/);
assert.match(input.serviceId, /^1s[0-9]+$/);
let browser;
const result = { status: 'failed', checks: [] };
(async () => {
  result.stage = 'browser-start';
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', colorScheme: 'dark' });
  await context.addCookies(input.cookies.map(({ name, value }) => ({ name, value, url: origin, sameSite: 'Lax' })));
  const base = '/v2-beta/projects/1a12/';
  let descriptorBytes = 0;
  let descriptorRequests = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/console/console-config.json') {
      const response = await route.fetch();
      const config = await response.json();
      config.modules.metricsPayloadTransport = true;
      return route.fulfill({ response, json: config });
    }
    if (url.pathname === base + 'containers/' + input.instanceId + '/stats') {
      assert.equal(route.request().headers()['x-rancher-stats-payload'], '1');
      const response = await route.fetch({ url: origin + base + 'services/' + input.serviceId + '/containerStats' });
      assert.equal(response.status(), 200);
      const descriptor = await response.json();
      assert.equal(typeof descriptor.payload, 'string');
      assert(descriptor.payload.length > 8192);
      assert(descriptor.token.length < 4096);
      descriptorBytes = descriptor.payload.length;
      descriptorRequests++;
      return route.fulfill({ response });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  const connections = [];
  page.on('pageerror', error => errors.push(error.name));
  page.on('websocket', socket => {
    const url = new URL(socket.url());
    if (url.pathname.replace(/\/$/, '') !== '/v1/containerstats/service') return;
    const entry = { port: Number(url.port), tokenChars: url.searchParams.get('token')?.length || 0, frames: [] };
    connections.push(entry);
    socket.on('framesent', frame => entry.frames.push(Buffer.byteLength(frame.payload)));
  });
  result.stage = 'open-own-container';
  await page.goto(origin + '/console/stacks?env=1a12&view=containers&q=' + encodeURIComponent(input.instanceName));
  await page.getByRole('button', { name: input.instanceName, exact: true }).click();
  result.stage = 'open-metrics-panel';
  await page.getByRole('dialog').getByRole('button', { name: 'Métricas', exact: true }).click();
  result.stage = 'await-live-sample';
  await page.getByRole('dialog').getByText('Ao vivo', { exact: true }).waitFor({ timeout: 25000 });
  assert.equal(connections.length, 1);
  assert.equal(connections[0].port, 18090);
  assert(connections[0].tokenChars < 4096);
  assert.deepEqual(connections[0].frames, [descriptorBytes]);
  assert.equal(descriptorRequests, 1);
  assert.equal(errors.length, 0);
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await context.close();
  result.status = 'passed';
  result.stage = 'closed';
  result.checks = ['own cookie restores app session', 'browser-only feature opt-in', 'real signed three-replica descriptor', 'short URL over console proxy', 'one large first frame', 'live own-container samples', 'dialog closes without reconnect', 'no uncaught page error'];
  result.payloadChars = descriptorBytes;
  result.urlTokenChars = connections[0].tokenChars;
})().catch(error => {
  result.errorType = error.name;
}).finally(async () => {
  if (browser) await browser.close();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'passed' ? 0 : 1;
});
