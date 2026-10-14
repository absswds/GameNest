const test = require('node:test');
const assert = require('node:assert/strict');
const go9 = require('../games/go9');
const bot = require('../bots/go9');

function fresh() { const s = go9.createState(); go9.initGame(s, 2); return s; }
function toScoring(s) {
  assert.equal(go9.handleMove({ pass: true }, s, s.currentPlayer), null);
  assert.equal(go9.handleMove({ pass: true }, s, s.currentPlayer), null);
}
// Black wall on col 3, white wall on col 5; one dead white stone at (4,1) inside black's side.
function territoryBoard(s) {
  for (let r = 0; r < 9; r++) { s.board[r][3] = 1; s.board[r][5] = 2; }
  s.board[4][1] = 2;
}

test('go9: two passes enter scoring instead of finishing', () => {
  const s = fresh();
  toScoring(s);
  assert.equal(s.winner, null);
  assert.equal(s.phase, 'scoring');
  assert.equal(s.moveHistory.filter(m => m.pass).length, 2);
  assert.notEqual(go9.handleMove({ pass: true }, s, s.currentPlayer), null);
  assert.notEqual(go9.handleMove({ row: 0, col: 0 }, s, s.currentPlayer), null);
});

test('go9: mark toggles whole group and clears acceptance', () => {
  const s = fresh();
  s.board[0][0] = 2; s.board[0][1] = 2; s.board[8][8] = 1;
  toScoring(s);
  assert.equal(go9.handleMove({ type: 'accept' }, s, s.currentPlayer), null);
  assert.equal(s.accepted.filter(Boolean).length, 1);
  assert.equal(go9.handleMove({ type: 'mark', row: 0, col: 1 }, s, 0), null);
  assert.equal(s.deadMarks.length, 2);
  assert.deepEqual(s.accepted, [false, false]);
  assert.equal(go9.handleMove({ type: 'mark', row: 0, col: 0 }, s, 1), null);
  assert.equal(s.deadMarks.length, 0);
  assert.equal(go9.handleMove({ type: 'mark', row: 5, col: 5 }, s, 0), 'go_mark_empty');
  assert.equal(go9.handleMove({ type: 'mark', row: 'x', col: 5 }, s, 0), 'g_invalid_action');
});

test('go9: both accept removes dead stones and scores the territory', () => {
  const s = fresh();
  territoryBoard(s);
  toScoring(s);
  go9.handleMove({ type: 'mark', row: 4, col: 1 }, s, 0);
  go9.handleMove({ type: 'accept' }, s, s.currentPlayer);
  assert.equal(s.winner, null);
  go9.handleMove({ type: 'accept' }, s, s.currentPlayer);
  assert.notEqual(s.winner, null);
  assert.equal(s.board[4][1], 0);
  assert.equal(s.captures[0], 1);
  // black: wall 9 + cols 0-2 (27) - 7.5 = 28.5; white: wall 9 + cols 6-8 (27) = 36; col 4 is neutral
  assert.equal(s.finalScores.black, 28.5);
  assert.equal(s.finalScores.white, 36);
  assert.equal(s.winner, 1);
});

test('go9: without marking, the dead stone spoils the region (baseline)', () => {
  const s = fresh();
  territoryBoard(s);
  toScoring(s);
  go9.handleMove({ type: 'accept' }, s, s.currentPlayer);
  go9.handleMove({ type: 'accept' }, s, s.currentPlayer);
  assert.equal(s.finalScores.black, 9 - 7.5);
});

test('go9: resume returns to play, opponent of resumer moves next', () => {
  const s = fresh();
  toScoring(s);
  go9.handleMove({ type: 'resume' }, s, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.consecutivePasses, 0);
  assert.equal(s.currentPlayer, 0);
  assert.equal(go9.handleMove({ type: 'accept' }, s, 0), 'go_not_scoring');
  assert.equal(go9.handleMove({ row: 4, col: 4 }, s, 0), null);
  toScoring(s);
  assert.equal(s.phase, 'scoring');
});

test('go9 bot: accepts in scoring without mutating state', () => {
  const s = fresh();
  toScoring(s);
  const snap = JSON.stringify(s);
  assert.deepEqual(bot.createBot(s.currentPlayer).getMove(s), { type: 'accept' });
  assert.equal(JSON.stringify(s), snap);
});

test('go9: human vs bot finishes (human accept, then bot accepts)', () => {
  const s = fresh();
  const b = bot.createBot(1);
  go9.handleMove({ pass: true }, s, 0);
  go9.handleMove({ pass: true }, s, 1);
  assert.equal(s.currentPlayer, 0);
  assert.equal(go9.handleMove({ type: 'accept' }, s, 0), null);
  assert.equal(s.currentPlayer, 1);
  assert.equal(go9.handleMove(b.getMove(s), s, 1), null);
  assert.notEqual(s.winner, null);
});

test('go9: bot-vs-bot games finish through currentPlayer scheduling', () => {
  for (let g = 0; g < 5; g++) {
    const s = fresh();
    const bots = [bot.createBot(0), bot.createBot(1)];
    for (let i = 0; i < 3000 && s.winner === null; i++) {
      const p = s.currentPlayer;
      assert.equal(go9.handleMove(bots[p].getMove(s, p), s, p), null);
    }
    assert.notEqual(s.winner, null);
  }
});
