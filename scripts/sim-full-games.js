#!/usr/bin/env node
'use strict';
/*
 * Full-game simulation through the REAL server (server.js in a child process, real ws protocol).
 *
 *   node scripts/sim-full-games.js                      # every game
 *   node scripts/sim-full-games.js uno monopoly         # only these games
 *   node scripts/sim-full-games.js uno --runs=3 --speed=30 --stuck=20 --max-time=120 --jobs=4
 *   node scripts/sim-full-games.js --quick              # 1 run per game, tight limits (used by tests)
 *   node scripts/sim-full-games.js uno --seed=1234      # reproduce: base seed (run i uses seed+i)
 *   node scripts/sim-full-games.js --out=path.md        # write a markdown table
 *
 * How it works
 *  - Each run spawns `node -r <this file> server.js` on a random free port. When loaded via -r with
 *    SIM_FULL_CHILD=1 this file is a preload that (a) seeds Math.random and (b) warps time by
 *    --speed (Date.now runs faster, setTimeout/setInterval delays are divided), so 1-2 s bot delays,
 *    phase deadlines, round timers etc. all still go through the real server code but quickly.
 *    No game/server source is modified.
 *  - The host client takes seat 0, `add_bot` fills the other seats (server-side bots, exactly like
 *    the lobby). Seat 0 is played by the game's bot via getMove(toBotState(view)) (same approach as
 *    mcp/suggest_move) so it only ever sees its own playerView.
 *  - Games without bots (suikabattle, minesweeper, drawguess, truthdare) use extra ws clients that
 *    play randomly-but-legally (see RANDOM_PLAYERS).
 *  - Stuck = the (time-noise-stripped) view of every client unchanged for --stuck real seconds.
 */
const path = require('path');

// ---------------------------------------------------------------- shared helpers
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- child preload mode
if (process.env.SIM_FULL_CHILD === '1') {
  const K = Math.max(1, Number(process.env.SIM_SPEED) || 1);
  Math.random = mulberry32(Number(process.env.SIM_SEED) || 1);
  if (K > 1) {
    const realNow = Date.now.bind(Date);
    const t0 = realNow();
    Date.now = () => t0 + (realNow() - t0) * K;
    const st = global.setTimeout, si = global.setInterval;
    const scale = (ms) => { ms = Number(ms); return ms > 0 ? Math.max(1, ms / K) : ms; };
    global.setTimeout = (fn, ms, ...a) => st(fn, scale(ms), ...a);
    // the 30s ws heartbeat stays real-time: a CPU-heavy bot (chess) in the client must not look dead
    global.setInterval = (fn, ms, ...a) => si(fn, ms >= 30000 ? ms : scale(ms), ...a);
  }
  return; // eslint-disable-line no-useless-return -- module-level return is valid in CommonJS
}

