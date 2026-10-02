const test = require('node:test');
const assert = require('node:assert');

test('gomoku: six in a row still wins, full board is a draw', () => {
  const gomoku = require('../games/gomoku');
  const s = gomoku.createState();
  if (gomoku.initGame) gomoku.initGame(s, 2);
  for (const c of [0, 1, 2, 4, 5]) s.board[0][c] = 0;
  assert.strictEqual(gomoku.handleMove({ row: 0, col: 3 }, s, 0), null);
  assert.strictEqual(s.winner, 0);

  const d = gomoku.createState();
  if (gomoku.initGame) gomoku.initGame(d, 2);
  // checkerboard pairs: no five-in-row anywhere, leave one cell for the last move
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) d.board[r][c] = (Math.floor(c / 2) + r) % 2;
  d.board[14][14] = null;
  d.currentPlayer = 0;
  d.board[14][13] = 1;
  assert.strictEqual(gomoku.handleMove({ row: 14, col: 14 }, d, 0), null);
  assert.strictEqual(d.winner, -1);
});

test('uno: playing a +4 as the last card wins immediately', () => {
  const uno = require('../games/uno');
  const s = uno.createState();
  uno.initGame(s, 2);
  s.hands[0] = [{ color: 'wild', value: '+4', id: '+4-0' }];
  s.unoCalled[0] = true;
  s.currentPlayer = 0;
  assert.strictEqual(uno.handleMove({ cardId: '+4-0', chosenColor: 'red' }, s, 0), null);
  assert.strictEqual(s.winner, 0);
});

test('exploding kittens: skip ends only one of two owed turns', () => {
  const ek = require('../games/exploding-kittens');
  const s = ek.createState();
  ek.initGame(s, 3);
  s.hands[0].push({ type: 'skip', id: 'skip-t' });
  s.currentPlayer = 0; s.extraTurns[0] = 1; s.phase = 'play';
  assert.strictEqual(ek.handleMove({ cardId: 'skip-t' }, s, 0), null);
  assert.strictEqual(s.currentPlayer, 0);
  assert.strictEqual(s.extraTurns[0], 0);
});

test('rummikub: two jokers and a number form a valid run; stalemate goes to the lowest rack', () => {
  const rk = require('../games/rummikub');
  const s = rk.createState();
  rk.initGame(s, 2);
  s.pool = [];
  s.table = [];
  s.hasBroken = [true, true];
  s.hands[0] = [{ color: 'red', num: 5, id: 'r5' }, { color: 'joker', num: 0, id: 'j0', wild: true }, { color: 'joker', num: 0, id: 'j1', wild: true }, { color: 'blue', num: 13, id: 'b13' }];
  s.hands[1] = [{ color: 'blue', num: 1, id: 'b1' }, { color: 'red', num: 2, id: 'r2' }];
  assert.strictEqual(rk.handleMove({ tileIds: ['r5', 'j0', 'j1'] }, s, 0), null);
  s.currentPlayer = 0; s.playedThisTurn[0] = false;
  assert.strictEqual(rk.handleMove({ pass: true }, s, 0), null);
  assert.strictEqual(rk.handleMove({ pass: true }, s, 1), null);
  assert.strictEqual(s.winner, 1);
});

test('davinci: revealing your last hidden tile as a penalty eliminates you', () => {
  const dv = require('../games/davinci');
  const s = dv.createState();
  dv.initGame(s, 3);
  s.phase = 'penalty'; s.penaltyPlayer = 0; s.currentPlayer = 0; s.drawnTile = null;
  s.numRevealed[0] = s.numRevealed[0].map((_, i, a) => i !== 0);
  assert.strictEqual(dv.handleMove({ revealIndex: 0 }, s, 0), null);
  assert.strictEqual(s.eliminated[0], true);
});

test('minesweeper: the first reveal of a game is never a mine', () => {
  const ms = require('../games/minesweeper');
  for (let i = 0; i < 30; i++) {
    const s = ms.createState();
    ms.initGame(s, 1);
    s.mines.forEach((row) => row.fill(true)); // worst case: mines everywhere...
    s.mines[0][0] = false; s.mines[0][1] = false; // ...except two safe cells
    assert.strictEqual(ms.handleMove({ action: 'reveal', row: 5, col: 5 }, s, 0), null);
    assert.strictEqual(s.alive[0], true);
  }
});
