// bots/snakebattle.js — Snake Battle AI with difficulty and floodfill safety
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

const VECTORS = {
  up: { x: 0, y: -1, opposite: 'down' },
  down: { x: 0, y: 1, opposite: 'up' },
  left: { x: -1, y: 0, opposite: 'right' },
  right: { x: 1, y: 0, opposite: 'left' },
};

exports.name = 'snakebattle';

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function floodFillCount(start, width, height, blocked, maxLimit) {
  const q = [start];
  const seen = new Set([cellKey(start)]);
  let count = 0;
  while (q.length > 0 && count < maxLimit) {
    const cur = q.shift();
    count++;
    for (const d of Object.keys(VECTORS)) {
      const nx = cur.x + VECTORS[d].x, ny = cur.y + VECTORS[d].y;
      const k = `${nx},${ny}`;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !blocked.has(k) && !seen.has(k)) {
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
  }
  return count;
}

exports.createBot = playerIndex => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const snake = state.snakes[playerIndex];
    if (!snake || !snake.alive) return { direction: 'up' };

    const diff = getDifficulty(state);
    const blocked = new Set();
    state.snakes.forEach(other => other.body.forEach(cell => blocked.add(cellKey(cell))));
    const tail = snake.body[snake.body.length - 1];
    blocked.delete(cellKey(tail));

    const head = snake.body[0];
    const safeDirections = [];
    Object.keys(VECTORS).forEach(direction => {
      const vector = VECTORS[direction];
      if (vector.opposite === snake.direction) return;
      const next = { x: head.x + vector.x, y: head.y + vector.y };
      if (next.x < 0 || next.x >= state.width || next.y < 0 || next.y >= state.height || blocked.has(cellKey(next))) return;
      safeDirections.push({ direction, next });
    });

    if (safeDirections.length === 0) return { direction: snake.direction };

    if (diff === 'easy' && Math.random() < 0.4) {
      return { direction: safeDirections[Math.floor(Math.random() * safeDirections.length)].direction };
    }

    let bestDirection = safeDirections[0].direction;
    let bestScore = -Infinity;

    safeDirections.forEach(({ direction, next }) => {
      const distance = state.food ? Math.abs(next.x - state.food.x) + Math.abs(next.y - state.food.y) : 0;
      let score = -distance + (direction === snake.direction ? 0.2 : 0);

      if (diff === 'hard') {
        // Check available open space ahead to prevent dead ends
        const openSpace = floodFillCount(next, state.width, state.height, blocked, snake.body.length + 5);
        if (openSpace < snake.body.length) {
          score -= 500; // heavy trap penalty
        } else {
          score += openSpace * 0.5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
    });

    return { direction: bestDirection };
  },
});
