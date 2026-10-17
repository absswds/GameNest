// game_state 里每个客户端的 yourTurn 标记，以及 /api/share-url。
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const WebSocket = require('ws');

const PORT = 3191;
const delay = ms => new Promise(r => setTimeout(r, ms));

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

test('yourTurn in game_started and /api/share-url', async () => {
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

    const msgs = [];
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    ws.on('message', raw => msgs.push(JSON.parse(raw.toString())));
    await new Promise(r => ws.on('open', r));
    const send = o => ws.send(JSON.stringify(o));

    send({ type: 'create_room', data: { game: 'flightchess', lang: 'zh' } });
    await delay(150);
    send({ type: 'add_bot' });
    await delay(100);
    send({ type: 'player_ready' });
    await delay(100);
    send({ type: 'start_game' });
    await delay(300);

    const started = msgs.find(m => m.type === 'game_started');
    assert.ok(started, 'game_started received');
    assert.equal(typeof started.yourTurn, 'boolean');
    const created = msgs.find(m => m.roomId || m.room);
    const roomId = created && (created.roomId || created.room);
    assert.ok(roomId, 'room id known');
    ws.close();

    const ok = await getJson('/api/share-url?room=' + encodeURIComponent(roomId));
    assert.equal(ok.status, 200);
    const url = JSON.parse(ok.body).url;
    assert.match(url, new RegExp('^http://[^/]+/\\?room=' + roomId + '$'));
    const bad = await getJson('/api/share-url?room=' + encodeURIComponent('a/b'));
    assert.equal(bad.status, 400);
  } finally {
    srv.kill();
  }
});
