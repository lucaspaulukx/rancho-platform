// Read-only localhost acceptance. Only this context's frontend configuration is overridden.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium } = require('node:module').createRequire(path.join(input.runtimeModules, 'package.json'))('playwright');
const origin = 'http://localhost:18090';
const result = {
  status: 'failed', checks: [], browserClosed: false, pageErrors: 0,
  blockedRequests: 0, configurationOverrides: 0, contextsClosed: 0,
};
let browser;
const contexts = new Set();
const budget = setTimeout(() => { result.timedOut = true; void browser?.close(); }, 90_000);
function check(name, condition = true) { assert(condition); result.checks.push(name); }
async function closeContext(value) {
  if (!contexts.has(value)) return;
  await value.close();
  contexts.delete(value);
  result.contextsClosed++;
}

async function context({ authenticated = false, enabled = true } = {}) {
  const value = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'pt-BR', colorScheme: 'dark',
  });
  contexts.add(value);
  if (authenticated)
    await value.addCookies(input.cookies.map(({ name, value }) => ({ name, value, url: origin, sameSite: 'Lax' })));
  await value.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) {
      result.blockedRequests++;
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  await value.route(origin + '/console/console-config.json', async (route) => {
    assert.equal(route.request().method(), 'GET');
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    const config = await response.json();
    config.localization = {
      enabled, defaultLocale: 'pt-BR', availableLocales: ['pt-BR', 'en-US'],
      selectable: true, detectBrowser: false, preview: true,
    };
    // Theme variation is local to this browser context, never the deployed JSON.
    config.themeDefault = 'system';
    config.themeSelectable = true;
    result.configurationOverrides++;
    await route.fulfill({ response, json: config });
  });
  return value;
}

async function page(context) {
  const value = await context.newPage();
  value.setDefaultTimeout(8_000);
  value.on('pageerror', () => result.pageErrors++);
  return value;
}

async function insideViewport(select) {
  const box = await select.boundingBox();
  const width = await select.page().evaluate(() => window.innerWidth);
  return !!box && box.x >= 0 && box.x + box.width <= width + 1 && box.width > 0;
}

