// Private credentials arrive only on stdin. Output contains named booleans, no responses/tokens.
const fs = require('node:fs');
const crypto = require('node:crypto');
const config = JSON.parse(fs.readFileSync(0, 'utf8'));
let stage = 'readiness';
const checks = [];
const jars = new Map();
function check(name, condition) { if (!condition) throw new Error('Check failed'); checks.push(name); }
async function request(url, { jar = 'native', body, form = false, headers = {}, method } = {}) {
  const parsed = new URL(url);
  // Namespace has no egress, but reject unexpected endpoints independently too.
  checkEndpoint(parsed);
  if (!jars.has(jar)) jars.set(jar, new Map());
  const cookies = jars.get(jar);
  if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  headers.Accept ||= 'application/json';
  headers['User-Agent'] = 'Mozilla/5.0 RecoveryRehearsal';
  if (cookies.has('CSRF')) headers['X-Api-Csrf'] = cookies.get('CSRF');
  if (body !== undefined) {
    headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
    body = form ? new URLSearchParams(body).toString() : JSON.stringify(body);
  }
  const response = await fetch(url, { method: method || (body === undefined ? 'GET' : 'POST'), body,
    headers, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(';'); const at = pair.indexOf('=');
    cookies.set(pair.slice(0, at), pair.slice(at + 1));
  }
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, location: response.headers.get('location'),
    contentType: response.headers.get('content-type') };
}
function checkEndpoint(url) {
  if (url.protocol !== 'http:' || url.hostname !== 'localhost' || !['8080', '18081', '18090'].includes(url.port))
    throw new Error('External endpoint refused');
}
async function ready(url) {
  const deadline = Date.now() + 360000;
  while (Date.now() < deadline) {
    try { if ((await request(url)).status === 200) return; } catch { /* bounded startup wait */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Startup timeout');
}
async function follow(url, jar, options = {}) {
  for (let i = 0; i < 12; i++) {
    const ticket = new URL(url).searchParams.get('oidc_ticket');
    if (ticket) return { ticket };
    const response = await request(url, { jar, ...options }); options = {};
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    url = new URL(response.location, url).href;
  }
  throw new Error('Redirect limit');
}
async function main() {
  await ready('http://localhost:8080/ping');
  await ready('http://localhost:18081/realms/master/.well-known/openid-configuration');
  checks.push('isolated engines ready');
  stage = 'classic-client-assets';
  const classicBase = 'http://localhost:8080';
  const classic = await request(classicBase + '/index.html');
  check('classic entry document served', classic.status === 200 && classic.contentType?.includes('text/html')
    && typeof classic.data === 'string');
  for (const name of ['vendor', 'ui']) {
    const path = classic.data.match(new RegExp('src="(/assets/' + name + '-[a-f0-9]+[.]js)"'))?.[1];
    check('classic ' + name + ' bundle referenced', !!path);
    const asset = await request(classicBase + path);
    check('classic ' + name + ' bundle served', asset.status === 200
      && asset.contentType?.includes('javascript') && typeof asset.data === 'string' && asset.data.length > 0);
  }
  stage = 'restored-local-administrator';
  const native = await request('http://localhost:8080/v2-beta/token', {
    body: { code: config.rancherUsername + ':' + config.rancherPassword } });
  check('restored local administrator password and state', native.status === 201 && native.data.userType === 'admin' && !!native.data.jwt);
  jars.get('native').set('token', native.data.jwt);
  const projects = await request('http://localhost:8080/v2-beta/projects?all=true&limit=-1');
  check('restored environment inventory', projects.status === 200 && projects.data.data.length === config.expectedEnvironments);
  stage = 'restored-keycloak-administrator';
  const master = await request('http://localhost:18081/realms/master/protocol/openid-connect/token', { jar: 'master', form: true,
    body: { client_id: 'admin-cli', grant_type: 'password', username: config.keycloakUsername, password: config.keycloakPassword } });
  check('restored Keycloak administrator password and H2 state', master.status === 200 && !!master.data.access_token);
  const bearer = { Authorization: 'Bearer ' + master.data.access_token };
  const realm = await request('http://localhost:18081/admin/realms/rancher-lab', { jar: 'master', headers: { ...bearer } });
  check('restored dedicated realm', realm.status === 200 && realm.data.realm === 'rancher-lab');
  if (!config.localOnly) {
  stage = 'new-oidc-identity';
  const username = 'recovery-copy-' + crypto.randomBytes(8).toString('hex');
  const password = crypto.randomBytes(32).toString('base64url');
  const created = await request('http://localhost:18081/admin/realms/rancher-lab/users', { jar: 'master', headers: { ...bearer },
    body: { username, enabled: true, firstName: 'Recovery', lastName: 'Copy', email: username + '@example.invalid', emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }] } });
  check('synthetic user created only inside recovered IdP', created.status === 201);
  const page = await follow('http://localhost:8080/oidc/login', 'oidc');
  check('restored OIDC client and discovery', page.status === 200 && typeof page.data === 'string');
  const action = page.data.match(/<form[^>]+action="([^"]+)"/);
  check('authorization code login form', !!action);
  const result = await follow(action[1].replaceAll('&amp;', '&'), 'oidc', { form: true,
    body: { username, password, credentialId: '' } });
  check('PKCE callback issued one-time ticket', !!result.ticket);
  const token = await request('http://localhost:8080/v2-beta/token', { jar: 'oidc', body: { code: 'oidc-ticket:' + result.ticket } });
  check('restored Rancher crypto state and OIDC exchange', token.status === 201 && token.data.userType === 'user' && !!token.data.jwt);
  jars.get('oidc').set('token', token.data.jwt);
  const empty = await request('http://localhost:8080/v2-beta/projects', { jar: 'oidc' });
  check('new user has zero environment access', empty.status === 200 && empty.data.data.length === 0);
  const forbidden = await request('http://localhost:8080/v2-beta/projects', { jar: 'oidc', body: { name: 'must-not-exist' } });
  check('new user cannot create environment', forbidden.status === 403);
  const after = await request('http://localhost:8080/v2-beta/projects?all=true&limit=-1');
  check('OIDC first login created no environment', after.status === 200 && after.data.data.length === config.expectedEnvironments);
  }
  stage = 'revoke-copy-sessions';
  for (const jar of config.localOnly ? ['native'] : ['oidc', 'native']) {
    const revoked = await request('http://localhost:8080/v2-beta/token/current', { jar, method: 'DELETE' });
    check('recovered ' + jar + ' session revoked', [200, 202, 204].includes(revoked.status));
  }
  process.stdout.write(JSON.stringify({ status: 'passed', checks }));
}
main().catch(() => { process.stdout.write(JSON.stringify({ status: 'failed', stage, passedChecks: checks })); process.exitCode = 1; });
