'use strict';
// MCP agent plays each v2.2 game to the end: wait_for_turn -> suggest_move -> make_move.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SDK = path.join(ROOT, 'mcp', 'node_modules', '@modelcontextprotocol', 'sdk');
const hasSdk = require('fs').existsSync(SDK);
const { Client } = hasSdk ? require(SDK + '/dist/cjs/client/index.js') : {};
const { StdioClientTransport } = hasSdk ? require(SDK + '/dist/cjs/client/stdio.js') : {};

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}
async function waitUp(port) {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.status) return; } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

const GAMES = [
  { game: 'undercover', bots: 4, guide: /speech/i },
  { game: 'paodekuai', bots: 2, guide: /cards/ },
  { game: 'quizrace', bots: 1, guide: /answer/, options: { questionCount: 10, timePerQuestion: 10 } },
];

for (const g of GAMES) {
  test('MCP agent plays ' + g.game + ' to the end', { timeout: 240000, skip: !hasSdk && 'run npm install in mcp/ first' }, async (t) => {
    const port = await freePort();
    const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port) }), stdio: 'ignore' });
    const client = new Client({ name: 'test', version: '1.0.0' });
    t.after(async () => { try { await client.close(); } catch (e) { /* ignore */ } srv.kill(); });
    await waitUp(port);
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [path.join(ROOT, 'mcp', 'server.js')],
      env: Object.assign({}, process.env, { GAMENEST_URL: 'ws://127.0.0.1:' + port }),
    }));
    const call = async (name, args) => {
      const r = await client.callTool({ name, arguments: args || {} });
      const txt = r.content[0].text;
      if (r.isError) throw new Error(name + ': ' + txt);
      try { return JSON.parse(txt); } catch (e) { return txt; }
    };

    assert.match((await call('get_rules', { game: g.game })).moveGuide, g.guide);
    await call('create_room', { game: g.game, name: 'Claude' });
    for (let i = 0; i < g.bots; i++) await call('add_bot');
    for (const [key, value] of Object.entries(g.options || {})) await call('set_option', { key, value });
    await call('ready');
    const started = await call('start_game');
    assert.strictEqual(started.phase, 'playing', JSON.stringify(started).slice(0, 300));

    let snap = started, moves = 0, refused = 0;
    for (let i = 0; i < 400 && !snap.gameOver; i++) {
      snap = await call('wait_for_turn', { timeoutSec: 30 });
      if (snap.gameOver) break;
      if (snap.reason !== 'my_turn') continue; // e.g. out of the game while the others finish
      const { move } = await call('suggest_move');
      assert.ok(move, 'bot suggested a move at seq ' + snap.seq);
      const r = await call('make_move', { move, expectSeq: snap.seq });
      if (r.ok) moves++; else refused++;
    }
    snap = await call('get_state');
    assert.strictEqual(snap.gameOver, true, 'game finished');
    assert.ok(moves > 0, 'the agent made moves');
    assert.ok(refused <= 2, 'suggested moves are accepted (refused ' + refused + ')');
    await call('leave_room');
  });
}
