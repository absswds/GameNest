'use strict';
// GameNest MCP server: lets an AI agent play GameNest as a normal player seat.
// stdout is reserved for the MCP stdio transport; all logs go to stderr.
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const WebSocket = require('ws');
const { McpServer, createMcpHandler, localhostAllowedOrigins, originValidationResponse } = require('@modelcontextprotocol/server');
const { serveStdio } = require('@modelcontextprotocol/server/stdio');
const { z } = require('zod');
const guides = require('./move-guides');
const { svgToStrokes, renderPng } = require('./draw');

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
const resetRoom = () => { S.match = null; S.roomId = null; S.resumeToken = null; S.state = null; S.phase = null; S.mySeat = null; S.game = null; };

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

// drawguess strokes arrive as deltas on the current canvas instead of a full game_state
function applyDelta(d) {
  const task = S.state && S.state.myTask;
  if (!d || !task || !Array.isArray(task.strokes)) return;
  if (d.op === 'stroke' && d.stroke) task.strokes.push(d.stroke);
  else if (d.op === 'trim') task.strokes.length = Math.min(task.strokes.length, d.n || 0);
  S.seq++;
}

function onMessage(m) {
  switch (m.type) {
    case 'room_created': S.match = null; applyRoomInfo(m); break; // fresh room: drop the previous room's match
    case 'game_started': applyRoomInfo(m); S.phase = 'playing'; break;
    case 'game_state': applyRoomInfo(m); if (m.state) S.phase = 'playing'; break;
    case 'game_delta': applyDelta(m.delta); break;
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
const stateOutputSchema = z.looseObject({
  connected: z.boolean(),
  roomId: z.string().nullable(),
  game: z.string().nullable(),
  mySeat: z.number().int().nullable(),
  phase: z.string().nullable(),
  isHost: z.boolean(),
  players: z.any(),
  options: z.any(),
  match: z.any(),
  seq: z.number().int(),
  currentActor: z.number().int().nullable(),
  pendingActors: z.array(z.any()).nullish(),
  isMyTurn: z.boolean(),
  gameOver: z.boolean(),
  winner: z.any(),
  lastError: z.string().nullable(),
  reason: z.enum(['my_turn', 'game_over', 'round_end', 'timeout']).optional(),
  state: z.any(),
});
const canvasStrokes = () => { const st = S.state; return (st && (st.strokes || (st.myTask && st.myTask.strokes))) || []; };
const needRoom = () => { if (!S.roomId) throw new Error('not in a room: call create_room or join_room first'); };
const roomAction = (type, label, mk) => async (args) => {
  needRoom();
  const r = await sendAndWait(type, mk ? mk(args) : {}, null, 1500);
  if (!r.ok) throw new Error(r.error);
  return Object.assign({ done: label }, snapshot(false));
};

// The remaining room messages the browser client can send (drawguess strokes/guesses go through make_move).
const EXTRA = ['swap_seat', 'kick_player', 'set_avatar', 'set_name'];

function createServer() {
  const server = new McpServer({ name: 'gamenest', version: '1.0.0' });
  const text = (o) => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o) }] });
  const tool = (name, cfg, fn) => {
    const config = {
      title: cfg.title,
      description: cfg.description,
      inputSchema: cfg.inputSchema || {},
      annotations: Object.assign({ openWorldHint: false }, cfg.annotations),
    };
    if (cfg.outputSchema) config.outputSchema = cfg.outputSchema;
    return server.registerTool(name, config, async (args) => {
      try {
        const res = await fn(args || {});
        const out = text(res);
        if (cfg.outputSchema) out.structuredContent = res;
        return out;
      } catch (e) { return { isError: true, content: [{ type: 'text', text: String((e && e.message) || e) }] }; }
    });
  };

  tool('list_games', {
    title: 'List Games',
    description: 'List available games: id, name, min/max players, whether a built-in bot exists. 列出可玩的游戏。',
    annotations: { readOnlyHint: true },
  }, async () => listGames());

  tool('get_rules', {
    title: 'Get Rules',
    description: 'Get the move JSON format and an example for a game. 获取某游戏的出招格式。',
    inputSchema: { game: z.string() },
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async ({ game }) => {
    if (!guides[game]) throw new Error('unknown game: ' + game);
    return { game, moveGuide: guides[game], note: 'Inspect get_state().state for exact fields; suggest_move gives a legal move from the built-in bot.' };
  });

  tool('create_room', {
    title: 'Create Room',
    description: 'Create a room for a game and become the host (seat 0). 创建房间。',
    inputSchema: { game: z.string(), name: z.string().max(8).optional() },
  }, async ({ game, name }) => {
    S.leaving = false;
    const r = await sendAndWait('create_room', { game, lang: 'en' }, () => !!S.roomId && S.game === game, 3000);
    if (!r.ok || r.unconfirmed) throw new Error(r.error || 'create_room failed (no response)');
    await connectAndSend('set_name', { name: name || 'Claude' });
    return snapshot(false);
  });

  tool('join_room', {
    title: 'Join Room',
    description: 'Join an existing room by room id (shown in the browser). 加入房间。',
    inputSchema: { roomId: z.string(), name: z.string().max(8).optional() },
  }, async ({ roomId, name }) => {
    S.leaving = false;
    const id = roomId.toUpperCase();
    const r = await sendAndWait('join_room', { roomId: id, lang: 'en' }, () => S.roomId === id, 3000);
    if (!r.ok || r.unconfirmed) throw new Error(r.error || 'join_room failed (no response)');
    await connectAndSend('set_name', { name: name || 'Claude' });
    return snapshot(false);
  });

  tool('add_bot', {
    title: 'Add Bot',
    description: 'Host only, before start: add a built-in bot to the next free seat. 添加电脑玩家。',
  }, roomAction('add_bot', 'add_bot'));

  tool('remove_bot', {
    title: 'Remove Bot',
    description: 'Host only, before start: remove the bot at a seat. 移除电脑。',
    inputSchema: { seat: z.number().int() },
    annotations: { destructiveHint: true },
  }, roomAction('remove_bot', 'remove_bot', ({ seat }) => ({ botIndex: seat })));

  tool('set_option', {
    title: 'Set Room Option',
    description: 'Host only, before start: set a room option (e.g. key bestOf, value 3). 设置房间选项。',
    inputSchema: { key: z.string(), value: z.any() },
    annotations: { idempotentHint: true },
  }, roomAction('set_option', 'set_option', ({ key, value }) => ({ key, value })));

  tool('ready', {
    title: 'Toggle Ready',
    description: 'Toggle my ready flag. Every human must be ready before start_game. 准备/取消准备。',
  }, roomAction('player_ready', 'ready toggled'));

  tool('start_game', {
    title: 'Start Game',
    description: 'Host only: start the game (all humans ready, enough seats). 开始游戏。',
  }, async () => {
    needRoom();
    const r = await sendAndWait('start_game', {}, () => S.phase === 'playing' && !!S.state, 3000);
    if (!r.ok) throw new Error(r.error);
    return snapshot(true);
  });

  tool('get_state', {
    title: 'Get Game State',
    description: 'Latest game state as seen by my seat, plus mySeat, currentActor, isMyTurn, winner, players, seq. 获取当前局面。',
    outputSchema: stateOutputSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async () => snapshot(true));

  tool('wait_for_turn', {
    title: 'Wait for Turn',
    description: 'Block until it is my turn, the game is over, or timeout (default 60s, max 120s). reason is my_turn | game_over | round_end (twentyfour: call next_round) | timeout. 等待轮到我/游戏结束。',
    inputSchema: { timeoutSec: z.number().min(1).max(120).optional() },
    outputSchema: stateOutputSchema,
    annotations: { readOnlyHint: true },
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

  tool('make_move', {
    title: 'Make Move',
    description: 'Send a game move object (see get_rules). Optional expectSeq (seq from get_state) rejects stale moves. 出招。',
    inputSchema: { move: z.record(z.string(), z.any()), expectSeq: z.number().int().optional() },
  }, async ({ move, expectSeq }) => {
    needRoom();
    if (typeof expectSeq === 'number' && expectSeq !== S.seq) {
      return { ok: false, stale: true, error: 'state changed since seq ' + expectSeq, seq: S.seq };
    }
    const r = await sendAndWait('game_move', move, null, 2000);
    const a = actorInfo();
    return Object.assign({}, r, { seq: S.seq, isMyTurn: a.isMyTurn, gameOver: a.over });
  });

  // ---------- drawguess: see and draw the canvas ----------
  server.registerTool('get_canvas', {
    title: 'Get Drawing Canvas',
    description: 'drawguess only: the current drawing as a PNG image (280x280 coordinates, shown at 2x) plus stroke count. Use it to look at the picture before guessing or to check my own drawing. 查看画布。',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  }, async () => {
    try {
      if (S.game !== 'drawguess') throw new Error('get_canvas only works in drawguess');
      const strokes = canvasStrokes();
      return { content: [
        { type: 'image', data: renderPng(strokes, 2).toString('base64'), mimeType: 'image/png' },
        { type: 'text', text: JSON.stringify({ strokes: strokes.length, phase: S.state && S.state.phase }) },
      ] };
    } catch (e) { return { isError: true, content: [{ type: 'text', text: String((e && e.message) || e) }] }; }
  });

  tool('draw', {
    title: 'Draw on Canvas',
    description: 'drawguess, drawer only: draw an SVG on the canvas. Supported: line rect circle ellipse polyline polygon path (M L H V C S Q T A Z). Coordinates 0-280 (or set viewBox). Each element carries its own stroke="#color" and stroke-width; no transform, no fills (a fill-only shape is outlined). Fix mistakes with undo_stroke / clear_canvas; check with get_canvas. 画画：传入 SVG。',
    inputSchema: { svg: z.string().max(20000) },
  }, async ({ svg }) => {
    needRoom();
    const st = S.state;
    if (S.game !== 'drawguess' || !st || !st.myTask || !st.myTask.canDraw) throw new Error('not the drawer in a playing drawguess round');
    const strokes = svgToStrokes(svg);
    if (strokes.length > 60) throw new Error('too many strokes (' + strokes.length + '), max 60 per call');
    let sent = 0;
    for (const stroke of strokes) {
      const r = await sendAndWait('game_move', { type: 'stage_stroke', stroke }, null, 1000);
      if (!r.ok) return { ok: false, strokesSent: sent, error: r.error };
      sent++;
    }
    return { ok: true, strokesSent: sent, hint: 'call get_canvas to check the result' };
  });

  const drawerMove = async (move) => {
    needRoom();
    const st = S.state;
    if (S.game !== 'drawguess' || !st || !st.myTask || !st.myTask.canDraw) throw new Error('not the drawer in a playing drawguess round');
    const r = await sendAndWait('game_move', move, null, 1500);
    return Object.assign({}, r, { strokesLeft: canvasStrokes().length });
  };

  tool('undo_stroke', {
    title: 'Undo Canvas Stroke',
    description: 'drawguess, drawer only: remove the last count strokes (default 1) so everyone sees the fix. 撤销最近几笔。',
    inputSchema: { count: z.number().int().min(1).max(60).optional() },
  }, async ({ count }) => drawerMove({ type: 'stage_undo', count: count || 1 }));

  tool('clear_canvas', {
    title: 'Clear Canvas',
    description: 'drawguess, drawer only: wipe the whole canvas. 清空画布。',
    annotations: { destructiveHint: true },
  }, async () => drawerMove({ type: 'stage_clear' }));

  tool('suggest_move', {
    title: 'Suggest Move',
    description: 'Run the project built-in bot on my current view to propose a move (null if unsupported or it fails). 让内置电脑给出建议。',
    annotations: { readOnlyHint: true },
  }, async () => {
    needRoom();
    if (!S.state) return { move: null, reason: 'no state yet' };
    if (S.game === 'sudoku') return { move: sudokuHint(S.state), seq: S.seq };
    let botMod;
    try { botMod = require(path.join(ROOT, 'bots', S.game)); } catch (e) { return { move: null, reason: 'no bot for ' + S.game }; }
    try {
      const bot = botMod.createBot(S.mySeat);
      const view = toBotState(S.game, JSON.parse(JSON.stringify(S.state)), S.mySeat);
      let move = bot.getMove(view, S.mySeat);
      // Timed bots (quizrace) return {} while "thinking"; a few back-to-back calls make them answer now
      for (let i = 0; i < 4 && move && typeof move === 'object' && !Object.keys(move).length; i++) move = bot.getMove(view, S.mySeat);
      return { move: move === undefined ? null : move, seq: S.seq };
    } catch (e) { return { move: null, reason: 'bot failed: ' + e.message }; }
  });

  tool('restart', {
    title: 'Restart Game',
    description: 'Host: restart the game after it ends; non-host: ask the host to restart. 重新开始。',
  }, async () => {
    needRoom();
    const isHost = snapshot(false).isHost;
    const r = await sendAndWait(isHost ? 'game_restart' : 'request_restart', {}, isHost ? null : () => true, 2500);
    if (!r.ok) throw new Error(r.error);
    return snapshot(true);
  });

  tool('next_round', {
    title: 'Next Round',
    description: 'Advance to the next round (twentyfour only). 24点下一轮。',
  }, async () => {
    needRoom();
    const r = await sendAndWait('next_round', {}, null, 2000);
    if (!r.ok) throw new Error(r.error);
    return snapshot(true);
  });

  tool('return_to_room', {
    title: 'Return to Room',
    description: 'Go back to the room lobby after a game. 回到房间大厅。',
  }, roomAction('return_to_room', 'return_to_room'));

  tool('send_message', {
    title: 'Send Room Message',
    description: 'Send another room message: swap_seat {fromIndex, toIndex}, kick_player {playerIndex} (host, before start), set_avatar {avatar}, set_name {name}. 换座、踢人、改头像/名字。',
    inputSchema: { type: z.enum(EXTRA), data: z.record(z.string(), z.any()).optional() },
  }, async ({ type, data }) => {
    needRoom();
    const r = await sendAndWait(type, data || {}, () => false, 800);
    if (!r.ok) throw new Error(r.error);
    return Object.assign({ sent: type }, snapshot(false));
  });

  tool('leave_room', {
    title: 'Leave Room',
    description: 'Leave the current room and give up the seat. 离开房间。',
    annotations: { destructiveHint: true },
  }, async () => {
    S.leaving = true;
    if (S.ws && S.ws.readyState === WebSocket.OPEN) await sendAndWait('leave_room', {}, () => !S.roomId, 1500);
    resetRoom();
    return { left: true };
  });

  return server;
}

// Some games send a bespoke per-seat view; rebuild the shape their bot reads, with hidden cards left unknown.
// The bot only ever sees what this seat can see, so suggestions never peek at hidden info.
function toBotState(game, v, me) {
  const s = Object.assign({}, v);
  const unknown = (n) => new Array(Math.min(Math.max(0, n | 0), 200)).fill(null);
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

// Transport: stdio by default (Claude, Cursor, Codex, Gemini CLI... all spawn it as a subprocess).
// `--http[=port]` or MCP_HTTP_PORT serves the same tools over Streamable HTTP at /mcp for any other MCP client
// or a remote agent. Bound to 127.0.0.1 unless MCP_HTTP_HOST says otherwise; there is no auth, so keep it local.
const httpArg = process.argv.find((a) => a === '--http' || a.startsWith('--http='));
const httpPort = httpArg ? Number(httpArg.split('=')[1] || process.env.MCP_HTTP_PORT || 3333) : Number(process.env.MCP_HTTP_PORT || 0);

async function startHttp(port) {
  // Node 18 has no global Web Crypto by default; the SDK's HTTP transport calls crypto.randomUUID().
  if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
  const host = process.env.MCP_HTTP_HOST || '127.0.0.1';
  const mcpHandler = createMcpHandler(() => createServer(), {
    onerror: (e) => log('http error', e.message),
  });
  const srv = http.createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith('/mcp')) { res.writeHead(404).end(); return; }
    try {
      let url;
      try { url = new URL(req.url, 'http://' + (req.headers.host || host + ':' + port)); }
      catch (e) { url = new URL(req.url, 'http://' + host + ':' + port); }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) { for (const x of v) headers.append(k, x); }
        else if (v !== undefined) headers.set(k, v);
      }
      let body;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = Buffer.concat(chunks);
      }
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableFinished) ac.abort(); });
      const webReq = new Request(url, { method: req.method, headers, body, signal: ac.signal });
      const webRes = originValidationResponse(webReq, localhostAllowedOrigins()) || await mcpHandler.fetch(webReq);
      const outHeaders = {};
      webRes.headers.forEach((v, k) => { outHeaders[k] = v; });
      res.writeHead(webRes.status, webRes.statusText, outHeaders);
      if (!webRes.body) { res.end(); return; }
      const reader = webRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length) res.write(value);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } catch (e) {
      log('http error', e.message);
      if (!res.headersSent) res.writeHead(500).end();
      else if (!res.writableEnded) res.end();
    }
  });
  await new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, host, () => {
      srv.off('error', reject);
      log('Streamable HTTP on http://' + host + ':' + port + '/mcp');
      resolve();
    });
  });
  return mcpHandler;
}

(async () => {
  if (httpPort) await startHttp(httpPort);
  else serveStdio(() => createServer(), { onerror: (e) => log('stdio error', e.message) });
  log('ready, GAMENEST_URL=' + URL_BASE);
})().catch((e) => { log('fatal', e); process.exit(1); });
process.on('SIGTERM', () => process.exit(0));
