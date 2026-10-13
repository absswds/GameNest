// tests/davinci.test.js — Da Vinci Code redesigned rules (color public, guess number only)
// Run: node tests/davinci.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const davinci = require('../games/davinci');

// Helper: create a state forced into 'guess' phase for move testing
function makeGuessState(playerCount, tileSetup) {
  const state = davinci.createState();
  state.playerCount = playerCount;
  state.tiles = [];
  state.numRevealed = [];
  state.eliminated = Array(playerCount).fill(false);
  for (let i = 0; i < playerCount; i++) {
    state.tiles[i] = tileSetup(i);
    state.numRevealed[i] = state.tiles[i].map(() => false);
  }
  state.pool = [];
  state.currentPlayer = 0;
  state.phase = 'guess';
  state.drawnTile = null;
  state.penaltyPlayer = null;
  state.winner = null;
  state.lastGuessResult = null;
  state.initJokerQueue = [];
  return state;
}

function tile(color, num, id) {
  var isWild = (color === 'joker');
  return { color: isWild ? 'black' : color, num, id: id || (color[0] + num), wild: isWild };
}

// ---- Card count (real rules: 2-3p→4 tiles, 4p→3 tiles) ----

test('davinci: 2 players get 4 tiles each', () => {
  const state = davinci.createState();
  davinci.initGame(state, 2);
  assert.equal(state.tiles[0].length, 4);
  assert.equal(state.tiles[1].length, 4);
});

test('davinci: 3 players get 4 tiles each', () => {
  const state = davinci.createState();
  davinci.initGame(state, 3);
  for (let i = 0; i < 3; i++) assert.equal(state.tiles[i].length, 4);
});

test('davinci: 4 players get 3 tiles each', () => {
  const state = davinci.createState();
  davinci.initGame(state, 4);
  for (let i = 0; i < 4; i++) assert.equal(state.tiles[i].length, 3);
});

// ---- playerView: color public, number hidden ----

test('davinci: playerView preserves color for opponent tiles', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  const view = davinci.playerView(state, 0);
  // Opponent (player 1) tile color must be visible
  assert.equal(view.tiles[1][0].color, 'black');
  assert.equal(view.tiles[1][1].color, 'white');
});

test('davinci: playerView hides number for opponent tiles', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  const view = davinci.playerView(state, 0);
  assert.equal(view.tiles[1][0].num, null, 'opponent tile number should be hidden');
  assert.equal(view.tiles[1][1].num, null);
});

test('davinci: playerView shows number for own tiles', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  const view = davinci.playerView(state, 0);
  assert.equal(view.tiles[0][0].num, 3);
  assert.equal(view.tiles[0][1].num, 7);
});

test('davinci: playerView shows number when numRevealed is true', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.numRevealed[1][0] = true;
  const view = davinci.playerView(state, 0);
  assert.equal(view.tiles[1][0].num, 3, 'revealed number should be visible');
  assert.equal(view.tiles[1][1].num, null, 'unrevealed stays hidden');
});

// ---- Guess by number only ----

test('davinci: correct number guess without continueGuess ends turn', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[1][0], true);
  assert.equal(state.lastGuessResult.correct, true);
  assert.equal(state.phase, 'draw', 'without continueGuess, turn advances');
});

test('davinci: correct number guess with continueGuess keeps turn', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5, continueGuess: true }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[1][0], true);
  assert.equal(state.phase, 'guess', 'with continueGuess, turn stays in guess phase');
  assert.equal(state.currentPlayer, 0, 'same player continues');
});

test('davinci: wrong number guess returns null (broadcast) and does not reveal', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 4 }, state, 0);
  assert.equal(err, null, 'wrong guess should return null so server broadcasts');
  assert.equal(state.numRevealed[1][0], false);
  assert.equal(state.lastGuessResult.correct, false, 'feedback shows wrong');
  assert.equal(state.phase, 'penalty', 'wrong guess enters penalty phase');
  assert.equal(state.penaltyPlayer, 0, 'guesser must reveal a tile');
});

test('davinci: guessJoker correct on joker tile', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('joker', -1);
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessJoker: true }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[1][0], true);
});

