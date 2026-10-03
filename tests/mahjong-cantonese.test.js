// tests/mahjong-cantonese.test.js — Cantonese Mahjong (鸡平胡)
// Run: node tests/mahjong-cantonese.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const game = require('../games/mahjong-cantonese');
const core = require('../games/lib/mahjong-core');

// ---- Helpers ----

let _tid = 0;
function T(k, n, id) {
  if (!id) id = k + n + '#' + (_tid++);
  return { k, n, id: id };
}

// Build a hand from compact notation.
// 1-9m = wan, 1-9s = tiao, 1-9p = tong
// E/S/W/N = winds 东南西北 (feng 1-4), C/F/B = dragons 中发白 (jian 1-3)
function hand(str) {
  const tiles = [];
  let nums = '';
  for (const ch of str) {
    if (ch >= '0' && ch <= '9') { nums += ch; continue; }
    let k;
    if (ch === 'm') k = 'wan';
    else if (ch === 's') k = 'tiao';
    else if (ch === 'p') k = 'tong';
    else if (ch === 'E') { tiles.push(T('feng', 1)); continue; }
    else if (ch === 'S') { tiles.push(T('feng', 2)); continue; }
    else if (ch === 'W') { tiles.push(T('feng', 3)); continue; }
    else if (ch === 'N') { tiles.push(T('feng', 4)); continue; }
    else if (ch === 'C') { tiles.push(T('jian', 1)); continue; }
    else if (ch === 'F') { tiles.push(T('jian', 2)); continue; }
    else if (ch === 'B') { tiles.push(T('jian', 3)); continue; }
    else continue;
    for (const n of nums) tiles.push(T(k, parseInt(n)));
    nums = '';
  }
  return tiles;
}

// Find first tile in hand matching (k, n).
function find(hand, k, n) {
  return hand.find(t => t.k === k && t.n === n);
}

// Init a game then override hands deterministically. Wall stays non-empty.
function freshState(playerCount, hands) {
  const s = game.createState();
  game.initGame(s, playerCount);
  if (hands) {
    for (let i = 0; i < playerCount; i++) s.hands[i] = hands[i];
    for (const h of s.hands) core.sortTiles(h);
  }
  return s;
}

// ---- initGame ----

test('initGame: 136 tiles total (wall + hands + melds + discards)', () => {
  const s = game.createState();
  game.initGame(s, 4);
  let total = s.wall.length;
  for (const h of s.hands) total += h.length;
  for (const m of s.melds) total += m.reduce((a, md) => a + md.tiles.length, 0);
  for (const d of s.discards) total += d.length;
  assert.equal(total, 136);
});

test('initGame: dealer (P0) draws first → 14 tiles, others 13', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(s.hands[0].length, 14);
  assert.equal(s.hands[1].length, 13);
  assert.equal(s.hands[2].length, 13);
  assert.equal(s.hands[3].length, 13);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.hasDrawn, true);
  assert.equal(s.phase, 'play');
});

test('initGame: honours present in deck (136 = 108 + 28)', () => {
  const s = game.createState();
  game.initGame(s, 4);
  const all = [];
  for (const h of s.hands) all.push(...h);
  all.push(...s.wall);
  const honours = all.filter(t => t.k === 'feng' || t.k === 'jian');
  assert.equal(honours.length, 28);
});

test('initGame: 2-player game deals correctly', () => {
  const s = game.createState();
  game.initGame(s, 2);
  let total = s.wall.length;
  for (const h of s.hands) total += h.length;
  assert.equal(total, 136);
  assert.equal(s.hands[0].length, 14);
  assert.equal(s.hands[1].length, 13);
});

// ---- dealer rotation (server writes state.dealerIndex before initGame) ----

test('initGame: dealerIndex rotates the dealer (dealer draws first)', () => {
  const s = game.createState();
  s.dealerIndex = 2; // server sets the next dealer before initGame
  game.initGame(s, 4);
  assert.equal(s.dealer, 2);
  assert.equal(s.currentPlayer, 2, 'dealer starts the round');
  assert.equal(s.hands[2].length, 14, 'dealer drew the extra tile');
  assert.equal(s.hands[0].length, 13);
  assert.equal(s.hasDrawn, true);
  assert.equal(s.phase, 'play');
});

// ---- discard → draw flow ----

