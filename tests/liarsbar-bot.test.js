const test = require('node:test');
const assert = require('node:assert/strict');

const liarsbarBot = require('../bots/liarsbar');

function makeBot() {
  return liarsbarBot.createBot(0);
}

function withMockedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function makeState(overrides) {
  return Object.assign({
    phase: 'playing',
    currentPlayer: 0,
    currentShooter: -1,
    themeRank: 'Q',
    lastClaimant: -1,
    pileCards: [],
    alive: [true, true, true],
    hands: [[
      { id: 'qh', rank: 'Q', suit: 'h' },
      { id: 'wild', rank: '★', suit: 'wild' },
      { id: 'js', rank: 'J', suit: 's' },
    ], [{ id: 'opp1', rank: 'J', suit: 'd' }], [{ id: 'opp2', rank: 'K', suit: 'c' }]],
  }, overrides || {});
}

test('liarsbar bot shoots immediately during shooting phase', () => {
  const move = makeBot().getMove(makeState({
    phase: 'shooting',
    currentShooter: 0,
  }));

  assert.deepEqual(move, { action: 'shoot' });
});

test('liarsbar bot suspects when evidence strongly suggests the last claim is fake', () => {
  const state = makeState({
    lastClaimant: 1,
    pileCards: [
      { id: 'a', rank: 'J', suit: 's' },
      { id: 'b', rank: 'K', suit: 'h' },
      { id: 'c', rank: 'J', suit: 'd' },
      { id: 'd', rank: 'K', suit: 'c' },
      { id: 'e', rank: 'J', suit: 'c' },
    ],
    hands: [[
      { id: 'q1', rank: 'Q', suit: 'h' },
      { id: 'q2', rank: 'Q', suit: 's' },
      { id: 'wild', rank: '★', suit: 'wild' },
    ], [{ id: 'opp-only', rank: 'J', suit: 'd' }], []],
    alive: [true, true, false],
  });

  const move = withMockedRandom(0.99, () => makeBot().getMove(state));
  assert.deepEqual(move, { action: 'suspect' });
});

test('liarsbar bot prefers exact theme cards before spending wild cards', () => {
  const move = withMockedRandom(0.99, () => makeBot().getMove(makeState()));
  assert.deepEqual(move, { action: 'play', cardId: 'qh' });
});

test('liarsbar bot saves ghost cards until they are the last practical option', () => {
  const state = makeState({
    hands: [[
      { id: 'ghost', rank: '👻', suit: 'ghost' },
      { id: 'js', rank: 'J', suit: 's' },
      { id: 'kd', rank: 'K', suit: 'd' },
    ], [], []],
  });

  const move = makeBot().getMove(state);
  assert.notEqual(move.cardId, 'ghost');
});
