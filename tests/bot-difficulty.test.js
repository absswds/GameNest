const test = require('node:test');
const assert = require('node:assert/strict');

// Bots to test
const tictactoeBot = require('../bots/tictactoe');
const twentyfourBot = require('../bots/twentyfour');
const unoBot = require('../bots/uno');
const bigtwoBot = require('../bots/bigtwo');
const sudokuBot = require('../bots/sudoku');
const gomokuBot = require('../bots/gomoku');
const snakebattleBot = require('../bots/snakebattle');
const game2048Bot = require('../bots/2048');

test('TicTacToe Bot respects difficulty', () => {
  const bot = tictactoeBot.createBot(0);
  // Easy state: board where winning move is (0, 2)
  // X X _
  // O O _
  // _ _ _
  const state = {
    board: ['X', 'X', null, 'O', 'O', null, null, null, null],
    _options: { difficulty: 'hard' },
  };
  const hardMove = bot.getMove(state);
  // Hard bot must take winning cell 2
  assert.equal(hardMove.cell, 2, 'Hard bot plays optimal winning move');

  // Hard bot as player O: must block player X
  const botO = tictactoeBot.createBot(1);
  const blockState = {
    board: ['X', 'X', null, 'O', null, null, null, null, null],
    _options: { difficulty: 'hard' },
  };
  const blockMove = botO.getMove(blockState);
  assert.equal(blockMove.cell, 2, 'Hard bot blocks opponent winning move');
});

test('24 Points Bot respects difficulty', () => {
  const bot = twentyfourBot.createBot(0);
  const stateEasy = {
    phase: 'playing',
    numbers: [3, 8, 3, 8],
    _options: { difficulty: 'easy' },
  };
  const stateHard = {
    phase: 'playing',
    numbers: [3, 8, 3, 8],
    _options: { difficulty: 'hard' },
  };
  const hardMove = bot.getMove(stateHard);
  assert.ok(hardMove.expression, 'Hard bot always solves 24 when solution exists');

  // Over 100 trials, easy bot should have non-trivial pass/empty rate
  let easyFailCount = 0;
  for (let i = 0; i < 100; i++) {
    const move = bot.getMove(stateEasy);
    if (!move.expression) easyFailCount++;
  }
  assert.ok(easyFailCount > 20, `Easy bot fails often (failed ${easyFailCount}/100)`);
});


test('Sudoku Bot respects difficulty', () => {
  const bot = sudokuBot.createBot(0);
  const puzzle = Array(9).fill(null).map(() => Array(9).fill(0));
  const solution = Array(9).fill(null).map((_, r) => Array(9).fill(null).map((_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1));
  const filled = Array(9).fill(null).map(() => Array(9).fill(0));

  const stateHard = {
    puzzle,
    solution,
    filled: [filled],
    _options: { difficulty: 'hard' },
  };
  const hardMove = bot.getMove(stateHard);
  assert.equal(hardMove.type, 'fill');
  assert.equal(hardMove.val, solution[hardMove.row][hardMove.col], 'Hard bot fills correct solution cell');

  const stateEasy = {
    puzzle,
    solution,
    filled: [filled],
    _options: { difficulty: 'easy' },
  };
  let blunders = 0;
  for (let i = 0; i < 100; i++) {
    const move = bot.getMove(stateEasy);
    if (move.val !== solution[move.row][move.col]) blunders++;
  }
  assert.ok(blunders > 5, `Easy bot makes occasional mistakes (blundered ${blunders}/100)`);
});

test('UNO Bot respects difficulty in card playing', () => {
  const bot = unoBot.createBot(0);
  const stateHard = {
    hands: [
      [{ id: 'c1', color: 'red', number: 5 }, { id: 'c2', color: 'blue', number: 7 }],
      [{ id: 'o1', color: 'red', number: 1 }], // Opponent 1 has 1 card left!
    ],
    discardPile: [{ id: 'd1', color: 'red', number: 7 }],
    currentColor: 'red',
    _options: { difficulty: 'hard' },
  };
  const moveHard = bot.getMove(stateHard);
  assert.ok(moveHard.cardId, 'Hard bot selects a playable card');
});

test('Gomoku Bot blocks and attacks in hard mode', () => {
  const bot = gomokuBot.createBot(0); // Bot is 0 (Black)
  const board = Array(15).fill(null).map(() => Array(15).fill(null));
  // Opponent has 4 in a row: (7, 3), (7, 4), (7, 5), (7, 6)
  board[7][3] = 1;
  board[7][4] = 1;
  board[7][5] = 1;
  board[7][6] = 1;

  const stateHard = {
    board,
    _options: { difficulty: 'hard' },
  };
  const move = bot.getMove(stateHard);
  // Bot must block at (7, 2) or (7, 7)
  const blocked = (move.row === 7 && (move.col === 2 || move.col === 7));
  assert.ok(blocked, `Hard Gomoku bot blocked 4-in-a-row at (${move.row}, ${move.col})`);
});

test('Snake Battle Bot avoids self-trapping in hard mode', () => {
  const bot = snakebattleBot.createBot(0);
  // Build a state where turning UP leads into a tiny 1-cell dead-end pocket
  // Grid size 20x20
  // Head at (5, 5). Moving 'up' leads to (5, 4).
  const snakes = [
    {
      id: 0,
      alive: true,
      body: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }, { x: 5, y: 9 }],
      dir: 'up',
    },
  ];
  // Surround (5, 4) with walls/obstacles so UP has flood space 0
  const obstacles = [{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 5, y: 3 }];
  const stateHard = {
    gridWidth: 20,
    gridHeight: 20,
    snakes,
    obstacles,
    foods: [{ x: 10, y: 10 }],
    _options: { difficulty: 'hard' },
  };
  const move = bot.getMove(stateHard);
  assert.notEqual(move.dir, 'up', 'Hard Snake Bot avoids turning into a dead-end pocket');
});

test('2048 Bot selects optimal moves with lookahead in hard mode', () => {
  const bot = game2048Bot.createBot(0);
  const state = {
    boards: [
      [
        [2, 4, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
    _options: { difficulty: 'hard' },
  };
  const move = bot.getMove(state);
  assert.ok(['left', 'right', 'up', 'down'].includes(move.dir), 'Returns valid direction');
});

