// tests/mahjong-router.test.js — Unified Mahjong router (games/mahjong-sichuan.js)
// The router keeps exports.name='mahjong-sichuan' but routes to Sichuan or
// Cantonese depending on state._options.mahjongMode.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../games/lib/mahjong-core');
const game = require('../games/mahjong-sichuan'); // router module

// ---- createState: default Sichuan structure ----

test('createState: default Sichuan structure', () => {
  const s = game.createState();
  assert.equal(s.cfg, core.SICHUAN);
  assert.equal(s._variants, 'sichuan');
  assert.ok(Array.isArray(s.voidSuit), 'sichuan state has voidSuit array');
  assert.equal(s.phase, 'deal');
});

// ---- initGame: default (Sichuan) mode ----

test('initGame: default mode is Sichuan', () => {
  const s = game.createState();
  game.initGame(s, 2);
  assert.equal(s._variants, 'sichuan');
  assert.equal(s.phase, 'void');
  assert.ok(s.voidSuit.every(v => v === undefined), 'void choices start unset');
});

test('initGame: sichuan mode when mahjongMode explicitly sichuan', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'sichuan' };
  game.initGame(s, 2);
  assert.equal(s._variants, 'sichuan');
  assert.equal(s.phase, 'void');
});

// ---- initGame: cantonese switch ----

test('initGame: cantonese mode rebuilds state into Cantonese structure', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese' };
  game.initGame(s, 2);
  assert.equal(s._variants, 'cantonese');
  assert.ok(Array.isArray(s.wall), 'cantonese state has wall array');
  assert.equal(s.phase, 'play');
  assert.equal(s.hasDrawn, true);
  assert.equal(s.hands[0].length, 14); // dealer (0) draws first
  assert.equal(s.hands[1].length, 13);
});

test('initGame: preserves _options when switching to cantonese', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese', someFlag: true };
  game.initGame(s, 2);
  assert.equal(s._variants, 'cantonese');
  assert.deepEqual(s._options, { mahjongMode: 'cantonese', someFlag: true });
});

test('initGame: preserves runtime meta fields when switching to cantonese', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese' };
  s._realPlayerCount = 1;
  s._hasBots = true;
  s._lang = 'en';
  game.initGame(s, 2);
  assert.equal(s._variants, 'cantonese');
  assert.equal(s._realPlayerCount, 1);
  assert.equal(s._hasBots, true);
  assert.equal(s._lang, 'en');
});

// ---- handleMove routing ----

test('handleMove: sichuan void flow still works', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(game.handleMove({ type: 'void', suit: 'wan' }, s, 0), null);
  assert.equal(s.voidSuit[0], 'wan');
  assert.equal(s.phase, 'void');
  assert.equal(game.handleMove({ type: 'void', suit: 'tong' }, s, 1), null);
  assert.equal(game.handleMove({ type: 'void', suit: 'tiao' }, s, 2), null);
  assert.equal(game.handleMove({ type: 'void', suit: 'wan' }, s, 3), null);
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 0);
});

test('handleMove: cantonese discard flow routes to Cantonese', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese' };
  game.initGame(s, 4);
  assert.equal(s._variants, 'cantonese');
  assert.equal(s.phase, 'play');
  assert.equal(s.hasDrawn, true);
  const tileId = s.hands[0][0].id;
  const err = game.handleMove({ type: 'discard', tileId }, s, 0);
  assert.equal(err, null);
  assert.equal(s.discards[0].length, 1);
  // either the discard led to a claim, or the next player drew
  assert.ok(s.phase === 'play' || s.phase === 'claim');
});

// ---- playerView routing ----

test('playerView: sichuan hides opponents, exposes public info', () => {
  const s = game.createState();
  game.initGame(s, 4);
  const view = game.playerView(s, 0);
  assert.ok(view.cfg, 'sichuan view carries cfg');
  assert.ok(Array.isArray(view.hands[1]), 'opponent hand is array of placeholders');
  assert.equal(view.hands[1][0].k, undefined);
  assert.deepEqual(view.voidSuit, s.voidSuit);
});

test('playerView: cantonese hides opponents as counts, hides wall', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese' };
  game.initGame(s, 4);
  const view = game.playerView(s, 0);
  assert.equal(typeof view.wall, 'number', 'cantonese wall exposed as count');
  assert.equal(typeof view.hands[1], 'number', 'opponent hand shown as count');
  assert.ok(Array.isArray(view.hands[0]), 'own hand shown as array');
});

// ---- getCurrentActor routing ----

test('getCurrentActor: sichuan returns currentPlayer', () => {
  const s = game.createState();
  game.initGame(s, 4);
  assert.equal(game.getCurrentActor(s), 0);
});

test('getCurrentActor: cantonese returns currentPlayer during play', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese' };
  game.initGame(s, 4);
  assert.equal(s.phase, 'play');
  assert.equal(game.getCurrentActor(s), 0);
});

// ---- setCurrentActor routing (used by server.skipDisconnectedTurn) ----

test('setCurrentActor: sichuan makes the absent seat play a minimal move (void -> discard)', () => {
  const s = game.createState();
  game.initGame(s, 4);
  // void phase: the missing seat picks a suit, the turn moves on (no actor is skipped)
  for (let i = 0; i < 4; i++) {
    assert.equal(game.getCurrentActor(s), i);
    game.setCurrentActor(s, (i + 1) % 4);
    assert.ok(s.voidSuit[i], 'seat ' + i + ' got a void suit');
  }
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 0);
  // play phase: the actor discards (no draw is skipped, hand size stays consistent)
  game.setCurrentActor(s, 1);
  assert.equal(s.discards[0].length, 1);
  assert.equal(s.hands[0].length, 13);
  if (s.phase === 'claim') {
    const actor = game.getCurrentActor(s);
    game.setCurrentActor(s, 0);
    assert.ok(!(s.phase === 'claim' && game.getCurrentActor(s) === actor), 'claim response passed');
  }
});

test('setCurrentActor: cantonese makes the absent seat discard its drawn tile', () => {
  const s = game.createState();
  s._options = { mahjongMode: 'cantonese' };
  game.initGame(s, 4);
  const before = s.currentPlayer;
  const drawn = s.drawn;
  game.setCurrentActor(s, 3);
  assert.ok(!s.hands[before].some(t => t.id === drawn), 'drawn tile discarded');
  assert.notEqual(game.getCurrentActor(s), before);
});
