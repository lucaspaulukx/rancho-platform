// Runs against the built local console with synthetic, read-only API responses.
// Set UX06_BASELINE=1 to measure the unpaginated path, including in older builds.
// Set UX06_SOAK_SECONDS=60–900 to run only the visible-tab polling soak.
// Set UX06_LAYOUT_ONLY=1 to run only the narrow and RTL layout smoke.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { setTimeout: sleep } = require('node:timers/promises');

const origin = 'http://localhost:18090';
const viewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const projectCount = 20;
const pageSize = 100;
const renderedPageSize = 50;
const groupedPageSize = 100;
const counts = { stacks: 20, services: 200, containers: 2000 };
const coldRuns = 3;
const refreshTimeoutMs = 22_000; // Inventory polls every 15 seconds.
const soakFailureMessage = 'UX06 synthetic inventory read failure';
const longEnvironmentName = 'synthetic-environment-' + 'x'.repeat(80);
const longStackName = 'synthetic-stack-' + 'x'.repeat(80);
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

async function checkInventoryLocales(page) {
  const summary = page.locator('.workload-context > .muted');
  const language = page.locator('.language-selector select');
  for (const [locale, expected, direction] of [
    ['pt-BR', '20 stacks · 200 serviços · 2.000 containers', 'ltr'],
    ['fr-FR', '20 stacks · 200 services · 2\u202f000 conteneurs', 'ltr'],
    ['fa-IR', '۲۰ پشته · ۲۰۰ سرویس · ۲٬۰۰۰ کانتینر', 'rtl'],
  ]) {
    await language.selectOption(locale);
    await page.waitForFunction(
      ({ expected, direction }) =>
        document.documentElement.dir === direction &&
        document.querySelector('.workload-context > .muted')?.textContent === expected,
      { expected, direction },
    );
    assert.ok(await summary.isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
}

async function checkOperationLayout(page) {
  const heading = page.getByRole('heading', { name: longEnvironmentName, exact: true });
  const checkText = async (locator) => {
    const fits = await locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return (
        box.left >= -1 &&
        box.right <= innerWidth + 1 &&
        text.left >= box.left - 1 &&
        text.right <= box.right + 1
      );
    });
    assert.ok(fits, 'the full name must fit inside its column and viewport');
  };

  const stackContext = (kind) =>
    page
      .locator(`.operation-row.${kind} .operation-count`)
      .filter({ hasText: longStackName })
      .first();
  await checkText(heading);
  await checkText(stackContext('container'));
  await page.locator('#operation-view-1').click();
  await checkText(stackContext('service'));

  await page.setViewportSize(viewport);
  await page.locator('.language-selector select').selectOption('fa-IR');
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  const metrics = page.locator('.operation-metrics > span');
  const treeTools = page.locator('.operation-tree-tools > span');
  assert.ok(
    await metrics.evaluate((totals) => {
      const row = totals.parentElement;
      const left = row.getBoundingClientRect().left;
      const inset = parseFloat(getComputedStyle(row).paddingInlineEnd);
      return Math.abs(totals.getBoundingClientRect().left - left - inset) <= 2;
    }),
    'RTL totals align with the inline end of the metrics row',
  );
  assert.ok(
    await treeTools.evaluate(
      (count) =>
        Math.abs(
          count.parentElement.getBoundingClientRect().right - count.getBoundingClientRect().right,
        ) <= 1,
    ),
    'RTL tree count aligns with the inline start of the toolbar',
  );
  await checkText(heading);
  await page.setViewportSize({ ...mobileViewport, width: 320 });
  await checkText(heading);
  await checkText(stackContext('service'));

  await page.locator('.language-selector select').selectOption('fr-FR');
  const longState = page
    .locator('.operation-row.service .operation-state .badge bdi')
    .filter({ hasText: 'Retour à la version précédente en cours' })
    .first();
  await checkText(longState);
  assert.ok(
    await longState.evaluate((label) => {
      const badge = label.closest('.badge').getBoundingClientRect();
      const column = label.closest('.operation-state').getBoundingClientRect();
      return badge.left >= column.left - 1 && badge.right <= column.right + 1;
    }),
    'a long translated state fits within its column',
  );

  const row = page
    .locator('.operation-row.service')
    .filter({ hasText: 'Retour à la version précédente en cours' })
    .first();
  const trigger = row.locator('.action-menu-trigger');
  assert.match(await trigger.getAttribute('aria-label'), /^Actions pour ux06-/);
  await trigger.press('ArrowDown');
  const menu = page.getByRole('menu', {
    name: await trigger.getAttribute('aria-label'),
    exact: true,
  });
  const details = menu.getByRole('menuitem', { name: 'Voir les détails', exact: true });
  await details.waitFor();
  assert.ok(
    await menu.getByRole('menuitem', { name: 'Voir les journaux', exact: true }).isDisabled(),
  );
  assert.ok(await details.evaluate((button) => button === document.activeElement));
  await page.keyboard.press('ArrowDown');
  assert.ok(await details.evaluate((button) => button === document.activeElement));
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.ok(await trigger.evaluate((button) => button === document.activeElement));

  await trigger.press('ArrowDown');
  await details.waitFor();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog');
  await drawer.waitFor();
  await page.waitForFunction(
    (element) => element.contains(document.activeElement),
    await drawer.elementHandle(),
  );
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  await page.waitForFunction(
    (button) => button === document.activeElement,
    await trigger.elementHandle(),
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

async function checkSoak(context, page, requests, readFailure, seconds) {
  const expand = page.getByRole('button', { name: 'Expandir tudo', exact: true });
  const next = page.getByRole('button', { name: 'Próxima página', exact: true });
  const search = page.getByRole('searchbox', { name: 'Buscar na operação' });
  const ready = page
    .getByRole('button', { name: 'Atualizar', exact: true })
    .and(page.locator(':enabled'));
  const resourceRows = page.locator('main .operation-row');
  const totalPages = Math.ceil(
    Object.values(counts).reduce((sum, count) => sum + count, 0) / groupedPageSize,
  );
  const pageStatus = (number) =>
    page.getByText(`Página ${number} de ${totalPages}`, { exact: true });
  const environments = projects.slice(0, 2);
  const measurements = [];
  let interactionCycles = 0;
  let completedPolls = 0;
  let maxResourceRows = 0;

  async function switchEnvironment(index) {
    await page.locator('.environment-trigger').click();
    await page
      .locator('.environment-options')
      .getByRole('option', { name: projectName(index + 1) })
      .click();
    await page
      .locator('main .operation-row.stack .resource-name-button bdi')
      .filter({ hasText: new RegExp(`^${rowId(environments[index].id, 'stacks', 0)}$`) })
      .waitFor();
    await ready.waitFor();
  }

  async function checkRows(id, min, max) {
    const names = await resourceRows.evaluateAll((rows) =>
      rows.map((row) => row.querySelector('.resource-name-button bdi')?.textContent),
    );
    assert.ok(names.length >= min && names.length <= max);
    assert.ok(names.every((name) => name?.startsWith(`ux06-${id}-`)));
    maxResourceRows = Math.max(maxResourceRows, names.length);
  }

  async function interact(id) {
    await expand.click();
    await pageStatus(1).waitFor();
    await checkRows(id, groupedPageSize, groupedPageSize);
    await next.click();
    await pageStatus(2).waitFor();
    await checkRows(id, groupedPageSize, groupedPageSize + 2);
    const last = rowName(id, counts.containers - 1);
    await search.fill(last);
    await waitForRows(page, last, 1);
    await checkRows(id, 3, 3);
    await search.clear();
    await pageStatus(1).waitFor();
    await checkRows(id, groupedPageSize, groupedPageSize);
    interactionCycles += 1;
  }

  async function observePoll(id) {
    const start = requests.length;
    const lastPage = `${origin}/v2-beta/projects/${id}/containers?limit=${pageSize}&marker=${counts.containers - pageSize}`;
    // No UI interaction occurs in this window. Wait for the final successful page,
    // then verify all three collections and the completed refresh in the UI.
    await page.waitForResponse((response) => response.url() === lastPage && response.ok(), {
      timeout: Math.min(refreshTimeoutMs, Math.max(1, deadline - performance.now())),
    });
    await ready.waitFor();
    const cycle = requests.slice(start);
    assert.ok(cycle.every((entry) => entry.scope === id));
    checkCursors(cycle, id);
    await pageStatus(1).waitFor();
    await checkRows(id, groupedPageSize, groupedPageSize);
    completedPolls += 1;
  }

  stage = 'soak warmup';
  assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
  await page.evaluate(() => {
    window.ux06.checkScope = true;
  });
  await switchEnvironment(1);
  checkCursors(requests, environments[1].id);
  await switchEnvironment(0);
  await expand.click();
  await pageStatus(1).waitFor();

  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  async function sample() {
    const heapBytes = await heap(session);
    const { metrics } = await session.send('Performance.getMetrics');
    const taskSeconds = metrics.find(({ name }) => name === 'TaskDuration')?.value;
    assert.ok(Number.isFinite(taskSeconds) && taskSeconds >= 0);
    return {
      elapsedMs: round(performance.now() - started),
      postGcHeapBytes: heapBytes,
      taskSeconds,
    };
  }
  const started = performance.now();
  const deadline = started + seconds * 1000;
  try {
    measurements.push(await sample());
    const first = environments[0].id;
    stage = 'soak grouped interaction';
    await interact(first);

    stage = 'soak transient polling failure';
    readFailure.scope = first;
    readFailure.remaining = 2; // Exhaust the app's single automatic query retry.
    const error = page
      .locator('main .error-state')
      .getByRole('alert')
      .filter({ hasText: soakFailureMessage });
    await error.waitFor({ timeout: refreshTimeoutMs });
    assert.equal(readFailure.remaining, 0);

    stage = 'soak automatic recovery';
    await observePoll(first);
    assert.equal(await error.count(), 0);
    measurements.push(await sample());

    let environment = 0;
    do {
      stage = 'soak grouped interaction';
      environment = 1 - environment;
      const { id } = environments[environment];
      await switchEnvironment(environment);
      await interact(id);
      stage = 'soak periodic refresh';
      await observePoll(id);
      measurements.push(await sample());
    } while (deadline - performance.now() >= refreshTimeoutMs);
    await sleep(Math.max(0, deadline - performance.now()));

    stage = 'soak final measurements';
    await checkRows(environments[environment].id, groupedPageSize, groupedPageSize);
    const final = await sample();
    measurements.push(final);
    const initial = measurements[0];
    const { staleFrames } = await page.evaluate(() => window.ux06);
    assert.equal(staleFrames, 0);
    assert.ok(completedPolls >= 2);
    assert.ok(final.taskSeconds > initial.taskSeconds);
    return {
      requestedSeconds: seconds,
      measuredSeconds: round(final.elapsedMs / 1000),
      environmentsExercised: environments.length,
      interactionCycles,
      completedPolls,
      syntheticReadFailures: 2,
      automaticRecovery: true,
      maxResourceRows,
      mainThreadTaskMs: round((final.taskSeconds - initial.taskSeconds) * 1000),
      postGcHeapDeltaBytes: final.postGcHeapBytes - initial.postGcHeapBytes,
      samples: measurements.map(({ elapsedMs, postGcHeapBytes, taskSeconds }) => ({
        elapsedMs: round(elapsedMs - initial.elapsedMs),
        postGcHeapBytes,
        mainThreadTaskMs: round((taskSeconds - initial.taskSeconds) * 1000),
      })),
    };
  } finally {
    await session.detach();
  }
}

async function run(
  browser,
  {
    pagination,
    grouped,
    sweep = false,
    smoke = false,
    layout = false,
    inventoryLocales = false,
    soakSeconds,
    size = viewport,
  },
) {
  const context = await browser.newContext({
    viewport: size,
    locale: 'pt-BR',
    colorScheme: 'dark',
    serviceWorkers: 'block',
  });
  const requests = [];
  const apiRequests = [];
  const readFailure = { scope: null, remaining: 0 };
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
          if (
            readFailure.remaining > 0 &&
            entry.scope === readFailure.scope &&
            entry.collection === 'containers' &&
            entry.cursor === counts.containers - pageSize
          ) {
            readFailure.remaining -= 1;
            return route.fulfill({ status: 503, json: { message: soakFailureMessage } });
          }
          if (entry.collection) requests.push(entry);
          if (layout && (url.pathname === '/v2-beta/projects' || entry.collection === 'stacks')) {
            const json = JSON.parse(entry.body);
            json.data[0].name = entry.collection === 'stacks' ? longStackName : longEnvironmentName;
            return route.fulfill({ json });
          }
          if (layout && entry.collection === 'services') {
            const json = JSON.parse(entry.body);
            json.data[0].state = 'rolling-back';
            json.data[0].accountId = entry.scope;
            return route.fulfill({ json });
          }
          return route.fulfill({ contentType: 'application/json', body: entry.body });
        }
        if (url.pathname === '/console/console-config.json') {
          const response = await route.fetch({ maxRedirects: 0 });
          const config = await response.json();
          config.workloadInventoryPagination = pagination;
          config.workloadTreePagination = grouped === true;
          if (layout || inventoryLocales) {
            config.modules.observability = true;
            config.localization = {
              enabled: true,
              defaultLocale: 'pt-BR',
              availableLocales: ['pt-BR', 'en-US', 'fa-IR', 'fr-FR'],
              selectable: true,
              detectBrowser: false,
              preview: true,
            };
          }
          if (inventoryLocales) config.modules.contextActions = false;
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
    if (grouped !== undefined && !soakSeconds) {
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
    if (inventoryLocales) {
      stage = 'localized inventory with context actions disabled';
      await page.goto(`${origin}/console/containers?env=${first}`, {
        waitUntil: 'domcontentloaded',
      });
      await checkInventoryLocales(page);
      checkNetwork();
      return { localizedSummary: true, locales: ['pt-BR', 'fr-FR', 'fa-IR'], viewport: size };
    }
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
      const result = soakSeconds
        ? await checkSoak(context, page, requests, readFailure, soakSeconds)
        : await checkGrouped(page, first, grouped, apiRequests, requests);
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
      if (layout) {
        stage = 'long names and RTL layout';
        await checkOperationLayout(page);
      }
      checkNetwork();
      return {
        assetEntry: initialRender.assetEntry,
        renderedRows: initialRender.renderedRows,
        paginationControls: pagination,
        ...(pagination && { viewport: size, nextPage: true, documentFitsViewport: true }),
        ...(layout && { longNamesAndRtlLayout: true, contextMenuKeyboard: true }),
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
  const duration = process.env.UX06_SOAK_SECONDS;
  const soakSeconds = duration === undefined ? undefined : Number(duration);
  const pagination = process.env.UX06_BASELINE !== '1';
  if (duration !== undefined) {
    stage = 'validate UX06_SOAK_SECONDS (60–900 integer, grouped pagination required)';
    assert.ok(/^\d+$/.test(duration) && soakSeconds >= 60 && soakSeconds <= 900 && pagination);
  }
  stage = 'launch Chromium';
  const modules = process.env.PLAYWRIGHT_MODULES;
  const { chromium } = modules
    ? createRequire(path.resolve(modules, 'package.json'))('playwright')
    : require('playwright');
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE,
  });
  try {
    const evidence = {
      scope: 'Built localhost console, synthetic read-only API, browser measurements only',
      platform: {
        os: os.platform(),
        architecture: os.arch(),
        chromium: browser.version(),
        viewport,
      },
      fixture: { environments: projectCount, perEnvironment: counts, apiPageSize: pageSize },
    };
    if (soakSeconds) {
      const { assetEntry, ...soak } = await run(browser, {
        pagination,
        grouped: true,
        soakSeconds,
      });
      assert.match(assetEntry, /^\/console\/assets\/[A-Za-z0-9_.-]+\.js$/);
      console.log(JSON.stringify({ status: 'passed', assetEntry, ...evidence, soak }, null, 2));
      return;
    }
    if (process.env.UX06_LAYOUT_ONLY === '1') {
      const smoke = await run(browser, {
        pagination: true,
        smoke: true,
        layout: true,
        size: mobileViewport,
      });
      const inventoryLocales = await run(browser, {
        pagination: true,
        inventoryLocales: true,
        size: { ...mobileViewport, width: 320 },
      });
      console.log(JSON.stringify({ status: 'passed', ...evidence, smoke, inventoryLocales }, null, 2));
      return;
    }
    const samples = [];
    for (let index = 0; index < coldRuns; index += 1)
      samples.push(await run(browser, { pagination, sweep: index === 0 }));
    assert.equal(new Set(samples.map(({ assetEntry }) => assetEntry)).size, 1);
    const disabledSmoke = pagination
      ? await run(browser, { pagination: false, smoke: true })
      : null;
    if (disabledSmoke) assert.equal(disabledSmoke.assetEntry, samples[0].assetEntry);
    const mobileSmoke = pagination
      ? await run(browser, { pagination, smoke: true, layout: true, size: mobileViewport })
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
          ...evidence,
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
