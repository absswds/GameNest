'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pdk = require('../games/paodekuai');
const { createBot } = require('../bots/paodekuai');
const P = require('../public/js/paodekuai-patterns');

// ---- helpers -------------------------------------------------------------
function card(id) {
  return { rank: id.slice(0, -1), suit: id.slice(-1), id: id };
}
function cards(str) {
  return str.split(/\s+/).filter(Boolean).map(card);
}
function ids(list) {
  return list.map(function (c) { return c.id; });
}

// Fresh playing state with hand-picked hands; the opening-card rule is switched off.
function setup(handStrs, opts) {
  opts = opts || {};
  const s = pdk.createState();
  s._options = Object.assign({ rounds: 3, turnTime: 0 }, opts.options || {});
  pdk.initGame(s, handStrs.length);
  s.hands = handStrs.map(cards);
  s.firstCard = null;
  s.currentPlayer = opts.turn || 0;
  s.lastPlay = null;
  s.lastPlayPlayer = -1;
  s.passed = new Array(handStrs.length).fill(false);
  s.played = new Array(handStrs.length).fill(false);
  return s;
}
function play(s, who, str) {
  return pdk.handleMove({ cards: str.split(/\s+/).filter(Boolean) }, s, who);
}
function pass(s, who) {
  return pdk.handleMove({ cards: [] }, s, who);
}
function det(str, isLast) {
  return P.detect(cards(str), !!isLast);
}

// ---- deck & dealing --------------------------------------------------------
describe('paodekuai - deck & dealing', () => {
  it('48-card deck without jokers, 2h/2c/2d and As', () => {
    const deck = P.createDeck();
    assert.equal(deck.length, 48);
    const set = new Set(ids(deck));
    assert.equal(set.size, 48);
    for (const bad of ['2h', '2c', '2d', 'As']) assert.ok(!set.has(bad), bad);
    for (const good of ['2s', 'Ah', 'Ac', 'Ad', '3s']) assert.ok(set.has(good), good);
    assert.ok(deck.every(function (c) { return c.rank !== 'JOKER' && P.rankVal(c.rank) >= 0; }));
  });

  it('3 players get 16 cards each, using the whole deck', () => {
    const s = pdk.createState();
    pdk.initGame(s, 3);
    assert.equal(s.hands.length, 3);
    s.hands.forEach(function (h) { assert.equal(h.length, 16); });
    const all = [].concat(s.hands[0], s.hands[1], s.hands[2]);
    assert.equal(new Set(ids(all)).size, 48);
  });

  it('2 players get 16 cards each, the other 16 stay out', () => {
    const s = pdk.createState();
    pdk.initGame(s, 2);
    assert.equal(s.hands.length, 2);
    s.hands.forEach(function (h) { assert.equal(h.length, 16); });
    assert.equal(new Set(ids([].concat(s.hands[0], s.hands[1]))).size, 32);
  });
});

