const test = require('node:test');
const assert = require('node:assert/strict');

const battleship = require('../games/battleship');
const battleshipBot = require('../bots/battleship');

// Helper: create a fresh state
function freshState() {
  return battleship.createState();
}

// Helper: place all ships for a player using non-overlapping positions
function placeAllShips(state, playerIndex) {
  var sizes = state.shipSizes;
  // Place each ship on its own row to avoid overlap
  for (var i = 0; i < sizes.length; i++) {
    var err = battleship.handleMove(
      { r: i, c: 0, orientation: 'h', size: sizes[i] },
      state,
      playerIndex
    );
    assert.equal(err, null, 'Placement should succeed for ship ' + i);
  }
}

test('createState returns correct initial state', () => {
  var state = freshState();
  assert.equal(state.phase, 'placing');
  assert.equal(state.currentPlayer, 0);
  assert.equal(state.winner, null);
  assert.deepEqual(state.ships, [[], []]);
  assert.deepEqual(state.shots, [[], []]);
  assert.deepEqual(state.shipSizes, [5, 4, 3, 3, 2]);
  assert.deepEqual(state.placedCount, [0, 0]);
  assert.equal(state.lastShotResult, null);
  assert.equal(state._playerCount, 2);
});

test('placing a ship increments placedCount', () => {
  var state = freshState();
  var err = battleship.handleMove({ r: 0, c: 0, orientation: 'h', size: 5 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.placedCount[0], 1);
  assert.equal(state.ships[0].length, 1);
  assert.equal(state.ships[0][0].type, 'carrier');
  assert.equal(state.ships[0][0].cells.length, 5);
});

test('placing rejects wrong ship size', () => {
  var state = freshState();
  var err = battleship.handleMove({ r: 0, c: 0, orientation: 'h', size: 3 }, state, 0);
  assert.ok(err, 'Should reject wrong size');
});

test('placing rejects out-of-bounds', () => {
  var state = freshState();
  var err = battleship.handleMove({ r: 0, c: 8, orientation: 'h', size: 5 }, state, 0);
  assert.ok(err, 'Should reject out of bounds');
});

test('placing rejects overlapping ships', () => {
  var state = freshState();
  battleship.handleMove({ r: 0, c: 0, orientation: 'h', size: 5 }, state, 0);
  var err = battleship.handleMove({ r: 0, c: 3, orientation: 'h', size: 4 }, state, 0);
  assert.ok(err, 'Should reject overlapping');
});

test('placing rejects invalid player index', () => {
  var state = freshState();
  var err = battleship.handleMove({ r: 0, c: 0, orientation: 'h', size: 5 }, state, 5);
  assert.ok(err, 'Should reject invalid player');
});

test('both players placing all ships transitions to shooting', () => {
  var state = freshState();
  placeAllShips(state, 0);
  assert.equal(state.phase, 'placing');
  assert.equal(state.currentPlayer, 0);
  placeAllShips(state, 1);
  assert.equal(state.phase, 'shooting');
  assert.equal(state.currentPlayer, 0);
});

test('shooting a miss records correctly', () => {
  var state = freshState();
  placeAllShips(state, 0);
  placeAllShips(state, 1);
  // Player 0 shoots at (9,9) which should be empty (player 1's ships are at row 5)
  var err = battleship.handleMove({ r: 9, c: 9 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.shots[0].length, 1);
  assert.equal(state.shots[0][0].result, 'miss');
  assert.equal(state.currentPlayer, 1);
});

test('shooting a hit records correctly', () => {
  var state = freshState();
  placeAllShips(state, 0);
  placeAllShips(state, 1);
  // Player 1's ships are at rows 0-4 (helper places at rows i)
  // Player 0 shoots at (0,0) which has player 1's carrier
  var err = battleship.handleMove({ r: 0, c: 0 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.shots[0][0].result, 'hit');
  assert.equal(state.currentPlayer, 1);
});

test('shooting rejects already-shot cell', () => {
  var state = freshState();
  placeAllShips(state, 0);
  placeAllShips(state, 1);
  // Player 0 shoots at (9,9) - miss
  battleship.handleMove({ r: 9, c: 9 }, state, 0);
  // Player 0 tries to shoot same cell again - should reject
  var err = battleship.handleMove({ r: 9, c: 9 }, state, 0);
  assert.ok(err, 'Should reject already shot');
  // Player 1 can shoot (9,9) since it's their own shot record
  var err2 = battleship.handleMove({ r: 9, c: 9 }, state, 1);
  assert.equal(err2, null, 'Player 1 should be able to shoot same cell');
});

test('sinking a ship returns sunk result', () => {
  var state = freshState();
  // Place player 1's destroyer (size 2) at (5,0)-(5,1)
  // and all other ships elsewhere
  state.ships[1] = [
    { type: 'carrier', cells: [{ r: 9, c: 0, hit: false }, { r: 9, c: 1, hit: false }, { r: 9, c: 2, hit: false }, { r: 9, c: 3, hit: false }, { r: 9, c: 4, hit: false }] },
    { type: 'battleship', cells: [{ r: 8, c: 0, hit: false }, { r: 8, c: 1, hit: false }, { r: 8, c: 2, hit: false }, { r: 8, c: 3, hit: false }] },
    { type: 'cruiser', cells: [{ r: 7, c: 0, hit: false }, { r: 7, c: 1, hit: false }, { r: 7, c: 2, hit: false }] },
    { type: 'submarine', cells: [{ r: 6, c: 0, hit: false }, { r: 6, c: 1, hit: false }, { r: 6, c: 2, hit: false }] },
    { type: 'destroyer', cells: [{ r: 5, c: 0, hit: false }, { r: 5, c: 1, hit: false }] },
  ];
  state.placedCount = [5, 5];
  state.phase = 'shooting';
  state.currentPlayer = 0;

  // Hit first cell of destroyer
  battleship.handleMove({ r: 5, c: 0 }, state, 0);
  assert.equal(state.shots[0][0].result, 'hit');

  // Hit second cell → sunk
  state.currentPlayer = 0;
  battleship.handleMove({ r: 5, c: 1 }, state, 0);
  assert.equal(state.shots[0][1].result, 'sunk');
  assert.equal(state.shots[0][1].shipType, 'destroyer');
});

test('winning when all enemy ships sunk', () => {
  var state = freshState();
  // Minimal setup: give player 1 only 1 ship of size 1
  state.ships[1] = [
    { type: 'carrier', cells: [{ r: 0, c: 0, hit: false }] },
  ];
  state.ships[0] = [
    { type: 'carrier', cells: [{ r: 9, c: 0, hit: false }] },
  ];
  state.shipSizes = [1];
  state.placedCount = [1, 1];
  state.phase = 'shooting';
  state.currentPlayer = 0;

  var err = battleship.handleMove({ r: 0, c: 0 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.winner, 0);
  assert.equal(state.phase, 'over');
});

test('cannot move after game is over', () => {
  var state = freshState();
  state.winner = 0;
  state.phase = 'over';
  var err = battleship.handleMove({ r: 0, c: 0 }, state, 0);
  assert.ok(err, 'Should reject move after game over');
});

test('playerView hides enemy ship positions during game', () => {
  var state = freshState();
  placeAllShips(state, 0);
  placeAllShips(state, 1);
  var view = battleship.playerView(state, 0);
  // Enemy board should have no shipType info during game
  assert.equal(view.enemyBoard[5][0].shot, null);
  assert.equal(view.enemyBoard[5][0].shipType, null);
  // Should have myShips
  assert.equal(view.myShips.length, 5);
  // Should have myBoard
  assert.ok(view.myBoard);
});

test('playerView reveals ships after game over', () => {
  var state = freshState();
  state.ships[1] = [
    { type: 'carrier', cells: [{ r: 0, c: 0, hit: true }] },
  ];
  state.ships[0] = [
    { type: 'carrier', cells: [{ r: 9, c: 0, hit: false }] },
  ];
  state.shipSizes = [1];
  state.shots = [[{ r: 0, c: 0, result: 'sunk' }], []];
  state.phase = 'over';
  state.winner = 0;

  var view = battleship.playerView(state, 0);
  assert.equal(view.enemyBoard[0][0].shot, 'sunk');
  assert.equal(view.enemyBoard[0][0].shipType, 'carrier');
});

test('bot can place ships during placing phase', () => {
  var state = freshState();
  var bot = battleshipBot.createBot(0);
  var move = bot.getMove(state);
  assert.ok(typeof move.r === 'number');
  assert.ok(typeof move.c === 'number');
  assert.ok(move.orientation === 'h' || move.orientation === 'v');
  assert.equal(move.size, 5);
});

test('bot can make shooting move', () => {
  var state = freshState();
  placeAllShips(state, 0);
  placeAllShips(state, 1);
  var bot = battleshipBot.createBot(0);
  var move = bot.getMove(state);
  assert.ok(typeof move.r === 'number');
  assert.ok(typeof move.c === 'number');
  assert.ok(move.r >= 0 && move.r < 10);
  assert.ok(move.c >= 0 && move.c < 10);
});

test('bot does not mutate state', () => {
  var state = freshState();
  placeAllShips(state, 0);
  placeAllShips(state, 1);
  var bot = battleshipBot.createBot(0);
  var before = JSON.stringify(state);
  bot.getMove(state);
  var after = JSON.stringify(state);
  assert.equal(before, after);
});