const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- config
// sizes: seat counts cycled over the runs. maxMs: real-time cap for one run (default --max-time).
const CONFIG = {
  '2048': { sizes: [1, 2] },
  battleship: { sizes: [2] },
  bigtwo: { sizes: [4, 3] },
  checkers: { sizes: [2] },
  chess: { sizes: [2] },
  chinesechess: { sizes: [2] },
  connect4: { sizes: [2] },
  davinci: { sizes: [3, 2, 4] },
  // doudizhu is a multi-round match; options.totalRounds=1 ends with state.winner. The default (3 rounds) keeps
  // extending through continue_vote forever, so the run counts as done once 4 rounds are in roundHistory.
  doudizhu: { sizes: [3], options: [{ totalRounds: 1 }, {}, { totalRounds: 2 }], done: (v) => Array.isArray(v.roundHistory) && v.roundHistory.length >= 4 },
  drawguess: { sizes: [3, 2], humans: 'all', options: [{}, { mode: 'whisper' }] },
  'exploding-kittens': { sizes: [4, 2] },
  flightchess: { sizes: [4, 2] },
  go9: { sizes: [2] },
  gomoku: { sizes: [2] },
  hearts: { sizes: [4] },
  liarsbar: { sizes: [4, 3] },
  'mahjong-cantonese': { sizes: [4, 2] },
  'mahjong-sichuan': { sizes: [4, 2] },
  minesweeper: { sizes: [2, 1], humans: 'all' },
  monopoly: { sizes: [3, 2] },
  numberbomb: { sizes: [3, 2] },
  oldmaid: { sizes: [4, 3] },
  reversi: { sizes: [2] },
  rummikub: { sizes: [3, 2] },
  sanguo: { sizes: [5, 4] },
  sheeptile: { sizes: [2] }, // min 2 seats even though the bot plays solo
  snakebattle: { sizes: [3, 2] },
  sudoku: { sizes: [2, 1] },
  suikabattle: { sizes: [2, 1], humans: 'all' },
  texas: { sizes: [4, 2] },
  tictactoe: { sizes: [2] },
  truthdare: { sizes: [3, 2], humans: 'all', noEnd: true },
  twentyfour: { sizes: [2, 1] },
  uno: { sizes: [4, 2] },
  werewolf: { sizes: [8, 6] },
};

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const a = argv.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : def;
};
const QUICK = argv.includes('--quick');
const OPT = {
  runs: Number(flag('runs', QUICK ? 1 : 5)),
  speed: Number(flag('speed', 20)),
  stuck: Number(flag('stuck', QUICK ? 6 : 20)),
  maxTime: Number(flag('max-time', QUICK ? 14 : 120)),
  maxSteps: Number(flag('max-steps', 6000)),
  jobs: Number(flag('jobs', 4)),
  seed: Number(flag('seed', 1000)),
  out: flag('out', null),
  verbose: argv.includes('--verbose'),
};
const wanted = argv.filter((a) => !a.startsWith('--'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- modules (for actor info + bots)
const gameMods = {}, botMods = {};
function loadMods() {
  for (const f of fs.readdirSync(path.join(ROOT, 'games'))) {
    if (!f.endsWith('.js')) continue;
    try { const m = require(path.join(ROOT, 'games', f)); gameMods[f.replace(/\.js$/, '')] = m; } catch (e) { /* reported at run time */ }
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'bots'))) {
    if (!f.endsWith('.js')) continue;
    try { botMods[f.replace(/\.js$/, '')] = require(path.join(ROOT, 'bots', f)); } catch (e) { /* reported at run time */ }
  }
}

// ---------------------------------------------------------------- view -> bot state (from mcp/server.js)
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

