// One own host stream. JSON-line controls; tokens/payloads remain in memory only.
const readline = require('node:readline');
const path = require('node:path');
const assert = require('node:assert/strict');
const inputLines = readline.createInterface({ input: process.stdin });
let input, socket, WebSocket, finished = false, timer;
const stats = { handshake: null, before: 0, after: 0, closed: false, closeCode: null };
function emit(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
function stop() {
  if (finished) return;
  finished = true; clearTimeout(timer); socket?.terminate();
  emit({ type: 'result', ...stats }); inputLines.close();
}
function decoded(buffer) {
  const raw = buffer.toString('utf8');
  if (input.mode !== 'exec') return raw;
  // Native exec uses base64; logs have a channel prefix followed by plain text.
  try { return Buffer.from(raw, 'base64').toString('utf8'); } catch { return raw; }
}
function openProbe() {
  const next = new WebSocket(input.url, { headers: { Cookie: 'token=' + input.session },
    origin: 'http://localhost:18080', followRedirects: false, handshakeTimeout: 8000,
    perMessageDeflate: false, maxPayload: 1048576 });
  next.on('unexpected-response', (_, response) => { emit({ type: 'new-handshake', status: response.statusCode }); response.destroy(); next.terminate(); });
  next.on('open', () => { emit({ type: 'new-handshake', status: 101 }); next.terminate(); });
  next.on('error', () => {});
}
inputLines.on('line', line => {
  try {
    const message = JSON.parse(line);
    if (input) {
      if (message.command === 'finish') stop();
      else if (message.command === 'new-handshake') openProbe();
      else if (message.command === 'send-after') {
        if (input.mode !== 'exec') throw new Error('Unexpected input mode');
        if (socket.readyState === WebSocket.OPEN) socket.send(Buffer.from(input.marker + '-after\n').toString('base64'));
        emit({ type: 'after-input-attempted', open: socket.readyState === WebSocket.OPEN });
      } else if (message.command === 'watch-after') { input.afterPhase = true; emit({ type: 'watching-after' }); }
      return;
    }
    input = message;
    assert(['logs', 'exec', 'metrics'].includes(input.mode));
    assert.match(input.marker, /^console-host-stream-[a-f0-9]{12}$/);
    assert.match(input.dockerId, /^[a-f0-9]{64}$/);
    assert.match(input.instanceId, /^1i[0-9]+$/);
    assert.match(input.instanceUuid, /^[a-f0-9-]{36}$/);
    const url = new URL(input.url);
    assert.equal(url.origin, 'ws://localhost:18080');
    assert.equal(url.username + url.password + url.hash, '');
    assert.equal([...url.searchParams.keys()].join(','), 'token');
    const expected = input.mode === 'metrics' ? ['/v1/containerstats/' + input.dockerId, '/v1/stats/' + input.dockerId]
      : ['/v1/' + (input.mode === 'exec' ? 'exec' : 'logs')];
    assert(expected.includes(url.pathname.replace(/\/$/, '')));
    assert.match(input.session, /^[A-Za-z0-9_.~-]{1,8192}$/);
    ({ ws: WebSocket } = require(path.join(input.runtimeModules, 'playwright-core/lib/utilsBundle.js')));
    socket = new WebSocket(url.href, { headers: { Cookie: 'token=' + input.session }, origin: 'http://localhost:18080',
      followRedirects: false, handshakeTimeout: 10000, maxPayload: 1048576, perMessageDeflate: false });
    socket.on('upgrade', response => { stats.handshake = response.statusCode; });
    socket.on('unexpected-response', (_, response) => { stats.handshake = response.statusCode; emit({ type: 'handshake-rejected', status: response.statusCode }); response.destroy(); });
    socket.on('open', () => {
      emit({ type: 'ready', handshake: stats.handshake });
      if (input.mode === 'exec') socket.send(Buffer.from(input.marker + '-before\n').toString('base64'));
    });
    socket.on('message', buffer => {
      const text = decoded(buffer);
      const ownsMetric = input.mode === 'metrics' && (text.includes(input.dockerId) || text.includes(input.instanceId) || text.includes(input.instanceUuid));
      if (text.includes(input.marker + '-before') || (ownsMetric && !input.afterPhase)) {
        stats.before++;
        if (stats.before === 1) emit({ type: 'before' });
      }
      if (text.includes(input.marker + '-after') || (ownsMetric && input.afterPhase)) {
        stats.after++;
        if (stats.after === 1) emit({ type: 'after' });
      }
    });
    socket.on('close', code => { stats.closed = true; stats.closeCode = code; emit({ type: 'closed', code }); });
    socket.on('error', () => { emit({ type: 'socket-error' }); });
    timer = setTimeout(stop, 120000);
  } catch { emit({ type: 'probe-error' }); stop(); }
});
