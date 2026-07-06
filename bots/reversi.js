// bots/reversi.js — AI for 黑白棋
// Minimax + alpha-beta pruning, depth 5, classic Othello heuristics

const { botName } = require('./lib/bot-name');

const ROWS = 8, COLS = 8;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

exports.name = 'reversi';

// Standard Othello position weight table
const PST = [
  [120,-20, 20,  5,  5, 20,-20,120],
  [-20,-40, -5, -5, -5, -5,-40,-20],
  [ 20, -5, 15,  3,  3, 15, -5, 20],
  [  5, -5,  3,  3,  3,  3, -5,  5],
  [  5, -5,  3,  3,  3,  3, -5,  5],
  [ 20, -5, 15,  3,  3, 15, -5, 20],
  [-20,-40, -5, -5, -5, -5,-40,-20],
  [120,-20, 20,  5,  5, 20,-20,120],
];

// Corner positions
const CORNERS = [[0,0],[0,7],[7,0],[7,7]];
// X-squares (diagonal neighbors of corners, dangerous)
const X_SQUARES = [[1,1],[1,6],[6,1],[6,6]];

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function getFlips(board, row, col, side) {
  if (board[row][col] !== null) return [];
  const enemy = 1 - side;
  const allFlips = [];
  for (const [dr, dc] of DIRS) {
    const dirFlips = [];
    let r = row + dr, c = col + dc;
    while (inBounds(r, c) && board[r][c] === enemy) {
      dirFlips.push({ row: r, col: c });
      r += dr; c += dc;
    }
    if (dirFlips.length > 0 && inBounds(r, c) && board[r][c] === side) {
      allFlips.push(...dirFlips);
    }
  }
  return allFlips;
}

function getLegalMoves(board, side) {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== null) continue;
      const flips = getFlips(board, r, c, side);
      if (flips.length > 0) {
        moves.push({ row: r, col: c, flips });
      }
    }
  }
  return moves;
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

function applyMove(board, move, side) {
  const flipped = [];
  board[move.row][move.col] = side;
  for (const f of move.flips) {
    flipped.push({ row: f.row, col: f.col, prev: board[f.row][f.col] });
    board[f.row][f.col] = side;
  }
  return flipped;
}

function undoMove(board, move, flipped) {
  board[move.row][move.col] = null;
  for (const f of flipped) {
    board[f.row][f.col] = f.prev;
  }
}

function evaluate(board, side) {
  const enemy = 1 - side;
  let score = 0;
  let myCount = 0, oppCount = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v === null) continue;
      if (v === side) {
        myCount++;
        score += PST[r][c];
      } else {
        oppCount++;
        score -= PST[r][c];
      }
    }
  }

  // Corner occupancy bonus
  for (const [cr, cc] of CORNERS) {
    if (board[cr][cc] === side) score += 25;
    else if (board[cr][cc] === enemy) score -= 25;
  }

  // X-square penalty (only if corner is empty)
  for (const [xr, xc] of X_SQUARES) {
    if (board[xr][xc] === side) {
      // Check if adjacent corner is empty
      const cr = xr === 0 ? 0 : 7;
      const cc = xc === 0 ? 0 : 7;
      if (board[cr][cc] === null) score -= 10;
    } else if (board[xr][xc] === enemy) {
      const cr = xr === 0 ? 0 : 7;
      const cc = xc === 0 ? 0 : 7;
      if (board[cr][cc] === null) score += 10;
    }
  }

  // Mobility
  const myMoves = getLegalMoves(board, side).length;
  const oppMoves = getLegalMoves(board, enemy).length;
  score += (myMoves - oppMoves) * 5;

  // Endgame: piece count dominance when board is nearly full
  if (myCount + oppCount > 50) {
    score += (myCount - oppCount) * 20;
  }

  return score;
}

function minimax(board, depth, alpha, beta, maximizing, side) {
  if (depth === 0) return evaluate(board, side);

  const currentSide = maximizing ? side : (1 - side);
  const moves = getLegalMoves(board, currentSide);

  if (moves.length === 0) {
    // Pass — opponent gets to move
    return minimax(board, depth - 1, alpha, beta, !maximizing, side);
  }

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const flipped = applyMove(board, move, currentSide);
      const val = minimax(board, depth - 1, alpha, beta, false, side);
      undoMove(board, move, flipped);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const flipped = applyMove(board, move, currentSide);
      const val = minimax(board, depth - 1, alpha, beta, true, side);
      undoMove(board, move, flipped);
      if (val > best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = cloneBoard(state.board);
    const side = playerIndex;
    const moves = getLegalMoves(board, side);

    if (moves.length === 0) return { pass: true };
    if (moves.length === 1) return { row: moves[0].row, col: moves[0].col };

    // Sort moves by heuristic value for better pruning
    moves.sort((a, b) => {
      const va = PST[a.row][a.col] + a.flips.length * 2;
      const vb = PST[b.row][b.col] + b.flips.length * 2;
      return vb - va;
    });

    const depth = 5;
    let bestMove = moves[0];
    let bestVal = -Infinity;

    for (const move of moves) {
      const flipped = applyMove(board, move, side);
      const val = minimax(board, depth - 1, -Infinity, Infinity, false, side);
      undoMove(board, move, flipped);
      if (val > bestVal) {
        bestVal = val;
        bestMove = move;
      }
    }

    return { row: bestMove.row, col: bestMove.col };
  },
});
