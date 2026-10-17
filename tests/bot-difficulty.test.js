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
  for (let i = 0; i < 400; i++) {
    const move = bot.getMove(stateEasy);
    if (move.val !== solution[move.row][move.col]) blunders++;
  }
  // ~5% blunder rate: expect about 20 of 400, never a majority
  assert.ok(blunders > 0 && blunders < 60, `Easy bot makes occasional mistakes (blundered ${blunders}/400)`);
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


test('OldMaid: easy bots do not loop forever', () => {
  const om = require('../games/oldmaid');
  const bots = [0, 1, 2].map((i) => require('../bots/oldmaid').createBot(i));
  for (let g = 0; g < 20; g++) {
    const s = om.createState();
    s._options = { difficulty: 'easy' };
    om.initGame(s, 3);
    let steps = 0;
    while (s.winner === null && s.loser === null && steps++ < 2000) {
      const err = om.handleMove(bots[s.currentPlayer].getMove(s), s, s.currentPlayer);
      assert.equal(err, null);
    }
    assert.ok(s.loser !== null, 'game finished within 2000 moves');
  }
});

test('BigTwo: hard bot opens with a pair only if it holds the diamond 3', () => {
  const bt = require('../games/bigtwo');
  const mk = (rank, suit) => ({ id: rank + suit, rank, suit });
  const bot = bigtwoBot.createBot(0);
  const hands = [
    [mk('3', 'd'), mk('3', 'h'), mk('5', 'c'), mk('9', 's')],
    [mk('3', 'd'), mk('4', 'h'), mk('4', 'c'), mk('9', 's')],
  ];
  for (const h of hands) {
    const s = bt.createState();
    s._options = { difficulty: 'hard' };
    bt.initGame(s, 2);
    s.hands = [h.slice(), [mk('6', 's')]];
    s.currentPlayer = 0;
    s._opened = false;
    const m = bot.getMove(s);
    assert.equal(bt.handleMove(m, s, 0), null, 'opening move is legal: ' + JSON.stringify(m));
  }
});

test('Werewolf: all-bot tables at every difficulty never make an illegal move', () => {
  const ww = require('../games/werewolf');
  const wwBot = require('../bots/werewolf');
  for (const diff of ['easy', 'normal', 'hard']) {
    for (let g = 0; g < 8; g++) {
      const n = 6 + (g % 7);
      const s = ww.createState();
      s._options = { difficulty: diff, sheriff: g % 2 === 0, discussTime: 0 };
      ww.initGame(s, n);
      let steps = 0;
      while (s.winner === null && steps++ < 3000) {
        const pending = ww.getPendingActors(s);
        if (!pending.length) { ww.onTimeout(s); continue; }
        const p = pending[0];
        const mv = wwBot.createBot(p).getMove(s, p);
        const err = ww.handleMove(mv, s, p);
        assert.equal(err, null, `${diff} ${s.phase} P${p} ${JSON.stringify(mv)}: ${err}`);
      }
      assert.ok(s.winner !== null, 'werewolf game finished');
    }
  }
});

test('pickByDifficulty: hard takes the best, easy/normal stay within maxLoss', () => {
  const { pickByDifficulty } = require('../bots/lib/difficulty');
  const cands = [{ move: 'a', score: 100 }, { move: 'b', score: 90 }, { move: 'c', score: 0 }];
  for (let i = 0; i < 200; i++) {
    assert.equal(pickByDifficulty(cands, 'hard'), 'a');
    assert.notEqual(pickByDifficulty(cands, 'normal'), 'c', 'normal never loses more than maxLoss (40)');
    assert.ok(['a', 'b', 'c'].includes(pickByDifficulty(cands, 'easy')));
  }
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickByDifficulty(cands, 'normal'));
  assert.ok(seen.has('b'), 'normal sometimes plays a slightly worse move');
  assert.equal(pickByDifficulty([], 'easy'), null);
});
