const assert = require('assert');
const fs = require('fs');
const WebSocket = require('ws');

const server = fs.readFileSync('server.js', 'utf8');
const client = fs.readFileSync('public/js/room-client.js', 'utf8');
const lobby = fs.readFileSync('public/index.html', 'utf8');

assert(server.includes("code: 'ROOM_NOT_FOUND'"), 'missing rooms must return a stable error code');
assert(client.includes("msg.code === 'ROOM_NOT_FOUND'"), 'game page must handle missing room as a terminal error');
assert(client.includes('clearExpiredRoomAndReturn') && client.includes('sessionStorage.removeItem(key)'), 'stale room credentials must be cleared');
assert(lobby.includes("roomExpired"), 'lobby must explain why the user was returned');

const ws = new WebSocket('ws://localhost:3000');
const timeout = setTimeout(() => fail(new Error('missing-room response timed out')), 5000);
function fail(error) {
  clearTimeout(timeout);
  try { ws.close(); } catch (_) {}
  console.error(error);
  process.exit(1);
}
ws.on('open', () => ws.send(JSON.stringify({ type: 'join_room', data: { roomId: 'ZZZZ' } })));
ws.on('message', raw => {
  const msg = JSON.parse(raw);
  try {
    assert.strictEqual(msg.type, 'error');
    assert.strictEqual(msg.code, 'ROOM_NOT_FOUND');
    clearTimeout(timeout);
    ws.close();
    console.log('Stale room recovery contract passed');
    process.exit(0);
  } catch (error) { fail(error); }
});
ws.on('error', fail);