// ---- who leads ----------------------------------------------------------------
describe('paodekuai - opening play', () => {
  it('3 players: spade 3 holder leads and must include it', () => {
    for (let i = 0; i < 20; i++) {
      const s = pdk.createState();
      pdk.initGame(s, 3);
      assert.equal(s.firstCard, '3s');
      assert.ok(s.hands[s.currentPlayer].some(function (c) { return c.id === '3s'; }));
    }
  });

  it('first play without spade 3 is refused, with it is accepted', () => {
    const s = setup(['3s 4h 9d', '5h 6h', '7h 8h']);
    s.firstCard = '3s';
    assert.equal(play(s, 0, '9d'), 'pdk_first_must_have_s3');
    assert.equal(play(s, 0, '3s'), null);
    assert.equal(s.firstCard, null);
  });

  it('2 players: if nobody holds spade 3 the lowest card leads and must be included', () => {
    let checked = 0;
    for (let i = 0; i < 400 && checked < 3; i++) {
      const s = pdk.createState();
      pdk.initGame(s, 2);
      const all = [].concat(s.hands[0], s.hands[1]);
      if (all.some(function (c) { return c.id === '3s'; })) continue;
      checked++;
      let low = all[0];
      all.forEach(function (c) { if (P.cardKey(c) < P.cardKey(low)) low = c; });
      assert.equal(s.firstCard, low.id);
      assert.ok(s.hands[s.currentPlayer].some(function (c) { return c.id === low.id; }));
    }
    assert.ok(checked > 0, 'never saw a deal without spade 3');
  });

  it('after a round the winner leads the next one', () => {
    const s = setup(['3d', '5h 6h', '7h 8h 9h'], { turn: 0 });
    // player 1 will win: give them a one-card hand
    s.hands = [cards('4d 4c'), cards('5h'), cards('7h 8h 9h')];
    s.currentPlayer = 1;
    assert.equal(play(s, 1, '5h'), null);
    assert.equal(s.phase, 'roundEnd');
    assert.equal(pdk.handleMove({ action: 'next_round' }, s, 0), null);
    assert.equal(s.phase, 'playing');
    assert.equal(s.currentRound, 2);
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.firstCard, null);
    s.hands.forEach(function (h) { assert.equal(h.length, 16); });
  });
});

// ---- patterns -----------------------------------------------------------------
describe('paodekuai - pattern detection', () => {
  it('single, pair, bomb', () => {
    assert.equal(det('5h').type, 'single');
    assert.equal(det('5h 5d').type, 'pair');
    assert.equal(det('7s 7h 7c 7d').type, 'bomb');
    assert.equal(det('5h 6d'), null);
  });

  it('consecutive pairs need at least two pairs and no 2', () => {
    assert.equal(det('5h 5d 6h 6d').type, 'pairs');
    assert.equal(det('5h 5d 6h 6d 7h 7d').length, 3);
    assert.equal(det('5h 5d 7h 7d'), null);
    assert.equal(det('Kh Kd Ah Ad').type, 'pairs');
    assert.equal(det('Ah Ad 2s 2s'), null);
  });

  it('triple takes two cards; one or none only on the last play', () => {
    assert.equal(det('5h 5d 5c 8h 9d').type, 'triple');
    assert.equal(det('5h 5d 5c 8h 8d').type, 'triple');
    assert.equal(det('5h 5d 5c 8h', false), null);
    assert.equal(det('5h 5d 5c', false), null);
    const four = det('5h 5d 5c 8h', true);
    assert.equal(four.type, 'triple');
    assert.equal(four.short, true);
    assert.equal(det('5h 5d 5c', true).type, 'triple');
  });

  it('airplane: 2+ consecutive triples, two cards each, fewer on the last play', () => {
    const full = det('5h 5d 5c 6h 6d 6c 9h 9d Kh Kd');
    assert.equal(full.type, 'plane');
    assert.equal(full.length, 2);
    assert.equal(det('5h 5d 5c 6h 6d 6c 9h 9d Kh', false), null);
    assert.equal(det('5h 5d 5c 7h 7d 7c 9h 9d Kh Kd'), null);
    const shortPlane = det('5h 5d 5c 6h 6d 6c 9h', true);
    assert.equal(shortPlane.type, 'plane');
    assert.equal(shortPlane.short, true);
    assert.equal(det('5h 5d 5c 6h 6d 6c', true).type, 'plane');
  });

  it('straight needs 5+ cards and the 2 never joins one', () => {
    assert.equal(det('3h 4h 5h 6h 7h').type, 'straight');
    assert.equal(det('3h 4h 5h 6h 7h 8h').length, 6);
    assert.equal(det('3h 4h 5h 6h'), null);
    assert.equal(det('10h Jh Qh Kh Ah').type, 'straight');
    assert.equal(det('Jh Qh Kh Ah 2s'), null);
    assert.equal(det('Qh Kh Ah 2s 3h'), null);
  });
});

