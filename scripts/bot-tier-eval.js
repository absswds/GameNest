#!/usr/bin/env node
'use strict';
/*
 * Bot difficulty-tier evaluation (in-process, no server).
 *
 *   node scripts/bot-tier-eval.js [games...] [--n=40] [--seed=1] [--out=path.md] [--budget=180] [--verbose]
 *
 * For every game it plays tier pairs (hard vs easy, normal vs easy, hard vs normal) and reports how often
 * tier A (the stronger one) wins. Seats alternate between the two tiers (A B A B ...) and the assignment is
 * rotated every game so each tier sits in each seat equally often. Draws count half.
 * Team / asymmetric games (doudizhu, sanguo, werewolf) also get a "normal vs normal" control row: any gap from
 * 50% there is a seat/role bias of the harness, not a tier effect.
 *
 * The driver mirrors server.js: applyRuntimeState fields, getCurrentActor / getPendingActors, the
 * {pass:true} then {} fallback after a refused bot move, phase deadlines through onTimeout, and the realtime
 * tick loop. Date.now is a virtual clock and Math.random is seeded, so runs are reproducible.
 * Bots read their difficulty from state._options.difficulty, so each seat gets a shallow copy of the state
 * with its own difficulty. State mutation by bots is detected on sampled calls (JSON before/after).
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const a = argv.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : def;
};
const OPT = {
  n: Number(flag('n', 40)),
  seed: Number(flag('seed', 1)),
  out: flag('out', null),
  budget: Number(flag('budget', 180)), // wall-clock seconds per pair
  verbose: argv.includes('--verbose'),
};
const wanted = argv.filter((a) => !a.startsWith('--'));

// ---------------------------------------------------------------- seeded random + virtual clock
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const realNow = Date.now.bind(Date);
let CLOCK = 1e12;
Date.now = () => CLOCK;
const realConsoleError = console.error;
console.error = () => {}; // game modules log noisy errors on refused moves

// ---------------------------------------------------------------- game table
// n: seats. opts: room options. cap: step cap. N: games per pair (default --n). kind: driver.
// metric(s, seat): optional number reported as the per-tier mean in the note.
const G = {
  reversi: { n: 2, N: 12 },
  gomoku: { n: 2 },
  chess: { n: 2, N: 6, cap: 600, wall: 400000 },
  connect4: { n: 2 },
  checkers: { n: 2, cap: 600 },
  chinesechess: { n: 2, cap: 600 },
  go9: { n: 2, cap: 400 },
  tictactoe: { n: 2 },
  battleship: { n: 2, kind: 'battleship' },
  numberbomb: { n: 4 },
  twentyfour: { n: 2, kind: 'twentyfour', opts: { maxRounds: 5 } },
  hearts: { n: 4 },
  uno: { n: 4 },
  doudizhu: { n: 3, opts: { totalRounds: 1 }, control: true },
  bigtwo: { n: 4 },
  texas: { n: 4, kind: 'texas', hands: 30 },
  liarsbar: { n: 4 },
  'exploding-kittens': { n: 4 },
  oldmaid: { n: 4 },
  flightchess: { n: 4 },
  'mahjong-sichuan': { n: 4, opts: { mahjongMode: 'sichuan' }, cap: 5000 },
  'mahjong-cantonese': { n: 4, opts: { mahjongMode: 'cantonese' }, cap: 5000 },
  monopoly: { n: 4, cap: 8000 },
  werewolf: { n: 8, kind: 'phase', control: true },
  sanguo: { n: 5, kind: 'phase', control: true, cap: 20000 },
  rummikub: { n: 4, cap: 4000 },
  davinci: { n: 4 },
  '2048': { n: 2, kind: 'realtime', cap: 20000, metric: (s, i) => s.scores[i] },
  snakebattle: { n: 2, kind: 'realtime', cap: 4000, metric: (s, i) => s.snakes[i].score },
  sudoku: { n: 2, kind: 'realtime', cap: 3000, metric: (s, i) => s.counts[i] },
  sheeptile: { n: 2, kind: 'phase', cap: 20000, metric: (s, i) => s.players[i].score },
};
const SKIPPED = {};

// ---------------------------------------------------------------- outcome -> winning seats
function resolve(id, s, tiers, tierA) {
  if (id === 'oldmaid') return typeof s.loser === 'number' ? { loserSeat: s.loser } : { draw: true };
  if (id === 'texas') {
    let a = 0, b = 0;
    s.chips.forEach((c, i) => { if (tiers[i] === tierA) a += c; else b += c; });
    return a === b ? { draw: true } : { credit: a > b ? 1 : 0 };
  }
  if (id === 'sanguo') return s.winners && s.winners.length ? { seats: s.winners } : { draw: true };
  if (id === 'werewolf') {
    if (s.winner === -2) return { seats: s.roles.map((r, i) => (r === 'wolf' ? i : -1)).filter((i) => i >= 0) };
    if (s.winner === -3) return { seats: s.roles.map((r, i) => (r !== 'wolf' ? i : -1)).filter((i) => i >= 0) };
    return { draw: true };
  }
  if (id === 'doudizhu') {
    const all = [0, 1, 2];
    if (s.winner === -2) return { seats: [s.landlord] };
    if (s.winner === -3) return { seats: all.filter((i) => i !== s.landlord) };
    return { draw: true };
  }
  if (id === 'mahjong-sichuan' && Array.isArray(s.winners) && s.winners.length) return { seats: s.winners };
  if (typeof s.winner === 'number' && s.winner >= 0) return { seats: [s.winner] };
  return { draw: true };
}

// ---------------------------------------------------------------- one game

function makeCtx(id, cfg, tiers, rngSeed) {
  const g = require(path.join(ROOT, 'games', id + '.js'));
  const b = require(path.join(ROOT, 'bots', id + '.js'));
  Math.random = mulberry32(rngSeed);
  CLOCK = 1e12;
  const n = cfg.n;
  const s = g.createState();
  s._playerCount = n; s._realPlayerCount = 0; s._hasBots = true;
  s._options = Object.assign({}, cfg.opts || {}); s._lang = 'zh';
  if (id === 'mahjong-sichuan' || id === 'mahjong-cantonese') {
    s.cumulativeScore = new Array(n).fill(0);
    s.dealerIndex = Math.floor(Math.random() * n);
    s.roundNumber = 1;
  }
  if (g.initGame) g.initGame(s, n);
  const bots = []; for (let i = 0; i < n; i++) bots.push(b.createBot(i));
  return { wallEnd: realNow() + (cfg.wall || 120000), id, g, s, bots, tiers, n, cfg, errs: {}, calls: 0, rng: mulberry32(rngSeed ^ 0x9e3779b9) };
}

function bump(map, k) { map[k] = (map[k] || 0) + 1; }

// ask the bot of `seat` for a move, with that seat's own difficulty
function botMove(ctx, seat) {
  const { s, bots, tiers } = ctx;
  const view = Object.assign({}, s, { _options: Object.assign({}, s._options, { difficulty: tiers[seat].split('#')[0] }) });
  ctx.calls++;
  const check = ctx.calls <= 12 || ctx.calls % 40 === 0;
  let before = null;
  if (check) { try { before = JSON.stringify(view); } catch (e) { before = null; } }
  const mv = bots[seat].getMove(view, seat);
  if (before !== null) {
    let after = null;
    try { after = JSON.stringify(view); } catch (e) { /* ignore */ }
    if (after !== null && after !== before) bump(ctx.mut || (ctx.mut = {}), ctx.id);
  }
  return mv;
}

