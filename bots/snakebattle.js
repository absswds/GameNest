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

exports.createBot = playerIndex => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    const snake = state.snakes[playerIndex];
    if (!snake || !snake.alive) return { direction: 'up' };

    const blocked = new Set();
    state.snakes.forEach(other => other.body.forEach(cell => blocked.add(cellKey(cell))));
    const tail = snake.body[snake.body.length - 1];
    blocked.delete(cellKey(tail));

    const head = snake.body[0];
    let bestDirection = snake.direction;
    let bestScore = -Infinity;
    Object.keys(VECTORS).forEach(direction => {
      const vector = VECTORS[direction];
      if (vector.opposite === snake.direction) return;
      const next = { x: head.x + vector.x, y: head.y + vector.y };
      if (next.x < 0 || next.x >= state.width || next.y < 0 || next.y >= state.height || blocked.has(cellKey(next))) return;
      const distance = state.food ? Math.abs(next.x - state.food.x) + Math.abs(next.y - state.food.y) : 0;
      const score = -distance + (direction === snake.direction ? 0.2 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
    });
    return { direction: bestDirection };
  },
});
