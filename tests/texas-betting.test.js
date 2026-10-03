const test = require('node:test');
const assert = require('node:assert');
const texas = require('../games/texas');

function newGame(n) {
  const s = texas.createState();
  texas.initGame(s, n);
  return s;
}
const total = s => s.chips.reduce((a, b) => a + b, 0) + s.pot;
function act(s, data) {
  const err = texas.handleMove(data, s, s.currentPlayer);
  assert.strictEqual(err, null, JSON.stringify(data));
}

test('texas: blinds are counted once and chips are conserved', () => {
  const s = newGame(3);
  assert.strictEqual(s.pot, 30);
  assert.strictEqual(total(s), 3000);
  act(s, { action: 'fold' });
  assert.strictEqual(s.pot, 30);
  assert.strictEqual(total(s), 3000);
});

test('texas: called and raised chips reach the pot and the winner', () => {
  const s = newGame(3);
  act(s, { action: 'raise', amount: 100 }); // seat 0
  act(s, { action: 'call' });               // SB
  act(s, { action: 'call' });               // BB
  assert.strictEqual(s.phase, 'flop');
  assert.strictEqual(s.pot, 300);
  assert.strictEqual(total(s), 3000);
  while (s.winner === null) act(s, { action: 'check' });
  assert.strictEqual(s.chips.reduce((a, b) => a + b, 0), 3000);
});

test('texas: big blind gets its option and a street needs everyone to act', () => {
  const s = newGame(3);
  act(s, { action: 'call' }); // seat 0
  act(s, { action: 'call' }); // SB completes
  assert.strictEqual(s.phase, 'preflop');
  assert.strictEqual(s.currentPlayer, s.bigBlind);
  act(s, { action: 'check' });
  assert.strictEqual(s.phase, 'flop');
  act(s, { action: 'check' });
  assert.strictEqual(s.phase, 'flop');
  act(s, { action: 'check' });
  act(s, { action: 'check' });
  assert.strictEqual(s.phase, 'turn');
});

test('texas: a raise reopens action for players who already checked', () => {
  const s = newGame(3);
  act(s, { action: 'call' });
  act(s, { action: 'call' });
  act(s, { action: 'check' });
  act(s, { action: 'check' });
  act(s, { action: 'raise', amount: 40 });
  act(s, { action: 'call' });
  assert.strictEqual(s.phase, 'flop');
  act(s, { action: 'call' });
  assert.strictEqual(s.phase, 'turn');
});

test('texas: a raise may use every chip left on top of the current bet', () => {
  const s = newGame(2);
  const p = s.currentPlayer;
  const posted = s.bets[p];
  s.chips[p] = 100;
  act(s, { action: 'raise', amount: posted + 100 });
  assert.strictEqual(s.chips[p], 0);
  const err = texas.handleMove({ action: 'raise', amount: 5000 }, s, s.currentPlayer);
  assert.strictEqual(err, 'tx_not_enough_chips');
});

test('texas: everyone all-in runs the board out to showdown', () => {
  const s = newGame(2);
  act(s, { action: 'all_in' });
  act(s, { action: 'all_in' });
  assert.notStrictEqual(s.winner, null);
  assert.strictEqual(s.communityCards.length, 5);
  assert.strictEqual(s.chips.reduce((a, b) => a + b, 0), 2000);
});
