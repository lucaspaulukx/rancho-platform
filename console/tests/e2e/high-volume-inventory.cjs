// Runs against the built local console with synthetic, read-only API responses.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const origin = 'http://localhost:18090';
const viewport = { width: 1440, height: 1000 };
const projectCount = 20;
const pageSize = 100;
const counts = { stacks: 20, services: 200, containers: 2000 };
const coldRuns = 3;
const round = (number) => Math.round(number * 100) / 100;
const projectId = (index) => `1a${9000 + index}`;
const projectName = (index) => `UX06 environment ${String(index).padStart(2, '0')}`;
const rowId = (project, collection, index) => `ux06-${project}-${collection}-${index}`;
const rowName = (project, index) => `ux06-${project}-container-${String(index).padStart(4, '0')}`;
const projects = Array.from({ length: projectCount }, (_, offset) => ({
  id: projectId(offset + 1),
  name: projectName(offset + 1),
  state: 'active',
  orchestration: 'cattle',
}));
const responses = new Map();
let stage = 'setup';

function synthetic(url, data, scope, collection, cursor) {
  responses.set(url, { body: JSON.stringify(data), scope, collection, cursor });
}

synthetic('/oidc/config', { version: 1, effective: {}, available: {} });
synthetic('/v2-beta/token', {
  data: [{ accountId: 'ux06', userIdentity: { externalId: 'ux06' }, userType: 'user' }],
});
synthetic('/v2-beta/projects?limit=100', { data: projects });
for (const { id } of projects) {
  const base = `/v2-beta/projects/${id}`;
  synthetic(`${base}/schemas`, {
    data: [
      {
        id: 'container',
        pluralName: 'containers',
        resourceFields: {},
        collectionMethods: ['GET'],
        resourceMethods: ['GET'],
        links: { collection: `${base}/containers` },
      },
    ],
  });
  for (const [collection, total] of Object.entries(counts)) {
    const items = Array.from({ length: total }, (_, index) => {
      const row = {
        id: rowId(id, collection, index),
        type: collection.slice(0, -1),
        name: rowId(id, collection, index),
        state: 'active',
        links: {},
      };
      if (collection === 'services') row.stackId = rowId(id, 'stacks', index % counts.stacks);
      if (collection === 'containers') {
        row.name = rowName(id, index);
        row.state = 'running';
        row.serviceIds = [rowId(id, 'services', index % counts.services)];
        row.imageUuid = 'docker:alpine:3.20';
      }
      return row;
    });
    const cursorUrl = (cursor) =>
      `${base}/${collection}?limit=${pageSize}${cursor ? `&marker=${cursor}` : ''}`;
    for (let cursor = 0; cursor < items.length; cursor += pageSize) {
      const end = cursor + pageSize;
      synthetic(
        cursorUrl(cursor),
        {
          data: items.slice(cursor, end),
          pagination: end < items.length ? { next: cursorUrl(end) } : {},
        },
        id,
        collection,
        cursor,
      );
    }
  }
}

function checkCursors(requests, project) {
  for (const [collection, total] of Object.entries(counts)) {
    const cursors = requests
      .filter((entry) => entry.scope === project && entry.collection === collection)
      .map((entry) => entry.cursor);
    const expected = Array.from(
      { length: Math.ceil(total / pageSize) },
      (_, index) => index * pageSize,
    );
    assert.deepEqual(cursors, expected);
  }
}

const rowNames = 'main .operation-row.container .resource-name-button bdi';
async function waitForRows(page, name, count) {
  await page.waitForFunction(
    ({ rowNames, name, count }) => {
      const visible = document.querySelectorAll(rowNames);
      return (
        (count == null || visible.length === count) &&
        [...visible].some((row) => row.textContent === name)
      );
    },
    { rowNames, name, count },
  );
}

async function checkScope(page, id) {
  assert.equal(
    await page
      .locator(rowNames)
      .evaluateAll(
        (names, prefix) => names.every((name) => name.textContent.startsWith(prefix)),
        `ux06-${id}-container-`,
      ),
    true,
  );
}

async function paint(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))),
      ),
  );
}