test('discard: current player discards, no claims → next player draws', () => {
  // P0 discards an isolated honour; others hold only number tiles → no claim.
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 2m'), // P0 (dealer) 14
    hand('2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 6p'), // P1
    hand('2s 3s 4s 5s 6s 7s 8s 9s 4p 5p 6p 7p 8p'), // P2
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'), // P3
  ]);
  s._playerCount = 4;
  const tile = find(s.hands[0], 'feng', 1); // E (feng)
  const err = game.handleMove({ type: 'discard', tileId: tile.id }, s, 0);
  assert.equal(err, null);
  assert.equal(s.discards[0].length, 1);
  assert.equal(s.discards[0][0].k, 'feng');
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.hasDrawn, true);
  assert.equal(s.hands[1].length, 14);
  assert.equal(s.phase, 'play');
});

test('discard: cannot discard a tile not in hand', () => {
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 2m'),
    hand('2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 6p'),
    hand('2s 3s 4s 5s 6s 7s 8s 9s 4p 5p 6p 7p 8p'),
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'),
  ]);
  s._playerCount = 4;
  const err = game.handleMove({ type: 'discard', tileId: 'nonexistent' }, s, 0);
  assert.ok(err);
});

// ---- chow (吃) — upstream only ----

test('chow: upstream player (P1) can chow a discard', () => {
  // P0 discards 5m; P1 (upstream) has 3m,4m → can chow 345m.
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5m'), // P0, will discard 5m
    hand('3m 4m 2s 3s 4s 5s 6s 7s 8s 9s 1p 2p 3p'), // P1 has 3m4m
    hand('2m 6m 7m 8m 9m 2p 3p 4p 5p 6p 7p 8p 9p'),  // P2
    hand('1m 2m 3m 4m 6m 7m 8m 9m 1s 2s 3s 4s 5s'),  // P3
  ]);
  s._playerCount = 4;
  const discardTile = s.hands[0].find(t => t.k === 'wan' && t.n === 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  // P1 is the only eligible claimer (upstream, has 3m4m).
  assert.equal(s.phase, 'claim');
  assert.deepEqual(s.claim.order, [1]);
  const err = game.handleMove({ type: 'chow', tiles: [
    s.hands[1].find(t => t.k === 'wan' && t.n === 3).id,
    s.hands[1].find(t => t.k === 'wan' && t.n === 4).id,
  ]}, s, 1);
  assert.equal(err, null);
  // meld formed, P1 to discard
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.melds[1].length, 1);
  assert.equal(s.melds[1][0].type, 'chow');
  assert.equal(s.melds[1][0].tiles.length, 3);
  assert.equal(s.hasDrawn, true);
});

test('chow: non-upstream player (P2) cannot chow', () => {
  // P0 discards 5m; P1 (upstream) has 3m,4m → eligible. P2 also has 3m,4m but is
  // NOT upstream → must NOT appear in claim order.
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5m'),
    hand('3m 4m 2s 3s 4s 5s 6s 7s 8s 9s 1p 2p 3p'), // P1 upstream, has 3m4m
    hand('3m 4m 2m 6m 7m 8m 9m 2p 5p 6p 7p 8p 9p'),  // P2 has 3m4m, not upstream
    hand('1m 2m 6m 7m 8m 9m 1s 2s 3s 4s 5s 6s 7s'),  // P3
  ]);
  s._playerCount = 4;
  const discardTile = s.hands[0].find(t => t.k === 'wan' && t.n === 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  assert.equal(s.phase, 'claim');
  assert.ok(s.claim.order.includes(1), 'upstream P1 should be eligible');
  assert.ok(!s.claim.order.includes(2), 'non-upstream P2 should NOT be eligible');
  // P1 passes → all passed → next player after discarder (P1) draws.
  const err = game.handleMove({ type: 'pass' }, s, 1);
  assert.equal(err, null);
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.hands[1].length, 14);
});

// ---- pung (碰) ----

