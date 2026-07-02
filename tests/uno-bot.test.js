const test = require('node:test');
const assert = require('node:assert/strict');

const unoBot = require('../bots/uno');

function makeBot() {
  return unoBot.createBot(0);
}

function baseState(hand, overrides) {
  return Object.assign({
    hands: [hand, [{ id: 'opp-a', color: 'blue', value: '1' }, { id: 'opp-b', color: 'yellow', value: '2' }]],
    discard: [{ id: 'top-red-5', color: 'red', value: '5' }],
    currentColor: 'red',
    currentPlayer: 0,
    direction: 1,
    drawStack: 0,
    unoCalled: [true, true],
  }, overrides || {});
}

test('uno bot keeps wild cards when a normal playable card works', () => {
  const hand = [
    { id: 'red-7', color: 'red', value: '7' },
    { id: 'wild-0', color: 'wild', value: 'wild' },
  ];

  const move = makeBot().getMove(baseState(hand));
  assert.equal(move.cardId, 'red-7');
});

test('uno bot chooses the dominant color after playing a wild card', () => {
  const hand = [
    { id: 'wild-0', color: 'wild', value: 'wild' },
    { id: 'blue-3', color: 'blue', value: '3' },
    { id: 'blue-6', color: 'blue', value: '6' },
    { id: 'green-1', color: 'green', value: '1' },
  ];

  const move = makeBot().getMove(baseState(hand, {
    discard: [{ id: 'top-yellow-9', color: 'yellow', value: '9' }],
    currentColor: 'yellow',
  }));

  assert.equal(move.cardId, 'wild-0');
  assert.equal(move.chosenColor, 'blue');
});

test('uno bot prefers stacking +2 before spending +4 on a draw penalty', () => {
  const hand = [
    { id: 'plus4-0', color: 'wild', value: '+4' },
    { id: 'red-plus2', color: 'red', value: '+2' },
  ];

  const move = makeBot().getMove(baseState(hand, {
    drawStack: 2,
    discard: [{ id: 'top-green-plus2', color: 'green', value: '+2' }],
    currentColor: 'green',
  }));

  assert.equal(move.cardId, 'red-plus2');
});

test('uno bot pressures the next player with one card by preferring action cards', () => {
  const hand = [
    { id: 'blue-7', color: 'blue', value: '7' },
    { id: 'blue-skip', color: 'blue', value: 'skip' },
  ];

  const move = makeBot().getMove(baseState(hand, {
    hands: [hand, [{ id: 'opp-last', color: 'red', value: '9' }]],
    discard: [{ id: 'top-blue-2', color: 'blue', value: '2' }],
    currentColor: 'blue',
  }));

  assert.equal(move.cardId, 'blue-skip');
});