// mirror of scheduleBotMove / schedulePhaseGame: move, then {pass:true}, then {}
function tryMove(ctx, seat) {
  const { g, s } = ctx;
  let err;
  try {
    err = g.handleMove(botMove(ctx, seat), s, seat);
  } catch (e) {
    err = 'bot_exception';
    bump(ctx.threw || (ctx.threw = {}), String(e && e.message).slice(0, 80));
  }
  if (err) {
    bump(ctx.errs, err);
    try { err = g.handleMove({ pass: true }, s, seat); } catch (e) { err = 'pass_exception'; }
    if (err) { try { err = g.handleMove({}, s, seat); } catch (e) { err = 'empty_exception'; } }
  }
  return err || null;
}

function nextTexasHand(ctx) {
  const { g, s } = ctx;
  const next = g.createState();
  if (!g.carryOver(s, next, ctx.n)) return false;
  next._playerCount = ctx.n; next._realPlayerCount = 0; next._hasBots = true;
  next._options = s._options; next._lang = 'zh';
  g.initGame(next, ctx.n);
  ctx.s = next; ctx.hand = (ctx.hand || 1) + 1;
  return true;
}

function over(ctx) {
  const s = ctx.s;
  if (ctx.id === 'texas') {
    if (s.winner === null || s.winner === undefined) return false;
    if (s.sessionOver || (ctx.hand || 1) >= (ctx.cfg.hands || 30)) return true;
    return !nextTexasHand(ctx);
  }
  if (ctx.id === 'mahjong-sichuan' || ctx.id === 'mahjong-cantonese') return s.phase === 'over';
  return s.winner !== null && s.winner !== undefined;
}