test('pung: any player with a pair can pung', () => {
  // P0 discards 5m; P2 has two 5m → pung.
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5m'),
    hand('2s 3s 4s 5s 6s 7s 8s 9s 1p 2p 3p 4p 5p'),
    hand('5m 5m 2m 3m 4m 6m 7m 8m 9m 1s 2s 3s 4s'), // P2 pair of 5m
    hand('1m 2m 3m 4m 6m 7m 8m 9m 1s 2s 5s 6s 7s'),
  ]);
  s._playerCount = 4;
  const discardTile = s.hands[0].find(t => t.k === 'wan' && t.n === 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  assert.equal(s.phase, 'claim');
  assert.ok(s.claim.order.includes(2));
  // P1 passes, then P2 pungs.
  game.handleMove({ type: 'pass' }, s, 1);
  assert.equal(s.phase, 'claim');
  const err = game.handleMove({ type: 'pung' }, s, 2);
  assert.equal(err, null);
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 2);
  assert.equal(s.melds[2].length, 1);
  assert.equal(s.melds[2][0].type, 'pung');
  assert.equal(s.melds[2][0].tiles.length, 3);
});

// ---- kong (杠) ----

test('kong: player with 3 matching tiles can kong, draws replacement', () => {
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5m'),
    hand('2s 3s 4s 5s 6s 7s 8s 9s 1p 2p 3p 4p 5p'),
    hand('5m 5m 5m 2m 3m 4m 6m 7m 8m 9m 1s 2s 3s'), // P2 triple 5m
    hand('1m 2m 3m 4m 6m 7m 8m 9m 1s 2s 4s 5s 6s'),
  ]);
  s._playerCount = 4;
  const wallBefore = s.wall.length;
  const discardTile = s.hands[0].find(t => t.k === 'wan' && t.n === 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  game.handleMove({ type: 'pass' }, s, 1);
  const err = game.handleMove({ type: 'kong' }, s, 2);
  assert.equal(err, null);
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 2);
  assert.equal(s.melds[2][0].type, 'kong');
  assert.equal(s.melds[2][0].tiles.length, 4);
  // drew replacement from wall
  assert.equal(s.wall.length, wallBefore - 1);
  assert.equal(s.hands[2].length, 11); // 13 - 3 + 1 replacement
});

// ---- win detection ----

test('win: claim a discard to win (hu)', () => {
  // P2 has 13 tiles that + 5m = winning hand: 123m 456m 789m 222m 11s + 5m? need valid.
  // Winning 14: 123m 456m 789m 222m 11s. P2 holds 123m 456m 789m 222m 1s (13), waits on 1s.
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 1s'), // P0 discards 1s
    hand('2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 6p'),
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 2s 2s 2s 1s'), // P2: 123m456m789m 222s 1s (13)
    hand('2s 3s 4s 5s 6s 7s 8s 9s 4p 5p 6p 7p 8p'),
  ]);
  s._playerCount = 4;
  const discardTile = s.hands[0].find(t => t.k === 'tiao' && t.n === 1);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  assert.equal(s.phase, 'claim');
  // P1 passes, P2 wins.
  game.handleMove({ type: 'pass' }, s, 1);
  const err = game.handleMove({ type: 'win' }, s, 2);
  assert.equal(err, null);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 2);
  assert.ok(s.winInfo);
});

test('win: self-draw (自摸) on drawn tile', () => {
  // P0 (dealer, already drew) holds a winning 14-tile hand.
  const s = freshState(4, [
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 2s 2s 2s 1s 1s'), // 123m456m789m 222s 11s = win
    hand('E S W N C F B 9m 9p 9s 2p 3p 4p 5p'),
    hand('2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 4p 5p'),
    hand('1m 2m 3m 4m 5m 6m 7m 8m 3s 4s 5s 6s 7s'),
  ]);
  s._playerCount = 4;
  assert.equal(s.hasDrawn, true);
  const err = game.handleMove({ type: 'win' }, s, 0);
  assert.equal(err, null);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 0);
});

test('win: cannot declare win on a non-winning hand', () => {
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 2m'),
    hand('2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 6p'),
    hand('2s 3s 4s 5s 6s 7s 8s 9s 4p 5p 6p 7p 8p'),
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'),
  ]);
  s._playerCount = 4;
  const err = game.handleMove({ type: 'win' }, s, 0);
  assert.ok(err);
  assert.equal(s.phase, 'play');
  assert.equal(s.winner, null);
});

// ---- claim priority ----

