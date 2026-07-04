const test = require('node:test');
const assert = require('node:assert/strict');

const sheeptileBot = require('../bots/sheeptile');

function makeState() {
  const layout = [
    { id: 1, level: 1, x: 0, y: 0, z: 0, faceDown: false },
    { id: 2, level: 1, x: 2, y: 0, z: 0, faceDown: false },
    { id: 3, level: 1, x: 4, y: 0, z: 0, faceDown: false },
  ];

  return {
    sameBoard: true,
    layout,
    patterns: [{
      1: 5,
      2: 5,
      3: 9,
    }],
    players: [{
      level: 1,
      removed: {},
      slot: [
        { pattern: 1, fromId: 101 },
        { pattern: 2, fromId: 102 },
        { pattern: 3, fromId: 103 },
        { pattern: 4, fromId: 104 },
        { pattern: 5, fromId: 105 },
      ],
      eliminated: false,
      powers: { undo: 1, shuffle: 1, pop3: 1 },
      shuffleOverride: {},
    }],
  };
}

test('sheeptile bot keeps picking when a near-full tray has a live matching line', () => {
  const state = makeState();
  const move = sheeptileBot.createBot(0).getMove(state);

  assert.deepEqual(move, { type: 'pick', tileId: 1 });
});

test('sheeptile bot spends pop3 when the tray is near full and no live line exists', () => {
  const state = makeState();
  state.patterns[0][2] = 8;

  const move = sheeptileBot.createBot(0).getMove(state);
  assert.deepEqual(move, { type: 'power_pop3' });
});
