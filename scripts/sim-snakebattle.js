const assert = require('assert');
const game = require('../games/snakebattle');
const botModule = require('../bots/snakebattle');

function newState(playerCount) {
  const state = game.createState();
  game.initGame(state, playerCount);
  return state;
}

function setSnake(snake, body, direction) {
  snake.body = body.map(([x, y]) => ({ x, y }));
  snake.direction = direction;
  snake.nextDirection = direction;
  snake.alive = true;
}

// A new realtime game exposes a bounded shared board and non-overlapping spawns.
const initial = newState(4);
assert.strictEqual(game.realtime, true);
assert.strictEqual(initial.realtime, true);
assert.strictEqual(initial.snakes.length, 4);
const occupied = new Set();
initial.snakes.forEach(snake => snake.body.forEach(cell => {
  const key = `${cell.x},${cell.y}`;
  assert(!occupied.has(key), `spawn collision at ${key}`);
  occupied.add(key);
}));

// Reverse direction is rejected, but a perpendicular input is accepted.
assert.strictEqual(game.handleMove({ direction: 'left' }, initial, 0), '不能立刻反向');
assert.strictEqual(game.handleMove({ direction: 'down' }, initial, 0), null);
assert.strictEqual(initial.snakes[0].nextDirection, 'down');

// Eating grows the snake and replaces the food.
const eating = newState(2);
setSnake(eating.snakes[0], [[2, 2], [1, 2], [0, 2]], 'right');
setSnake(eating.snakes[1], [[20, 10], [21, 10], [22, 10]], 'left');
eating.food = { x: 3, y: 2 };
const beforeLength = eating.snakes[0].body.length;
game.tick(eating);
assert.strictEqual(eating.snakes[0].body.length, beforeLength + 1);
assert.notDeepStrictEqual(eating.food, { x: 3, y: 2 });

// A wall collision eliminates the snake and declares the other survivor the winner.
const wall = newState(2);
setSnake(wall.snakes[0], [[wall.width - 1, 2], [wall.width - 2, 2], [wall.width - 3, 2]], 'right');
setSnake(wall.snakes[1], [[10, 10], [9, 10], [8, 10]], 'right');
wall.food = { x: 15, y: 15 };
game.tick(wall);
assert.strictEqual(wall.snakes[0].alive, false);
assert.strictEqual(wall.winner, 1);

// Heads entering the same cell eliminate both sides and produce a draw.
const headOn = newState(2);
setSnake(headOn.snakes[0], [[5, 5], [4, 5], [3, 5]], 'right');
setSnake(headOn.snakes[1], [[7, 5], [8, 5], [9, 5]], 'left');
headOn.food = { x: 15, y: 15 };
game.tick(headOn);
assert.strictEqual(headOn.snakes[0].alive, false);
assert.strictEqual(headOn.snakes[1].alive, false);
assert.strictEqual(headOn.winner, -1);

// A bot can continuously submit only legal direction intents without mutating state itself.
const botState = newState(2);
const bot = botModule.createBot(1);
for (let i = 0; i < 30 && botState.winner == null; i++) {
  const move = bot.getMove(botState);
  assert(['up', 'down', 'left', 'right'].includes(move.direction));
  const err = game.handleMove(move, botState, 1);
  assert.strictEqual(err, null);
  game.tick(botState);
}

console.log('Snake Battle simulation passed');
