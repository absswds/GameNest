// 回归:昵称/头像净化(XSS)、扫雷视图不泄露他人布局、数独非致命错误即时广播。
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const PORT = 3190;
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

// host + guest in a started 2-player room of `game`
async function startRoom(game) {
  const host = client();
  await host.open;
  host.send({ type: 'create_room', data: { game, lang: 'en' } });
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
  await delay(300);
  assert.ok(host.last.game_started, 'game should start');
  return { host, guest };
}

test('names and avatars are sanitised server-side', async () => {
  const srv = await startServer();
  try {
    const host = client();
    await host.open;
    host.send({ type: 'create_room', data: { game: 'tictactoe', lang: 'en' } });
    await delay(150);
    const nameOf = () => {
      const u = host.last.room_update;
      const me = u && u.players.find(p => p.index === 0);
      return me && me.name;
    };
    host.send({ type: 'set_name', data: { name: '<b>Bob</b>' } });
    await delay(100);
    assert.equal(nameOf(), 'bBob/b');
    host.send({ type: 'set_name', data: { name: '<>&"\'`' } });
    host.send({ type: 'set_name', data: { name: { a: 1 } } });
    await delay(100);
    assert.equal(nameOf(), 'bBob/b', 'empty-after-strip and non-string names are rejected');
    host.send({ type: 'set_name', data: { name: 'a\u0001b\u007fc' } });
    await delay(100);
    assert.equal(nameOf(), 'abc');
    host.send({ type: 'set_avatar', data: { avatar: '<i>' } });
    await delay(100);
    const me = host.last.room_update.players.find(p => p.index === 0);
    assert.equal(me.avatar, 'i', 'markup stripped from avatar');
    for (const p of host.last.room_update.players) assert.ok(!/[<>&"'`]/.test(p.name + p.avatar));
    host.ws.close();
  } finally { srv.kill(); }
});

test('minesweeper views never contain another seat\'s layout', async () => {
  const srv = await startServer();
  try {
    const { host, guest } = await startRoom('minesweeper');
    const check = (c, mine, other) => {
      const s = c.last.game_state && c.last.game_state.state || c.last.game_started.state;
      assert.ok(s, 'state');
      assert.ok(!s.mines || s.mines.length === 0, 'no mine layout');
      assert.equal(s.revealed[other], null, 'other revealed hidden');
      assert.equal(s.flagged[other], null, 'other flagged hidden');
      assert.ok(Array.isArray(s.board));
    };
    check(host, 0, 1);
    check(guest, 1, 0);
    host.ws.close(); guest.ws.close();
  } finally { srv.kill(); }
});

test('sudoku: a non-fatal wrong entry is broadcast to the other player at once', async () => {
  const srv = await startServer();
  try {
    const { host, guest } = await startRoom('sudoku');
    const st = (host.last.game_started || {}).state;
    assert.ok(st && st.board.length === 9, 'sudoku board in view');
    let r = -1, c = -1;
    for (let i = 0; i < 9 && r < 0; i++) if (st.board[i].some(x => x.given)) for (let j = 0; j < 9; j++) if (!st.board[i][j].given) { r = i; c = j; break; }
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await delay(10); } return fn(); };
    // Sync to the 600ms tick: send right after a tick broadcast, so a state reaching the host within
    // 400ms of the move can only be the immediate broadcast, not the next tick.
    // Only try values already given in the same row: they are always wrong, so the cell is never
    // filled by a lucky correct guess (which made later tries return a different error).
    const wrongVals = st.board[r].filter(x => x.given).map(x => x.value);
    let sent = 0, wrongAt = 0, hostBefore = 0;
    for (const v of wrongVals) {
      if (wrongAt) break;
      const n = host.msgs.filter(m => m.type === 'game_state').length;
      assert.ok(await waitFor(() => host.msgs.filter(m => m.type === 'game_state').length > n, 3000), 'tick broadcast seen');
      hostBefore = host.msgs.length;
      const t0 = Date.now();
      const errs = guest.msgs.filter(m => m.type === 'error' && m.code === 'su_wrong').length;
      guest.send({ type: 'game_move', data: { row: r, col: c, val: v } });
      sent++;
      if (await waitFor(() => guest.msgs.filter(m => m.type === 'error' && m.code === 'su_wrong').length > errs, 1500)) {
        wrongAt = Date.now();
        const got = await waitFor(() => host.msgs.slice(hostBefore).some(m => m.type === 'game_state'), 400);
        assert.ok(got, 'host got a state broadcast right after the wrong move');
      }
    }
    assert.ok(wrongAt, 'guest got su_wrong: ' + JSON.stringify(guest.msgs.map(m => m.type + (m.code ? ':' + m.code : ''))) + ' rs=' + guest.ws.readyState + ' cell=' + r + ',' + c + ' sent=' + sent);
    host.ws.close(); guest.ws.close();
  } finally { srv.kill(); }
});