describe('paodekuai - beating rules', () => {
  const beat = function (a, b) { return P.canBeat(det(a), det(b)); };
  it('same pattern and size, higher rank', () => {
    assert.equal(beat('6h', '5h'), true);
    assert.equal(beat('5h', '6h'), false);
    assert.equal(beat('6h 6d', '5h 5d'), true);
    assert.equal(beat('6h', '5h 5d'), false);
    assert.equal(beat('4h 5h 6h 7h 8h 9h', '3h 4h 5h 6h 7h'), false);
    assert.equal(beat('4h 5h 6h 7h 8h', '3h 4h 5h 6h 7h'), true);
    assert.equal(beat('6h 6d 7h 7d', '5h 5d 6c 6s'), true);
    assert.equal(beat('6h 6d 6c 3h 4d', '5h 5d 5c 8h 9d'), true);
  });
  it('bomb beats any non-bomb; bombs compare by rank', () => {
    assert.equal(beat('4h 4d 4c 4s', '2s'), true);
    assert.equal(beat('4h 4d 4c 4s', '5h 5d 5c 8h 9d'), true);
    assert.equal(beat('5h 5d 5c 5s', '4h 4d 4c 4s'), true);
    assert.equal(beat('4h 4d 4c 4s', '5h 5d 5c 5s'), false);
    assert.equal(beat('2s', '4h 4d 4c 4s'), false);
  });
});

// ---- turn flow --------------------------------------------------------------
describe('paodekuai - turn flow', () => {
  it('rejects bad moves with error keys', () => {
    const s = setup(['3d 5h 9s', '4h 6h', '7h 8h']);
    assert.equal(play(s, 1, '4h'), 'g_not_your_turn');
    assert.equal(play(s, 0, '4h'), 'pdk_card_not_in_hand');
    assert.equal(play(s, 0, '3d 3d'), 'pdk_card_not_in_hand');
    assert.equal(play(s, 0, '3d 5h'), 'pdk_invalid_play');
    assert.equal(pass(s, 0), 'pdk_must_lead');
    assert.equal(pdk.handleMove({ cards: 'x' }, s, 0), 'pdk_invalid_format');
  });

  it('follower must beat with the same pattern', () => {
    const s = setup(['3d 9h 9d', '4h 4d 6h', '7h 8h 10s']);
    assert.equal(play(s, 0, '9h 9d'), null);
    assert.equal(play(s, 1, '6h'), 'pdk_doesnt_beat');
    assert.equal(play(s, 1, '4h 4d'), 'pdk_doesnt_beat');
  });

  it('mustBeat (default): pass is refused while a beating play exists', () => {
    const s = setup(['3d 5h 9s', '6h 4d 4c', '7h 8h 10s']);
    assert.equal(s.mustBeat, true);
    assert.equal(play(s, 0, '5h'), null);
    assert.equal(pass(s, 1), 'pdk_must_beat');
    assert.equal(play(s, 1, '6h'), null);
  });

  it('pass allowed when nothing beats, and a full round of passes hands the lead back', () => {
    const s = setup(['3d 5h 9s', '4h 4d 4c', '6h 7h']);
    assert.equal(play(s, 0, '9s'), null);
    assert.equal(pass(s, 1), null);
    assert.equal(pass(s, 2), null);
    assert.equal(s.lastPlay, null);
    assert.equal(s.currentPlayer, 0);
  });

  it('mustBeat off: passing is always allowed', () => {
    const s = setup(['3d 5h 9s', '6h 7h 4c', '8h 8d'], { options: { mustBeat: false } });
    assert.equal(s.mustBeat, false);
    assert.equal(play(s, 0, '5h'), null);
    assert.equal(pass(s, 1), null);
  });

  it('next player holds one card: a single must be the highest single in hand', () => {
    const s = setup(['3d 5h 9s', '4h', '7h 8h 10s']);
    assert.equal(play(s, 0, '3d'), 'pdk_must_play_highest_single');
    assert.equal(play(s, 0, '5h'), 'pdk_must_play_highest_single');
    assert.equal(play(s, 0, '9s'), null);
  });

  it('single-card rule does not restrict pairs', () => {
    const s = setup(['3d 3h 9s', '4h', '7h 8h 10s']);
    assert.equal(play(s, 0, '3d 3h'), null);
  });

  it('single-card rule also applies in a 2-player game', () => {
    const s = setup(['9s', '6h 3d 7d'], { turn: 1 });
    // seat 1 leads a single: next player (seat 0) has 1 card so it must be the highest (7d)
    assert.equal(play(s, 1, '3d'), 'pdk_must_play_highest_single');
    assert.equal(play(s, 1, '7d'), null);
  });
});

