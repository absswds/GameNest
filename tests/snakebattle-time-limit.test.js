const test = require('node:test');
const assert = require('node:assert/strict');
const snake = require('../games/snakebattle');

function stateAtLimit() {
  const state = snake.createState();
  snake.initGame(state, 2);
  state.food = null;
  state.tick = snake.TIME_LIMIT_TICKS - 1;
  return state;
}

test('when time runs out the longest living snake wins', () => {
  const state = stateAtLimit();
  state.snakes[1].body.push({ ...state.snakes[1].body[2], x: state.snakes[1].body[2].x + 1 });
  snake.tick(state);
  assert.equal(state.winner, 1);
  assert.equal(state.endReason, 'time');
});

test('equal lengths at the time limit are a draw', () => {
  const state = stateAtLimit();
  snake.tick(state);
  assert.equal(state.winner, -1);
  assert.equal(state.endReason, 'time');
});

test('the game keeps running before the time limit', () => {
  const state = snake.createState();
  snake.initGame(state, 2);
  snake.tick(state);
  assert.equal(state.winner, null);
});
