const assert = require('assert');
const monopoly = require('../games/monopoly');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

function createStartedState(playerCount) {
  const state = monopoly.createState();
  monopoly.initGame(state, playerCount || 2);
  return state;
}

function withMockedRandom(values, fn) {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

test('landing on your own monopolized property offers direct upgrade action', () => {
  const state = createStartedState(2);
  state.positions[0] = 7;
  state.properties[6] = { owner: 0, houses: 0 };
  state.properties[8] = { owner: 0, houses: 0 };
  state.properties[9] = { owner: 0, houses: 1 };
  state.cash[0] = 1500;

  const err = withMockedRandom([0.01, 0.01], () => monopoly.handleMove({ type: 'roll' }, state, 0));

  assert.strictEqual(err, null);
  assert.strictEqual(state.positions[0], 9);
  assert.strictEqual(state.phase, 'landed');
  assert.strictEqual(state.pendingAction, 'can_build');
});

test('building from direct upgrade action uses current space and ends landing choice', () => {
  const state = createStartedState(2);
  state.phase = 'landed';
  state.currentPlayer = 0;
  state.positions[0] = 9;
  state.pendingAction = 'can_build';
  state.properties[6] = { owner: 0, houses: 0 };
  state.properties[8] = { owner: 0, houses: 0 };
  state.properties[9] = { owner: 0, houses: 1 };
  state.cash[0] = 1500;

  const err = monopoly.handleMove({ type: 'build' }, state, 0);

  assert.strictEqual(err, null);
  assert.strictEqual(state.properties[9].houses, 2);
  assert.strictEqual(state.cash[0], 1440);
  assert.strictEqual(state.phase, 'end_turn');
  assert.strictEqual(state.pendingAction, null);
});

test('chance cards record structured feedback for the affected player', () => {
  const state = createStartedState(2);

  const err = withMockedRandom([0.01, 0.01, 0], () => monopoly.handleMove({ type: 'roll' }, state, 0));

  assert.strictEqual(err, null);
  assert.strictEqual(state.positions[0], 2);
  assert.ok(state.lastCardEffect);
  assert.strictEqual(state.lastCardEffect.player, 0);
  assert.strictEqual(state.lastCardEffect.delta, 50);
  assert.strictEqual(state.lastCardEffect.tone, 'gain');
  assert.match(state.lastCardEffect.summary, /\+50/);
});

test('chance card feedback keeps the acting player so other clients can show who drew it', () => {
  const state = createStartedState(3);
  state.currentPlayer = 1;
  state.positions[1] = 0;

  const err = withMockedRandom([0.01, 0.01, 0], () => monopoly.handleMove({ type: 'roll' }, state, 1));

  assert.strictEqual(err, null);
  assert.ok(state.lastCardEffect);
  assert.strictEqual(state.lastCardEffect.player, 1);
  assert.strictEqual(state.lastCardEffect.summary, '+50 · 收到银行股息，得 50元');
});