// phase deadline handling (server: schedulePhaseTimer)
function fireDeadline(ctx, force) {
  const { g, s } = ctx;
  if (typeof g.getPhaseDeadline !== 'function' || typeof g.onTimeout !== 'function') return false;
  const d = g.getPhaseDeadline(s) || 0;
  if (d > 0 && (force || CLOCK >= d)) {
    if (CLOCK < d) CLOCK = d;
    g.onTimeout(s);
    return true;
  }
  return false;
}

function runTurnGame(ctx, cap) {
  const { g, id } = ctx;
  let fails = 0, steps = 0;
  const placing = id === 'battleship';
  while (!over(ctx)) {
    if (steps++ > cap || realNow() > ctx.wallEnd) return 'cap';
    CLOCK += 1500;
    if (fireDeadline(ctx, false)) continue;
    if (placing && ctx.s.phase === 'placing') {
      let moved = false;
      for (let i = 0; i < ctx.n; i++) {
        if (ctx.s.placedCount[i] < ctx.s.shipSizes.length) { tryMove(ctx, i); moved = true; }
      }
      if (!moved) return 'stuck';
      continue;
    }
    const actor = typeof g.getCurrentActor === 'function' ? g.getCurrentActor(ctx.s) : ctx.s.currentPlayer;
    if (!Number.isInteger(actor) || actor < 0 || actor >= ctx.n) {
      if (fireDeadline(ctx, true)) continue;
      return 'stuck';
    }
    const err = tryMove(ctx, actor);
    if (err) {
      CLOCK += 15000;
      if (!fireDeadline(ctx, false) && ++fails > 25) return 'stuck';
    } else fails = 0;
  }
  return 'ok';
}

function runPhaseGame(ctx, cap) {
  const { g, s } = ctx;
  let steps = 0, fails = 0;
  while (!over(ctx)) {
    if (steps++ > cap || realNow() > ctx.wallEnd) return 'cap';
    CLOCK += 700;
    if (fireDeadline(ctx, false)) continue;
    const pending = (g.getPendingActors(s) || []).slice();
    if (!pending.length) {
      if (!fireDeadline(ctx, true)) { if (typeof g.onTimeout === 'function') g.onTimeout(s); else return 'stuck'; }
      continue;
    }
    const p = pending[Math.floor(ctx.rng() * pending.length)];
    const err = tryMove(ctx, p);
    if (err) {
      // server: that bot sits it out until the deadline passes it by
      if (!fireDeadline(ctx, true)) { if (typeof g.onTimeout === 'function') g.onTimeout(s); else if (++fails > 25) return 'stuck'; }
    } else fails = 0;
  }
  return 'ok';
}

