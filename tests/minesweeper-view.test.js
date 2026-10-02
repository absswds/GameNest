const test = require('node:test');
const assert = require('node:assert/strict');
const ms = require('../games/minesweeper');

test('minesweeper: a seat without a board (joined before the game started) gets an empty view, not a crash', () => {
  const s = ms.createState();
  assert.deepEqual(ms.playerBoardView(s, 1), []);
  ms.initGame(s, 1);
  assert.deepEqual(ms.playerBoardView(s, 1), [], 'seat 1 has no board when only one was dealt in');
  assert.ok(ms.playerBoardView(s, 0).length > 0);
});
