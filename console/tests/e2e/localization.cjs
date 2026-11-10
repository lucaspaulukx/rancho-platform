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
const accessibilityRoutes = ['groups', 'users', 'api-keys', 'settings', 'audit', 'environments'];
let axe;
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

async function context({ authenticated = false, enabled = true, extraLocales = [] } = {}) {
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
      enabled, defaultLocale: 'pt-BR', availableLocales: ['pt-BR', 'en-US', ...extraLocales],
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

async function scanAccessibility(page, route) {
  await page.evaluate(axe);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
      const findings = await page.evaluate(async () => {
        const report = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        });
        const summary = ({ id, nodes }) => ({ id, count: nodes.length });
        return { violations: report.violations.map(summary), manualReview: report.incomplete.map(summary) };
      });
      result.accessibility.push({ route, width, theme, ...findings });
    }
  }
}

async function main() {
  assert(Array.isArray(input.cookies) && input.cookies.some((cookie) => cookie.name === 'token'));
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  if (input.accessibility) {
    result.stage = 'accessibility-setup';
    axe = fs.readFileSync(path.resolve(__dirname, '../../node_modules/axe-core/axe.min.js'), 'utf8');
    result.accessibility = [];
  }

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
  const publicContext = await context({ extraLocales: ['fr-FR', 'de-DE', 'ja-JP', 'zh-Hans', 'hu-HU', 'ru-RU', 'uk-UA', 'fa-IR'] });
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
  await publicPage.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fr-FR');
  await publicPage.getByRole('heading', { name: 'Accédez à votre environnement', exact: true }).waitFor();
  check('French preview translates sign-in while preserving both drafts and the URL',
    await publicPage.locator('html').getAttribute('lang') === 'fr-FR' &&
    await publicPage.getByText('Aperçu · traductions incomplètes', { exact: true }).isVisible() &&
    await username.inputValue() === 'localization-draft-only' &&
    await password.inputValue() === 'not-a-real-password' && publicPage.url() === loginUrl);
  for (const [locale, title, label, notice] of [
    ['de-DE', 'Auf Ihre Umgebung zugreifen', 'Sprache', 'Vorschau · Übersetzungen unvollständig'],
    ['ja-JP', '環境にアクセス', '言語', 'プレビュー · 一部未翻訳'],
    ['zh-Hans', '访问您的环境', '语言', '预览 · 翻译尚未完成'],
    ['hu-HU', 'Hozzáférés a környezetéhez', 'Nyelv', 'Előnézet · hiányos fordítások'],
    ['ru-RU', 'Войдите в свою среду', 'Язык', 'Предварительная версия · перевод неполный'],
    ['uk-UA', 'Отримайте доступ до свого середовища', 'Мова', 'Попередня версія · переклад неповний'],
    ['fa-IR', 'به محیط خود دسترسی پیدا کنید', 'زبان', 'پیش‌نمایش · ترجمه‌ها کامل نیستند'],
  ]) {
    await publicPage.locator('.language-selector select').selectOption(locale);
    await publicPage.getByRole('heading', { name: title, exact: true }).waitFor();
    check(`${locale} login preview keeps mobile controls, drafts and URL`,
      await insideViewport(publicPage.getByRole('combobox', { name: label, exact: true })) &&
      await publicPage.getByText(notice, { exact: true }).isVisible() &&
      await publicPage.locator('html').getAttribute('lang') === locale &&
      await publicPage.locator('html').getAttribute('dir') === (locale === 'fa-IR' ? 'rtl' : 'ltr') &&
      await username.inputValue() === 'localization-draft-only' &&
      await password.inputValue() === 'not-a-real-password' && publicPage.url() === loginUrl);
  }
  await publicPage.setViewportSize({ width: 1440, height: 1000 });
  const rtlAuth = await publicPage.locator('.auth-layout').evaluate((layout) => {
    const story = layout.querySelector('.auth-story');
    const panel = layout.querySelector('.auth-panel');
    const username = layout.querySelector('input[name="username"]');
    return getComputedStyle(story).borderLeftWidth === '1px' &&
      story.getBoundingClientRect().left >= panel.getBoundingClientRect().right - 1 &&
      getComputedStyle(username).direction === 'ltr';
  });
  check('Persian desktop login mirrors the panels and keeps a Latin username left-to-right', rtlAuth);
  await publicPage.locator('.language-selector select').selectOption('pt-BR');
  await publicPage.getByRole('heading', { name: 'Acesse seu ambiente', exact: true }).waitFor();
  check('returning to Portuguese restores the login direction and retains both drafts',
    await publicPage.locator('html').getAttribute('dir') === 'ltr' &&
    await username.inputValue() === 'localization-draft-only' &&
    await password.inputValue() === 'not-a-real-password');
  await closeContext(publicContext);

  result.stage = 'authenticated-shell';
  const authenticated = await context({ authenticated: true, extraLocales: ['fr-FR', 'de-DE', 'ja-JP', 'zh-Hans', 'hu-HU', 'ru-RU', 'uk-UA', 'fa-IR'] });
  const workspace = await page(authenticated);
  const workspaceUrl = origin + '/console/stacks?env=1a12&q=localization-acceptance';
  await workspace.goto(workspaceUrl, { waitUntil: 'domcontentloaded' });
  const language = () => workspace.getByRole('combobox', { name: /^(Idioma|Language)$/ });
  await language().waitFor();
  const search = workspace.getByLabel('Buscar na operação', { exact: true });
  await search.waitFor();
  const searchControl = await search.elementHandle();
  const create = workspace.locator('details.creation-menu > summary').filter({ hasText: /^Criar$/ });
  await create.waitFor();
  const createControl = await create.elementHandle();
  await workspace.getByRole('button', { name: 'Recolher menu', exact: true }).click();
  await language().selectOption('en-US');
  await workspace.getByRole('button', { name: 'Expand menu', exact: true }).waitFor();
  check('authenticated switch preserves environment/path/filter and operation controls',
    workspace.url() === workspaceUrl &&
    await workspace.getByLabel('Search operations', { exact: true }).inputValue() === 'localization-acceptance' &&
    await workspace.getByLabel('Search operations', { exact: true }).evaluate((node, previous) => node === previous, searchControl) &&
    await workspace.locator('details.creation-menu > summary').filter({ hasText: /^Create$/ }).evaluate((node, previous) => node === previous, createControl) &&
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
  result.stage = 'administration-routes';
  await workspace.locator('.environment-trigger').click();
  const ltrEnvironment = workspace.locator('.environment-popover');
  await ltrEnvironment.waitFor();
  check('English mobile environment menu remains within the viewport', await insideViewport(ltrEnvironment));
  await workspace.keyboard.press('Escape');
  await workspace.setViewportSize({ width: 1440, height: 1000 });
  for (const [route, title] of [
    ['groups', 'Groups and permissions'],
    ['users', 'Users'],
    ['api-keys', 'API keys'],
    ['settings', 'Server settings'],
    ['audit', 'Audit'],
    ['processes', 'Processes'],
    ['drivers', 'Machine drivers'],
    ['catalog-repositories', 'Catalog repositories'],
    ['hosts', 'Hosts'],
    ['catalog', 'Catalog'],
    ['webhooks', 'Webhooks'],
    ['environments', 'Environments'],
    ['volumes', 'Volumes'],
  ]) {
    await workspace.goto(origin + '/console/' + route + '?env=1a12');
    await workspace.getByRole('heading', { name: title, exact: true }).waitFor();
    check('translated administrative route ' + route + ' keeps scope',
      new URL(workspace.url()).searchParams.get('env') === '1a12');
    for (const width of [320, 390]) {
      await workspace.setViewportSize({ width, height: 844 });
      result.stage = 'administration-layout-' + route + '-' + width;
      await workspace.locator('main .loading:visible').waitFor({ state: 'hidden' });
      const fits = await workspace.evaluate(() => {
        const main = document.querySelector('main');
        const actions = main?.querySelectorAll('.page-actions > .button') ?? [];
        return main && main.scrollWidth <= main.clientWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          [...actions].every((action) => {
            const box = action.getBoundingClientRect();
            return box.left >= -1 && box.right <= innerWidth + 1;
          });
      });
      assert(fits);
      check(route + ' fits the viewport at ' + width + ' px');
    }
    if (axe && accessibilityRoutes.includes(route)) {
      result.stage = 'accessibility-' + route;
      await scanAccessibility(workspace, route);
    }
    await workspace.setViewportSize({ width: 1440, height: 1000 });
  }
  await workspace.goto(origin + '/console/environments/1a12?env=1a12');
  await workspace.getByRole('heading', { name: 'Resources in this environment', exact: true }).waitFor();
  await workspace.getByRole('button', { name: 'View network policies', exact: true }).click();
  await workspace.getByRole('dialog', { name: 'Network policies', exact: true }).waitFor();
  check('network policy drawer follows the active locale and preserves environment scope',
    new URL(workspace.url()).searchParams.get('env') === '1a12');
  await workspace.getByRole('dialog', { name: 'Network policies', exact: true })
    .getByRole('button', { name: 'Close', exact: true }).click();
  await workspace.getByLabel('User menu', { exact: true }).click();
  await workspace.getByRole('button', { name: 'About this console', exact: true }).click();
  const about = workspace.getByRole('dialog', { name: 'About this console', exact: true });
  await about.getByText('Rancher 1.6.30', { exact: true }).waitFor();
  check('About dialog uses the active locale and retains Rancher attribution',
    await about.getByText('Rancher 1.6.30', { exact: true }).isVisible());
  await about.getByRole('button', { name: 'Close dialog', exact: true }).click();
  result.stage = 'authenticated-rtl';
  for (const [locale, stacks] of [
    ['de-DE', 'Stacks'], ['fr-FR', 'Stacks'], ['ja-JP', 'スタック'],
    ['zh-Hans', '堆栈'], ['ru-RU', 'Стеки'], ['uk-UA', 'Стеки'],
    ['hu-HU', 'Stackek'], ['fa-IR', 'پشته‌ها'],
  ]) {
    await workspace.locator('.language-selector select').selectOption(locale);
    const stacksLink = workspace.locator('.sidebar a[href="/console/stacks?env=1a12"]');
    check(`${locale} navigation translates in place and keeps the environment route`,
      await stacksLink.getAttribute('title') === stacks &&
      new URL(workspace.url()).searchParams.get('env') === '1a12' &&
      await workspace.getByTestId('app-shell').getAttribute('class').then((value) => value.includes('sidebar-collapsed')));
  }
  await workspace.locator('.language-selector select').selectOption('fa-IR');
  await workspace.getByRole('combobox', { name: 'زبان', exact: true }).waitFor();
  check('Persian desktop places the sidebar on the right with its divider facing the workspace',
    await workspace.locator('.sidebar').evaluate((sidebar) => {
      const box = sidebar.getBoundingClientRect();
      return document.documentElement.dir === 'rtl' &&
        Math.abs(box.right - document.documentElement.clientWidth) <= 1 &&
        getComputedStyle(sidebar).borderLeftWidth === '1px';
    }));
  await workspace.getByRole('button', { name: 'View network policies', exact: true }).click();
  const rtlDrawer = workspace.getByRole('dialog', { name: 'Network policies', exact: true });
  await rtlDrawer.waitFor();
  check('Persian desktop drawer opens at inline end without changing environment',
    await rtlDrawer.evaluate((drawer) => Math.abs(drawer.getBoundingClientRect().left) <= 1) &&
    new URL(workspace.url()).searchParams.get('env') === '1a12');
  await workspace.keyboard.press('Escape');
  await rtlDrawer.waitFor({ state: 'hidden' });
  await workspace.setViewportSize({ width: 390, height: 844 });
  const mobileMenu = workspace.getByRole('button', { name: 'باز کردن پیمایش', exact: true });
  await mobileMenu.focus();
  await workspace.keyboard.press('Enter');
  const mobileSidebar = workspace.locator('.sidebar.mobile-open');
  await mobileSidebar.waitFor();
  await workspace.waitForFunction(() => {
    const sidebar = document.querySelector('.sidebar.mobile-open');
    return sidebar?.contains(document.activeElement) &&
      Math.abs(sidebar.getBoundingClientRect().right - document.documentElement.clientWidth) <= 1;
  });
  await workspace.keyboard.press('Shift+Tab');
  check('Persian mobile sidebar opens on the right and retains keyboard focus',
    await mobileSidebar.evaluate((sidebar) => sidebar.contains(document.activeElement)));
  await workspace.keyboard.press('Escape');
  await mobileSidebar.waitFor({ state: 'hidden' });
  await workspace.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'باز کردن پیمایش');
  check('Escape closes the Persian mobile sidebar and returns focus to its trigger');
  await workspace.locator('.environment-trigger').click();
  const rtlEnvironment = workspace.locator('.environment-popover');
  await rtlEnvironment.waitFor();
  check('Persian mobile environment menu remains within the viewport',
    await insideViewport(rtlEnvironment) && new URL(workspace.url()).searchParams.get('env') === '1a12');
  await workspace.keyboard.press('Escape');
  result.stage = 'rtl-compose-draft';
  await workspace.setViewportSize({ width: 1440, height: 1000 });
  await workspace.goto(origin + '/console/stacks?env=1a12');
  await workspace.locator('details.creation-menu > summary').click();
  await workspace.locator('.creation-options').getByRole('button', { name: 'Stack', exact: true }).click();
  const creator = workspace.getByRole('dialog', { name: 'Create stack', exact: true });
  await creator.waitFor();
  await creator.getByLabel('How to create the stack', { exact: true }).selectOption('compose');
  const composeSource = creator.getByRole('textbox', { name: 'Docker Compose', exact: true });
  const yamlDraft = 'services:\n  web:\n    image: alpine:3.20\n';
  await composeSource.fill(yamlDraft);
  check('Persian Compose editor keeps source left-to-right without changing the draft',
    await composeSource.evaluate((source) => getComputedStyle(source).direction === 'ltr') &&
    await composeSource.inputValue() === yamlDraft &&
    await workspace.locator('html').getAttribute('dir') === 'rtl');
  result.stage = 'module-load-recovery';
  const recoveryContext = await context({ authenticated: true, extraLocales: ['fa-IR'] });
  await recoveryContext.addInitScript(() => {
    localStorage.setItem('rancho.console.locale.anonymous', JSON.stringify({ version: 1, locale: 'en-US' }));
  });
  let simulatedFailures = 0;
  await recoveryContext.route(/\/console\/assets\/Audit-[^/]+\.js$/, async (route) => {
    if (simulatedFailures === 0) {
      simulatedFailures++;
      await route.fulfill({
        status: 503, contentType: 'application/javascript',
        headers: { 'cache-control': 'no-store' }, body: 'synthetic-private-module-response',
      });
    } else await route.continue();
  });
  const recoveryPage = await page(recoveryContext);
  const recoveryUrl = origin + '/console/audit?env=1a12';
  await recoveryPage.goto(recoveryUrl, { waitUntil: 'domcontentloaded' });
  await recoveryPage.getByRole('heading', { name: 'This page could not be loaded', exact: true }).waitFor();
  check('a failed lazy module displays localized recovery while preserving its route',
    simulatedFailures === 1 && recoveryPage.url() === recoveryUrl &&
    !await recoveryPage.getByText('synthetic-private-module-response', { exact: true }).count() &&
    await recoveryPage.locator('.sidebar').isVisible());
  await recoveryPage.locator('.language-selector select').selectOption('fa-IR');
  await recoveryPage.getByRole('heading', { name: 'بارگیری این صفحه ممکن نشد', exact: true }).waitFor();
  check('an open recovery message translates into Persian without retrying the failed module',
    simulatedFailures === 1 && recoveryPage.url() === recoveryUrl &&
    await recoveryPage.locator('html').getAttribute('dir') === 'rtl');
  await recoveryPage.getByRole('button', { name: 'بارگیری دوبارهٔ کنسول', exact: true }).click();
  await recoveryPage.getByRole('heading', { name: 'Audit', exact: true }).waitFor();
  check('reload recovers the actual lazy module after transport returns',
    simulatedFailures === 1 && recoveryPage.url() === recoveryUrl &&
    await recoveryPage.locator('html').getAttribute('lang') === 'fa-IR');
  await closeContext(recoveryContext);
  result.stage = 'registry-validation';
  const registryPage = await page(authenticated);
  const registryUrl = origin + '/console/registries?env=1a12';
  await registryPage.goto(registryUrl);
  await registryPage.locator('.language-selector select').selectOption('pt-BR');
  await registryPage.locator('main .page-actions').getByRole('button', { name: /^Criar / }).click();
  const registryEditor = registryPage.getByRole('dialog');
  const registryName = registryEditor.getByLabel('Nome', { exact: true });
  const registryAddress = registryEditor.getByLabel(/^Endereço do registry(?: \*)?$/);
  await registryName.fill('synthetic-registry');
  await registryAddress.fill('ftp://registry.invalid');
  await registryEditor.getByRole('button', { name: 'Salvar', exact: true }).click();
  await registryEditor.getByText('Informe um endereço HTTP ou HTTPS para o registry.', { exact: true }).waitFor();
  const localePeer = await page(authenticated);
  await localePeer.goto(registryUrl);
  await localePeer.locator('.language-selector select').selectOption('en-US');
  await registryEditor.getByText('Enter an HTTP or HTTPS registry address.', { exact: true }).waitFor();
  check('registry validation translates with the dialog open and retains the address draft',
    await registryEditor.getByLabel(/^Registry address(?: \*)?$/).inputValue() === 'ftp://registry.invalid' &&
    await registryEditor.getByLabel('Name', { exact: true }).inputValue() === 'synthetic-registry' &&
    registryPage.url() === registryUrl);
  result.stage = 'rejected-pagination';
  const failedInventory = await page(authenticated);
  await failedInventory.route(origin + '/v2-beta/projects/1a12/hosts?limit=100', (route) =>
    route.fulfill({ json: { data: [], pagination: {
      next: 'https://outside.invalid/v2-beta/projects?marker=synthetic-private-pagination',
    } } }),
  );
  const hostsUrl = origin + '/console/hosts?env=1a12';
  await failedInventory.goto(hostsUrl);
  const inventoryAlert = failedInventory.locator('main .error-state').getByRole('alert');
  await inventoryAlert.getByText('The server returned a disallowed API address.', { exact: true }).waitFor();
  await failedInventory.locator('.language-selector select').selectOption('pt-BR');
  await inventoryAlert.getByText('O servidor retornou um endereço de API não permitido.', { exact: true }).waitFor();
  check('blocked pagination remains local and updates its visible error in place',
    failedInventory.url() === hostsUrl &&
    !(await inventoryAlert.textContent()).includes('synthetic-private-pagination') &&
    result.blockedRequests === 0);
  if (axe) {
    result.stage = 'accessibility-results';
    check('axe checks for six routes in both themes on mobile and desktop',
      result.accessibility.length === accessibilityRoutes.length * 4 &&
      result.accessibility.every(({ violations }) => violations.length === 0));
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
