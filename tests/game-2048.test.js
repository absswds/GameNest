const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('../games/lib/game2048');
const game2048 = require('../games/2048');
const bot2048 = require('../bots/2048');

function emptyGrid() {
  return [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
}

function makeState(playerCount) {
  const state = game2048.createState();
  game2048.initGame(state, playerCount || 2);
  return state;
}

// =====================================================================
// Pure lib functions
// =====================================================================

test('2048 lib: move left merges [2,2,0,0] -> [4,0,0,0] with score +4', () => {
  const g = emptyGrid();
  g[0] = [2, 2, 0, 0];
  const res = lib.move(g, 'left');
  assert.equal(res.changed, true);
  assert.equal(res.score, 4);
  assert.deepEqual(res.grid[0], [4, 0, 0, 0]);
});

test('2048 lib: move does not merge more than once per pair', () => {
  const g = emptyGrid();
  g[0] = [2, 2, 2, 2];
  const res = lib.move(g, 'left');
  // [2,2,2,2] -> merge first pair, merge second pair -> [4,4,0,0]
  assert.deepEqual(res.grid[0], [4, 4, 0, 0]);
  assert.equal(res.score, 8);
});

test('2048 lib: move right slides to the right edge', () => {
  const g = emptyGrid();
  g[0] = [2, 0, 2, 0];
  const res = lib.move(g, 'right');
  assert.deepEqual(res.grid[0], [0, 0, 0, 4]);
  assert.equal(res.score, 4);
});

test('2048 lib: move up slides toward the top edge', () => {
  const g = emptyGrid();
  g[0][0] = 2; g[2][0] = 2;
  const res = lib.move(g, 'up');
  assert.equal(res.grid[0][0], 4);
  assert.equal(res.grid[1][0], 0);
  assert.equal(res.score, 4);
});

test('2048 lib: move down slides toward the bottom edge', () => {
  const g = emptyGrid();
  g[0][0] = 2; g[2][0] = 2;
  const res = lib.move(g, 'down');
  assert.equal(res.grid[3][0], 4);
  assert.equal(res.grid[2][0], 0);
  assert.equal(res.score, 4);
});

test('2048 lib: move returns changed=false when nothing moves', () => {
  const g = emptyGrid();
  g[0] = [2, 4, 2, 4];
  const res = lib.move(g, 'left');
  assert.equal(res.changed, false);
  assert.equal(res.score, 0);
  assert.deepEqual(res.grid[0], [2, 4, 2, 4]);
});

test('2048 lib: spawn adds exactly one tile (2 or 4)', () => {
  const g = emptyGrid();
  const before = g.flat().filter(v => v !== 0).length;
  lib.spawn(g);
  const after = g.flat().filter(v => v !== 0).length;
  assert.equal(after, before + 1);
  // The spawned cell must be 2 or 4
  const vals = g.flat().filter(v => v !== 0);
  assert.ok(vals[0] === 2 || vals[0] === 4);
});

test('2048 lib: spawn on a full board is a no-op', () => {
  const g = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  lib.spawn(g);
  // No blank to fill -> board unchanged
  assert.deepEqual(g, [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
});

test('2048 lib: hasMove false on full non-mergeable board', () => {
  const g = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(lib.hasMove(g), false);
});

test('2048 lib: hasMove true when a blank exists', () => {
  const g = emptyGrid();
  assert.equal(lib.hasMove(g), true);
});

test('2048 lib: hasMove true when adjacent equal pair exists', () => {
  const g = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]];
  assert.equal(lib.hasMove(g), true);
});

test('2048 lib: maxTile returns the largest value', () => {
  const g = [[2, 4, 8, 16], [32, 64, 128, 256], [512, 1024, 2, 4], [8, 16, 32, 64]];
  assert.equal(lib.maxTile(g), 1024);
});

test('2048 lib: copy produces an independent clone', () => {
  const g = emptyGrid();
  g[0][0] = 2;
  const c = lib.copy(g);
  c[0][0] = 99;
  assert.equal(g[0][0], 2);
});

// =====================================================================
// Game module: initGame / createState / playerView
// =====================================================================

test('2048: initGame gives every player the same seed board', () => {
  const state = makeState(3);
  // seedBoard must be defined and equal to each player's starting board
  assert.ok(state.seedBoard);
  assert.deepEqual(state.boards[0], state.seedBoard);
  assert.deepEqual(state.boards[1], state.seedBoard);
  assert.deepEqual(state.boards[2], state.seedBoard);
  // But separate mutations must not alias
  state.boards[0][0][0] = 99;
  assert.notEqual(state.boards[1][0][0], 99);
});

test('2048: seed board starts with exactly 2 tiles', () => {
  const state = makeState(2);
  const tiles = state.seedBoard.flat().filter(v => v !== 0).length;
  assert.equal(tiles, 2);
});

test('2048: initGame sets up per-player arrays', () => {
  const state = makeState(2);
  assert.equal(state.boards.length, 2);
  assert.deepEqual(state.scores, [0, 0]);
  assert.deepEqual(state.alive, [true, true]);
  assert.equal(state.winner, null);
  assert.equal(state.currentPlayer, -1);
});

test('2048: playerView returns per-player slice + maxTile', () => {
  const state = makeState(2);
  state.boards[0][0][0] = 512;
  const view = game2048.playerView(state, 0);
  assert.deepEqual(view.board, state.boards[0]);
  assert.equal(view.score, 0);
  assert.equal(view.alive, true);
  assert.equal(view.winner, null);
  assert.equal(view.currentPlayer, -1);
  assert.equal(view.maxTile, 512);
});

// =====================================================================
// handleMove
// =====================================================================

test('2048: handleMove rejects move after winner', () => {
  const state = makeState(2);
  state.winner = 0;
  assert.equal(game2048.handleMove({ dir: 'left' }, state, 1), 'g_game_over');
});

test('2048: handleMove rejects move from a dead player', () => {
  const state = makeState(2);
  state.alive[1] = false;
  assert.equal(game2048.handleMove({ dir: 'left' }, state, 1), 'g2048_dead');
});

test('2048: handleMove rejects a move that changes nothing', () => {
  const state = makeState(2);
  // Row already packed left with distinct values -> left changes nothing
  state.boards[0] = [[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const err = game2048.handleMove({ dir: 'left' }, state, 0);
  assert.equal(err, 'g2048_no_move');
  // board must be unchanged (no mutation on rejected move)
  assert.deepEqual(state.boards[0][0], [2, 4, 8, 16]);
});

test('2048: handleMove applies move, adds score, spawns a tile', () => {
  const state = makeState(2);
  state.boards[0] = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const err = game2048.handleMove({ dir: 'left' }, state, 0);
  assert.equal(err, null);
  assert.equal(state.boards[0][0][0], 4);
  assert.equal(state.scores[0], 4);
  // After move+spawn there should be 2 tiles on the board (merged to 1, +1 spawn)
  const tiles = state.boards[0].flat().filter(v => v !== 0).length;
  assert.equal(tiles, 2);
});

test('2048: reaching 2048 sets winner and kills the player', () => {
  const state = makeState(2);
  state.boards[0] = [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const err = game2048.handleMove({ dir: 'left' }, state, 0);
  assert.equal(err, null);
  assert.equal(state.boards[0][0][0], 2048);
  assert.equal(state.winner, 0);
  assert.equal(state.alive[0], false);
});

test('2048: all-dead resolves to the highest score (unique)', () => {
  const state = makeState(2);
  // Player 0 already dead with a higher score.
  state.alive[0] = false;
  state.scores[0] = 200;
  // Player 1: one blank at (0,0); moving left slides, spawn fills (0,3).
  // Force spawn to place a 4 so the board locks into a dead checkerboard.
  state.boards[1] = [[0, 2, 4, 2], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  state.scores[1] = 100;
  const realRandom = Math.random;
  Math.random = () => 0.95; // >= 0.9 -> spawn a 4
  try {
    const err = game2048.handleMove({ dir: 'left' }, state, 1);
    assert.equal(err, null);
    assert.equal(state.alive[1], false);
    assert.equal(state.winner, 0); // player 0 has the highest score
  } finally {
    Math.random = realRandom;
  }
});

test('2048: all-dead resolves to -1 on a tie', () => {
  const state = makeState(2);
  state.alive[0] = false;
  state.scores[0] = 100;
  state.boards[1] = [[0, 2, 4, 2], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  state.scores[1] = 100;
  const realRandom = Math.random;
  Math.random = () => 0.95;
  try {
    const err = game2048.handleMove({ dir: 'left' }, state, 1);
    assert.equal(err, null);
    assert.equal(state.winner, -1); // tie
  } finally {
    Math.random = realRandom;
  }
});

test('2048: a player whose board locks (no 2048) simply dies', () => {
  const state = makeState(2);
  // Player 0 alive but locked dead board; player 1 still alive -> no winner yet.
  state.boards[0] = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  // A locked board has no legal move, so handleMove must reject (changed=false).
  const err = game2048.handleMove({ dir: 'left' }, state, 0);
  assert.equal(err, 'g2048_no_move');
  // Player 0 should NOT be marked dead by a rejected move; still alive, no winner.
  assert.equal(state.alive[0], true);
  assert.equal(state.winner, null);
});

// =====================================================================
// Bot
// =====================================================================

test('2048: bot only returns legal directions', () => {
  const bot = bot2048.createBot(0);
  const state = makeState(2);
  // Give a board where only some directions are legal.
  state.boards[0] = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]];
  const move = bot.getMove(state);
  assert.ok(move && (move.dir === 'up' || move.dir === 'down' || move.dir === 'left' || move.dir === 'right'));
  // Verify the chosen direction actually changes the board
  const res = lib.move(lib.copy(state.boards[0]), move.dir);
  assert.equal(res.changed, true);
});

test('2048: bot returns {pass:true} when no legal move', () => {
  const bot = bot2048.createBot(0);
  const state = makeState(2);
  state.boards[0] = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  const move = bot.getMove(state);
  assert.deepEqual(move, { pass: true });
});

test('2048: bot prefers a move that reaches 2048', () => {
  const bot = bot2048.createBot(0);
  const state = makeState(2);
  state.boards[0] = [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const move = bot.getMove(state);
  assert.equal(move.dir, 'left');
});

test('2048: bot getMove does not mutate player board', () => {
  const bot = bot2048.createBot(0);
  const state = makeState(2);
  state.boards[0] = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const before = JSON.stringify(state.boards[0]);
  bot.getMove(state);
  assert.deepEqual(JSON.stringify(state.boards[0]), before);
});

test('2048: a solo player who gets stuck without reaching 2048 loses', () => {
  const state = makeState(1);
  state.boards[0] = [[4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2], [4, 2, 4, 0]];
  const origRandom = Math.random;
  Math.random = () => 0; // the spawn is a 2 in the first empty cell, which locks the board
  try { assert.equal(game2048.handleMove({ dir: 'right' }, state, 0), null); } finally { Math.random = origRandom; }
  assert.equal(state.alive[0], false);
  assert.equal(state.winner, -2, 'a lone locked-up player must not be declared the winner');
});
