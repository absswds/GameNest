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

// Cells another living snake's head can enter on the coming tick (a head-on meeting kills both snakes).
function contestedCells(state, playerIndex) {
  const set = new Set();
  state.snakes.forEach((other, i) => {
    if (i === playerIndex || !other.alive) return;
    const head = other.body[0];
    Object.keys(VECTORS).forEach(d => {
      if (VECTORS[d].opposite === other.direction) return;
      set.add(`${head.x + VECTORS[d].x},${head.y + VECTORS[d].y}`);
    });
  });
  return set;
}

// Multi-source BFS: how many free cells I reach strictly before any opponent, and my distance to the food.
function territory(start, state, blocked, rivalHeads) {
  const dist = new Map([[cellKey(start), 0]]);
  const rival = new Map();
  let q = rivalHeads.map(h => { rival.set(cellKey(h), 0); return h; });
  const spread = (queue, map) => {
    const next = [];
    for (const cur of queue) {
      const d = map.get(cellKey(cur));
      for (const v of Object.values(VECTORS)) {
        const nx = cur.x + v.x, ny = cur.y + v.y, k = `${nx},${ny}`;
        if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height || blocked.has(k) || map.has(k)) continue;
        map.set(k, d + 1);
        next.push({ x: nx, y: ny });
      }
    }
    return next;
  };
  let mine = [start];
  while (mine.length || q.length) {
    mine = spread(mine, dist);
    q = spread(q, rival);
  }
  let area = 0;
  dist.forEach((d, k) => { if (!rival.has(k) || rival.get(k) > d) area++; });
  const foodKey = state.food ? cellKey(state.food) : null;
  const foodDist = foodKey && dist.has(foodKey) ? dist.get(foodKey) : null;
  const foodRival = foodKey && rival.has(foodKey) ? rival.get(foodKey) : Infinity;
  return { area, foodDist, foodRival };
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

    const contested = diff === 'easy' ? new Set() : contestedCells(state, playerIndex);
    // Hard always sidesteps a head-on cell, normal mostly does; easy never looks.
    const avoidContested = diff === 'hard' || (diff === 'normal' && Math.random() < 0.9);
    let pool = safeDirections;
    if (avoidContested) {
      const calm = safeDirections.filter(({ next }) => !contested.has(cellKey(next)));
      if (calm.length) pool = calm;
    }

    if (diff === 'easy' && Math.random() < 0.4) {
      return { direction: pool[Math.floor(Math.random() * pool.length)].direction };
    }

    let bestDirection = safeDirections[0].direction;
    let bestScore = -Infinity;

    pool.forEach(({ direction, next }) => {
      const distance = state.food ? Math.abs(next.x - state.food.x) + Math.abs(next.y - state.food.y) : 0;
      let score = -distance + (direction === snake.direction ? 0.2 : 0);

      if (diff === 'hard') {
        const rivalHeads = state.snakes.filter((o, i) => i !== playerIndex && o.alive).map(o => o.body[0]);
        const t = Number.isInteger(state.width) && Number.isInteger(state.height)
          ? territory(next, state, blocked, rivalHeads)
          : { area: floodFillCount(next, state.width, state.height, blocked, snake.body.length + 5), foodDist: null };
        if (t.area < snake.body.length) {
          score -= 500; // heavy trap penalty
        } else {
          score += t.area * 0.5;
          // Chase food only when it is not lost to a closer rival
          if (t.foodDist !== null && t.foodDist <= t.foodRival) score += 40 - t.foodDist * 3;
        }
      } else if (diff === 'normal') {
        const room = floodFillCount(next, state.width, state.height, blocked, snake.body.length + 5);
        if (room < snake.body.length) score -= 500;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
    });

    return { direction: bestDirection };
  },
});