test('claim priority: win beats pung', () => {
  // P0 discards 5m. P1 can pung (two 5m). P2 can win with 5m.
  // P2's winning hand: 123m 456m 789m 222s + 5m pair → hold 123m456m789m 222s 5m (13), win on 5m.
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5m'),
    hand('5m 5m 2m 3m 4m 6m 7m 8m 9m 1s 2s 3s 4s'), // P1 pair 5m
    hand('1m 2m 3m 4m 6m 7m 8m 9m 2s 2s 2s 5m 8p'), // P2: 123m46789m 222s 5m 8p (13)
    hand('1m 2m 3m 4m 6m 7m 8m 9m 1s 2s 3s 4s 5s'),
  ]);
  // Make P2's hand a real win on 5m: 123m 456m 789m 222s 55m → needs 4,6 of m and pair 5m.
  s.hands[2] = hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 2s 2s 2s 5m'); // 123m456m789m 222s 5m (13), win on 5m → 222s pair? no.
  // Winning 14 with 5m: 123m 456m 789m 222s 55m. Hold 13 = 123m456m789m 222s 5m, +5m = pair. Yes.
  core.sortTiles(s.hands[2]);
  s._playerCount = 4;
  const discardTile = s.hands[0].find(t => t.k === 'wan' && t.n === 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  // order: P1 (pung), P2 (win). Both respond; win should take priority.
  assert.ok(s.claim.order.includes(1));
  assert.ok(s.claim.order.includes(2));
  game.handleMove({ type: 'pung' }, s, 1);
  game.handleMove({ type: 'win' }, s, 2);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 2, 'win should beat pung');
});

// ---- playerView ----

test('playerView: hides other players hands (shows length only)', () => {
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 2m'),
    hand('2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 6p'),
    hand('2s 3s 4s 5s 6s 7s 8s 9s 4p 5p 6p 7p 8p'),
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'),
  ]);
  s._playerCount = 4;
  const view = game.playerView(s, 0);
  // own hand: full tiles (real tile objects with id)
  assert.ok(Array.isArray(view.hands[0]));
  assert.equal(view.hands[0].length, 14);
  assert.ok(view.hands[0][0].id, 'own tiles expose id (not hidden)');
  assert.ok(view.hands[0].some(t => t.k === 'feng'), 'own hand contains the feng tile');
  // others: hidden (number)
  assert.equal(typeof view.hands[1], 'number');
  assert.equal(view.hands[1], 13);
  assert.equal(view.hands[2], 13);
  assert.equal(view.hands[3], 13);
  // wall hidden (count only)
  assert.equal(typeof view.wall, 'number');
  // discards/melds visible
  assert.ok(Array.isArray(view.discards));
  assert.ok(Array.isArray(view.melds));
});

test('playerView: claim info exposed for renderer', () => {
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5m'),
    hand('3m 4m 2s 3s 4s 5s 6s 7s 8s 9s 1p 2p 3p'),
    hand('2m 6m 7m 8m 9m 2p 3p 4p 5p 6p 7p 8p 9p'),
    hand('1m 2m 3m 4m 6m 7m 8m 9m 1s 2s 3s 4s 5s'),
  ]);
  s._playerCount = 4;
  const discardTile = s.hands[0].find(t => t.k === 'wan' && t.n === 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  const view = game.playerView(s, 1);
  assert.ok(view.claim);
  assert.equal(view.claim.discarder, 0);
  assert.ok(view.claim.order.includes(1));
});

// ---- wall exhaustion (荒庄) ----

// ---- minimum-fan (起胡番数) ----

// P0 discards 5p (tong). P2 holds 123m 456m 789m 123s 5p (13), so +5p = 55p pair.
// The win is a bare 平胡 (all sequences + pair) = 1 fan, below minFan 2.
function belowMinFanState(minFan) {
  const s = game.createState();
  s._options = { mj_minFan: minFan };
  game.initGame(s, 4);
  s._playerCount = 4;
  s.hands[0] = hand('E S W N C F B 1m 9m 1s 9s 1p 9p 5p'); // P0 discards a 5p
  s.hands[1] = hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'); // no tong → no claim
  s.hands[2] = hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 5p'); // waits on 5p (55p pair)
  s.hands[3] = hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'); // no tong → no claim
  for (const h of s.hands) core.sortTiles(h);
  s.phase = 'play';
  s.currentPlayer = 0;
  s.hasDrawn = true;
  s.winner = null;
  s.lastDiscard = null;
  s.claim = null;
  const discardTile = find(s.hands[0], 'tong', 5);
  game.handleMove({ type: 'discard', tileId: discardTile.id }, s, 0);
  assert.equal(s.phase, 'claim');
  assert.deepEqual(s.claim.order, [2], 'only P2 can win');
  return s;
}

