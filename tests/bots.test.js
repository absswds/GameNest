const test = require('node:test');
const assert = require('node:assert/strict');

const numberbombBot = require('../bots/numberbomb');
const oldmaidBot = require('../bots/oldmaid');
const texasBot = require('../bots/texas');

function withMockedRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

test('numberbomb bot guesses the exact midpoint without random drift', () => {
  const bot = numberbombBot.createBot(0);
  const move = withMockedRandom(0, () => bot.getMove({ low: 1, high: 99 }));
  assert.equal(move.guess, 50);
});

test('oldmaid bot prefers a known pairing draw over the nearest random opponent', () => {
  const bot = oldmaidBot.createBot(0);
  const move = bot.getMove({
    hands: [
      [
        { id: 'as-self', rank: 'A', suit: 's' },
        { id: '7h-self', rank: '7', suit: 'h' },
      ],
      [
        { id: 'kc-opp1', rank: 'K', suit: 'c' },
        { id: 'qd-opp1', rank: 'Q', suit: 'd' },
      ],
      [
        { id: 'ah-opp2', rank: 'A', suit: 'h' },
        { id: '9c-opp2', rank: '9', suit: 'c' },
      ],
    ],
  });

  assert.deepEqual(move, { drawFrom: 2, cardIndex: 0 });
});

test('oldmaid bot falls back to the shortest non-empty target when no pairing draw exists', () => {
  const bot = oldmaidBot.createBot(0);
  const move = bot.getMove({
    hands: [
      [{ id: '3s-self', rank: '3', suit: 's' }],
      [
        { id: '8h-opp1', rank: '8', suit: 'h' },
        { id: '9h-opp1', rank: '9', suit: 'h' },
        { id: '10h-opp1', rank: '10', suit: 'h' },
      ],
      [
        { id: 'ks-opp2', rank: 'K', suit: 's' },
        { id: 'qc-opp2', rank: 'Q', suit: 'c' },
      ],
    ],
  });

  assert.deepEqual(move, { drawFrom: 2, cardIndex: 1 });
});

test('texas bot raises more assertively with a premium made hand when checked to', () => {
  const bot = texasBot.createBot(0);
  const move = bot.getMove({
    chips: [300],
    currentBet: 40,
    bets: [40],
    pot: 120,
    hands: [[
      { rank: 'A', suit: 's' },
      { rank: 'A', suit: 'h' },
    ]],
    communityCards: [],
  });

  assert.equal(move.action, 'raise');
  assert.equal(move.amount, 112);
});

test('texas bot folds medium pretty hands when the call pressure is too high', () => {
  const bot = texasBot.createBot(0);
  const move = withMockedRandom(0.99, () => bot.getMove({
    chips: [100],
    currentBet: 50,
    bets: [0],
    pot: 120,
    hands: [[
      { rank: 'J', suit: 's' },
      { rank: '9', suit: 's' },
    ]],
    communityCards: [],
  }));

  assert.deepEqual(move, { action: 'fold' });
});
