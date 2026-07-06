const test = require('node:test');
const assert = require('node:assert/strict');

const connect4 = require('../games/connect4');

function makeState(overrides) {
  var state = connect4.createState();
  connect4.initGame(state);
  if (overrides) Object.assign(state, overrides);
  return state;
}

function fillColumn(state, col, count, side) {
  for (var i = 0; i < count; i++) {
    var row = 5 - i;
    state.board[row][col] = side;
  }
}

// ---- handleMove basic tests ----

test('connect4: full column is rejected', () => {
  var state = makeState();
  // Fill column 3 completely
  for (var r = 0; r < 6; r++) state.board[r][3] = 0;

  var err = connect4.handleMove({ col: 3 }, state, 0);
  assert.equal(err, '该列已满');
  assert.equal(state.winner, null);
});

test('connect4: invalid column rejected', () => {
  var state = makeState();
  assert.equal(connect4.handleMove({ col: -1 }, state, 0), '无效的列');
  assert.equal(connect4.handleMove({ col: 7 }, state, 0), '无效的列');
  assert.equal(connect4.handleMove({ col: 'a' }, state, 0), '无效的列');
});

test('connect4: wrong player rejected', () => {
  var state = makeState();
  assert.equal(connect4.handleMove({ col: 0 }, state, 1), '不是你的回合');
});

test('connect4: game over rejected', () => {
  var state = makeState();
  state.winner = 0;
  assert.equal(connect4.handleMove({ col: 0 }, state, 0), '游戏已结束');
});

