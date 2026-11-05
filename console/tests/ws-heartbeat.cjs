const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { ws: WebSocket } = require(
  path.join(input.runtimeModules, 'playwright-core/lib/utilsBundle.js'),
);
const url = new URL(input.url);
assert.equal(url.origin, 'ws://localhost:18080');
assert.equal(url.username, '');
assert.equal(url.password, '');
assert.equal(url.hash, '');
assert.match(url.pathname, /^\/v2-beta\/projects\/1a12\/subscribe\/?$/);
assert.equal(url.search, '?eventNames=resource.change');
assert.match(input.token, /^[A-Za-z0-9_.~-]{1,8192}$/);
const stats = {
  observationCompleted: false,
  handshakeStatus: null,
  pings: 0,
  pongs: 0,
  rttMs: [],
  discardedEventFrames: 0,
  closeCode: null,
  errorType: null,
};
const pending = new Map();
let interval,
  finishTimer,
  closeTimer,
  complete = false;
function finish() {
  if (complete) return;
  complete = true;
  clearInterval(interval);
  clearTimeout(finishTimer);
  clearTimeout(closeTimer);
  console.log(JSON.stringify(stats));
}
const socket = new WebSocket(url.href, {
  headers: { Cookie: 'token=' + input.token },
  origin: 'http://localhost:18080',
  handshakeTimeout: 10000,
  maxPayload: 1048576,
  followRedirects: false,
  perMessageDeflate: false,
});
socket.on('upgrade', (response) => {
  stats.handshakeStatus = response.statusCode;
});
socket.on('unexpected-response', (_, response) => {
  stats.handshakeStatus = response.statusCode;
  response.destroy();
  socket.terminate();
  finish();
});
socket.on('open', () => {
  const ping = () => {
    if (socket.readyState !== WebSocket.OPEN || stats.pings >= 6) return;
    const key = String(++stats.pings);
    pending.set(key, performance.now());
    socket.ping(key);
  };
  ping();
  interval = setInterval(ping, 5000);
  finishTimer = setTimeout(() => {
    clearInterval(interval);
    stats.observationCompleted = true;
    socket.close(1000);
    closeTimer = setTimeout(() => {
      socket.terminate();
      finish();
    }, 3000);
  }, 35000);
});
socket.on('pong', (payload) => {
  const key = payload.toString(),
    at = pending.get(key);
  if (at !== undefined) {
    stats.pongs++;
    stats.rttMs.push(Math.round((performance.now() - at) * 100) / 100);
    pending.delete(key);
  }
});
socket.on('message', () => {
  stats.discardedEventFrames++;
});
socket.on('error', (error) => {
  stats.errorType = error.name;
});
socket.on('close', (code) => {
  stats.closeCode = code;
  finish();
});
setTimeout(() => {
  if (!complete) {
    socket.terminate();
    finish();
  }
}, 45000).unref();
