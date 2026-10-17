// tests/lan-rooms.test.js
// 验证 GET /api/rooms 局域网房间列表与 set_private 私密房间功能。
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const PORT = 3193;
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

async function fetchRooms() {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/rooms`);
  return res.json();
}

test('GET /api/rooms returns public waiting rooms and filters private/playing/full rooms', async () => {
  await withServer(async () => {
    // 1. Initially no rooms
    let data = await fetchRooms();
    assert.deepEqual(data.rooms, []);

    // 2. Client A creates a room (gomoku, 2 players)
    const a = await client();
    a.send({ type: 'create_room', data: { game: 'gomoku', lang: 'zh' } });
    await delay(150);
    const createMsg = a.msgs.find(m => m.type === 'room_created');
    assert(createMsg, 'room_created should arrive');
    const roomIdA = createMsg.roomId;
    assert.equal(createMsg.isPrivate, false);

    // 3. /api/rooms now lists roomIdA
    data = await fetchRooms();
    assert.equal(data.rooms.length, 1);
    assert.equal(data.rooms[0].roomId, roomIdA);
    assert.equal(data.rooms[0].game, 'gomoku');
    assert.equal(data.rooms[0].playerCount, 1);
    assert.equal(data.rooms[0].maxPlayers, 2);

    // 4. Host sets room to private
    a.send({ type: 'set_private', data: { isPrivate: true } });
    await delay(150);
    const updateMsg = a.msgs.filter(m => m.type === 'room_update').pop();
    assert(updateMsg && updateMsg.isPrivate === true, 'room_update should report isPrivate: true');

    // 5. Room disappears from /api/rooms
    data = await fetchRooms();
    assert.deepEqual(data.rooms, [], 'Private room must not appear in /api/rooms');

    // 6. Host sets room back to public
    a.send({ type: 'set_private', data: { isPrivate: false } });
    await delay(150);
    data = await fetchRooms();
    assert.equal(data.rooms.length, 1);
    assert.equal(data.rooms[0].roomId, roomIdA);

    // 7. Client B joins the room
    const b = await client();
    b.send({ type: 'join_room', data: { roomId: roomIdA } });
    await delay(150);
    const joinMsg = b.msgs.find(m => m.type === 'room_joined');
    assert(joinMsg, 'client B joined');
    assert.equal(joinMsg.isPrivate, false);

    // Non-host B tries to set private -> error
    b.send({ type: 'set_private', data: { isPrivate: true } });
    await delay(150);
    const bErr = b.msgs.find(m => m.type === 'error');
    assert(bErr, 'non-host set_private must return error');

    // Room is now full (2/2) -> should not appear in /api/rooms
    data = await fetchRooms();
    assert.equal(data.rooms.length, 0, 'Full room must not appear in /api/rooms');

    // Close connections
    a.ws.close();
    b.ws.close();
    await delay(100);
  });
});
