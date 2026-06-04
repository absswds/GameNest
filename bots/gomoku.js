// bots/gomoku.js — Gomoku AI with pattern scoring
exports.name = 'gomoku';

const SIZE = 15;
const DIRS = [[1,0],[0,1],[1,1],[1,-1]];

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    const board = state.board;
    const me = playerIndex;
    const opp = 1 - me;

    let bestScore = -1, bestMoves = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== null) continue;
        // Only consider positions near existing stones
        if (!hasNeighbor(board, r, c)) continue;

        const atk = evaluate(board, r, c, me);
        const def = evaluate(board, r, c, opp);
        const score = Math.max(atk, def * 1.1); // slightly prefer defense

        if (score > bestScore) {
          bestScore = score;
          bestMoves = [{ row: r, col: c }];
        } else if (score === bestScore) {
          bestMoves.push({ row: r, col: c });
        }
      }
    }

    // Fallback when no neighboured cell exists (e.g. empty board, or stones only at edges):
    // take the center if free, otherwise the first empty cell anywhere on the board.
    if (bestMoves.length === 0) {
      const mid = (SIZE - 1) / 2 | 0;
      if (board[mid][mid] === null) return { row: mid, col: mid };
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] === null) return { row: r, col: c };
        }
      }
      return { pass: true }; // board full — game should already be a draw
    }

    const pick = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    return { row: pick.row, col: pick.col };
  },
});

function hasNeighbor(board, r, c) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] !== null) return true;
    }
  }
  return false;
}

function evaluate(board, r, c, player) {
  board[r][c] = player;
  let score = 0;

  for (const [dr, dc] of DIRS) {
    let count = 1, open = 0;
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) count++;
      else { if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) open++; break; }
    }
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) count++;
      else { if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) open++; break; }
    }
    if (count >= 5) score += 100000;
    else if (count === 4 && open >= 1) score += 10000;
    else if (count === 3 && open >= 2) score += 1000;
    else if (count === 3 && open >= 1) score += 100;
    else if (count === 2 && open >= 2) score += 10;
    else if (count === 2 && open >= 1) score += 3;
    else score += 1;
  }

  board[r][c] = null;
  return score;
}
