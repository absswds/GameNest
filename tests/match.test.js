const test = require('node:test');
const assert = require('node:assert');
const { createMatch, recordResult } = require('../games/lib/match');

test('match: default and invalid bestOf fall back to a single game', () => {
  assert.strictEqual(createMatch().bestOf, 1);
  assert.strictEqual(createMatch(4).bestOf, 1);
  assert.strictEqual(createMatch('3').bestOf, 3);
});

test('match: single game ends after one result', () => {
  const m = recordResult(createMatch(1), 1);
  assert.deepStrictEqual([m.over, m.winner, m.wins], [true, 1, [0, 1]]);
});

test('match: best of 3 ends early at 2 wins', () => {
  const m = createMatch(3);
  recordResult(m, 0);
  assert.strictEqual(m.over, false);
  recordResult(m, 0);
  assert.deepStrictEqual([m.over, m.winner, m.played], [true, 0, 2]);
  recordResult(m, 1); // ignored once over
  assert.deepStrictEqual(m.wins, [2, 0]);
});

test('match: draws use up games and a level match is a draw', () => {
  const m = createMatch(3);
  recordResult(m, 0);
  recordResult(m, -1);
  recordResult(m, 1);
  assert.deepStrictEqual([m.over, m.winner, m.draws], [true, -1, 1]);
});
