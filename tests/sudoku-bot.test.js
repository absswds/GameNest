const test = require('node:test');
const assert = require('node:assert/strict');

const game = require('../games/sudoku');
const bot = require('../bots/sudoku');

function newGame(difficulty) {
  const state = game.createState();
  game.initGame(state, 2);
  state._options = { difficulty };
  return state;
}

test('sudoku hard bot always fills a correct value', () => {
  const state = newGame('hard');
  const b = bot.createBot(0);
  for (let i = 0; i < 20; i++) {
    const mv = b.getMove(state);
    assert.equal(mv.type, 'fill');
    assert.equal(mv.val, state.solution[mv.row][mv.col]);
    assert.equal(game.handleMove(mv, state, 0), null);
  }
});

test('sudoku hard bot candidate count uses real digits of filled cells', () => {
  const state = newGame('hard');
  const b = bot.createBot(0);
  // Fill most of the board for seat 0 so candidate counting matters; the bot must still play correctly.
  for (let i = 0; i < 40; i++) game.handleMove(b.getMove(state), state, 0);
  const mv = b.getMove(state);
  assert.equal(mv.val, state.solution[mv.row][mv.col]);
});

test('sudoku easy bot rarely gets eliminated over a whole puzzle', () => {
  let survived = 0;
  for (let g = 0; g < 20; g++) {
    const state = newGame('easy');
    const b = bot.createBot(0);
    let steps = 0;
    while (state.winner === null && !state.eliminated[0] && steps++ < 500) {
      game.handleMove(b.getMove(state), state, 0);
    }
    if (!state.eliminated[0]) survived++;
  }
  assert.ok(survived >= 15, `survived ${survived}/20`);
});
