// JSON lines on stdin/stdout; credentials and event payloads never leave memory.
const readline = require('node:readline');
const path = require('node:path');
const assert = require('node:assert/strict');
const lines = readline.createInterface({ input: process.stdin });
let socket, WebSocket, input, after = false, done = false, timer;
const stats = { handshake: null, before: 0, after: 0, closed: false, closeCode: null };
function emit(value) { process.stdout.write(JSON.stringify(value) + '\n'); }
function finish() {
  if (done) return;
  done = true;
  clearTimeout(timer);
  socket?.terminate();
  emit({ type: 'result', ...stats });
  lines.close();
}
lines.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    if (input) {
      if (message.command === 'watch-after') { after = true; emit({ type: 'watching-after' }); }
      else if (message.command === 'finish') finish();
      return;
    }
    input = message;
    const url = new URL(input.url);
    assert.equal(url.origin, 'ws://localhost:18080');
    assert.equal(url.pathname.replace(/\/$/, ''), '/v2-beta/projects/1a12/subscribe');
    assert.equal(url.search, '?eventNames=resource.change');
    assert.equal(url.username + url.password + url.hash, '');
    assert.match(input.token, /^[A-Za-z0-9_.~-]{1,8192}$/);
    assert.match(input.stack, /^1st\d+$/);
    assert.match(input.marker, /^console-stream-[a-f0-9]{12}$/);
    ({ ws: WebSocket } = require(path.join(input.runtimeModules, 'playwright-core/lib/utilsBundle.js')));
    socket = new WebSocket(url.href, {
      headers: { Cookie: 'token=' + input.token }, origin: 'http://localhost:18080',
      handshakeTimeout: 10000, maxPayload: 1048576, followRedirects: false,
      perMessageDeflate: false,
    });
    socket.on('upgrade', (r) => { stats.handshake = r.statusCode; });
    socket.on('open', () => emit({ type: 'ready', handshake: stats.handshake }));
    socket.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.resourceId !== input.stack) return;
        const text = JSON.stringify(event);
        if (!after && text.includes(input.marker + '-before')) { stats.before++; emit({ type: 'before' }); }
        if (after && text.includes(input.marker + '-after')) { stats.after++; emit({ type: 'after' }); }
      } catch { /* Discard unknown frames without logging. */ }
    });
    socket.on('close', (code) => { stats.closed = true; stats.closeCode = code; emit({ type: 'closed', code }); });
    socket.on('error', () => emit({ type: 'socket-error' }));
    socket.on('unexpected-response', (_, response) => {
      stats.handshake = response.statusCode; response.destroy(); finish();
    });
    timer = setTimeout(finish, 45000);
  } catch { emit({ type: 'probe-error' }); finish(); process.exitCode = 1; }
});
