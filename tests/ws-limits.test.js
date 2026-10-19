// WebSocket abuse limits (server.js): oversized messages and message floods close the connection,
// while normal play — including drawguess streaming strokes at ~20 msg/s — is never affected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const PORT = 3189;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  srv.stderr.on('data', (d) => { err += d; });
  await new Promise((res, rej) => {
    const t = setInterval(() => {
      const w = new WebSocket(`ws://127.0.0.1:${PORT}`);
      w.on('open', () => { w.close(); clearInterval(t); res(); });
      w.on('error', () => {});
    }, 150);
    setTimeout(() => { clearInterval(t); rej(new Error('server not listening: ' + err.slice(-200))); }, 8000);
  });
  return srv;
}

function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  ws.msgs = [];
  ws.closed = new Promise((r) => ws.on('close', (code) => r(code)));
  ws.on('message', (raw) => ws.msgs.push(JSON.parse(raw.toString())));
  ws.on('error', () => {});
  return new Promise((r) => ws.on('open', () => r(ws)));
}
const send = (ws, type, data) => ws.send(JSON.stringify({ type, data }));
const isOpen = (ws) => ws.readyState === WebSocket.OPEN;

test('websocket limits: payload size, floods, and normal drawing traffic', async (t) => {
  const srv = await startServer();
  t.after(() => srv.kill());

  await t.test('a message over 1MB closes the connection', async () => {
    const ws = await connect();
    ws.send(JSON.stringify({ type: 'game_move', data: { junk: 'x'.repeat(1.5 * 1024 * 1024) } }));
    assert.equal(await ws.closed, 1009, 'closed as message too big');
  });

  await t.test('a short burst is trimmed but the connection survives and recovers', async () => {
    const ws = await connect();
    for (let i = 0; i < 300; i++) send(ws, 'noop');
    await delay(2500); // bucket refills
    send(ws, 'create_room', { game: 'drawguess', lang: 'zh' });
    await delay(300);
    assert.ok(isOpen(ws), 'still connected');
    assert.ok(ws.msgs.some((m) => m.type === 'room_created'), 'later messages are handled again');
    ws.close();
  });

  await t.test('a sustained flood is disconnected', async () => {
    const ws = await connect();
    for (let i = 0; i < 2000; i++) send(ws, 'noop');
    assert.equal(await ws.closed, 1008, 'closed for policy violation');
  });

  await t.test('drawing at 20 strokes/s for 4s goes through untouched', async () => {
    const host = await connect();
    send(host, 'create_room', { game: 'drawguess', lang: 'zh' });
    await delay(200);
    const roomId = host.msgs.find((m) => m.type === 'room_created').roomId;
    const guest = await connect();
    send(guest, 'join_room', { roomId, lang: 'zh' });
    await delay(200);
    send(host, 'set_option', { key: 'wordChoices', value: 1 });
    send(host, 'player_ready');
    send(guest, 'player_ready');
    await delay(200);
    send(host, 'start_game');
    await delay(300);
    const started = host.msgs.find((m) => m.type === 'game_started');
    assert.ok(started, 'game started');
    const drawer = started.state.drawerIndex === 0 ? host : guest; // host takes seat 0
    for (let i = 0; i < 80; i++) {
      send(drawer, 'game_move', { type: 'stage_stroke', stroke: { color: '#000', width: 3, g: i, pts: [{ x: i, y: 1 }, { x: i + 1, y: 2 }] } });
      await delay(50);
    }
    await delay(300);
    const viewer = drawer === host ? guest : host;
    const deltas = viewer.msgs.filter((m) => m.type === 'game_delta' && m.delta.op === 'stroke');
    assert.equal(deltas.length, 80, 'every stroke reached the other player');
    assert.equal(deltas[79].delta.n, 80);
    assert.ok(isOpen(host) && isOpen(guest));
    host.close(); guest.close();
  });
});
