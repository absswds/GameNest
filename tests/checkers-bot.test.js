const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../games/checkers');
const bot = require('../bots/checkers');

const dec = (rows) => rows.map((row) => [...row].map((ch) => ch === '.' ? null
  : { side: ch === 'r' || ch === 'R' ? 0 : 1, type: ch === 'R' || ch === 'B' ? 'k' : 'm' }));

function hardMove(rows, side) {
  const state = game.createState();
  game.initGame(state);
  state.board = dec(rows);
  state.currentPlayer = side;
  state._options = { difficulty: 'hard' };
  return bot.createBot(side).getMove(state);
}

// Regression: the old search ignored promotion/multi-jump continuation, and its hard tier (depth 7)
// chose (5,2)->(4,1) here, a move that loses by force. Hard must avoid it.
test('checkers hard bot avoids a forced-loss move', () => {
  const rows = ['.......b', 'b.b...b.', '.......b', 'b.......', '.....b..', 'r.r.....', '...r.r.r', '....r...'];
  const m = hardMove(rows, 0);
  assert.ok(!(m.from.row === 5 && m.from.col === 2 && m.to.row === 4 && m.to.col === 1), 'must not play (5,2)->(4,1)');
});

test('checkers bot continues a multi-jump with the same piece', () => {
  // red man at (5,2) jumped to (3,4)... state says it must continue from (3,4) over (2,3)->(1,2)
  const state = game.createState();
  game.initGame(state);
  state.board = dec(['........', '........', '...b....', '....r...', '........', '........', '........', '........']);
  state.currentPlayer = 0;
  state.mustCapture = true;
  state._lastCaptureRow = 3; state._lastCaptureCol = 4;
  state._options = { difficulty: 'hard' };
  const m = bot.createBot(0).getMove(state);
  assert.deepEqual(m, { from: { row: 3, col: 4 }, to: { row: 1, col: 2 } });
});