// realtime server ignores these (a bot that is already dead / a finished game): not a bot fault
const BENIGN = new Set(['g2048_dead', 'g_game_over', 'sb_you_are_out', 'su_eliminated']);

function runRealtime(ctx, cap) {
  const { g, s } = ctx;
  const tickMs = g.tickMs || 120;
  for (let t = 0; t < cap; t++) {
    if (over(ctx)) return 'ok';
    CLOCK += tickMs;
    for (let i = 0; i < ctx.n; i++) {
      try {
        const err = g.handleMove(botMove(ctx, i), s, i);
        if (err && !BENIGN.has(err)) bump(ctx.errs, err);
      } catch (e) {
        bump(ctx.errs, 'bot_exception');
        bump(ctx.threw || (ctx.threw = {}), String(e && e.message).slice(0, 80));
      }
    }
    g.tick(s);
  }
  return over(ctx) ? 'ok' : 'cap';
}

// 24 points: bots race on virtual timers (first attempt 30-40s, up to 3 retries 10-15s apart), first correct wins the round
function runTwentyFour(ctx) {
  const { g, s } = ctx;
  const maxRounds = s.maxRounds;
  for (let round = 1; round <= maxRounds; round++) {
    s.currentRound = round;
    if (round > 1) { s.phase = 'playing'; s.roundWinner = null; s.solutions = []; s.playerSubmissions = {}; g.initGame(s, ctx.n); }
    const events = [];
    for (let i = 0; i < ctx.n; i++) {
      let t = 30 + ctx.rng() * 10;
      events.push([t, i]);
      for (let r = 0; r < 3; r++) { t += 10 + ctx.rng() * 5; events.push([t, i]); }
    }
    events.sort((a, b) => a[0] - b[0]);
    for (const [, i] of events) {
      if (s.phase !== 'playing') break;
      let mv = {};
      try { mv = botMove(ctx, i); } catch (e) { bump(ctx.threw || (ctx.threw = {}), String(e && e.message).slice(0, 80)); continue; }
      if (!mv || !mv.expression) continue;
      const err = g.handleMove(mv, s, i);
      if (err) bump(ctx.errs, err);
    }
    if (s.phase === 'playing') { s.roundWinner = -1; s.phase = 'round_end'; } // nobody solved it
  }
  let best = -1, tie = false, w = -1;
  s.roundsWon.forEach((v, i) => { if (v > best) { best = v; w = i; tie = false; } else if (v === best) tie = true; });
  s.winner = tie ? -1 : w;
  return 'ok';
}

// ---------------------------------------------------------------- evaluation
function playGame(id, cfg, tiers, seed) {
  const ctx = makeCtx(id, cfg, tiers, seed);
  const cap = cfg.cap || 6000;
  let status;
  try {
    if (cfg.kind === 'twentyfour') status = runTwentyFour(ctx);
    else if (cfg.kind === 'phase') status = runPhaseGame(ctx, cap);
    else if (cfg.kind === 'realtime') status = runRealtime(ctx, cap);
    else status = runTurnGame(ctx, cap);
  } catch (e) {
    status = 'crash';
    bump(ctx.threw || (ctx.threw = {}), 'DRIVER/GAME: ' + String(e && e.stack).split('\n').slice(0, 2).join(' | ').slice(0, 160));
  }
  return { ctx, status };
}