function sudokuHint(v) { // sudoku's bot reads the hidden solution; solve the visible board instead
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

// ---------------------------------------------------------------- random legal players (bot-less games)
const pickOf = (rng, a) => a[Math.floor(rng() * a.length)];
const RANDOM_PLAYERS = {
  minesweeper(c, ctx) {
    const b = c.view && c.view.board;
    if (!Array.isArray(b) || !b.length) return null;
    const cells = [];
    b.forEach((row, r) => row.forEach((cell, col) => { if (!cell.revealed && !cell.flagged) cells.push({ action: 'reveal', row: r, col }); }));
    return cells.length ? pickOf(ctx.rng, cells) : null;
  },
  suikabattle(c) {
    const v = c.view, me = c.seat;
    if (!v || v.phase !== 'playing' || (v.eliminated && v.eliminated[me])) return null;
    if (v.drops[me] < 10 + me * 3) return { type: 'drop' };
    if (v.merges[me] < 4) return { type: 'merge', fruitType: v.merges[me] % 5 };
    return { type: 'gameover' };
  },
  truthdare(c, ctx) {
    ctx.draws = (ctx.draws || 0);
    if (c.seat !== ctx.drawer) return null;
    ctx.draws++;
    if (ctx.draws > 12) { ctx.finished = true; return null; }
    return { action: 'draw', kind: pickOf(ctx.rng, ['truth', 'dare', 'random']) };
  },
  drawguess(c, ctx) {
    const v = c.view;
    if (!v) return null;
    const t = v.myTask;
    if (v.phase === 'gameover') return null;
    if (v.mode === 'whisper') {
      if (v.phase === 'choosing') return t && t.type === 'choose' ? { type: 'choose_word', index: 0 } : null;
      if (v.phase === 'playing') {
        if (!t) return null;
        if (t.type === 'draw') return { type: 'submit', content: [{ color: '#222', width: 4, pts: [{ x: 10, y: 10 }, { x: 100, y: 100 }] }] };
        return { type: 'submit', content: 'a guess' };
      }
      if (v.phase === 'reveal') return { type: 'vote_match', value: pickOf(ctx.rng, ['match', 'drift']) };
      return null;
    }
    if (v.phase === 'choosing') return t && t.type === 'choose' ? { type: 'choose_word', index: 0 } : null;
    if (v.phase === 'playing' && t) {
      if (t.canDraw) {
        ctx.word = t.word;
        if (!c.stroked || c.stroked !== v.round) { c.stroked = v.round; return { type: 'stage_stroke', stroke: { color: '#222', width: 4, pts: [{ x: 20, y: 20 }, { x: 120, y: 160 }] } }; }
        return null;
      }
      if (t.correct) return null;
      if (ctx.word && c.guessedRound !== v.round) { c.guessedRound = v.round; return { type: 'stage_guess', text: 'definitely wrong' }; }
      if (ctx.word) return { type: 'stage_guess', text: ctx.word };
    }
    return null;
  },
};

// ---------------------------------------------------------------- client
const NOISE_KEY = /time|deadline|tick|elapsed|remain|ms$|at$|^id$/i;
function signature(v) {
  const seen = new WeakSet();
  return JSON.stringify(v, (k, val) => {
    if (NOISE_KEY.test(k) && typeof val === 'number') return undefined;
    if (val && typeof val === 'object') { if (seen.has(val)) return undefined; seen.add(val); }
    return val;
  });
}
const isOverState = (st) => !!st && ((st.winner !== null && st.winner !== undefined) || (Array.isArray(st.winners) && st.winners.length > 0) ||
  st.phase === 'over' || st.phase === 'finished' || st.phase === 'gameover' || st.gameOver === true);

class Client {
  constructor(port, label) {
    this.label = label; this.port = port;
    this.seat = null; this.roomId = null; this.phase = null; this.view = null; this.players = [];
    this.seq = 0; this.steps = 0; this.errors = []; this.moves = 0; this.badMoves = 0;
    this.lastMoves = []; this.sig = ''; this.sigAt = Date.now(); this.listeners = new Set();
    this.attempt = 0; this.lastSentAt = 0; this.lastSentSeq = -1; this.match = null; this.resume = null;
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://127.0.0.1:' + this.port);
      this.ws.on('open', resolve);
      this.ws.on('error', (e) => { this.wsError = e.message; reject(e); });
      this.ws.on('close', () => { this.closed = true; this.notify(); });
      this.ws.on('message', (raw) => { let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; } this.onMessage(m); });
    });
  }
  onMessage(m) {
    if (typeof m.playerIndex === 'number') this.seat = m.playerIndex;
    if (m.roomId) this.roomId = m.roomId;
    if (m.players) this.players = m.players;
    if (m.phase) this.phase = m.phase;
    if ('match' in m) this.match = m.match;
    if (m.type === 'error') { this.errors.push({ code: m.code || null, message: m.message, move: this.lastMoves[this.lastMoves.length - 1] }); this.lastErrAt = Date.now(); }
    if (m.state !== undefined && (m.type === 'game_started' || m.type === 'game_state' || m.type === 'room_joined')) {
      this.view = m.state; this.seq++;
      if (m.type !== 'room_joined') this.steps++;
      if (m.type === 'game_started' || m.type === 'game_state') this.phase = 'playing';
      let s; try { s = signature(m.state); } catch (e) { s = String(Math.random()); }
      if (s !== this.sig) { this.sig = s; this.sigAt = Date.now(); }
    }
    this.notify();
  }
  notify() { for (const f of Array.from(this.listeners)) f(); }
  send(type, data) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, data: data || {} })); }
  waitFor(pred, ms, what) {
    return new Promise((resolve, reject) => {
      if (pred()) return resolve();
      const fn = () => { if (pred()) { clearTimeout(t); this.listeners.delete(fn); resolve(); } else if (this.closed) { clearTimeout(t); this.listeners.delete(fn); reject(new Error('socket closed waiting for ' + what)); } };
      const t = setTimeout(() => { this.listeners.delete(fn); reject(new Error('timeout waiting for ' + what + (this.errors.length ? ' (last error: ' + this.errors[this.errors.length - 1].message + ')' : ''))); }, ms || 5000);
      this.listeners.add(fn);
    });
  }
  close() { try { this.ws.terminate(); } catch (e) { /* ignore */ } }
}