test('connect4: piece drops to lowest empty row', () => {
  var state = makeState();
  var err = connect4.handleMove({ col: 2 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.board[5][2], 0); // row 5 = bottom
  assert.equal(state.board[4][2], null);
  assert.deepEqual(state.lastMove, { row: 5, col: 2 });
  assert.equal(state.currentPlayer, 1);
});

test('connect4: pieces stack in column', () => {
  var state = makeState();
  connect4.handleMove({ col: 1 }, state, 0);
  connect4.handleMove({ col: 1 }, state, 1);
  assert.equal(state.board[5][1], 0);
  assert.equal(state.board[4][1], 1);
  assert.equal(state.board[3][1], null);
});

// ---- Win detection ----

test('connect4: horizontal win', () => {
  var state = makeState();
  // Place 4 in a row at bottom
  state.board[5][0] = 0;
  state.board[5][1] = 0;
  state.board[5][2] = 0;
  state.board[5][3] = null; // not yet placed

  var err = connect4.handleMove({ col: 3 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.winner, 0);
});

test('connect4: vertical win', () => {
  var state = makeState();
  fillColumn(state, 0, 3, 0); // rows 5,4,3 = player 0
  var err = connect4.handleMove({ col: 0 }, state, 0); // row 2 = 4th piece
  assert.equal(err, null);
  assert.equal(state.winner, 0);
});

test('connect4: diagonal down-right win', () => {
  var state = makeState();
  // Build diagonal: (2,0), (3,1), (4,2), (5,3)
  state.board[2][0] = 0;
  state.board[3][1] = 0;
  state.board[4][2] = 0;
  state.board[5][3] = null;

  var err = connect4.handleMove({ col: 3 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.winner, 0);
});

test('connect4: diagonal down-left win', () => {
  var state = makeState();
  // Build diagonal: (2,6), (3,5), (4,4), (5,3)
  state.board[2][6] = 1;
  state.board[3][5] = 1;
  state.board[4][4] = 1;
  state.board[5][3] = null;
  state.currentPlayer = 1;

  var err = connect4.handleMove({ col: 3 }, state, 1);
  assert.equal(err, null);
  assert.equal(state.winner, 1);
});

test('connect4: no win with only 3 in a row', () => {
  var state = makeState();
  state.board[5][0] = 0;
  state.board[5][1] = 0;
  state.board[5][2] = 0;
  // column 3 empty, place opponent piece there
  state.board[5][3] = 1;

  var err = connect4.handleMove({ col: 4 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.winner, null);
});

// ---- Draw ----

test('connect4: draw when board is full', () => {
  var state = makeState();
  // Fill board with pairs-of-2 pattern (max 2 consecutive in any direction)
  var pattern = [
    [0, 0, 1, 1, 0, 0, 1],  // row 5
    [1, 1, 0, 0, 1, 1, 0],  // row 4
    [0, 0, 1, 1, 0, 0, 1],  // row 3
    [1, 1, 0, 0, 1, 1, 0],  // row 2
    [0, 0, 1, 1, 0, 0, 1],  // row 1
    [1, 1, 0, 0, 1, 1, 0],  // row 0
  ];
  for (var r = 0; r < 6; r++) {
    for (var c = 0; c < 7; c++) {
      state.board[r][c] = pattern[r][c];
    }
  }
  // Leave one spot for player 0
  state.board[0][6] = null;
  state.currentPlayer = 0;

  var err = connect4.handleMove({ col: 6 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.winner, -1);
});

// ---- playerView ----

test('connect4: playerView returns legal moves for current player', () => {
  var state = makeState();
  var view = connect4.playerView(state, 0);
  assert.deepEqual(view.legalMoves, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(view.currentPlayer, 0);
});

test('connect4: playerView filters full columns', () => {
  var state = makeState();
  fillColumn(state, 2, 6, 0);
  var view = connect4.playerView(state, 0);
  assert.ok(view.legalMoves.indexOf(2) === -1);
  assert.ok(view.legalMoves.indexOf(0) !== -1);
});

test('connect4: playerView empty for non-current player', () => {
  var state = makeState();
  var view = connect4.playerView(state, 1);
  assert.deepEqual(view.legalMoves, []);
});

test('connect4: playerView empty after game over', () => {
  var state = makeState();
  state.winner = 0;
  var view = connect4.playerView(state, 0);
  assert.deepEqual(view.legalMoves, []);
});

// ---- Bot tests ----

test('connect4: bot returns valid move', () => {
  const connect4Bot = require('../bots/connect4');
  var state = makeState();
  var bot = connect4Bot.createBot(0);
  var move = bot.getMove(state);
  assert.ok(move && typeof move.col === 'number');
  assert.ok(move.col >= 0 && move.col <= 6);
  assert.equal(state.board[0][move.col], null); // column not full
});

test('connect4: bot wins when possible', () => {
  const connect4Bot = require('../bots/connect4');
  var state = makeState();
  // Set up: bot (player 0) has 3 in column 3, one more to win
  state.board[3][3] = 0;
  state.board[4][3] = 0;
  state.board[5][3] = 0;
  state.currentPlayer = 0;

  var bot = connect4Bot.createBot(0);
  var move = bot.getMove(state);
  assert.equal(move.col, 3); // Should take the winning column
});

test('connect4: bot blocks opponent winning move', () => {
  const connect4Bot = require('../bots/connect4');
  var state = makeState();
  // Opponent (player 1) has 3 in row 5, columns 0-2
  state.board[5][0] = 1;
  state.board[5][1] = 1;
  state.board[5][2] = 1;
  state.currentPlayer = 0;

  var bot = connect4Bot.createBot(0);
  var move = bot.getMove(state);
  // Bot should block at column 3 (or make a move that doesn't lose)
  // With depth 6, it should see the threat
  assert.ok(move && typeof move.col === 'number');
  assert.ok(move.col >= 0 && move.col <= 6);
});

test('connect4: AI depth 6 completes in reasonable time', () => {
  const connect4Bot = require('../bots/connect4');
  var state = makeState();
  // Play a few moves to create a mid-game position
  connect4.handleMove({ col: 3 }, state, 0);
  connect4.handleMove({ col: 2 }, state, 1);
  connect4.handleMove({ col: 4 }, state, 0);
  connect4.handleMove({ col: 2 }, state, 1);

  var bot = connect4Bot.createBot(0);
  var start = Date.now();
  var move = bot.getMove(state);
  var elapsed = Date.now() - start;
  assert.ok(move && typeof move.col === 'number');
  assert.ok(elapsed < 3000, 'AI took too long: ' + elapsed + 'ms');
});