// ---- scoring --------------------------------------------------------------------
describe('paodekuai - scoring', () => {
  it('plain loss = cards left; loser who played pays 1 each', () => {
    const s = setup(['5h', '6h 7h 8h', '9h 9d']);
    s.played = [false, true, true];
    play(s, 0, '5h');
    assert.deepEqual(s.cumulativeScore, [5, -3, -2]);
    assert.deepEqual(s.roundScores, [5, -3, -2]);
    assert.deepEqual(s.roundResult.spring, [false, false, false]);
  });

  it('a loser who never played pays double (spring)', () => {
    const s = setup(['5h', '6h 7h 8h', '9h 9d']);
    s.played = [false, false, true];
    play(s, 0, '5h');
    assert.deepEqual(s.roundResult.spring, [false, true, false]);
    assert.deepEqual(s.cumulativeScore, [8, -6, -2]);
  });

  it('a bomb collects 10 from every other player immediately', () => {
    const s = setup(['4h 4d 4c 4s 9h', '6h 7h 8h', '9d 9c']);
    assert.equal(play(s, 0, '4h 4d 4c 4s'), null);
    assert.deepEqual(s.cumulativeScore, [20, -10, -10]);
    assert.equal(s.bombs[0], 1);
    assert.equal(s.phase, 'playing');
  });

  it('bomb points add to the card settlement and scores accumulate over rounds', () => {
    const s = setup(['4h 4d 4c 4s', '6h 7h 8h', '9d 9c']);
    s.played = [false, true, true];
    play(s, 0, '4h 4d 4c 4s'); // goes out with a bomb: +20, then cards 3 + 2
    assert.deepEqual(s.cumulativeScore, [25, -13, -12]);
    assert.equal(s.phase, 'roundEnd');
    pdk.handleMove({ action: 'next_round' }, s, 0);
    assert.equal(s.phase, 'playing');
    assert.deepEqual(s.cumulativeScore, [25, -13, -12]);
    s.hands = [cards('5h'), cards('6h 6d'), cards('9d')];
    s.firstCard = null;
    s.currentPlayer = 0;
    s.played = [false, true, true];
    play(s, 0, '5h');
    assert.deepEqual(s.cumulativeScore, [25 + 3, -13 - 2, -12 - 1]);
  });

  it('match ends after the configured rounds with the top scorer as winner', () => {
    const s = setup(['5h', '6h 7h', '9d'], { options: { rounds: 1 } });
    s.played = [false, true, true];
    play(s, 0, '5h');
    assert.equal(s.phase, 'matchEnd');
    assert.equal(s.winner, 0);
    assert.equal(pdk.handleMove({ cards: [] }, s, 0), 'g_game_over');
  });
});

