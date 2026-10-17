// set_name 重名加数字后缀，以及房主交接时的 host_changed 广播。
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const PORT = 3192;
const delay = ms => new Promise(r => setTimeout(r, ms));

async function withServer(fn) {
  const srv = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  srv.stderr.on('data', d => { err += d; });
  try {
    await new Promise((res, rej) => {
      const t = setInterval(() => {
        const w = new WebSocket(`ws://127.0.0.1:${PORT}`);
        w.on('open', () => { w.close(); clearInterval(t); res(); });
        w.on('error', () => {});
      }, 150);
      setTimeout(() => rej(new Error('server not listening: ' + err.slice(-200))), 8000);
    });
    await fn();
  } finally {
    srv.kill();
  }
}

async function client() {
  const msgs = [];
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  ws.on('message', raw => msgs.push(JSON.parse(raw.toString())));
  await new Promise(r => ws.on('open', r));
  return { ws, msgs, send: o => ws.send(JSON.stringify(o)) };
}

const lastPlayers = msgs => {
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].players) return msgs[i].players;
  return [];
};

test('duplicate names get a numeric suffix within 8 chars', async () => {
  await withServer(async () => {
    const a = await client();
    a.send({ type: 'create_room', data: { game: 'tictactoe', lang: 'zh' } });
    await delay(150);
    const roomId = a.msgs.find(m => m.roomId).roomId;
    const b = await client();
    b.send({ type: 'join_room', data: { roomId, lang: 'zh' } });
    await delay(150);

    a.send({ type: 'set_name', data: { name: '小明' } });
    await delay(100);
    b.send({ type: 'set_name', data: { name: '小明' } });
    await delay(100);
    assert.deepEqual(lastPlayers(a.msgs).map(p => p.name), ['小明', '小明2']);

    // renaming to own current name is not a duplicate
    b.send({ type: 'set_name', data: { name: '小明2' } });
    await delay(100);
    assert.deepEqual(lastPlayers(a.msgs).map(p => p.name), ['小明', '小明2']);

    // base is trimmed so the suffix still fits in 8 chars
    a.send({ type: 'set_name', data: { name: '12345678' } });
    await delay(100);
    b.send({ type: 'set_name', data: { name: '12345678' } });
    await delay(100);
    assert.deepEqual(lastPlayers(a.msgs).map(p => p.name), ['12345678', '1234567' + '2']);
    a.ws.close(); b.ws.close();
  });
});

test('host_changed is broadcast when the host leaves', async () => {
  await withServer(async () => {
    const a = await client();
    a.send({ type: 'create_room', data: { game: 'tictactoe', lang: 'zh' } });
    await delay(150);
    const roomId = a.msgs.find(m => m.roomId).roomId;
    const b = await client();
    b.send({ type: 'join_room', data: { roomId, lang: 'zh' } });
    await delay(150);
    b.send({ type: 'set_name', data: { name: 'Bob' } });
    await delay(100);
    const bIndex = b.msgs.find(m => m.type === 'room_joined').playerIndex;
    assert.equal(b.msgs.some(m => m.type === 'host_changed'), false);

    // the host's socket moves to another room: its seat is freed at once
    const c = await client();
    c.send({ type: 'create_room', data: { game: 'tictactoe', lang: 'zh' } });
    await delay(150);
    a.send({ type: 'join_room', data: { roomId: c.msgs.find(m => m.roomId).roomId, lang: 'zh' } });
    await delay(300);
    const hc = b.msgs.find(m => m.type === 'host_changed');
    assert.ok(hc, 'host_changed received');
    assert.equal(hc.hostIndex, bIndex);
    assert.equal(hc.name, 'Bob');
    a.ws.close(); b.ws.close();
  });
});