async function heap(session) {
  await session.send('HeapProfiler.collectGarbage');
  return (await session.send('Runtime.getHeapUsage')).usedSize;
}

async function run(browser, sweep) {
  const context = await browser.newContext({
    viewport,
    locale: 'pt-BR',
    colorScheme: 'dark',
    serviceWorkers: 'block',
  });
  const requests = [];
  let blocked = 0;
  let assetFailures = 0;
  let pageErrors = 0;
  try {
    await context.routeWebSocket('**/*', (socket) => {
      blocked += 1;
      socket.close();
    });
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const entry = responses.get(url.pathname + url.search);
      if (url.origin === origin && request.method() === 'GET') {
        if (entry) {
          if (entry.collection) requests.push(entry);
          return route.fulfill({ contentType: 'application/json', body: entry.body });
        }
        if (
          ['/console/containers', '/console/console-config.json'].includes(url.pathname) ||
          url.pathname.startsWith('/console/assets/') ||
          url.pathname.startsWith('/console/brand/')
        ) {
          return route.continue();
        }
      }
      blocked += 1;
      return route.abort();
    });
    await context.addInitScript((rowNames) => {
      window.ux06 = { longTasks: [], staleFrames: 0, transitionFrames: 0, checkScope: false };
      if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.ux06.longTasks.push(entry.duration);
        }).observe({ type: 'longtask', buffered: true });
      function checkRows() {
        if (window.ux06.checkScope) {
          const scope = new URLSearchParams(location.search).get('env');
          const selected = document
            .querySelector('.environment-trigger')
            ?.getAttribute('aria-label');
          const environment = selected?.match(/UX06 environment (\d{2})$/)?.[1];
          const first = document.querySelector(rowNames);
          if (first) {
            if (!first.textContent.startsWith(`ux06-${scope}-container-`))
              window.ux06.transitionFrames += 1;
            if (
              environment &&
              !first.textContent.startsWith(`ux06-1a${9000 + Number(environment)}-container-`)
            )
              window.ux06.staleFrames += 1;
          }
        }
        requestAnimationFrame(checkRows);
      }
      requestAnimationFrame(checkRows);
    }, rowNames);
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    page.on('pageerror', () => {
      pageErrors += 1;
    });
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/console/') && response.status() >= 400)
        assetFailures += 1;
    });
    const first = projects[0].id;
    stage = 'initial inventory';
    await page.goto(`${origin}/console/containers?env=${first}`, { waitUntil: 'domcontentloaded' });
    await waitForRows(page, rowName(first, 0));
    const readyMs = await paint(page);
    const coldRequests = requests.slice();
    checkCursors(coldRequests, first);
    assert.equal(coldRequests.length, 23);
    const initialRender = await page.evaluate((rowNames) => {
      const inventory = performance
        .getEntriesByType('resource')
        .filter((entry) =>
          /\/v2-beta\/projects\/[^/]+\/(stacks|services|containers)\?/.test(entry.name),
        );
      return {
        assetEntry: document.querySelector('script[type="module"][src]')?.getAttribute('src'),
        lastInventoryResponseMs: Math.max(0, ...inventory.map((entry) => entry.responseEnd)),
        domElements: document.querySelectorAll('*').length,
        renderedRows: document.querySelectorAll(rowNames).length,
      };
    }, rowNames);
    assert.match(initialRender.assetEntry, /^\/console\/assets\/[A-Za-z0-9_.-]+\.js$/);
    const summary = await page.locator('.operation-metrics strong').allTextContents();
    assert.deepEqual(summary.map(Number), Object.values(counts));
    await checkScope(page, first);
    const switcher = page.locator('.environment-trigger');
    const options = page.locator('.environment-options').getByRole('option');
    stage = 'environment choices';
    await switcher.click();
    await options.last().waitFor();
    assert.equal(await options.count(), projectCount);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.ux06.checkScope = true;
    });

    stage = 'inventory search';
    const search = page.getByRole('searchbox', { name: 'Buscar na operação' });
    const searchStart = await page.evaluate(() => performance.now());
    await search.fill(rowName(first, counts.containers - 1));
    await waitForRows(page, rowName(first, counts.containers - 1), 1);
    const searchMs = round((await paint(page)) - searchStart);
    await search.clear();
    await waitForRows(page, rowName(first, 0));

    const switchMeasurements = [];
    let heapBytes;
    if (sweep) {
      stage = 'environment sweep';
      const session = await context.newCDPSession(page);
      const firstScope = await heap(session);
      for (const [index, { id }] of projects.entries()) {
        if (!index) continue;
        await switcher.click();
        const option = options.filter({ hasText: projectName(index + 1) });
        const start = await page.evaluate(() => performance.now());
        await option.click();
        await waitForRows(page, rowName(id, 0));
        switchMeasurements.push(round((await paint(page)) - start));
        await checkScope(page, id);
        checkCursors(requests, id);
      }
      const afterSweep = await heap(session);
      stage = 'first environment revisit';
      await switcher.click();
      const start = await page.evaluate(() => performance.now());
      const requestStart = requests.length;
      await options.filter({ hasText: projectName(1) }).click();
      await waitForRows(page, rowName(first, 0));
      const revisitMs = round((await paint(page)) - start);
      const afterRevisit = await heap(session);
      heapBytes = { firstScope, afterSweep, afterRevisit };
      await session.detach();
      switchMeasurements.push({
        revisitMs,
        requestsByRevisitReady: requests
          .slice(requestStart)
          .filter((entry) => entry.scope === first).length,
      });
    }

    stage = 'network and render checks';
    const { longTasks, staleFrames, transitionFrames } = await page.evaluate(() => window.ux06);
    assert.equal(staleFrames, 0);
    assert.equal(blocked, 0);
    assert.equal(assetFailures, 0);
    assert.equal(pageErrors, 0);
    return {
      assetEntry: initialRender.assetEntry,
      initialReadyMs: round(readyMs),
      lastInventoryResponseMs: round(initialRender.lastInventoryResponseMs),
      responseToReadyMs: round(readyMs - initialRender.lastInventoryResponseMs),
      domElements: initialRender.domElements,
      renderedRows: initialRender.renderedRows,
      urlTransitionFrames: transitionFrames,
      initialInventoryRequests: coldRequests.length,
      initialInventoryJsonBytes: coldRequests.reduce(
        (sum, entry) => sum + Buffer.byteLength(entry.body),
        0,
      ),
      searchMs,
      longTasks: { count: longTasks.length, maxMs: Math.max(0, ...longTasks) },
      ...(sweep && { switchMeasurements, heapBytes, inventoryRequestsTotal: requests.length }),
    };
  } finally {
    await context.close();
  }
}

