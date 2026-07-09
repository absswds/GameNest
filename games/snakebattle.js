const DIRECTIONS = {
  up: { x: 0, y: -1, opposite: 'down' },
  down: { x: 0, y: 1, opposite: 'up' },
  left: { x: -1, y: 0, opposite: 'right' },
  right: { x: 1, y: 0, opposite: 'left' },
};

const SPAWNS = [
  { x: 3, y: 3, direction: 'right' },
  { x: 24, y: 16, direction: 'left' },
  { x: 24, y: 3, direction: 'down' },
  { x: 3, y: 16, direction: 'up' },
  { x: 14, y: 3, direction: 'down' },
  { x: 14, y: 16, direction: 'up' },
];

exports.name = 'snakebattle';
exports.maxPlayers = 6;
exports.realtime = true;
exports.tickMs = 120;

exports.createState = () => ({
  width: 28,
  height: 20,
  realtime: true,
  snakes: [],
  food: null,
  winner: null,
  tick: 0,
});

function makeSnake(index, spawn) {
  const vector = DIRECTIONS[spawn.direction];
  const body = [];
  for (let i = 0; i < 3; i++) {
    body.push({ x: spawn.x - vector.x * i, y: spawn.y - vector.y * i });
  }
  return {
    player: index,
    body,
    direction: spawn.direction,
    nextDirection: spawn.direction,
    alive: true,
    score: 0,
  };
}

function occupiedCells(state) {
  const occupied = new Set();
  state.snakes.forEach(snake => snake.body.forEach(cell => occupied.add(`${cell.x},${cell.y}`)));
  return occupied;
}

function spawnFood(state) {
  const occupied = occupiedCells(state);
  const available = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!occupied.has(`${x},${y}`)) available.push({ x, y });
    }
  }
  state.food = available.length ? available[Math.floor(Math.random() * available.length)] : null;
}

exports.initGame = (state, playerCount) => {
  state.snakes = [];
  for (let i = 0; i < playerCount; i++) state.snakes.push(makeSnake(i, SPAWNS[i]));
  state.winner = null;
  state.tick = 0;
  state.realtime = true;
  spawnFood(state);
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  const snake = state.snakes[playerIndex];
  if (!snake) return 'sb_player_not_found';
  if (!snake.alive) return 'sb_you_are_out';
  const direction = data && data.direction;
  if (!DIRECTIONS[direction]) return 'sb_invalid_direction';
  if (DIRECTIONS[direction].opposite === snake.direction) return 'sb_cannot_reverse';
  snake.nextDirection = direction;
  return null;
};

exports.tick = state => {
  if (state.winner !== null) return false;
  const moving = state.snakes.filter(snake => snake.alive);
  if (moving.length <= 1) {
    state.winner = moving.length === 1 ? moving[0].player : -1;
    return false;
  }

  const nextHeads = new Map();
  const growers = new Set();
  moving.forEach(snake => {
    const direction = DIRECTIONS[snake.nextDirection] || DIRECTIONS[snake.direction];
    const head = snake.body[0];
    const next = { x: head.x + direction.x, y: head.y + direction.y };
    nextHeads.set(snake.player, next);
    if (state.food && next.x === state.food.x && next.y === state.food.y) growers.add(snake.player);
  });

  const blocked = new Set();
  state.snakes.forEach(snake => {
    const keepsTail = !snake.alive || growers.has(snake.player);
    const length = snake.body.length - (keepsTail ? 0 : 1);
    for (let i = 0; i < length; i++) blocked.add(`${snake.body[i].x},${snake.body[i].y}`);
  });

  const crashes = new Set();
  const headCounts = new Map();
  moving.forEach(snake => {
    const next = nextHeads.get(snake.player);
    const key = `${next.x},${next.y}`;
    if (next.x < 0 || next.x >= state.width || next.y < 0 || next.y >= state.height || blocked.has(key)) {
      crashes.add(snake.player);
    }
    headCounts.set(key, (headCounts.get(key) || 0) + 1);
  });
  moving.forEach(snake => {
    const next = nextHeads.get(snake.player);
    if (headCounts.get(`${next.x},${next.y}`) > 1) crashes.add(snake.player);
  });

  let ateFood = false;
  moving.forEach(snake => {
    const next = nextHeads.get(snake.player);
    snake.direction = snake.nextDirection;
    if (crashes.has(snake.player)) {
      snake.alive = false;
      return;
    }
    snake.body.unshift(next);
    if (growers.has(snake.player)) {
      snake.score++;
      ateFood = true;
    } else {
      snake.body.pop();
    }
  });

  if (ateFood) spawnFood(state);
  state.tick++;
  const survivors = state.snakes.filter(snake => snake.alive);
  if (survivors.length <= 1) state.winner = survivors.length === 1 ? survivors[0].player : -1;
  return true;
};

exports.DIRECTIONS = DIRECTIONS;