test('davinci: guessNumber on joker tile is wrong', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('joker', -1);
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5 }, state, 0);
  assert.equal(err, null, 'wrong guess returns null so server broadcasts');
  assert.equal(state.numRevealed[1][0], false);
  assert.equal(state.lastGuessResult.correct, false);
  assert.equal(state.phase, 'penalty', 'wrong guess enters penalty phase');
  assert.equal(state.penaltyPlayer, 0, 'guesser must reveal a tile');
});

test('davinci: penalty phase — guesser reveals a tile then turn advances', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  // Wrong guess
  davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 4 }, state, 0);
  assert.equal(state.phase, 'penalty');
  // Guesser reveals their own tile at index 0
  const err = davinci.handleMove({ revealIndex: 0 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[0][0], true, 'revealed tile should be true');
  assert.equal(state.phase, 'draw', 'after penalty, turn advances to draw');
  assert.equal(state.currentPlayer, 1, 'next player\'s turn');
});

test('davinci: cannot guess own tiles', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  const err = davinci.handleMove({ targetPlayer: 0, tileIndex: 0, guessNum: 3 }, state, 0);
  assert.equal(err, 'dv_cannot_guess_own');
});

test('davinci: cannot guess already revealed tile', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  state.numRevealed[1][0] = true;
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5 }, state, 0);
  assert.equal(err, 'dv_card_already_revealed');
});

// ---- sortTiles: same number black before white, jokers last ----

test('davinci: correct guess increments guessCount', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  state.guessCount = [0, 0];
  davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5, continueGuess: true }, state, 0);
  assert.equal(state.guessCount[1], 1, 'target guessCount should increment');
  assert.equal(state.lastGuessResult.numRevealedCnt, 1);
});

test('davinci: eliminating last opponent ends game automatically', () => {
  // P1 has only 1 tile left unrevealed; guessing it should end the game
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1] = [tile('black', 5)];          // P1 has only 1 tile
  state.numRevealed[1] = [false];
  state.eliminated = [false, false];
  const err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5, continueGuess: true }, state, 0);
  assert.equal(err, null);
  assert.equal(state.winner, 0, 'P0 should win after eliminating P1');
  assert.equal(state.phase, 'over');
});

test('davinci: playerView hides drawnTile from non-current players', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.drawnTile = { color: 'black', num: 5, id: 'b5' };
  state.currentPlayer = 0;
  const view0 = davinci.playerView(state, 0);
  const view1 = davinci.playerView(state, 1);
  assert.ok(view0.drawnTile, 'current player should see drawnTile');
  assert.equal(view1.drawnTile, null, 'non-current player should NOT see drawnTile');
});

test('davinci: playerView exposes guessCount for status display', () => {
  const state = makeGuessState(2, () => [tile('black', 3), tile('white', 7)]);
  state.tiles[1][0] = tile('black', 5);
  state.guessCount = [0, 0];
  davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 5, continueGuess: true }, state, 0);
  const view = davinci.playerView(state, 1);
  assert.deepEqual(view.guessCount, [0, 1], 'playerView should expose guessCount array');
});

test('davinci: jokers have black/white color (opponents cannot identify them)', () => {
  // Run multiple times since jokers are shuffled
  let foundBlack = false, foundWhite = false;
  for (let trial = 0; trial < 50; trial++) {
    const state = davinci.createState();
    davinci.initGame(state, 2);
    for (const tile of state.tiles[0]) {
      if (tile.wild && tile.color === 'black') foundBlack = true;
      if (tile.wild && tile.color === 'white') foundWhite = true;
    }
  }
  assert.ok(foundBlack, 'should find a black joker');
  assert.ok(foundWhite, 'should find a white joker');
});

test('davinci: sortTiles puts black before white for same number', () => {
  const tiles = [tile('white', 5, 'w5'), tile('black', 5, 'b5'), tile('black', 3, 'b3')];
  davinci.sortTiles(tiles);
  assert.equal(tiles[0].id, 'b3');
  assert.equal(tiles[1].id, 'b5');
  assert.equal(tiles[2].id, 'w5');
});

test('davinci: sortTiles puts jokers at the end', () => {
  const tiles = [tile('joker', -1, 'j1'), tile('black', 2, 'b2'), tile('white', 9, 'w9')];
  davinci.sortTiles(tiles);
  assert.equal(tiles[0].id, 'b2');
  assert.equal(tiles[1].id, 'w9');
  assert.equal(tiles[2].id, 'j1');
});