// ---------------------------------------------------------------- server child
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
async function startServer(seed) {
  const port = await freePort();
  const env = Object.assign({}, process.env, { PORT: String(port), SIM_FULL_CHILD: '1', SIM_SPEED: String(OPT.speed), SIM_SEED: String(seed) });
  delete env.GAMENEST_DEBUG;
  const child = spawn(process.execPath, ['-r', __filename, 'server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const srv = { child, port, stderr: '', stdout: '', exited: null };
  child.stderr.on('data', (d) => { srv.stderr += d; if (srv.stderr.length > 400000) srv.stderr = srv.stderr.slice(-300000); });
  child.stdout.on('data', (d) => { srv.stdout += d; if (srv.stdout.length > 20000) srv.stdout = srv.stdout.slice(-10000); });
  child.on('exit', (code, sig) => { srv.exited = { code, sig }; });
  for (let i = 0; i < 100; i++) {
    if (srv.exited) throw new Error('server exited at startup (code ' + srv.exited.code + '): ' + srv.stderr.slice(0, 600));
    const ok = await new Promise((res) => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); res(true); }); s.once('error', () => res(false)); });
    if (ok) return srv;
    await sleep(100);
  }
  child.kill();
  throw new Error('server did not listen within 10s: ' + srv.stderr.slice(0, 400));
}
function stopServer(srv) {
  return new Promise((resolve) => {
    if (!srv || srv.exited) return resolve();
    srv.child.once('exit', () => resolve());
    srv.child.kill();
    setTimeout(() => { try { srv.child.kill('SIGKILL'); } catch (e) { /* ignore */ } resolve(); }, 1500);
  });
}
function stderrIssues(text) {
  const counts = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^at /.test(line) || /^\^+$/.test(line)) continue;
    const key = line.replace(/room=[A-Z0-9]+/g, 'room=*').replace(/\d{6,}/g, 'N').slice(0, 220);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts, ([line, n]) => ({ line, n }));
}

