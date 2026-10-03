'use strict';
// GameNest MCP server: lets an AI agent play GameNest as a normal player seat.
// stdout is reserved for the MCP stdio transport; all logs go to stderr.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WebSocket = require('ws');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const guides = require('./move-guides');

const ROOT = path.resolve(__dirname, '..');
const URL_BASE = process.env.GAMENEST_URL || 'ws://localhost:3000';
const log = (...a) => console.error('[gamenest-mcp]', ...a);

// ---------- game metadata ----------
function loadCatalog() {
  try {
    const w = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/js/game-catalog.js'), 'utf8'), { window: w, document: {}, navigator: {} });
    return w.gameCatalog || {};
  } catch (e) { return {}; }
}
function listGames() {
  const catalog = loadCatalog();
  return fs.readdirSync(path.join(ROOT, 'games'))
    .filter((f) => f.endsWith('.js') && f !== 'drawguess-words.js')
    .map((f) => f.replace(/\.js$/, ''))
    .map((id) => {
      let mod = {};
      try { mod = require(path.join(ROOT, 'games', id)); } catch (e) { /* ignore */ }
      const c = catalog[id] || {};
      return {
        id, name: c.name || id,
        minPlayers: mod.minPlayers || 2, maxPlayers: mod.maxPlayers || c.maxPlayers || 2,
        hasBot: fs.existsSync(path.join(ROOT, 'bots', id + '.js')),
        realtime: !!mod.realtime,
      };
    });
}
const gameMod = (id) => { try { return require(path.join(ROOT, 'games', id)); } catch (e) { return null; } };

// ---------- session (one WebSocket per process) ----------
const S = {
  ws: null, roomId: null, game: null, mySeat: null, resumeToken: null,
  phase: null, players: [], options: {}, match: null, state: null,
  seq: 0,            // increments on every state broadcast
  lastError: null,   // {seq, message, code, at}
  leaving: false, reconnecting: false,
};
const listeners = new Set();
const notify = () => { for (const f of Array.from(listeners)) f(); };
const resetRoom = () => { S.roomId = null; S.resumeToken = null; S.state = null; S.phase = null; S.mySeat = null; S.game = null; };

function connect() {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL_BASE);
    const t = setTimeout(() => { try { ws.terminate(); } catch (e) { /* ignore */ } reject(new Error('connect timeout: ' + URL_BASE)); }, 8000);
    ws.on('open', () => { clearTimeout(t); S.ws = ws; resolve(); });
    ws.on('error', (e) => { clearTimeout(t); log('ws error', e.message); reject(new Error('cannot connect to ' + URL_BASE + ': ' + e.message)); });
    ws.on('message', (raw) => { let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; } onMessage(m); });
    ws.on('close', () => {
      if (S.ws === ws) S.ws = null;
      if (S.roomId && S.resumeToken && !S.leaving) autoResume();
    });
  });
}

// Reconnect with the resume token (same mechanism as public/js/room-client.js).
async function autoResume() {
  if (S.reconnecting) return;
  S.reconnecting = true;
  for (let i = 0; i < 10 && !S.leaving && S.roomId; i++) {
    await new Promise((r) => setTimeout(r, 1000 * Math.min(i + 1, 5)));
    try {
      await connect();
      S.ws.send(JSON.stringify({ type: 'join_room', data: { roomId: S.roomId, resumeToken: S.resumeToken, lang: 'en' } }));
      log('resumed room', S.roomId);
      break;
    } catch (e) { log('resume attempt failed', e.message); }
  }
  S.reconnecting = false;
}

function applyRoomInfo(m) {
  if (m.roomId) S.roomId = m.roomId;
  if (m.game) S.game = m.game;
  if (typeof m.playerIndex === 'number') S.mySeat = m.playerIndex;
  if (m.resumeToken) S.resumeToken = m.resumeToken;
  if (m.phase) S.phase = m.phase;
  if (m.players) S.players = m.players;
  if (m.options) S.options = m.options;
  if ('match' in m) S.match = m.match;
  if ('state' in m && m.state) { S.state = m.state; S.seq++; }
}

