// Runs against the built local console with synthetic, read-only API responses.
// Set UX06_BASELINE=1 to measure the unpaginated path, including in older builds.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const origin = 'http://localhost:18090';
const viewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const projectCount = 20;
const pageSize = 100;
const renderedPageSize = 50;
const groupedPageSize = 100;
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

async function checkScope(page, id, count) {
  const names = await page.locator(rowNames).allTextContents();
  assert.equal(names.length, count);
  assert.ok(names.every((name) => name.startsWith(`ux06-${id}-container-`)));
  return names;
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

async function checkGrouped(page, first, pagination, apiRequests, requests) {
  const expand = page.getByRole('button', { name: 'Expandir tudo', exact: true });
  const collapse = page.getByRole('button', { name: 'Recolher tudo', exact: true });
  const previous = page.getByRole('button', { name: 'Página anterior', exact: true });
  const next = page.getByRole('button', { name: 'Próxima página', exact: true });
  const search = page.getByRole('searchbox', { name: 'Buscar na operação' });
  const pageStatus = (number, total) =>
    page.getByText(`Página ${number} de ${total}`, { exact: true });
  const resourceRows = page.locator('main .operation-row');
  const last = rowName(first, counts.containers - 1);
  const totalStackRows = counts.stacks + counts.services + counts.containers;
  const totalStackPages = Math.ceil(totalStackRows / groupedPageSize);
  const initialApiRequests = apiRequests.length;

  async function snapshot() {
    return page.evaluate((rowNames) => {
      const name = '.resource-name-button bdi';
      return {
        rows: document.querySelectorAll('main .operation-row').length,
        domElements: document.querySelectorAll('*').length,
        children: [...document.querySelectorAll(rowNames)].map((container) => {
          const service = container.closest('.operation-service');
          const serviceRow = service?.querySelector(
            ':scope > .operation-expand-row .operation-row',
          );
          const stack = service?.closest('.operation-stack');
          const stackRow = stack?.querySelector(':scope > .stack-heading .operation-row');
          return {
            name: container.textContent,
            service: serviceRow?.querySelector(name)?.textContent,
            stack: stackRow?.querySelector(name)?.textContent,
            stackContext: serviceRow?.querySelector('.operation-count')?.textContent,
          };
        }),
      };
    }, rowNames);
  }

  function checkParent(child, index, view) {
    const service = index % counts.services;
    const stack = rowId(first, 'stacks', service % counts.stacks);
    assert.equal(child.service, rowId(first, 'services', service));
    if (view === 'stacks') assert.equal(child.stack, stack);
    else assert.ok(child.stackContext.startsWith(`${stack} · `));
  }

  async function sweepView(view, totalRows, ancestorLimit) {
    const totalPages = Math.ceil(totalRows / groupedPageSize);
    const expected = Array.from({ length: counts.containers }, (_, index) => rowName(first, index));
    const indexes = new Map(expected.map((name, index) => [name, index]));
    const seen = new Set();
    let maxResourceRows = 0;
    let maxDomElements = 0;
    await pageStatus(1, totalPages).waitFor();
    assert.equal(await previous.isDisabled(), true);
    for (let number = 1; number <= totalPages; number += 1) {
      await pageStatus(number, totalPages).waitFor();
      const { rows, domElements, children } = await snapshot();
      const logicalRows = Math.min(groupedPageSize, totalRows - (number - 1) * groupedPageSize);
      assert.ok(rows >= logicalRows && rows <= logicalRows + ancestorLimit);
      if (number === 1) {
        assert.equal(rows, logicalRows);
        assert.ok(children.every((child) => child.name !== last));
      }
      for (const child of children) {
        assert.ok(indexes.has(child.name));
        assert.ok(!seen.has(child.name));
        checkParent(child, indexes.get(child.name), view);
        seen.add(child.name);
      }
      maxResourceRows = Math.max(maxResourceRows, rows);
      maxDomElements = Math.max(maxDomElements, domElements);
      if (number < totalPages) {
        await next.click();
        assert.equal(apiRequests.length, initialApiRequests);
      }
    }
    assert.equal(await next.isDisabled(), true);
    assert.equal(seen.size, counts.containers);
    assert.equal(apiRequests.length, initialApiRequests);
    return { totalPages, maxResourceRows, maxDomElements, containerOccurrences: seen.size };
  }

  stage = pagination ? 'grouped stack pagination' : 'grouped pagination disabled smoke';
  await expand.click();
  if (!pagination) {
    await waitForRows(page, last, counts.containers);
    const rows = await resourceRows.count();
    const domElements = await page.evaluate(() => document.querySelectorAll('*').length);
    assert.equal(rows, totalStackRows);
    assert.equal(await previous.count(), 0);
    assert.equal(await next.count(), 0);
    await collapse.click();
    assert.equal(await page.locator(rowNames).count(), 0);
    assert.equal(await resourceRows.count(), counts.stacks);
    assert.equal(apiRequests.length, initialApiRequests);
    return { pagination, expandedResourceRows: rows, expandedDomElements: domElements };
  }
  const stacks = await sweepView('stacks', totalStackRows, 2);

  stage = 'grouped search and expansion resets';
  await search.fill(last);
  await waitForRows(page, last, 1);
  const match = await snapshot();
  assert.equal(match.rows, 3);
  checkParent(match.children[0], counts.containers - 1, 'stacks');
  await search.clear();
  await pageStatus(1, totalStackPages).waitFor();
  await next.click();
  await pageStatus(2, totalStackPages).waitFor();
  await collapse.click();
  assert.equal(await page.locator(rowNames).count(), 0);
  assert.equal(await resourceRows.count(), counts.stacks);
  assert.equal(await next.count(), 0);
  await expand.click();
  await pageStatus(1, totalStackPages).waitFor();
  await next.click();
  await pageStatus(2, totalStackPages).waitFor();
  await expand.click();
  await pageStatus(1, totalStackPages).waitFor();

  stage = 'grouped service pagination';
  await next.click();
  await pageStatus(2, totalStackPages).waitFor();
  await page.getByRole('tab', { name: 'Serviços', exact: true }).click();
  const services = await sweepView('services', counts.services + counts.containers, 1);

  stage = 'grouped environment reset';
  await page.locator('.environment-trigger').click();
  await page
    .locator('.environment-options')
    .getByRole('option', { name: projectName(2) })
    .click();
  const second = projects[1].id;
  await page
    .locator('main .operation-row.service .resource-name-button bdi')
    .filter({ hasText: new RegExp(`^${rowId(second, 'services', 0)}$`) })
    .waitFor();
  assert.equal(await previous.isDisabled(), true);
  assert.equal(await page.locator(rowNames).count(), 0);
  checkCursors(requests, second);
  return {
    pagination,
    logicalPageSize: groupedPageSize,
    stacks,
    services,
    globalSearch: true,
    expansionResetsPage: true,
    viewResetsPage: true,
    environmentResetsPage: true,
    noAdditionalApiRequestsForSearchOrPaging: true,
  };
}

async function run(
  browser,
  { pagination, grouped, sweep = false, smoke = false, size = viewport },
) {
  const context = await browser.newContext({
    viewport: size,
    locale: 'pt-BR',
    colorScheme: 'dark',
    serviceWorkers: 'block',
  });
  const requests = [];
  const apiRequests = [];
  let blocked = 0;
  let assetFailures = 0;
  let pageErrors = 0;
  function checkNetwork() {
    assert.equal(blocked, 0);
    assert.equal(assetFailures, 0);
    assert.equal(pageErrors, 0);
  }
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
          apiRequests.push(url.pathname + url.search);
          if (entry.collection) requests.push(entry);
          return route.fulfill({ contentType: 'application/json', body: entry.body });
        }
        if (url.pathname === '/console/console-config.json') {
          const response = await route.fetch({ maxRedirects: 0 });
          const config = await response.json();
          config.workloadInventoryPagination = pagination;
          config.workloadTreePagination = grouped === true;
          return route.fulfill({ response, json: config });
        }
        if (
          url.pathname === '/console/containers' ||
          url.pathname.startsWith('/console/assets/') ||
          url.pathname.startsWith('/console/brand/')
        ) {
          return route.continue();
        }
      }
      blocked += 1;
      return route.abort();
    });
    if (grouped !== undefined) {
      // Exercise the background-tab polling policy while measuring local page changes.
      await context.addInitScript(() => {
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
      });
    }
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
    if (grouped !== undefined) {
      stage = 'initial grouped inventory';
      await page.goto(`${origin}/console/containers?env=${first}&view=stacks`, {
        waitUntil: 'domcontentloaded',
      });
      await page
        .locator('main .operation-row.stack .resource-name-button bdi')
        .filter({ hasText: new RegExp(`^${rowId(first, 'stacks', 0)}$`) })
        .waitFor();
      checkCursors(requests, first);
      assert.equal(requests.length, 23);
      const assetEntry = await page.locator('script[type="module"][src]').getAttribute('src');
      const result = await checkGrouped(page, first, grouped, apiRequests, requests);
      checkNetwork();
      return { assetEntry, ...result };
    }
    const expectedRows = pagination ? renderedPageSize : counts.containers;
    stage = smoke ? 'pagination disabled smoke' : 'initial inventory';
    await page.goto(`${origin}/console/containers?env=${first}`, { waitUntil: 'domcontentloaded' });
    await waitForRows(page, rowName(first, 0), expectedRows);
    const readyMs = await paint(page);
    const coldRequests = requests.slice();
    checkCursors(coldRequests, first);
    assert.equal(coldRequests.length, 23);
    assert.deepEqual(apiRequests.filter((url) => !responses.get(url).collection).sort(), [
      '/oidc/config',
      `/v2-beta/projects/${first}/schemas`,
      '/v2-beta/projects?limit=100',
      '/v2-beta/token',
    ]);
    const initialApiRequests = apiRequests.length;
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
    assert.equal(initialRender.renderedRows, expectedRows);
    const summary = await page.locator('.operation-metrics strong').allTextContents();
    assert.deepEqual(summary.map(Number), Object.values(counts));
    const firstPage = await checkScope(page, first, expectedRows);
    const previous = page.getByRole('button', { name: 'Página anterior', exact: true });
    const next = page.getByRole('button', { name: 'Próxima página', exact: true });
    if (!pagination) {
      assert.equal(await previous.count(), 0);
      assert.equal(await next.count(), 0);
    }
    if (smoke) {
      if (pagination) {
        stage = 'mobile pagination';
        assert.equal(await previous.isDisabled(), true);
        await next.click();
        await page.getByText('Página 2 de 40', { exact: true }).waitFor();
        assert.ok(
          (await checkScope(page, first, expectedRows)).every((name) => !firstPage.includes(name)),
        );
        assert.equal(apiRequests.length, initialApiRequests);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
      }
      checkNetwork();
      return {
        assetEntry: initialRender.assetEntry,
        renderedRows: initialRender.renderedRows,
        paginationControls: pagination,
        ...(pagination && { viewport: size, nextPage: true, documentFitsViewport: true }),
        initialApiRequests,
      };
    }
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
    await checkScope(page, first, 1);
    await search.clear();
    await waitForRows(page, rowName(first, 0), expectedRows);

    if (pagination) {
      stage = 'container pagination';
      const totalPages = Math.ceil(counts.containers / renderedPageSize);
      const pageStatus = (number) =>
        page.getByText(`Página ${number} de ${totalPages}`, { exact: true });
      await pageStatus(1).waitFor();
      assert.equal(await previous.isDisabled(), true);
      await next.click();
      await pageStatus(2).waitFor();
      const secondPage = await checkScope(page, first, expectedRows);
      assert.ok(secondPage.every((name) => !firstPage.includes(name)));
      await previous.click();
      await pageStatus(1).waitFor();
      assert.deepEqual(await checkScope(page, first, expectedRows), firstPage);
      assert.equal(apiRequests.length, initialApiRequests);
    }

    const switchMeasurements = [];
    let heapBytes;
    if (sweep) {
      stage = 'environment sweep';
      const session = await context.newCDPSession(page);
      const firstScope = await heap(session);
      if (pagination) {
        await next.click();
        assert.equal(await previous.isEnabled(), true);
        await checkScope(page, first, expectedRows);
        assert.equal(apiRequests.length, initialApiRequests);
      }
      for (const [index, { id }] of projects.entries()) {
        if (!index) continue;
        await switcher.click();
        const option = options.filter({ hasText: projectName(index + 1) });
        const start = await page.evaluate(() => performance.now());
        await option.click();
        await waitForRows(page, rowName(id, 0), expectedRows);
        switchMeasurements.push(round((await paint(page)) - start));
        await checkScope(page, id, expectedRows);
        if (pagination) assert.equal(await previous.isDisabled(), true);
        checkCursors(requests, id);
      }
      const afterSweep = await heap(session);
      stage = 'first environment revisit';
      await switcher.click();
      const start = await page.evaluate(() => performance.now());
      const requestStart = requests.length;
      await options.filter({ hasText: projectName(1) }).click();
      await waitForRows(page, rowName(first, 0), expectedRows);
      const revisitMs = round((await paint(page)) - start);
      await checkScope(page, first, expectedRows);
      if (pagination) assert.equal(await previous.isDisabled(), true);
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
    checkNetwork();
    return {
      assetEntry: initialRender.assetEntry,
      initialReadyMs: round(readyMs),
      lastInventoryResponseMs: round(initialRender.lastInventoryResponseMs),
      responseToReadyMs: round(readyMs - initialRender.lastInventoryResponseMs),
      domElements: initialRender.domElements,
      renderedRows: initialRender.renderedRows,
      urlTransitionFrames: transitionFrames,
      initialApiRequests,
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
    const pagination = process.env.UX06_BASELINE !== '1';
    const samples = [];
    for (let index = 0; index < coldRuns; index += 1)
      samples.push(await run(browser, { pagination, sweep: index === 0 }));
    assert.equal(new Set(samples.map(({ assetEntry }) => assetEntry)).size, 1);
    const disabledSmoke = pagination
      ? await run(browser, { pagination: false, smoke: true })
      : null;
    if (disabledSmoke) assert.equal(disabledSmoke.assetEntry, samples[0].assetEntry);
    const mobileSmoke = pagination
      ? await run(browser, { pagination, smoke: true, size: mobileViewport })
      : null;
    if (mobileSmoke) assert.equal(mobileSmoke.assetEntry, samples[0].assetEntry);
    const grouped = pagination
      ? {
          enabled: await run(browser, { pagination, grouped: true }),
          disabled: await run(browser, { pagination, grouped: false }),
        }
      : null;
    if (grouped) {
      assert.equal(grouped.enabled.assetEntry, samples[0].assetEntry);
      assert.equal(grouped.disabled.assetEntry, samples[0].assetEntry);
      assert.ok(grouped.enabled.stacks.maxDomElements < grouped.disabled.expandedDomElements);
    }
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
          workloadInventoryPagination: pagination,
          checks: {
            allEnvironmentsSelectable: true,
            apiPagination: true,
            search: true,
            environmentIsolation: true,
            networkAllowlist: true,
            ...(pagination && {
              renderedPageSize,
              clientPagination: true,
              environmentResetsPage: true,
              noAdditionalApiRequestsForSearchOrPaging: true,
            }),
          },
          initialReadyMs: { min: initialMs[0], median: initialMs[1], max: initialMs[2] },
          samples,
          ...(disabledSmoke && { disabledSmoke }),
          ...(mobileSmoke && { mobileSmoke }),
          ...(grouped && { grouped }),
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