async function contrast(select) {
  return select.evaluate((node) => {
    const style = getComputedStyle(node);
    const luminance = (color) => {
      const channels = color.match(/[0-9.]+/g)?.slice(0, 3).map(Number);
      if (!channels || channels.length !== 3) return NaN;
      const rgb = channels.map((value) => {
        const scaled = value / 255;
        return scaled <= .04045 ? scaled / 12.92 : ((scaled + .055) / 1.055) ** 2.4;
      });
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    };
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}

async function main() {
  assert(Array.isArray(input.cookies) && input.cookies.some((cookie) => cookie.name === 'token'));
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });

  result.stage = 'disabled-public-layout';
  const disabled = await context({ enabled: false });
  const disabledPage = await page(disabled);
  const loginUrl = origin + '/console/login?signedOut=true';
  // signedOut is the product's real no-autologin entry point; auth responses are not intercepted.
  await disabledPage.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await disabledPage.getByRole('heading', { name: 'Acesse seu ambiente', exact: true }).waitFor();
  check('flag off retains Portuguese login and hides selector', await disabledPage.locator('.language-selector').count() === 0);
  await closeContext(disabled);

  result.stage = 'public-login-drafts';
  const publicContext = await context();
  const publicPage = await page(publicContext);
  await publicPage.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  const publicSelector = publicPage.getByRole('combobox', { name: 'Idioma', exact: true });
  await publicSelector.waitFor();
  const username = publicPage.locator('input[name="username"]');
  const password = publicPage.locator('input[name="password"]');
  // Exclusive OIDC intentionally has no local fields; do not fake that policy to obtain green.
  await publicPage.getByRole('heading', { name: 'Acesse seu ambiente', exact: true }).waitFor();
  const methods = await publicPage.request.get(origin + '/oidc/status');
  assert.equal(methods.status(), 200);
  const loginPolicy = await methods.json();
  if (loginPolicy.only === true) {
    result.unmetPrecondition = 'local-login-fields-unavailable-in-exclusive-oidc';
    throw new Error('Unmet acceptance precondition.');
  }
  await username.fill('localization-draft-only');
  await password.fill('not-a-real-password');
  await publicSelector.selectOption('en-US');
  await publicPage.getByRole('heading', { name: 'Access your environment', exact: true }).waitFor();
  check('public language switch preserves username/password drafts and URL',
    await username.inputValue() === 'localization-draft-only' &&
    await password.inputValue() === 'not-a-real-password' && publicPage.url() === loginUrl);
  check('public selector exposes explicit incomplete-translation preview',
    await publicPage.getByText('Preview · translations incomplete', { exact: true }).isVisible());
  check('public document language updates', await publicPage.locator('html').getAttribute('lang') === 'en-US');
  await publicPage.setViewportSize({ width: 390, height: 844 });
  check('public mobile selector stays in viewport', await insideViewport(publicPage.getByRole('combobox', { name: 'Language', exact: true })));
  await closeContext(publicContext);

  result.stage = 'authenticated-shell';
  const authenticated = await context({ authenticated: true });
  const workspace = await page(authenticated);
  const workspaceUrl = origin + '/console/stacks?env=1a12&q=localization-acceptance';
  await workspace.goto(workspaceUrl, { waitUntil: 'domcontentloaded' });
  const language = () => workspace.getByRole('combobox', { name: /^(Idioma|Language)$/ });
  await language().waitFor();
  const search = workspace.getByLabel('Buscar na operação', { exact: true });
  await search.waitFor();
  const create = workspace.locator('details.creation-menu > summary').filter({ hasText: /^Criar$/ });
  await create.waitFor();
  await workspace.getByRole('button', { name: 'Recolher menu', exact: true }).click();
  await language().selectOption('en-US');
  await workspace.getByRole('button', { name: 'Expand menu', exact: true }).waitFor();
  check('authenticated switch preserves environment/path/filter and operation controls',
    workspace.url() === workspaceUrl && await search.inputValue() === 'localization-acceptance' &&
    await create.isVisible() &&
    await workspace.getByRole('button', { name: /^Environment: / }).isVisible());
  check('collapsed sidebar and selected locale survive shell translation',
    (await workspace.getByTestId('app-shell').getAttribute('class')).includes('sidebar-collapsed') &&
    await language().inputValue() === 'en-US' &&
    await workspace.getByRole('link', { name: 'Services', exact: true }).getAttribute('href') === '/console/services?env=1a12');

  result.stage = 'open-appearance-dialog';
  await workspace.getByLabel('User menu', { exact: true }).click();
  await workspace.getByRole('button', { name: 'Appearance', exact: true }).click();
  const appearance = workspace.getByRole('dialog', { name: 'Your appearance', exact: true });
  await appearance.getByLabel('Density', { exact: true }).selectOption('compact');
  // A second owned tab sends a real storage event while the primary modal stays open.
  const peer = await page(authenticated);
  await peer.goto(workspaceUrl, { waitUntil: 'domcontentloaded' });
  await peer.getByRole('combobox', { name: 'Language', exact: true }).selectOption('pt-BR');
  const translatedAppearance = workspace.getByRole('dialog', { name: 'Sua aparência', exact: true });
  await translatedAppearance.waitFor();
  check('cross-tab language change preserves the open appearance dialog and density',
    await translatedAppearance.getByLabel('Densidade', { exact: true }).inputValue() === 'compact' &&
    await workspace.locator('html').getAttribute('data-density') === 'compact' && workspace.url() === workspaceUrl);
  await peer.close();
  await translatedAppearance.getByRole('button', { name: 'Concluir', exact: true }).click();
  await language().selectOption('en-US');

  result.stage = 'mobile-theme-layout';
  await workspace.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['dark', 'light']) {
    await workspace.emulateMedia({ colorScheme: theme });
    await workspace.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
    const selector = language();
    const fits = await workspace.evaluate(() => {
      const navbar = document.querySelector('.navbar');
      return !!navbar && navbar.scrollWidth <= navbar.clientWidth + 1 &&
        document.documentElement.scrollWidth <= window.innerWidth + 1;
    });
    check('mobile ' + theme + ' selector remains labelled, selected and inside viewport',
      await selector.inputValue() === 'en-US' && await insideViewport(selector) && fits);
    check('mobile ' + theme + ' selector text contrast', await contrast(selector) >= 4.5);
  }
  check('no browser HTTP mutations or external navigation', result.blockedRequests === 0);
  check('no JavaScript errors', result.pageErrors === 0);
  result.status = 'passed';
  result.stage = 'measured';
}

main().catch((error) => {
  result.errorType = error?.name || 'Error';
  result.errorLines = [...String(error?.stack || '').matchAll(/localization\.cjs:([0-9]+):([0-9]+)/g)].map((match) => Number(match[1]));
}).finally(async () => {
  clearTimeout(budget);
  if (result.timedOut) result.status = 'failed';
  for (const value of contexts) {
    try { await closeContext(value); } catch { result.status = 'failed'; }
  }
  if (browser) {
    try { await browser.close(); result.browserClosed = true; } catch { result.status = 'failed'; }
  }
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'passed' ? 0 : 1;
});