function onMessage(m) {
  switch (m.type) {
    case 'game_started': applyRoomInfo(m); S.phase = 'playing'; break;
    case 'game_state': applyRoomInfo(m); if (m.state) S.phase = 'playing'; break;
    case 'player_index_updated': S.mySeat = m.playerIndex; break;
    case 'left_room': case 'kicked': resetRoom(); break;
    case 'error': S.lastError = { seq: S.seq, message: m.message, code: m.code || null, at: Date.now() }; break;
    default: applyRoomInfo(m);
  }
  if (m.type === 'room_update' && m.phase === 'lobby') S.state = null;
  notify();
}

async function connectAndSend(type, data) {
  await connect();
  S.ws.send(JSON.stringify({ type, data: data || {} }));
}

// Send and wait for the first reaction: server error, predicate true (default: new state), or timeout.
async function sendAndWait(type, data, pred, ms) {
  await connect();
  S.lastError = null; // an old error must not outlive the next action
  const errBefore = S.lastError;
  const seqBefore = S.seq;
  return new Promise((resolve) => {
    const done = (r) => { clearTimeout(t); listeners.delete(fn); resolve(r); };
    const fn = () => {
      if (S.lastError && S.lastError !== errBefore) return done({ ok: false, error: S.lastError.message, code: S.lastError.code });
      if (pred ? pred() : S.seq !== seqBefore) done({ ok: true });
    };
    const t = setTimeout(() => done({ ok: true, unconfirmed: true }), ms || 2000);
    listeners.add(fn);
    S.ws.send(JSON.stringify({ type, data: data || {} }));
  });
}

// ---------- derived info ----------
// mahjong-style games end with phase 'over' + winners[] and leave state.winner unset
const isOver = (st) => !!st && ((st.winner !== null && st.winner !== undefined) || st.phase === 'over');
function actorInfo() {
  const st = S.state;
  if (!st || S.phase !== 'playing') return { currentActor: null, pendingActors: null, isMyTurn: false, over: false };
  const gm = S.game && gameMod(S.game);
  let actor = st.currentPlayer;
  try { if (gm && gm.getCurrentActor) actor = gm.getCurrentActor(st); } catch (e) { /* ignore */ }
  let pending = null;
  try { if (gm && gm.getPendingActors) pending = gm.getPendingActors(st); } catch (e) { /* ignore */ }
  const over = isOver(st);
  let mine;
  if (Array.isArray(pending)) mine = pending.indexOf(S.mySeat) >= 0;
  else if (Number.isInteger(actor) && actor >= 0) mine = actor === S.mySeat;
  else mine = true; // currentPlayer -1/null: simultaneous or race game (2048, sudoku, minesweeper...)
  if (st.phase === 'round_end') mine = false; // twentyfour: the server starts the next round itself
  return { currentActor: Number.isInteger(actor) ? actor : null, pendingActors: pending, isMyTurn: !over && !!mine, over };
}
function snapshot(includeState) {
  const a = actorInfo();
  const out = {
    connected: !!(S.ws && S.ws.readyState === WebSocket.OPEN),
    roomId: S.roomId, game: S.game, mySeat: S.mySeat, phase: S.phase,
    isHost: !!S.players.find((p) => p.index === S.mySeat && p.isHost),
    players: S.players, options: S.options, match: S.match,
    seq: S.seq, currentActor: a.currentActor, pendingActors: a.pendingActors,
    isMyTurn: a.isMyTurn, gameOver: a.over,
    winner: S.state ? (S.state.winner === undefined ? null : S.state.winner) : null,
    lastError: S.lastError ? S.lastError.message : null,
  };
  if (includeState) out.state = S.state;
  return out;
}

// ---------- MCP ----------
const server = new McpServer({ name: 'gamenest', version: '1.0.0' });
const text = (o) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }] });
const tool = (name, description, schema, fn) => server.registerTool(name, { description, inputSchema: schema }, async (args) => {
  try { return text(await fn(args || {})); } catch (e) { return { isError: true, content: [{ type: 'text', text: String((e && e.message) || e) }] }; }
});
const needRoom = () => { if (!S.roomId) throw new Error('not in a room: call create_room or join_room first'); };
const roomAction = (type, label, mk) => async (args) => {
  needRoom();
  const r = await sendAndWait(type, mk ? mk(args) : {}, null, 1500);
  if (!r.ok) throw new Error(r.error);
  return Object.assign({ done: label }, snapshot(false));
};