// ---------------------------------------------------------------- one run
async function runOnce(game, runIdx, seed) {
  const cfg = CONFIG[game] || { sizes: [2] };
  const gm = gameMods[game], bm = botMods[game];
  const n = cfg.sizes[runIdx % cfg.sizes.length];
  const roomOptions = (cfg.options && cfg.options[runIdx % cfg.options.length]) || {};
  const hasBot = !!bm;
  const humans = hasBot && cfg.humans !== 'all' ? 1 : n;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const res = { game, run: runIdx, seed, players: n, humans, options: roomOptions, ok: false, reason: '', steps: 0, myMoves: 0, ms: 0 };
  const t0 = Date.now();
  let srv; const clients = [];
  try {
    srv = await startServer(seed);
    const host = new Client(srv.port, 'host'); clients.push(host);
    await host.connect();
    host.send('create_room', { game, lang: 'en' });
    await host.waitFor(() => host.roomId, 5000, 'room_created');
    for (let i = 1; i < humans; i++) {
      const c = new Client(srv.port, 'p' + i); clients.push(c);
      await c.connect();
      c.send('join_room', { roomId: host.roomId, lang: 'en' });
      await c.waitFor(() => c.seat !== null && c.roomId, 5000, 'room_joined');
    }
    for (let i = humans; i < n; i++) {
      const before = host.players.length;
      host.send('add_bot');
      await host.waitFor(() => host.players.length > before, 5000, 'bot added');
    }
    for (const [k, v] of Object.entries(roomOptions)) host.send('set_option', { key: k, value: v });
    for (const c of clients) c.send('player_ready');
    await host.waitFor(() => host.players.filter((p) => !p.isBot).every((p) => p.ready), 5000, 'all ready');
    host.send('start_game');
    await host.waitFor(() => host.phase === 'playing' && host.view, 8000, 'game_started');
    res.startedAt = Date.now();

    const ctx = { rng, drawer: 0 };
    const botFor = new Map();
    const botMoveFor = (c) => {
      if (!bm) return undefined;
      let b = botFor.get(c);
      if (!b || b.seat !== c.seat) { b = { seat: c.seat, bot: bm.createBot(c.seat) }; botFor.set(c, b); }
      if (game === 'sudoku') return sudokuHint(c.view);
      return b.bot.getMove(toBotState(game, JSON.parse(JSON.stringify(c.view)), c.seat), c.seat);
    };
    const myTurn = (c) => {
      const v = c.view;
      if (!v) return false;
      let pending = null, actor = v.currentPlayer;
      try { if (gm.getPendingActors) pending = gm.getPendingActors(v); } catch (e) { /* view may lack fields */ }
      try { if (gm.getCurrentActor) actor = gm.getCurrentActor(v); } catch (e) { /* ignore */ }
      if (Array.isArray(pending)) return pending.indexOf(c.seat) >= 0;
      if (Number.isInteger(actor) && actor >= 0) return actor === c.seat;
      return true; // simultaneous / race games
    };
    const realtime = !!(gm && gm.realtime);
    const issueNotes = new Set();

    const act = (c) => {
      const v = c.view;
      if (!v || isOverState(v) || c.phase !== 'playing') return;
      const now = Date.now();
      if (game === 'twentyfour' && v.phase === 'round_end') {
        if (c === host && now - c.lastSentAt > 400) { c.lastSentAt = now; c.send('next_round'); }
        return;
      }
      const fresh = c.lastSentSeq !== c.seq;
      if (fresh) c.attempt = 0;
      const gap = realtime ? 70 : (fresh ? 0 : 450);
      if (now - c.lastSentAt < gap) return;
      if (!fresh && !realtime && c.lastErrAt && c.lastErrAt < c.lastSentAt - 5) { /* no error and no new state: just wait */ }
      let move;
      if (RANDOM_PLAYERS[game] && humans === n && (cfg.humans === 'all')) {
        try { move = RANDOM_PLAYERS[game](c, ctx); } catch (e) { move = null; issueNotes.add('random player threw: ' + e.message); }
        if (move && !realtime && !fresh && game !== 'suikabattle' && game !== 'minesweeper') { /* retry same */ }
      } else {
        if (!myTurn(c)) return;
        const cands = [];
        try { const m = botMoveFor(c); if (m !== undefined && m !== null) cands.push(m); } catch (e) { issueNotes.add('my-seat bot threw (view-based state): ' + e.message.slice(0, 120)); }
        cands.push({ pass: true }, {});
        move = cands[Math.min(c.attempt, cands.length - 1)];
        c.attempt++;
      }
      if (!move) return;
      c.lastSentAt = now; c.lastSentSeq = c.seq; c.moves++; res.myMoves++;
      c.lastMoves.push(move); if (c.lastMoves.length > 8) c.lastMoves.shift();
      c.send('game_move', move);
    };

    // main drive loop
    let reason = '';
    const deadline = t0 + (cfg.maxMs || OPT.maxTime * 1000);
    while (true) {
      await sleep(25);
      for (const c of clients) act(c);
      const over = isOverState(host.view) || !!(cfg.done && host.view && cfg.done(host.view));
      if (over) { reason = 'over'; break; }
      if (cfg.noEnd && ctx.finished) { reason = 'over'; res.note = 'no end state in game design; drew 12 cards then stopped'; break; }
      if (cfg.noEnd && game === 'truthdare') { /* handled in RANDOM_PLAYERS */ }
      if (srv.exited) { reason = 'server-crashed'; break; }
      if (clients.some((c) => c.closed)) { reason = 'socket-closed'; break; }
      const now = Date.now();
      if (clients.every((c) => now - c.sigAt > OPT.stuck * 1000)) { reason = 'stuck'; break; }
      if (host.steps > OPT.maxSteps) { reason = 'max-steps'; break; }
      if (now > deadline) { reason = 'timeout'; break; }
    }
    res.reason = reason;
    res.ok = reason === 'over';
    res.steps = host.steps;
    const v = host.view || {};
    res.winner = v.winner !== undefined ? v.winner : (v.winners || null);
    res.finalPhase = v.phase;
    if (!res.ok) {
      let actor = v.currentPlayer, pending = null;
      try { if (gm.getCurrentActor) actor = gm.getCurrentActor(v); } catch (e) { /* ignore */ }
      try { if (gm.getPendingActors) pending = gm.getPendingActors(v); } catch (e) { /* ignore */ }
      res.snapshot = { phase: v.phase, currentPlayer: v.currentPlayer, actor, pending, seat: host.seat, myLastMoves: host.lastMoves.slice(-4), extra: Object.keys(v).filter((k) => /ask|stack|pend|deadline|round|turn|dice|state$/i.test(k)).slice(0, 8).reduce((o, k) => { o[k] = JSON.stringify(v[k]).slice(0, 160); return o; }, {}) };
    }
    // let the server flush stderr
    await sleep(150);
    res.errorsSeen = host.errors.length;
    const codes = new Map();
    const EXPECTED = /g2048_dead|sb_you_are_out|g_game_over|dg_wrong_try_again|sk_you_are_out|ms_you_are_out/;
    for (const c of clients) for (const e of c.errors) if (!EXPECTED.test(e.code || '')) codes.set(e.code || e.message, (codes.get(e.code || e.message) || 0) + 1);
    res.moveErrors = Array.from(codes, ([k, c]) => k + 'x' + c).slice(0, 8);
    res.lastError = host.errors.length ? { message: host.errors[host.errors.length - 1].message, move: host.errors[host.errors.length - 1].move } : null;
    res.notes = Array.from(issueNotes);
  } catch (e) {
    res.reason = 'harness-error';
    res.error = e.message;
  } finally {
    res.ms = Date.now() - t0;
    for (const c of clients) c.close();
    if (srv) { await stopServer(srv); res.stderr = stderrIssues(srv.stderr); res.stderrTail = srv.stderr.split(/\r?\n/).filter(Boolean).slice(-6); }
  }
  return res;
}