// ---- Full game simulation: 2-player game from init to win ----
test('davinci: full game — P0 eliminates P1 and wins', () => {
  // Set up a controlled 2-player game with no jokers
  const state = makeGuessState(2, () => []);
  state.tiles[0] = [tile('white', 1, 'w1'), tile('black', 2, 'b2')];
  state.tiles[1] = [tile('white', 3, 'w3'), tile('black', 4, 'b4')];
  state.numRevealed[0] = [false, false];
  state.numRevealed[1] = [false, false];
  state.guessCount = [0, 0];
  state.currentPlayer = 0;
  state.phase = 'guess';
  state.drawnTile = null;

  // P0 guesses P1's first tile correctly (w3)
  let err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 3, continueGuess: true }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[1][0], true, 'P1 tile 0 revealed');
  assert.equal(state.phase, 'guess', 'P0 can continue guessing');

  // P0 guesses P1's second tile correctly (b4) — eliminates P1
  err = davinci.handleMove({ targetPlayer: 1, tileIndex: 1, guessNum: 4, continueGuess: true }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[1][1], true, 'P1 tile 1 revealed');
  assert.equal(state.eliminated[1], true, 'P1 eliminated');
  assert.equal(state.winner, 0, 'P0 wins');
  assert.equal(state.phase, 'over');
});

test('davinci: full game — wrong guess triggers penalty, then turn advances', () => {
  const state = makeGuessState(2, () => []);
  state.tiles[0] = [tile('white', 1, 'w1'), tile('black', 2, 'b2')];
  state.tiles[1] = [tile('white', 3, 'w3'), tile('black', 4, 'b4')];
  state.numRevealed[0] = [false, false];
  state.numRevealed[1] = [false, false];
  state.guessCount = [0, 0];
  state.currentPlayer = 0;
  state.phase = 'guess';
  state.drawnTile = null;

  // P0 guesses wrong (guesses 9 but it's 3)
  let err = davinci.handleMove({ targetPlayer: 1, tileIndex: 0, guessNum: 9 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.phase, 'penalty', 'enters penalty phase');
  assert.equal(state.penaltyPlayer, 0, 'P0 must reveal');

  // P0 reveals their own tile at index 1
  err = davinci.handleMove({ revealIndex: 1 }, state, 0);
  assert.equal(err, null);
  assert.equal(state.numRevealed[0][1], true, 'P0 tile 1 revealed');
  assert.equal(state.phase, 'draw', 'turn advances to draw');
  assert.equal(state.currentPlayer, 1, 'P1\'s turn');
});

test('davinci: pass before any correct guess this turn is refused', () => {
  const state = makeGuessState(2, () => []);
  state.tiles[0] = [tile('white', 1, 'w1')];
  state.tiles[1] = [tile('white', 3, 'w3')];
  state.numRevealed[0] = [false];
  state.numRevealed[1] = [false];
  state.currentPlayer = 0;
  state.phase = 'guess';
  state.guessedThisTurn = false;
  assert.equal(davinci.handleMove({ pass: true }, state, 0), 'dv_must_guess_first');
});

test('davinci: full game — pass places drawn tile hidden and advances turn', () => {
  const state = makeGuessState(2, () => []);
  state.tiles[0] = [tile('white', 1, 'w1')];
  state.tiles[1] = [tile('white', 3, 'w3')];
  state.numRevealed[0] = [false];
  state.numRevealed[1] = [false];
  state.guessCount = [0, 0];
  state.currentPlayer = 0;
  state.phase = 'guess';
  state.drawnTile = { color: 'black', num: 7, id: 'b7' };
  state.guessedThisTurn = true;

  // P0 passes after a correct guess earlier this turn
  let err = davinci.handleMove({ pass: true }, state, 0);
  assert.equal(err, null);
  assert.equal(state.tiles[0].length, 2, 'drawn tile added to hand');
  assert.equal(state.numRevealed[0][1], false, 'drawn tile stays hidden');
  assert.equal(state.drawnTile, null, 'drawnTile cleared');
  assert.equal(state.currentPlayer, 1, 'turn advances to P1');
  assert.equal(state.phase, 'draw');
});