tool('list_games', 'List available games: id, name, min/max players, whether a built-in bot exists. 列出可玩的游戏。', {}, async () => listGames());

tool('get_rules', 'Get the move JSON format and an example for a game. 获取某游戏的出招格式。', { game: z.string() }, async ({ game }) => {
  if (!guides[game]) throw new Error('unknown game: ' + game);
  return { game, moveGuide: guides[game], note: 'Inspect get_state().state for exact fields; suggest_move gives a legal move from the built-in bot.' };
});

tool('create_room', 'Create a room for a game and become the host (seat 0). 创建房间。', { game: z.string(), name: z.string().max(8).optional() }, async ({ game, name }) => {
  S.leaving = false;
  const r = await sendAndWait('create_room', { game, lang: 'en' }, () => !!S.roomId && S.game === game, 3000);
  if (!r.ok || r.unconfirmed) throw new Error(r.error || 'create_room failed (no response)');
  await connectAndSend('set_name', { name: name || 'Claude' });
  return snapshot(false);
});

tool('join_room', 'Join an existing room by room id (shown in the browser). 加入房间。', { roomId: z.string(), name: z.string().max(8).optional() }, async ({ roomId, name }) => {
  S.leaving = false;
  const id = roomId.toUpperCase();
  const r = await sendAndWait('join_room', { roomId: id, lang: 'en' }, () => S.roomId === id, 3000);
  if (!r.ok || r.unconfirmed) throw new Error(r.error || 'join_room failed (no response)');
  await connectAndSend('set_name', { name: name || 'Claude' });
  return snapshot(false);
});

tool('add_bot', 'Host only, before start: add a built-in bot to the next free seat. 添加电脑玩家。', {}, roomAction('add_bot', 'add_bot'));
tool('remove_bot', 'Host only, before start: remove the bot at a seat. 移除电脑。', { seat: z.number().int() }, roomAction('remove_bot', 'remove_bot', ({ seat }) => ({ botIndex: seat })));
tool('set_option', 'Host only, before start: set a room option (e.g. key bestOf, value 3). 设置房间选项。', { key: z.string(), value: z.any() }, roomAction('set_option', 'set_option', ({ key, value }) => ({ key, value })));
tool('ready', 'Toggle my ready flag. Every human must be ready before start_game. 准备/取消准备。', {}, roomAction('player_ready', 'ready toggled'));

tool('start_game', 'Host only: start the game (all humans ready, enough seats). 开始游戏。', {}, async () => {
  needRoom();
  const r = await sendAndWait('start_game', {}, () => S.phase === 'playing' && !!S.state, 3000);
  if (!r.ok) throw new Error(r.error);
  return snapshot(true);
});

tool('get_state', 'Latest game state as seen by my seat, plus mySeat, currentActor, isMyTurn, winner, players, seq. 获取当前局面。', {}, async () => snapshot(true));

tool('wait_for_turn', 'Block until it is my turn, the game is over, or timeout (default 60s, max 120s). reason is my_turn | game_over | round_end (twentyfour: call next_round) | timeout. 等待轮到我/游戏结束。', {
  timeoutSec: z.number().min(1).max(120).optional(),
}, async ({ timeoutSec }) => {
  const ms = Math.min(timeoutSec || 60, 120) * 1000;
  const roundEnd = () => !!S.state && S.state.phase === 'round_end';
  const ready = () => { const a = actorInfo(); return a.over || a.isMyTurn || roundEnd() || !S.roomId; };
  if (!ready()) {
    await new Promise((resolve) => {
      const done = () => { clearTimeout(t); listeners.delete(fn); resolve(); };
      const fn = () => { if (ready()) done(); };
      const t = setTimeout(done, ms);
      listeners.add(fn);
    });
  }
  const snap = snapshot(true);
  snap.reason = snap.gameOver ? 'game_over' : snap.isMyTurn ? 'my_turn' : roundEnd() ? 'round_end' : 'timeout';
  if (snap.reason === 'round_end') snap.hint = 'Round finished: call next_round to start the next one.';
  return snap;
});