// ---------------------------------------------------------------- reporting
const fmt = (x) => (Number.isFinite(x) ? Math.round(x) : '-');
function summarise(game, runs) {
  const done = runs.filter((r) => r.ok);
  const avgSteps = done.length ? done.reduce((a, r) => a + r.steps, 0) / done.length : NaN;
  const avgMs = done.length ? done.reduce((a, r) => a + r.ms, 0) / done.length : NaN;
  const issues = [];
  for (const r of runs) {
    if (!r.ok) issues.push(r.reason + (r.error ? ' (' + r.error.slice(0, 120) + ')' : '') + ' seed=' + r.seed + ' n=' + r.players + (r.snapshot ? ' phase=' + r.snapshot.phase + ' cp=' + r.snapshot.currentPlayer + ' actor=' + r.snapshot.actor + ' pending=' + JSON.stringify(r.snapshot.pending) + ' lastMoves=' + JSON.stringify(r.snapshot.myLastMoves) : ''));
  }
  const agg = new Map();
  for (const r of runs) for (const s of (r.stderr || [])) agg.set(s.line, (agg.get(s.line) || 0) + s.n);
  const stderrLines = Array.from(agg, ([line, n]) => ({ line, n })).sort((a, b) => b.n - a.n).slice(0, 5);
  const merr = new Map();
  for (const r of runs) for (const e of (r.moveErrors || [])) { const [k, c] = [e.replace(/x\d+$/, ''), Number(e.match(/x(\d+)$/)[1])]; merr.set(k, (merr.get(k) || 0) + c); }
  const notes = Array.from(new Set(runs.flatMap((r) => r.notes || [])));
  return { game, total: runs.length, completed: done.length, avgSteps, avgMs, issues, stderrLines, moveErrors: Array.from(merr, ([k, c]) => k + 'x' + c).slice(0, 6), notes, runs };
}
function markdown(rows) {
  const L = [];
  L.push('# sim-full-games results');
  L.push('');
  L.push('Generated ' + new Date().toISOString() + '. Real server per run (`node server.js` child, random port), time warp x' + OPT.speed + ', ' + OPT.runs + ' runs/game, stuck=' + OPT.stuck + 's no-change (real), cap=' + OPT.maxTime + 's/run.');
  L.push('');
  L.push('| game | complete | avg steps | avg time | problems |');
  L.push('|---|---|---|---|---|');
  for (const s of rows) {
    const p = [];
    if (s.issues.length) p.push(s.issues.length + ' failed run(s)');
    if (s.stderrLines.length) p.push('stderr: ' + s.stderrLines.map((x) => x.line.replace(/\|/g, '/') + ' (x' + x.n + ')').join(' ; '));
    if (s.moveErrors.length) p.push('move errors seen by clients: ' + s.moveErrors.join(', '));
    if (s.notes.length) p.push(s.notes.join('; '));
    L.push('| ' + s.game + ' | ' + s.completed + '/' + s.total + ' | ' + fmt(s.avgSteps) + ' | ' + (Number.isFinite(s.avgMs) ? (s.avgMs / 1000).toFixed(1) + 's' : '-') + ' | ' + (p.join(' ; ') || 'none') + ' |');
  }
  const bad = rows.filter((s) => s.issues.length);
  if (bad.length) {
    L.push('');
    L.push('## Failed runs (repro: `node scripts/sim-full-games.js <game> --runs=1 --seed=<seed>`; run index decides seat count)');
    for (const s of bad) {
      L.push('');
      L.push('### ' + s.game);
      for (const r of s.runs.filter((x) => !x.ok)) {
        L.push('- run ' + r.run + ' seed=' + r.seed + ' players=' + r.players + ' reason=' + r.reason + (r.error ? ' error=' + r.error : '') + ' steps=' + r.steps + ' time=' + (r.ms / 1000).toFixed(1) + 's');
        if (r.snapshot) L.push('  - snapshot: ' + JSON.stringify(r.snapshot));
        if (r.lastError) L.push('  - last error from server: ' + JSON.stringify(r.lastError));
        if (r.moveErrors && r.moveErrors.length) L.push('  - move errors: ' + r.moveErrors.join(', '));
        if (r.stderrTail && r.stderrTail.length) L.push('  - server stderr tail: ' + JSON.stringify(r.stderrTail));
      }
    }
  }
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------- main
async function main() {
  loadMods();
  const all = Object.keys(gameMods).filter((g) => g !== 'drawguess-words').sort();
  const games = wanted.length ? wanted : all;
  for (const g of games) if (!gameMods[g]) { console.error('unknown game: ' + g + ' (known: ' + all.join(', ') + ')'); process.exit(2); }

  const jobs = [];
  games.forEach((g, gi) => { for (let i = 0; i < OPT.runs; i++) jobs.push({ game: g, i, seed: OPT.seed + gi * 100 + i }); });
  const results = new Map(games.map((g) => [g, []]));
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const j = jobs[next++];
      let r = await runOnce(j.game, j.i, j.seed);
      // a teammate may be mid-edit on a game file: retry start-up failures a couple of times
      for (let retry = 0; retry < 2 && r.reason === 'harness-error' && /server exited at startup|did not listen|SyntaxError/.test(r.error || ''); retry++) {
        await sleep(5000);
        r = await runOnce(j.game, j.i, j.seed);
      }
      results.get(j.game).push(r);
      console.log((r.ok ? 'ok   ' : 'FAIL ') + j.game.padEnd(18) + ' run' + j.i + ' n=' + r.players + ' steps=' + r.steps + ' ' + (r.ms / 1000).toFixed(1) + 's' + (r.ok ? '' : ' ' + r.reason + (r.error ? ': ' + r.error.slice(0, 150) : '') + ' seed=' + r.seed));
      if (OPT.verbose && r.stderr && r.stderr.length) for (const s of r.stderr.slice(0, 5)) console.log('     stderr x' + s.n + ': ' + s.line);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(OPT.jobs, jobs.length)) }, worker));

  const rows = games.map((g) => summarise(g, results.get(g).sort((a, b) => a.run - b.run)));
  console.log('\n' + 'game'.padEnd(18) + 'done   avgSteps  avgTime  problems');
  for (const s of rows) {
    console.log(s.game.padEnd(18) + (s.completed + '/' + s.total).padEnd(7) + String(fmt(s.avgSteps)).padEnd(10) + (Number.isFinite(s.avgMs) ? (s.avgMs / 1000).toFixed(1) + 's' : '-').padEnd(9) +
      (s.issues.length ? s.issues.length + ' failed' : '') + (s.stderrLines.length ? ' stderr:' + s.stderrLines.length + ' kinds' : '') + (s.moveErrors.length ? ' moveErr:' + s.moveErrors.join(',') : ''));
  }
  if (OPT.out) { fs.mkdirSync(path.dirname(path.resolve(OPT.out)), { recursive: true }); fs.writeFileSync(OPT.out, markdown(rows)); console.log('\nwritten ' + OPT.out); }
  process.exit(rows.every((s) => s.completed === s.total) ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
