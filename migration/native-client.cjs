// Bundled into isolated probes by the orchestrator. No credentials/files/log output.
class NativeClient {
  constructor() { this.jars = new Map(); }
  async request(path, { jar = 'admin', body, method } = {}) {
    if (!path.startsWith('/v2-beta/') || path.includes('://')) throw new Error('Unexpected native path');
    if (!this.jars.has(jar)) this.jars.set(jar, new Map());
    const cookies = this.jars.get(jar);
    const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 IsolatedGrantRehearsal' };
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => k + '=' + v).join('; ');
    if (cookies.has('CSRF')) headers['X-Api-Csrf'] = cookies.get('CSRF');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch('http://localhost:8080' + path, { headers, redirect: 'manual',
      method: method || (body === undefined ? 'GET' : 'POST'),
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0], at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    return { status: response.status, data };
  }
  async api(path, body, { jar = 'admin', expected = [200, 201, 202, 204], method } = {}) {
    const response = await this.request('/v2-beta/' + path, { jar, body, method });
    if (!expected.includes(response.status)) {
      const error = new Error('Native contract request failed');
      error.httpStatus = response.status;
      error.nativeCode = /^[A-Za-z][A-Za-z0-9_.-]{0,80}$/.test(response.data?.code || '') ? response.data.code : null;
      throw error;
    }
    return response.data;
  }
  async waitActive(path) {
    for (let attempt = 0; attempt < 90; attempt++) {
      const resource = await this.api(path);
      if (resource?.state === 'active') return resource;
      if (['error', 'removed', 'purged'].includes(resource?.state)) throw new Error('Owned native fixture lifecycle failed');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Owned native fixture lifecycle timeout');
  }
  async login(jar, username, password) {
    const token = await this.api('token', { code: username + ':' + password }, { jar });
    if (!token?.jwt) throw new Error('Native login failed');
    this.jars.get(jar).set('token', token.jwt);
    await this.api('projects', undefined, { jar });
  }
  async revoke() {
    let failures = 0;
    for (const [jar, cookies] of this.jars) {
      if (cookies.get('token')) {
        try { await this.api('token/current', undefined, { jar, method: 'DELETE' }); } catch { failures++; }
      }
    }
    if (failures) throw new Error('Owned probe session cleanup failed');
  }
}
