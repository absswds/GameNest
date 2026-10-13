// 回归:ws 消息处理不能因畸形/越权输入崩溃整个进程,以及 game_move/return_to_room/swap_seat 的状态与权限检查。
// 用真实服务器做协议级验证(独立端口)。
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const PORT = 3189;
const delay = ms => new Promise(r => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const c = { ws, msgs: [], last: {} };
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    c.msgs.push(m);
    c.last[m.type] = m;
  });
  c.send = o => ws.send(JSON.stringify(o));
  c.raw = s => ws.send(s);
  c.open = new Promise(r => ws.on('open', r));
  return c;
}

async function startServer() {
  const srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  srv.stderr.on('data', d => { err += d; });
  await new Promise((res, rej) => {
    const t = setInterval(() => {
      const w = new WebSocket(`ws://127.0.0.1:${PORT}`);
      w.on('open', () => { w.close(); clearInterval(t); res(); });
      w.on('error', () => {});
    }, 150);
    setTimeout(() => rej(new Error('server not listening: ' + err.slice(-200))), 8000);
  });
  return srv;
}

test('malformed and out-of-phase messages never kill the server', async () => {
  const srv = await startServer();
  let exited = false;
  srv.on('exit', () => { exited = true; });
  try {
    const host = client();
    await host.open;

    // Before joining any room: junk of every shape
    for (const s of ['null', '42', '"x"', '[]', '{}', '{"type":null}', '{"type":"game_move"}',
      '{"type":"set_name","data":{"name":123}}', '{"type":"set_avatar","data":{"avatar":{}}}',
      '{"type":"set_option","data":{"key":{},"value":1}}', '{"type":"join_room","data":{"roomId":{"a":1}}}',
      '{"type":"create_room","data":{"game":{"a":1}}}', '{"type":"swap_seat","data":null}',
      'not json at all']) {
      host.raw(s);
    }
    await delay(150);

    // twentyfour room: next_round / game_move with no running game must be refused, not crash
    host.send({ type: 'create_room', data: { game: 'twentyfour', lang: 'en' } });
    await delay(150);
    host.send({ type: 'next_round' });
    host.send({ type: 'game_move' });
    host.send({ type: 'game_move', data: null });
    host.send({ type: 'swap_seat', data: { fromIndex: 0, toIndex: 99 } });
    host.send({ type: 'swap_seat', data: { fromIndex: 0.5, toIndex: 1 } });
    host.send({ type: 'set_option', data: { key: '__proto__', value: { polluted: true } } });
    host.send({ type: 'set_name', data: { name: ['a'] } });
    await delay(200);
    assert.ok(host.msgs.some(m => m.type === 'error' && m.code === 'game_not_playing'), 'game_move without a game should get game_not_playing');
    assert.equal({}.polluted, undefined);

    // Still alive and serving
    const probe = client();
    await probe.open;
    assert.equal(exited, false, 'server process must still be running');
    probe.ws.close();
    host.ws.close();
  } finally {
    srv.kill();
  }
});

test('return_to_room mid-game is host-only; game_move after return is refused', async () => {
  const srv = await startServer();
  try {
    const host = client();
    await host.open;
    host.send({ type: 'create_room', data: { game: 'tictactoe', lang: 'en' } });
    await delay(150);
    const roomId = (host.last.room_created || host.last.room_joined || {}).roomId;
    assert.ok(roomId, 'room id');

    const guest = client();
    await guest.open;
    guest.send({ type: 'join_room', data: { roomId } });
    await delay(150);
    host.send({ type: 'player_ready' });
    guest.send({ type: 'player_ready' });
    await delay(100);
    host.send({ type: 'start_game' });
    await delay(200);
    assert.ok(host.last.game_started, 'game should start');

    // guest (non-host) cannot abort a running game
    guest.send({ type: 'return_to_room' });
    await delay(150);
    assert.ok(guest.msgs.some(m => m.type === 'error' && /host/i.test(m.message || '')), 'guest return_to_room refused mid-game');
    host.send({ type: 'game_move', data: { cell: 0 } });
    await delay(100);
    assert.equal(host.msgs.filter(m => m.type === 'error' && m.code === 'game_not_playing').length, 0, 'game still running');

    // non-host cannot rearrange the host seat
    guest.send({ type: 'swap_seat', data: { fromIndex: 0, toIndex: 1 } });
    await delay(100);

    // host returns to the lobby, then a late game_move is refused (no crash)
    host.send({ type: 'return_to_room' });
    await delay(150);
    const before = host.msgs.length;
    host.send({ type: 'game_move', data: { cell: 1 } });
    guest.send({ type: 'game_move', data: { cell: 2 } });
    await delay(150);
    assert.ok(host.msgs.slice(before).some(m => m.type === 'error' && m.code === 'game_not_playing'));
    host.ws.close();
    guest.ws.close();
  } finally {
    srv.kill();
  }
});