(async () => {
  const modules = process.env.PLAYWRIGHT_MODULES;
  const { chromium } = modules
    ? createRequire(path.resolve(modules, 'package.json'))('playwright')
    : require('playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE,
  });
  try {
    const samples = [];
    for (let index = 0; index < coldRuns; index += 1) samples.push(await run(browser, index === 0));
    assert.equal(new Set(samples.map(({ assetEntry }) => assetEntry)).size, 1);
    const initialMs = samples.map(({ initialReadyMs }) => initialReadyMs).sort((a, b) => a - b);
    console.log(
      JSON.stringify(
        {
          status: 'passed',
          assetEntry: samples[0].assetEntry,
          scope: 'Built localhost console, synthetic read-only API, browser measurements only',
          platform: {
            os: os.platform(),
            architecture: os.arch(),
            chromium: browser.version(),
            viewport,
          },
          fixture: { environments: projectCount, perEnvironment: counts, apiPageSize: pageSize },
          checks: {
            allEnvironmentsSelectable: true,
            apiPagination: true,
            search: true,
            environmentIsolation: true,
            networkAllowlist: true,
          },
          initialReadyMs: { min: initialMs[0], median: initialMs[1], max: initialMs[2] },
          samples,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  const script = path.basename(__filename);
  const line = String(error.stack)
    .split('\n')
    .find((entry) => entry.includes(script));
  const location = line?.match(/:(\d+):\d+\)?$/)?.[1];
  console.error(JSON.stringify({ status: 'failed', stage, errorType: error.name, line: location }));
  process.exitCode = 1;
});
