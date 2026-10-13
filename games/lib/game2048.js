// games/lib/game2048.js
// Pure 2048 grid helpers: no game-state logic, no randomness sources beyond Math.random.

const N = 4;

// Deep-copy a 4x4 grid (array of rows).
exports.copy = (g) => g.map((r) => r.slice());

// Slide+merge a single row toward index 0 (i.e. "left").
// Returns a new { row, score }; the input row is left untouched.
function slideRow(row) {
  // Drop zeros
  const tiles = row.filter((v) => v !== 0);
  const out = [];
  let score = 0;
  let i = 0;
  while (i < tiles.length) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      out.push(merged);
      score += merged;
      i += 2; // skip the pair — each tile merges at most once per move
    } else {
      out.push(tiles[i]);
      i += 1;
    }
  }
  while (out.length < N) out.push(0);
  return { row: out, score };
}

// Move the whole grid in a direction. Writes the result back into `grid` and returns
// { grid, score, changed } (`grid` is left as it was when nothing moved).
exports.move = (grid, dir) => {
  const work = grid.map((r) => r.slice());
  let score = 0;

  if (dir === 'left') {
    for (let r = 0; r < N; r++) {
      const s = slideRow(work[r]);
      work[r] = s.row;
      score += s.score;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < N; r++) {
      const rev = work[r].slice().reverse();
      const s = slideRow(rev);
      work[r] = s.row.reverse();
      score += s.score;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < N; c++) {
      const col = [work[0][c], work[1][c], work[2][c], work[3][c]];
      const s = slideRow(col);
      for (let r = 0; r < N; r++) work[r][c] = s.row[r];
      score += s.score;
    }
  } else if (dir === 'down') {
    for (let c = 0; c < N; c++) {
      const col = [work[3][c], work[2][c], work[1][c], work[0][c]];
      const s = slideRow(col);
      for (let r = 0; r < N; r++) work[r][c] = s.row[N - 1 - r];
      score += s.score;
    }
  }

  // Detect whether anything actually changed.
  let changed = false;
  for (let r = 0; r < N && !changed; r++) {
    for (let c = 0; c < N && !changed; c++) {
      if (work[r][c] !== grid[r][c]) changed = true;
    }
  }

  // Commit onto the original grid.
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) grid[r][c] = work[r][c];
  }

  return { grid, score, changed };
};

// Place a 2 (90%) or 4 (10%) in a random blank cell. No-op if board is full.
exports.spawn = (grid) => {
  const blanks = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === 0) blanks.push([r, c]);
    }
  }
  if (blanks.length === 0) return;
  const [r, c] = blanks[Math.floor(Math.random() * blanks.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
};

// Any blank cell, or any horizontally/vertically adjacent equal pair.
exports.hasMove = (grid) => {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
};

exports.maxTile = (grid) => {
  let m = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] > m) m = grid[r][c];
    }
  }
  return m;
};
