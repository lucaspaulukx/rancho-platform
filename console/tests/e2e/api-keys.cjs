const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { chromium, request } = require('node:module').createRequire(
  path.join(input.runtimeModules, 'package.json'),
)('playwright');
const root = path.resolve(__dirname, '../../..'),
  fixturePath = path.join(root, 'console/api-keys-fixture.json'),
  state = JSON.parse(fs.readFileSync(fixturePath, 'utf8')),
  checks = [],
  redact = [input.password];
assert.equal(state.environment, '1a12');
assert.equal(state.marker, 'Disposable API key acceptance ' + state.name);
let browser, page;
let enabled = true;
function check(name, ok = true) {
  assert.ok(ok, name);
  checks.push({ check: name, status: 'passed' });
  fs.writeFileSync(
    path.join(root, 'console/api-keys-e2e-results.json'),
    JSON.stringify(checks, null, 2) + '\n',
  );
  console.log('PASS: ' + name);
}
async function basic(url, publicValue, secretValue) {
  const auth = Buffer.from(publicValue + ':' + secretValue).toString('base64');
  redact.push(auth);
  const client = await request.newContext({
    extraHTTPHeaders: { Accept: 'application/json', Authorization: 'Basic ' + auth },
  });
  try {
    const result = await client.get(url, { maxRedirects: 0, timeout: 15000 });
    return result.status();
  } catch {
    throw new Error('Isolated credential probe failed');
  } finally {
    await client.dispose();
  }
}
async function waitAccess(url, credential, allowed) {
  for (let i = 0; i < 30; i++) {
    const code = await basic(url, credential.publicValue, credential.secretValue);
    if (allowed ? code === 200 : [401, 403, 404].includes(code)) return code;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Credential access state did not converge');
}
async function shot(name) {
  await page.screenshot({
    path: path.join(root, 'evidence/e2e-isolated', name + '.png'),
    animations: 'disabled',
    mask: [
      page.getByLabel('Segredo da chave', { exact: true }),
      page.getByLabel('Chave de acesso', { exact: true }),
    ],
  });
}
async function action(name, label, title) {
  await page.getByRole('button', { name: 'Ações da chave ' + name, exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await page.getByRole('dialog', { name: title, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByRole('dialog', { name: title, exact: true }).waitFor({ state: 'hidden' });
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: input.browserExecutable });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    colorScheme: 'dark',
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http://localhost:18090', 'http://localhost:18081'].includes(url.origin)
      ? route.continue()
      : route.abort();
  });
  await context.route('**/console/console-config.json', async (route) => {
    const response = await route.fetch(),
      config = await response.json();
    await route.fulfill({
      response,
      json: { ...config, modules: { ...config.modules, apiKeys: enabled } },
    });
  });
  page = await context.newPage();
  await page.goto('http://localhost:18090/console/login');
  await page.getByLabel('Usuário', { exact: true }).fill(input.username);
  await page.getByLabel('Senha', { exact: true }).fill(input.password);
  await page.getByRole('button', { name: 'Entrar com conta local' }).click();
  await page.getByLabel('Navegação principal', { exact: true }).waitFor();
  for (const scope of ['accounts', 'environment']) {
    await page.goto('http://localhost:18090/console/api-keys?env=1a12');
    await page.getByRole('heading', { name: 'Chaves de API', exact: true }).waitFor();
    await page.getByLabel('Escopo das chaves', { exact: true }).selectOption(scope);
    await page.getByRole('button', { name: 'Criar chave', exact: true }).click();
    await page.getByLabel('Nome da chave', { exact: true }).fill(state.name + '-' + scope);
    await page.getByLabel('Descrição da chave', { exact: true }).fill(state.marker);
    await shot('api-key-create-' + scope);
    await page.getByRole('button', { name: 'Revisar', exact: true }).click();
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/apikeys'),
    );
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    const createdResponse = await response;
    assert.ok(createdResponse.ok());
    const created = await createdResponse.json();
    redact.push(String(created.secretValue || ''));
    const current = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    assert.equal(current.name, state.name);
    current.keys.push({ id: created.id, name: created.name, accountId: created.accountId, scope });
    fs.writeFileSync(fixturePath, JSON.stringify(current, null, 2) + '\n');
    assert.equal(created.accountId, scope === 'environment' ? state.environment : state.account);
    await page.getByLabel('Segredo da chave', { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel('Segredo da chave', { exact: true }).getAttribute('type'),
      'password',
    );
    const credential = {
      publicValue: await page.getByLabel('Chave de acesso', { exact: true }).inputValue(),
      secretValue: await page.getByLabel('Segredo da chave', { exact: true }).inputValue(),
    };
    redact.push(credential.secretValue);
    assert.ok(credential.publicValue && credential.secretValue);
    check(scope + ' UI creates key with explicit owner and masked one-time secret');
    await page
      .getByRole('checkbox', {
        name: 'Guardei a credencial ou aceito perder a visualização do segredo',
        exact: true,
      })
      .check();
    await page.getByRole('button', { name: 'Concluir', exact: true }).click();
    assert.equal(await page.getByLabel('Segredo da chave', { exact: true }).count(), 0);
    const url =
      scope === 'environment'
        ? 'http://localhost:18090/v2-beta/projects/1a12/stacks?limit=1'
        : 'http://localhost:18090/v2-beta/projects?limit=1';
    await waitAccess(url, credential, true);
    check(scope + ' key authenticates using independent Basic request without UI cookies');
    if (scope === 'environment') {
      check(
        'environment key cannot read another environment',
        [401, 403, 404].includes(
          await basic(
            'http://localhost:18090/v2-beta/projects/1a8/stacks?limit=1',
            credential.publicValue,
            credential.secretValue,
          ),
        ),
      );
    }
    await action(state.name + '-' + scope, 'Desativar', 'Desativar chave?');
    await waitAccess(url, credential, false);
    check(scope + ' deactivation denies real Basic authentication');
    await action(state.name + '-' + scope, 'Ativar', 'Ativar chave?');
    await waitAccess(url, credential, true);
    check(scope + ' activation restores real Basic authentication');
    await page
      .getByRole('button', { name: 'Ações da chave ' + state.name + '-' + scope, exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Editar nome e descrição', exact: true }).click();
    assert.equal(await page.getByLabel('Segredo da chave', { exact: true }).count(), 0);
    await page
      .getByLabel('Nome da chave', { exact: true })
      .fill(state.name + '-' + scope + '-edited');
    await page.getByRole('button', { name: 'Revisar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Editar chave de API', exact: true })
      .waitFor({ state: 'hidden' });
    check(scope + ' metadata edit never recovers the secret');
    await action(state.name + '-' + scope + '-edited', 'Desativar', 'Desativar chave?');
    await action(state.name + '-' + scope + '-edited', 'Revogar', 'Revogar chave?');
    await waitAccess(url, credential, false);
    check(scope + ' revocation denies real Basic authentication');
    const prefix = scope === 'environment' ? '/v2-beta/projects/1a12/' : '/v2-beta/';
    let currentKey;
    for (let attempt = 0; attempt < 60; attempt++) {
      const response = await page.request.get(
        'http://localhost:18090' + prefix + 'apikeys/' + created.id,
        { headers: { Accept: 'application/json' } },
      );
      if (response.status() === 404) {
        currentKey = null;
        break;
      }
      assert.equal(response.status(), 200);
      currentKey = await response.json();
      if (['purged', 'removed'].includes(currentKey.state)) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(!currentKey || ['purged', 'removed'].includes(currentKey.state));
    if (currentKey?.actions?.purge && currentKey.state === 'removed') {
      await page.getByLabel('Situação das chaves', { exact: true }).selectOption('removed');
      await action(
        state.name + '-' + scope + '-edited',
        'Excluir definitivamente',
        'Excluir definitivamente chave?',
      );
      await waitAccess(url, credential, false);
      check(scope + ' permanent removal keeps credential denied');
    } else check(scope + ' unsupported purge is not offered by the frontend');
  }
  const axe = fs.readFileSync(path.join(root, 'console/node_modules/axe-core/axe.min.js'), 'utf8');
  const accessibility = [];
  for (const theme of ['dark', 'light'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = page.getByRole('button', {
        name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro',
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page.getByRole('button', { name: 'Criar chave', exact: true }).click();
      await page.getByLabel('Nome da chave', { exact: true }).waitFor();
      await shot(`api-key-form-${theme}-${width}`);
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
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      accessibility.push({ theme, width, violations, overflow });
      fs.writeFileSync(
        path.join(root, 'console/api-keys-a11y-results.json'),
        JSON.stringify(accessibility, null, 2) + '\n',
      );
      assert.equal(violations.length, 0);
      assert.equal(overflow, false);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      check(`API key form accessibility and layout ${theme} ${width}`);
    }
  enabled = false;
  await page.reload();
  await page.getByRole('heading', { name: 'Módulo desativado', exact: true }).waitFor();
  check('API key flag off blocks direct URL');
  await context.close();
})()
  .catch(async (error) => {
    if (page) await shot('api-key-failure').catch(() => {});
    let message = String(error.message);
    for (const secret of redact.filter(Boolean)) message = message.split(secret).join('[redacted]');
    console.error(message.replace(/authorization:.*$/gim, 'Authorization: [redacted]'));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