tool('make_move', 'Send a game move object (see get_rules). Optional expectSeq (seq from get_state) rejects stale moves. 出招。', {
  move: z.record(z.string(), z.any()),
  expectSeq: z.number().int().optional(),
}, async ({ move, expectSeq }) => {
  needRoom();
  if (typeof expectSeq === 'number' && expectSeq !== S.seq) {
    return { ok: false, stale: true, error: 'state changed since seq ' + expectSeq, seq: S.seq };
  }
  const r = await sendAndWait('game_move', move, null, 2000);
  const a = actorInfo();
  return Object.assign({}, r, { seq: S.seq, isMyTurn: a.isMyTurn, gameOver: a.over });
});

// Some games send a bespoke per-seat view; rebuild the shape their bot reads, with hidden cards left unknown.
// The bot only ever sees what this seat can see, so suggestions never peek at hidden info.
function toBotState(game, v, me) {
  const s = Object.assign({}, v);
  const unknown = (n) => new Array(n || 0).fill(null);
  if (game === 'hearts' && Array.isArray(v.handSizes)) {
    s.hands = v.handSizes.map((n, i) => (i === me ? v.myHand || [] : unknown(n)));
    s.passSubmissions = v.myPassCards ? { [me]: v.myPassCards } : {};
  } else if (game === 'texas' && Array.isArray(v.opponentHoleCounts)) {
    s.hands = v.opponentHoleCounts.map((n, i) => (i === me ? v.holeCards || [] : unknown(n)));
  } else if (game === 'battleship' && v.myShips) {
    s.ships = []; s.shots = [];
    s.ships[me] = v.myShips; s.ships[1 - me] = [];
    s.shots[me] = v.myShots || []; s.shots[1 - me] = [];
  } else if (game === '2048' && v.board) {
    s.boards = []; s.boards[me] = v.board;
  } else if (game === 'oldmaid' && Array.isArray(v.hands)) {
    s.hands = v.hands.map((h, i) => (i === me || !Array.isArray(h) ? h : h.map(() => ({ id: '?', rank: '?' }))));
  }
  return s;
}

// Sudoku's bot reads the hidden solution, so solve the visible board instead.
function sudokuHint(v) {
  if (!Array.isArray(v.board)) return null;
  const g = v.board.map((row) => row.map((c) => (c && c.value) || 0));
  const ok = (r, c, n) => {
    for (let i = 0; i < 9; i++) if (g[r][i] === n || g[i][c] === n) return false;
    const br = r - r % 3, bc = c - c % 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[br + i][bc + j] === n) return false;
    return true;
  };
  const blanks = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!g[r][c]) blanks.push([r, c]);
  const solve = (k) => {
    if (k === blanks.length) return true;
    const [r, c] = blanks[k];
    for (let n = 1; n <= 9; n++) if (ok(r, c, n)) { g[r][c] = n; if (solve(k + 1)) return true; }
    g[r][c] = 0; return false;
  };
  if (!blanks.length || !solve(0)) return null;
  const [r, c] = blanks[0];
  return { type: 'fill', row: r, col: c, val: g[r][c] };
}

tool('suggest_move', 'Run the project built-in bot on my current view to propose a move (null if unsupported or it fails). 让内置电脑给出建议。', {}, async () => {
  needRoom();
  if (!S.state) return { move: null, reason: 'no state yet' };
  if (S.game === 'sudoku') return { move: sudokuHint(S.state), seq: S.seq };
  let botMod;
  try { botMod = require(path.join(ROOT, 'bots', S.game)); } catch (e) { return { move: null, reason: 'no bot for ' + S.game }; }
  try {
    const bot = botMod.createBot(S.mySeat);
    const move = bot.getMove(toBotState(S.game, JSON.parse(JSON.stringify(S.state)), S.mySeat), S.mySeat);
    return { move: move === undefined ? null : move, seq: S.seq };
  } catch (e) { return { move: null, reason: 'bot failed: ' + e.message }; }
});