// ---- player view ----------------------------------------------------------------
describe('paodekuai - playerView', () => {
  it('shows own hand and only counts for the others', () => {
    const s = pdk.createState();
    pdk.initGame(s, 3);
    for (let me = 0; me < 3; me++) {
      const v = pdk.playerView(s, me);
      assert.deepEqual(ids(v.hands[me]), ids(s.hands[me]));
      for (let o = 0; o < 3; o++) {
        if (o === me) continue;
        assert.equal(v.hands[o].length, s.hands[o].length);
        assert.ok(v.hands[o].every(function (c) { return c === null; }));
      }
      const json = JSON.stringify(v);
      for (let o = 0; o < 3; o++) {
        if (o === me) continue;
        s.hands[o].forEach(function (c) {
          // the card id may appear as the opening card only if it is the own hand's
          if (s.hands[me].some(function (m) { return m.id === c.id; })) return;
          assert.ok(json.indexOf('"id":"' + c.id + '"') < 0, 'leaked ' + c.id);
        });
      }
    }
    assert.doesNotThrow(function () { JSON.stringify(s); });
  });

  it('does not throw before initGame', () => {
    const s = pdk.createState();
    assert.doesNotThrow(function () { pdk.playerView(s, 0); });
    assert.doesNotThrow(function () { pdk.playerView(s, 2); });
  });

  // Leaving to the lobby and coming back must not restart the countdown: the client
  // counts down from the server's remaining time, not from a full turnTime.
  it('sends the remaining turn time, not a full turn', () => {
    const s = setup(['3s 4s', '5s 6s', '7s 8s'], { options: { turnTime: 15 } });
    s.currentTurnDeadline = Date.now() + 6000;
    const left = pdk.playerView(s, 0).turnMsLeft;
    assert.ok(left > 5000 && left <= 6000, 'turnMsLeft ' + left);
    s.currentTurnDeadline = Date.now() - 500;
    assert.equal(pdk.playerView(s, 0).turnMsLeft, 0);
    s.currentTurnDeadline = null;
    assert.equal(pdk.playerView(s, 0).turnMsLeft, undefined);
  });
});

// ---- bots -----------------------------------------------------------------------
function playMatch(difficulty, count, useView) {
  const s = pdk.createState();
  s._options = { rounds: 3, turnTime: 0, difficulty: difficulty };
  s.difficulty = difficulty;
  pdk.initGame(s, count);
  s.difficulty = difficulty;
  const bots = [];
  for (let i = 0; i < count; i++) bots.push(createBot(i));
  let steps = 0;
  while (s.phase !== 'matchEnd' && steps < 5000) {
    steps++;
    const actor = s.phase === 'roundEnd' ? 0 : s.currentPlayer;
    const before = JSON.stringify(s);
    const view = useView ? pdk.playerView(s, actor) : s;
    const viewBefore = JSON.stringify(view);
    const move = bots[actor].getMove(view);
    assert.equal(JSON.stringify(view), viewBefore, 'bot mutated its state');
    assert.equal(JSON.stringify(s), before, 'bot mutated server state');
    const err = pdk.handleMove(move, s, actor);
    assert.equal(err, null, 'bot move rejected: ' + err + ' ' + JSON.stringify(move));
  }
  return { s: s, steps: steps };
}

describe('paodekuai - bots', () => {
  for (const diff of ['easy', 'normal', 'hard']) {
    for (const count of [2, 3]) {
      it(diff + ' bots finish a ' + count + '-player match on the full state', () => {
        const r = playMatch(diff, count, false);
        assert.equal(r.s.phase, 'matchEnd');
        assert.ok(r.steps < 5000);
        assert.equal(r.s.roundHistory.length, 3);
      });
      it(diff + ' bots finish a ' + count + '-player match from playerView', () => {
        const r = playMatch(diff, count, true);
        assert.equal(r.s.phase, 'matchEnd');
      });
    }
  }

  it('bot answers next_round at roundEnd', () => {
    const s = setup(['5h', '6h', '7h']);
    s.phase = 'roundEnd';
    assert.deepEqual(createBot(0).getMove(s), { action: 'next_round' });
  });
});
