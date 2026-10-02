'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
// The MCP server is its own package (mcp/package.json) so the SDK never ships in the APK/exe.
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

test('MCP agent plays tictactoe against a bot', { timeout: 90000, skip: !hasSdk && 'run npm install in mcp/ first' }, async (t) => {
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

  const tools = (await client.listTools()).tools.map((x) => x.name);
  for (const n of ['list_games', 'get_rules', 'create_room', 'join_room', 'add_bot', 'remove_bot', 'set_option', 'ready', 'start_game',
    'get_state', 'wait_for_turn', 'make_move', 'suggest_move', 'restart', 'next_round', 'return_to_room', 'send_message', 'leave_room']) assert.ok(tools.includes(n), 'missing tool ' + n);

  const games = await call('list_games');
  assert.ok(games.find((g) => g.id === 'tictactoe'));
  assert.match((await call('get_rules', { game: 'tictactoe' })).moveGuide, /cell/);

  const room = await call('create_room', { game: 'tictactoe', name: 'Claude' });
  assert.strictEqual(room.mySeat, 0);
  await call('add_bot');
  await call('ready');
  const started = await call('start_game');
  assert.strictEqual(started.phase, 'playing');

  let snap = started;
  for (let i = 0; i < 20 && !snap.gameOver; i++) {
    snap = await call('wait_for_turn', { timeoutSec: 15 });
    if (snap.gameOver) break;
    assert.strictEqual(snap.reason, 'my_turn');
    const { move } = await call('suggest_move');
    assert.ok(move, 'bot suggested a move');
    const r = await call('make_move', { move, expectSeq: snap.seq });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
  }
  snap = await call('get_state');
  assert.strictEqual(snap.gameOver, true);
  assert.ok([-1, 0, 1].includes(snap.winner));

  const bad = await call('make_move', { move: { cell: 99 } });
  assert.strictEqual(bad.ok, false);
  await call('leave_room');
});
