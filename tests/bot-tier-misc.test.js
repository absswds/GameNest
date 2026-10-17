const test = require('node:test');
const assert = require('node:assert/strict');

const sudokuGame = require('../games/sudoku');
const sudokuBot = require('../bots/sudoku');
const tf = require('../games/twentyfour');
const tfBot = require('../bots/twentyfour');
const snake = require('../games/snakebattle');
const snakeBot = require('../bots/snakebattle');

function withClock(fn) {
  const real = Date.now;
  let t = 1e12;
  Date.now = () => t;
  try { return fn(ms => { t += ms; }); } finally { Date.now = real; }
}

test('sudoku bot pace: hard fills every poll, easy/normal wait', () => {
  withClock(advance => {
    const fillsAfter = (difficulty, polls, stepMs) => {
      const s = sudokuGame.createState();
      sudokuGame.initGame(s, 2);
      s._options = { difficulty };
      const bot = sudokuBot.createBot(0);
      for (let i = 0; i < polls; i++) { advance(stepMs); sudokuGame.handleMove(bot.getMove(s), s, 0); }
      return s.counts[0] + (3 - s.lives[0]);
    };
    const hard = fillsAfter('hard', 20, 5000);
    const normal = fillsAfter('normal', 20, 5000);
    const easy = fillsAfter('easy', 20, 5000);
    assert.equal(hard, 20);
    assert.ok(normal < hard && normal >= 5, `normal ${normal}`);
    assert.ok(easy < normal, `easy ${easy} normal ${normal}`);
  });
});

test('twentyfour bot answers on a tier-dependent poll, hard on the first', () => {
  const s = tf.createState();
  tf.initGame(s, 2);
  for (let k = 0; k < 20; k++) {
    s._options = { difficulty: 'hard' };
    s.numbers = [3, 3, 8, 8];
    s.currentRound = k + 1;
    assert.ok(tfBot.createBot(0).getMove(s).expression);
  }
  const pollsNeeded = difficulty => {
    s._options = { difficulty };
    s.numbers = [3, 3, 8, 8].slice();
    const bot = tfBot.createBot(0);
    for (let n = 1; n <= 6; n++) if (bot.getMove(s).expression) return n;
    return Infinity;
  };
  let easy = 0, normal = 0;
  for (let k = 0; k < 100; k++) { easy += pollsNeeded('easy'); normal += pollsNeeded('normal'); }
  assert.ok(normal < easy && normal > 100 && easy <= 400);
});

test('snakebattle hard avoids a cell the opponent head can also enter', () => {
  const s = snake.createState();
  snake.initGame(s, 2);
  // me heading right, opponent head two cells ahead heading left: moving right meets it head-on
  s.snakes[0].body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  s.snakes[0].direction = 'right';
  s.snakes[1].body = [{ x: 12, y: 10 }, { x: 13, y: 10 }, { x: 14, y: 10 }];
  s.snakes[1].direction = 'left';
  s.food = { x: 11, y: 10 };
  s._options = { difficulty: 'hard' };
  const bot = snakeBot.createBot(0);
  for (let k = 0; k < 20; k++) assert.notEqual(bot.getMove(s).direction, 'right');
});
