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

test('oldmaid bot draws blindly from the next player', () => {
  const bot = oldmaidBot.createBot(0);
  const move = bot.getMove({
    hands: [
      [
        { id: 'as-self', rank: 'A', suit: 's' },
        { id: '7h-self', rank: '7', suit: 'h' },
      ],
      [
        { id: 'kc-opp1', rank: 'K', suit: 'c' },
        { id: 'ah-opp1', rank: 'A', suit: 'h' },
      ],
      [
        { id: 'qd-opp2', rank: 'Q', suit: 'd' },
        { id: '9c-opp2', rank: '9', suit: 'c' },
      ],
    ],
  });

  // The opponent's cards are face down, so the bot may not prefer the pairing ace.
  assert.equal(move.drawFrom, 1);
  assert.ok(move.cardIndex === 0 || move.cardIndex === 1);
});

test('oldmaid bot skips players who are out of cards when choosing whom to draw from', () => {
  const bot = oldmaidBot.createBot(0);
  const move = bot.getMove({
    hands: [
      [{ id: '3s-self', rank: '3', suit: 's' }],
      [],
      [
        { id: 'ks-opp2', rank: 'K', suit: 's' },
        { id: 'qc-opp2', rank: 'Q', suit: 'c' },
      ],
    ],
  });

  assert.equal(move.drawFrom, 2);
});

test('texas bot raises more assertively with a premium made hand when checked to', () => {
  const bot = texasBot.createBot(0);
  const move = bot.getMove({
    chips: [300, 300],
    currentBet: 40,
    lastRaise: 20,
    bets: [40, 40],
    folded: [false, false],
    allIn: [false, false],
    raiseClosed: [false, false],
    pot: 120,
    hands: [[
      { rank: 'A', suit: 's' },
      { rank: 'A', suit: 'h' },
    ], []],
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
