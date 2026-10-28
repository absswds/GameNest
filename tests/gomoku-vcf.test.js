const test = require('node:test');
const assert = require('node:assert/strict');
const gomokuBot = require('../bots/gomoku');

function emptyBoard() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

// Hand-built 3-step VCF for player 0:
// Step 1: (7, 7) makes a closed four on row 7 [(7,4)..(7,7)] -> forces player 1 to block at (7, 8)
// Step 2: (10, 7) makes a closed four on col 7 [(7,7)..(10,7)] -> forces player 1 to block at (11, 7)
// Step 3: (10, 6) or (10, 10) makes an open four on row 10 [(10,6)..(10,10)] -> unstoppable win
function makeThreeStepVCFBoard() {
  const b = emptyBoard();
  // Player 0 stones
  b[7][4] = 0; b[7][5] = 0; b[7][6] = 0;
  b[8][7] = 0; b[9][7] = 0;
  b[10][8] = 0; b[10][9] = 0;

  // Player 1 blockers (preventing one-end open fours and diagonal shortcuts)
  b[7][3] = 1;
  b[6][7] = 1;
  b[6][5] = 1; b[11][10] = 1;
  b[6][4] = 1; b[11][9] = 1;
  b[0][0] = 1;
  return b;
}

test('(a) findVCF finds a move in a hand-built 3-step VCF sequence', () => {
  const board = makeThreeStepVCFBoard();
  const move1 = gomokuBot._findVCF(board, 0);
  assert.deepEqual(move1, { row: 7, col: 7 });

  // Advance step 1 + forced block and verify step 2
  board[7][7] = 0;
  board[7][8] = 1;
  const move2 = gomokuBot._findVCF(board, 0);
  assert.deepEqual(move2, { row: 10, col: 7 });

  // Advance step 2 + forced block and verify step 3 (open four on row 10)
  board[10][7] = 0;
  board[11][7] = 1;
  const move3 = gomokuBot._findVCF(board, 0);
  assert.ok(move3 && move3.row === 10 && (move3.col === 6 || move3.col === 10));
});

test('(b) findVCF returns null on positions with no VCF', () => {
  const bEmpty = emptyBoard();
  assert.equal(gomokuBot._findVCF(bEmpty, 0), null);

  // A position where player 0 has a single dead-end closed three (can make one four, then nothing)
  const bDeadEnd = emptyBoard();
  bDeadEnd[7][3] = 1;
  bDeadEnd[7][4] = 0;
  bDeadEnd[7][5] = 0;
  bDeadEnd[7][6] = 0;
  bDeadEnd[2][2] = 0;
  bDeadEnd[12][12] = 1;
  bDeadEnd[12][13] = 1;
  assert.equal(gomokuBot._findVCF(bDeadEnd, 0), null);
  assert.equal(gomokuBot._findVCF(bDeadEnd, 1), null);
});

test('(c) hard bot picks a defending move when the opponent has a VCF', () => {
  const board = makeThreeStepVCFBoard();
  // Add an unrelated decoy line for player 1 in the top-left corner
  board[1][1] = 1;
  board[1][2] = 1;
  // The blockers on row 6 (cols 4, 5, 7) would give player 1 an open four at (6,6); cap that line
  board[6][3] = 0;
  board[6][8] = 0;
  assert.equal(gomokuBot._findVCF(board, 1), null, 'Player 1 must not have its own VCF here');

  // Confirm player 0 currently has a VCF
  assert.ok(gomokuBot._findVCF(board, 0), 'Opponent (player 0) should have a VCF before defense');

  const bot1 = gomokuBot.createBot(1);
  const state = {
    board,
    currentPlayer: 1,
    _options: { difficulty: 'hard' },
  };
  const move = bot1.getMove(state);
  assert.ok(move && Number.isInteger(move.row) && Number.isInteger(move.col));
  assert.ok(move.row >= 6, `Expected defending move near opponent VCF, got (${move.row}, ${move.col})`);

  // Applying the hard bot's move must break player 0's VCF
  const after = board.map((r) => r.slice());
  after[move.row][move.col] = 1;
  assert.equal(gomokuBot._findVCF(after, 0), null, 'Hard bot move should break opponent VCF');
});

test('(d) bot never mutates the state passed in', () => {
  const boards = [
    emptyBoard(),
    makeThreeStepVCFBoard(),
    (() => {
      const b = emptyBoard();
      b[7][7] = 0; b[7][8] = 1; b[6][7] = 0; b[8][8] = 1;
      return b;
    })(),
  ];

  for (const b of boards) {
    for (const diff of ['easy', 'normal', 'hard']) {
      for (const side of [0, 1]) {
        const state = {
          board: b.map((r) => r.slice()),
          currentPlayer: side,
          winner: null,
          moveHistory: [{ row: 7, col: 7, side: 0 }],
          _options: { difficulty: diff },
        };
        const before = JSON.stringify(state);
        const bot = gomokuBot.createBot(side);
        bot.getMove(state);
        assert.equal(JSON.stringify(state), before, `getMove mutated state (diff=${diff}, side=${side})`);

        gomokuBot._findVCF(state, side);
        assert.equal(JSON.stringify(state), before, `_findVCF mutated state (side=${side})`);
      }
    }
  }
});