function evalPair(id, cfg, tierA, tierB, label) {
  const N = cfg.N || OPT.n;
  const res = { id, label, games: 0, creditA: 0, draws: 0, stuck: 0, errs: {}, threw: {}, mut: 0, mA: 0, mB: 0, mCount: 0, ms: 0 };
  const t0 = realNow();
  for (let k = 0; k < N; k++) {
    if ((realNow() - t0) / 1000 > OPT.budget) break;
    const tiers = [];
    for (let i = 0; i < cfg.n; i++) tiers.push((i + k) % 2 === 0 ? tierA : tierB);
    const seed = (OPT.seed * 1000003 + hashStr(id + label) + k * 7919) >>> 0;
    const { ctx, status } = playGame(id, cfg, tiers, seed);
    for (const [e, c] of Object.entries(ctx.errs)) res.errs[e] = (res.errs[e] || 0) + c;
    for (const [e, c] of Object.entries(ctx.threw || {})) res.threw[e] = (res.threw[e] || 0) + c;
    if (ctx.mut) res.mut += ctx.mut[id] || 0;
    if (status !== 'ok') { res.stuck++; if (OPT.verbose) realConsoleError(id, label, 'game', k, status); continue; }
    res.games++;
    const r = resolve(id, ctx.s, tiers, tierA);
    if (r.draw || (r.seats && !r.seats.length)) res.draws++;
    else if (r.credit !== undefined) res.creditA += r.credit;
    else if (r.loserSeat !== undefined) res.creditA += tiers[r.loserSeat] === tierA ? 0 : 1;
    else {
      const a = r.seats.filter((i) => tiers[i] === tierA).length;
      res.creditA += a / r.seats.length;
    }
    if (cfg.metric) {
      for (let i = 0; i < cfg.n; i++) {
        const m = cfg.metric(ctx.s, i);
        if (tiers[i] === tierA) { res.mA += m; res.mCount++; } else res.mB += m;
      }
    }
  }
  res.ms = realNow() - t0;
  return res;
}

function fmtRow(r, cfg) {
  const pct = r.games ? ((r.creditA + r.draws * 0.5) / r.games) * 100 : NaN;
  const errTxt = Object.entries(r.errs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + 'x' + v).join(', ');
  const errTotal = Object.values(r.errs).reduce((a, b) => a + b, 0);
  const notes = [];
  if (cfg.metric && r.mCount) notes.push('mean metric A=' + (r.mA / r.mCount).toFixed(1) + ' B=' + (r.mB / r.mCount).toFixed(1));
  if (r.mut) notes.push('MUTATED STATE x' + r.mut);
  if (Object.keys(r.threw).length) notes.push('THREW: ' + Object.entries(r.threw).map(([k, v]) => k + ' x' + v).join('; '));
  if (r.games < (cfg.N || OPT.n) && r.games + r.stuck < (cfg.N || OPT.n)) notes.push('time budget hit');
  notes.push((r.ms / 1000).toFixed(0) + 's');
  return '| ' + r.id + ' | ' + r.label + ' | ' + r.games + ' | ' + (isNaN(pct) ? 'n/a' : pct.toFixed(1) + '%') + ' | ' + r.draws +
    ' | ' + r.stuck + ' | ' + errTotal + (errTxt ? ' (' + errTxt + ')' : '') + ' | ' + notes.join('; ') + ' |';
}

const PAIRS = [['hard', 'easy'], ['normal', 'easy'], ['hard', 'normal']];

function main() {
  const ids = wanted.length ? wanted : Object.keys(G);
  const rows = [];
  const header = '| game | pair (A vs B) | games | tier A win% | draws | stuck | bot errors | note |\n|---|---|---|---|---|---|---|---|';
  console.log(header);
  for (const id of ids) {
    const cfg = G[id];
    if (!cfg) { console.log('| ' + id + ' | - | - | - | - | - | - | unknown game (skipped) |'); continue; }
    const list = PAIRS.map(([a, b]) => [a, b, a + ' vs ' + b]);
    if (cfg.control) list.push(['normal#A', 'normal#B', 'control normal vs normal (seat-parity A vs B)']);
    for (const [a, b, label] of list) {
      const r = evalPair(id, cfg, a, b, label);
      const row = fmtRow(r, cfg);
      rows.push(row);
      console.log(row);
    }
  }
  const md = header + '\n' + rows.join('\n') + '\n';
  if (OPT.out) {
    // append when the file already holds rows from an earlier invocation with the same header
    let prev = '';
    try { prev = fs.readFileSync(OPT.out, 'utf8'); } catch (e) { /* new file */ }
    fs.writeFileSync(OPT.out, prev ? prev.replace(/\n*$/, '\n') + rows.join('\n') + '\n' : md);
  }
}
main();