tool('restart', 'Host: restart the game after it ends; non-host: ask the host to restart. 重新开始。', {}, async () => {
  needRoom();
  const isHost = snapshot(false).isHost;
  const r = await sendAndWait(isHost ? 'game_restart' : 'request_restart', {}, isHost ? null : () => true, 2500);
  if (!r.ok) throw new Error(r.error);
  return snapshot(true);
});
tool('next_round', 'Advance to the next round (twentyfour only). 24点下一轮。', {}, async () => {
  needRoom();
  const r = await sendAndWait('next_round', {}, null, 2000);
  if (!r.ok) throw new Error(r.error);
  return snapshot(true);
});
tool('return_to_room', 'Go back to the room lobby after a game. 回到房间大厅。', {}, roomAction('return_to_room', 'return_to_room'));

// The remaining room messages the browser client can send (drawguess strokes/guesses go through make_move).
const EXTRA = ['swap_seat', 'kick_player', 'set_avatar', 'set_name'];
tool('send_message', 'Send another room message: swap_seat {fromIndex, toIndex}, kick_player {playerIndex} (host, before start), set_avatar {avatar}, set_name {name}. 换座、踢人、改头像/名字。', {
  type: z.enum(EXTRA),
  data: z.record(z.string(), z.any()).optional(),
}, async ({ type, data }) => {
  needRoom();
  const r = await sendAndWait(type, data || {}, () => false, 800);
  if (!r.ok) throw new Error(r.error);
  return Object.assign({ sent: type }, snapshot(false));
});

tool('leave_room', 'Leave the current room and give up the seat. 离开房间。', {}, async () => {
  S.leaving = true;
  if (S.ws && S.ws.readyState === WebSocket.OPEN) await sendAndWait('leave_room', {}, () => !S.roomId, 1500);
  resetRoom();
  return { left: true };
});

// Transport: stdio by default (Claude, Cursor, Codex, Gemini CLI... all spawn it as a subprocess).
// `--http[=port]` or MCP_HTTP_PORT serves the same tools over Streamable HTTP at /mcp for any other MCP client
// or a remote agent. Bound to 127.0.0.1 unless MCP_HTTP_HOST says otherwise; there is no auth, so keep it local.
const httpArg = process.argv.find((a) => a === '--http' || a.startsWith('--http='));
const httpPort = httpArg ? Number(httpArg.split('=')[1] || process.env.MCP_HTTP_PORT || 3333) : Number(process.env.MCP_HTTP_PORT || 0);

async function startHttp(port) {
  const http = require('http');
  const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const host = process.env.MCP_HTTP_HOST || '127.0.0.1';
  let chain = Promise.resolve(); // one transport is attached to the shared server at a time
  const handle = async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close().catch(() => {}); });
    await server.connect(transport);
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { body = undefined; }
    }
    await transport.handleRequest(req, res, body);
  };
  http.createServer((req, res) => {
    if (!req.url.startsWith('/mcp')) { res.writeHead(404).end(); return; }
    // MCP spec: validate Origin to block DNS-rebinding from web pages. Non-browser clients send none.
    const origin = req.headers.origin;
    if (origin) { let h = ''; try { h = new URL(origin).hostname; } catch (e) {} if (!['localhost', '127.0.0.1', '[::1]'].includes(h)) { res.writeHead(403).end(); return; } }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return; } // stateless: no server-push stream
    chain = chain.then(() => handle(req, res)).catch((e) => {
      log('http error', e.message);
      if (!res.headersSent) res.writeHead(500).end();
    });
  }).listen(port, host, () => log('Streamable HTTP on http://' + host + ':' + port + '/mcp'));
}

(async () => {
  if (httpPort) await startHttp(httpPort);
  else await server.connect(new StdioServerTransport());
  log('ready, GAMENEST_URL=' + URL_BASE);
})().catch((e) => { log('fatal', e); process.exit(1); });
process.on('SIGTERM', () => process.exit(0));
