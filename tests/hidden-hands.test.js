const test = require('node:test');
const assert = require('node:assert/strict');

// Card games must not send other players' cards (or the draw pile order) to a client.
const cases = [
  { id: 'doudizhu', players: 3, piles: [] },
  { id: 'bigtwo', players: 4, piles: [] },
  { id: 'uno', players: 3, piles: ['deck'] },
  { id: 'liarsbar', players: 4, piles: [] },
  { id: 'oldmaid', players: 3, piles: [] },
  { id: 'exploding-kittens', players: 3, piles: ['deck'] },
  { id: 'rummikub', players: 3, piles: ['pool'] },
];

function start(mod, players) {
  const state = mod.createState();
  state._options = state._options || {};
  mod.initGame(state, players);
  return state;
}

for (const c of cases) {
  test(c.id + ': playerView hides other hands and keeps counts', () => {
    const mod = require('../games/' + c.id);
    assert.equal(typeof mod.playerView, 'function');
    const state = start(mod, c.players);
    const before = JSON.stringify(state);
    const view = mod.playerView(state, 0);

    assert.equal(JSON.stringify(state), before, 'playerView must not mutate state');
    assert.deepEqual(view.hands[0], state.hands[0], 'own hand visible');
    for (let i = 1; i < c.players; i++) {
      assert.equal(view.hands[i].length, state.hands[i].length, 'count preserved');
      assert.ok(view.hands[i].every((card) => card === null), 'opponent cards hidden');
    }
    for (const pile of c.piles) {
      assert.equal(view[pile].length, state[pile].length);
      assert.ok(view[pile].every((card) => card === null), pile + ' hidden');
    }
    assert.ok(!JSON.stringify(view.hands.slice(1)).includes('"id"'));
  });

  test(c.id + ': everything is revealed once the game has a winner', () => {
    const mod = require('../games/' + c.id);
    const state = start(mod, c.players);
    state.winner = 1;
    assert.equal(mod.playerView(state, 0), state);
  });
}

test('doudizhu: bottom cards hidden only while bidding', () => {
  const mod = require('../games/doudizhu');
  const state = start(mod, 3);
  state.phase = 'bidding';
  assert.ok(mod.playerView(state, 0).bottomCards.every((c) => c === null));
  state.phase = 'playing';
  assert.deepEqual(mod.playerView(state, 0).bottomCards, state.bottomCards);
});

test('exploding-kittens: See-the-Future cards only for the current player', () => {
  const mod = require('../games/exploding-kittens');
  const state = start(mod, 3);
  state.currentPlayer = 0;
  state.peekedCards = state.deck.slice(-3);
  assert.deepEqual(mod.playerView(state, 0).peekedCards, state.peekedCards);
  assert.equal(mod.playerView(state, 1).peekedCards, null);
});
