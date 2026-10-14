const test = require('node:test');
const assert = require('node:assert');
const texas = require('../games/texas');
const bots = require('../bots/texas');

function fresh(n) {
  const s = texas.createState();
  texas.initGame(s, n);
  return s;
}
// What server.js does on restart: new state, carryOver from the previous one, initGame
function nextHand(prev, n) {
  const s = texas.createState();
  texas.carryOver(prev, s, n);
  texas.initGame(s, n);
  return s;
}
function finished(chips, dealer, extra) {
  return { chips, dealer, winner: 0, handNumber: 1, ...extra };
}
function total(s) { return s.chips.reduce((a, b) => a + b, 0) + s.pot; }

test('chips carry over and the dealer moves to the next seat with chips', () => {
  const prev = finished([300, 0, 900, 800], 0);
  const s = nextHand(prev, 4);
  assert.strictEqual(s.dealer, 2); // seat 1 is busted
  assert.strictEqual(s.handNumber, 2);
  assert.deepStrictEqual(s.out, [false, true, false, false]);
  assert.strictEqual(total(s), 2000);
  // blinds follow the new dealer: SB = seat 3, BB = seat 0
  assert.strictEqual(s.smallBlind, 3);
  assert.strictEqual(s.bigBlind, 0);
  assert.strictEqual(s.chips[3], 790);
  assert.strictEqual(s.chips[0], 280);
  assert.strictEqual(s.currentPlayer, 2);
});

test('dealer wraps around past the last seat', () => {
  const s = nextHand(finished([500, 500, 500], 2), 3);
  assert.strictEqual(s.dealer, 0);
});

test('busted seat gets no cards, no blinds, never acts, and is hidden/out in the view', () => {
  const s = nextHand(finished([500, 0, 500], 2), 3); // dealer -> 0, heads-up between 0 and 2
  assert.deepStrictEqual(s.hands[1], []);
  assert.strictEqual(s.bets[1], 0);
  assert.strictEqual(s.smallBlind, 0); // heads-up: dealer posts SB
  assert.strictEqual(s.bigBlind, 2);
  assert.strictEqual(s.currentPlayer, 0);
  assert.strictEqual(texas.handleMove({ action: 'check' }, s, 1), 'g_not_your_turn');
  const v = texas.playerView(s, 1);
  assert.deepStrictEqual(v.holeCards, []);
  assert.strictEqual(v.out[1], true);
  assert.strictEqual(texas.playerView(s, 0).opponentHoleCounts[1], 0);
  // play the hand out: seat 1 is never the current player
  while (s.winner === null) {
    assert.notStrictEqual(s.currentPlayer, 1);
    const err = texas.handleMove({ action: 'call' }, s, s.currentPlayer);
    if (err) assert.strictEqual(texas.handleMove({ action: 'check' }, s, s.currentPlayer), null);
  }
  assert.strictEqual(s.chips[1], 0);
  assert.strictEqual(total(s), 1000);
});

test('session ends when one player holds all chips; the next restart starts fresh', () => {
  const s = nextHand(finished([20, 980], 1), 2); // dealer -> 0 (SB), seat 1 BB; seat 0 has only 20
  assert.strictEqual(s.sessionOver, false);
  texas.handleMove({ action: 'fold' }, s, s.currentPlayer === 0 ? 0 : s.currentPlayer);
  // fold-out: seat 1 wins the blinds; 20 chips left is not busted yet
  assert.strictEqual(s.winner, 1);
  // force a real bust: seat 0 all-in, seat 1 calls, seat 1 wins
  const t = nextHand(finished([20, 980], 1), 2);
  t.hands[0] = [{ rank: '2', suit: 's', id: '2s' }, { rank: '7', suit: 'h', id: '7h' }];
  t.hands[1] = [{ rank: 'A', suit: 's', id: 'As' }, { rank: 'A', suit: 'h', id: 'Ah' }];
  t.deck = [{ rank: '3', suit: 'c', id: '3c' }, { rank: '4', suit: 'd', id: '4d' }, { rank: '9', suit: 'c', id: '9c' }, { rank: 'J', suit: 'd', id: 'Jd' }, { rank: '5', suit: 'h', id: '5h' }];
  texas.handleMove({ action: 'all_in' }, t, t.currentPlayer);
  texas.handleMove({ action: 'call' }, t, t.currentPlayer);
  assert.strictEqual(t.phase, 'showdown');
  assert.strictEqual(t.chips[0], 0);
  assert.strictEqual(t.chips[1], 1000);
  assert.strictEqual(t.sessionOver, true);
  assert.strictEqual(t.winner, 1);
  const f = nextHand(t, 2);
  assert.deepStrictEqual(f.chips.map((c, i) => c + f.bets[i]), [1000, 1000]);
  assert.strictEqual(f.handNumber, 1);
  assert.strictEqual(f.sessionOver, false);
  assert.deepStrictEqual(f.out, [false, false]);
});

test('seat count change, unfinished hand, or no previous state starts a fresh session', () => {
  const prev = finished([100, 1900, 0], 1);
  for (const s of [nextHand(prev, 4), nextHand(prev, 2), nextHand(fresh(3), 3), nextHand(null, 3)]) {
    assert.strictEqual(s.handNumber, 1);
    assert.ok(s.chips.every((c, i) => c + s.bets[i] === 1000));
    assert.ok(s.out.every(o => !o));
  }
});

test('short blinds all-in heads-up resolves without hanging', () => {
  const s = nextHand(finished([5, 995], 1), 2); // dealer -> 0 posts 5 (all-in), seat 1 BB
  assert.ok(s.currentPlayer === 1 || s.winner !== null);
  assert.strictEqual(total(s), 1000);
  const t = nextHand(finished([5, 7], 1), 2);
  assert.strictEqual(t.phase, 'showdown'); // both all-in on the blinds: board runs out immediately
  assert.notStrictEqual(t.winner, null);
  assert.strictEqual(total(t), 12);
});

test('bot-only multi-hand session runs to the end without errors and conserves chips', () => {
  const n = 4;
  let state = nextHand(finished(new Array(n).fill(60), 0), n);
  const botList = [...Array(n).keys()].map(i => bots.createBot(i));
  let hands = 0;
  while (hands < 5000) {
    let steps = 0;
    while (state.winner === null) {
      assert.ok(++steps < 500, 'hand did not finish');
      const idx = state.currentPlayer;
      assert.strictEqual(state.out[idx], false);
      assert.ok(state.chips[idx] > 0);
      const before = JSON.stringify(state);
      let move = botList[idx].getMove(state);
      assert.strictEqual(JSON.stringify(state), before, 'bot mutated state');
      let err = texas.handleMove(move, state, idx);
      if (err) err = texas.handleMove({ pass: true }, state, idx);
      assert.strictEqual(err, null);
    }
    assert.strictEqual(total(state), 60 * n);
    hands++;
    if (state.sessionOver) break;
    state = nextHand(state, n);
  }
  assert.strictEqual(state.sessionOver, true);
  assert.strictEqual(state.chips.filter(c => c > 0).length, 1);
  assert.strictEqual(state.chips[state.winner], 60 * n);
});
