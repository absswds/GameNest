// bots/2048.js — 2048 AI with difficulty levels
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');
const { copy, move, maxTile } = require('../games/lib/game2048');

exports.name = '2048';

const DIRS = ['up', 'down', 'left', 'right'];

// Gradient position weights favoring keeping large numbers monotonic toward top-left corner
const MATRIX_WEIGHTS = [
  [4096, 1024, 256, 64],
  [16,   32,   64,  128],
  [8,    4,    2,   1],
  [0,    0,    0,   0]
];

function matrixScore(grid) {
  let score = 0;
  let emptyCount = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = grid[r][c];
      if (v === 0) emptyCount++;
      else score += v * MATRIX_WEIGHTS[r][c];
    }
  }
  return score + emptyCount * 250;
}

function cornerScore(grid) {
  const mt = maxTile(grid);
  if (grid[0][0] === mt || grid[0][3] === mt || grid[3][0] === mt || grid[3][3] === mt) {
    return mt;
  }
  return 0;
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = state.boards[playerIndex];
    const diff = getDifficulty(state);

    const validMoves = [];
    for (const dir of DIRS) {
      const res = move(copy(board), dir);
      if (res.changed) validMoves.push({ dir, res });
    }

    if (validMoves.length === 0) return { pass: true };

    if (diff === 'easy' && Math.random() < 0.4) {
      return { dir: validMoves[Math.floor(Math.random() * validMoves.length)].dir };
    }

    if (diff === 'hard') {
      let bestDir = validMoves[0].dir;
      let bestVal = -Infinity;

      for (const { dir, res } of validMoves) {
        // 1st step evaluation with matrix weight + empty spaces
        let s = res.score * 5 + matrixScore(res.grid);
        // Lookahead 1 more step into valid future moves
        let futureMax = 0;
        for (const d2 of DIRS) {
          const res2 = move(copy(res.grid), d2);
          if (res2.changed) {
            futureMax = Math.max(futureMax, res2.score * 3 + matrixScore(res2.grid));
          }
        }
        s += futureMax * 0.5;
        if (s > bestVal) {
          bestVal = s;
          bestDir = dir;
        }
      }
      return { dir: bestDir };
    }

    // Normal: current corner-greedy heuristic
    let best = null;
    let bestScore = -Infinity;
    for (const { dir, res } of validMoves) {
      const score = res.score * 4 + cornerScore(res.grid);
      if (score > bestScore) {
        bestScore = score;
        best = dir;
      }
    }
    return { dir: best || validMoves[0].dir };
  },
});