test('claim: below-min-fan win is demoted to pass and the round continues (no crash)', () => {
  const s = belowMinFanState(2);
  const res = game.handleMove({ type: 'win' }, s, 2);
  assert.equal(res, null);
  // must NOT be left in a corrupt claim/claim=null/winner-unset state
  assert.equal(s.winner, null, 'below-min win registers no winner');
  assert.equal(s.claim, null, 'claim resolved, not left dangling');
  assert.equal(s.phase, 'play', 'round continues to the next player');
  assert.equal(s.currentPlayer, 1, 'next player after the discarder draws');
});

test('claim: win at the minimum fan is allowed (平胡 = 1 fan, minFan 1)', () => {
  const s = belowMinFanState(1);
  const res = game.handleMove({ type: 'win' }, s, 2);
  assert.equal(res, null);
  assert.equal(s.winner, 2, '平胡 allowed when fan == minFan');
  assert.equal(s.phase, 'over');
});

test('wall exhaustion: game ends with no winner when wall empty', () => {
  const s = freshState(4, [
    hand('E S W N C F B 1m 9m 1s 9s 1p 9p 2m'),
    hand('2m 3m 4m 5m 6m 7m 8m 9m 2p 3p 4p 5p 6p'),
    hand('2s 3s 4s 5s 6s 7s 8s 9s 4p 5p 6p 7p 8p'),
    hand('1m 2m 3m 4m 5m 6m 7m 8m 9m 1s 2s 3s 4s'),
  ]);
  s._playerCount = 4;
  s.wall = []; // force empty wall
  const tile = find(s.hands[0], 'feng', 1); // isolated honour, nobody can claim
  game.handleMove({ type: 'discard', tileId: tile.id }, s, 0);
  // no claims (isolated honour), next player tries to draw → wall empty → draw game
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, -1);
});

// ---- multi-round state preservation (switchToCantonese must keep cumulativeScore/roundNumber) ----

test('switchToCantonese: preserves cumulativeScore/dealerIndex/roundNumber across initGame', () => {
  // 模拟 server 的 game_restart 流程：先写入累计字段，再调 initGame。
  // 如果 switchToCantonese 把这些字段清空，下一局积分和局数就会丢失。
  const sichuan = require('../games/mahjong-sichuan');
  const s = sichuan.createState();
  s._options = { mahjongMode: 'cantonese', mj_buyTiles: true };
  s._playerCount = 4;
  s._realPlayerCount = 1;
  s._hasBots = true;

  // server 在 initGame 之前写入累计字段（模拟 endOfRound + game_restart 快照恢复）
  s.cumulativeScore = [2, -1, -1, -1];
  s.dealerIndex = 2;
  s.roundNumber = 3;

  sichuan.initGame(s, 4);

  // initGame → switchToCantonese 之后，这些字段必须保留
  assert.deepEqual(s.cumulativeScore, [2, -1, -1, -1], 'cumulativeScore 不应被 initGame 清空');
  assert.equal(s.dealerIndex, 2, 'dealerIndex 不应被 initGame 清空');
  assert.equal(s.roundNumber, 3, 'roundNumber 不应被 initGame 清空');
  assert.equal(s._variants, 'cantonese');
});

test('对对和: needs pungs in the concealed hand too, not just the exposed melds', () => {
  const pung = (k, n) => ({ type: 'pung', tiles: [T(k, n), T(k, n), T(k, n)] });
  const melds = [pung('wan', 1), pung('tong', 5), pung('tiao', 9)];
  const win = { type: 'standard' };
  const names = (h, m) => core.countFanDetailed(h, m, win, core.CANTONESE, {}).details.map((d) => d.name);
  // concealed chow + pair → not 对对和
  assert.ok(!names([T('wan', 4), T('wan', 5), T('wan', 6), T('feng', 1), T('feng', 1)], melds).includes('对对和'));
  // concealed pung + pair → 对对和
  assert.ok(names([T('wan', 7), T('wan', 7), T('wan', 7), T('feng', 1), T('feng', 1)], melds).includes('对对和'));
  // fully concealed all-pung hand → 对对和
  const concealed = [];
  for (const [k, n] of [['wan', 1], ['wan', 3], ['tong', 5], ['tiao', 9]]) concealed.push(T(k, n), T(k, n), T(k, n));
  concealed.push(T('feng', 2), T('feng', 2));
  assert.ok(names(concealed, []).includes('对对和'));
});
