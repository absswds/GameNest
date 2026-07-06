// bots/chinesechess.js — AI for 中国象棋
// Minimax with alpha-beta pruning, depth 2-3, simple material evaluation

const ROWS = 10, COLS = 9;

const { botName } = require('./lib/bot-name');
const { getDepth } = require('./lib/difficulty');

exports.name = 'chinesechess';

// Piece values for evaluation
const PIECE_VALUES = {
  K: 10000, R: 900, H: 400, C: 450, E: 200, A: 200, P: 100,
};

// Position bonus tables (simplified — encourage control of center)
const POS_BONUS = {
  // Pawn position bonus (across the river is good)
  P: [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [5,5,10,15,15,10,5,5,0],
    [10,10,15,20,20,15,10,10,0],
    [5,5,10,15,15,10,5,5,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],
  // Horse prefers central positions
  H: [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,5,15,15,15,15,15,5,0],
    [0,5,15,20,20,20,15,5,0],
    [0,5,15,20,25,20,15,5,0],
    [0,5,15,20,25,20,15,5,0],
    [0,5,15,20,20,20,15,5,0],
    [0,5,15,15,15,15,15,5,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],
  // Cannon likes to be behind pawns
  C: [
    [0,0,0,0,0,0,0,0,0],
    [0,0,5,5,5,5,5,0,0],
    [0,5,10,10,10,10,10,5,0],
    [0,5,10,15,15,15,10,5,0],
    [0,5,10,15,20,15,10,5,0],
    [0,5,10,15,20,15,10,5,0],
    [0,5,10,15,15,15,10,5,0],
    [0,5,10,10,10,10,10,5,0],
    [0,0,5,5,5,5,5,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],
};

function evaluateBoard(board, side) {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const val = PIECE_VALUES[piece.type] || 0;
      const bonus = (POS_BONUS[piece.type] ? POS_BONUS[piece.type][r][c] : 0) || 0;
      if (piece.side === side) {
        score += val + bonus;
      } else {
        score -= val + bonus;
      }
    }
  }
  return score;
}

// We need to replicate move generation from the game module
// For the bot, we import from game module at runtime by referencing global state
// Actually, let's embed the move logic here to keep bot independent

function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function findKing(board, side) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] && board[r][c].type === 'K' && board[r][c].side === side)
        return { row: r, col: c };
  return null;
}

function getPieceMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, side } = piece;
  const moves = [];

  function addIfValid(tr, tc) {
    if (!inBounds(tr, tc)) return;
    const target = board[tr][tc];
    if (target && target.side === side) return;
    moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
  }

  switch (type) {
    case 'K': {
      const p = side === 0 ? { rMin: 7, rMax: 9, cMin: 3, cMax: 5 } : { rMin: 0, rMax: 2, cMin: 3, cMax: 5 };
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= p.rMin && nr <= p.rMax && nc >= p.cMin && nc <= p.cMax) addIfValid(nr, nc);
      }
      break;
    }
    case 'A': {
      const p = side === 0 ? { rMin: 7, rMax: 9, cMin: 3, cMax: 5 } : { rMin: 0, rMax: 2, cMin: 3, cMax: 5 };
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= p.rMin && nr <= p.rMax && nc >= p.cMin && nc <= p.cMax) addIfValid(nr, nc);
      }
      break;
    }
    case 'E': {
      const home = side === 0 ? [5,6,7,8,9] : [0,1,2,3,4];
      const steps = [[2,2],[2,-2],[-2,2],[-2,-2]];
      const eyes = [[1,1],[1,-1],[-1,1],[-1,-1]];
      for (let i = 0; i < 4; i++) {
        const nr = r + steps[i][0], nc = c + steps[i][1];
        const er = r + eyes[i][0], ec = c + eyes[i][1];
        if (inBounds(nr, nc) && home.includes(nr) && !board[er][ec]) addIfValid(nr, nc);
      }
      break;
    }
    case 'H': {
      const steps = [
        [-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],
        [-1,-2,0,-1],[-1,2,0,1],[1,-2,0,-1],[1,2,0,1],
      ];
      for (const [dr, dc, lr, lc] of steps) {
        if (inBounds(r + dr, c + dc) && !board[r + lr][c + lc]) addIfValid(r + dr, c + dc);
      }
      break;
    }
    case 'R': {
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        for (let i = 1; i < 10; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!inBounds(nr, nc)) break;
          if (board[nr][nc]) {
            if (board[nr][nc].side !== side) addIfValid(nr, nc);
            break;
          }
          addIfValid(nr, nc);
        }
      }
      break;
    }
    case 'C': {
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        for (let i = 1; i < 10; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (!inBounds(nr, nc)) break;
          if (!board[nr][nc]) {
            addIfValid(nr, nc);
          } else {
            for (let j = i + 1; j < 10; j++) {
              const cr = r + dr * j, cc = c + dc * j;
              if (!inBounds(cr, cc)) break;
              if (board[cr][cc]) {
                if (board[cr][cc].side !== side) addIfValid(cr, cc);
                break;
              }
            }
            break;
          }
        }
      }
      break;
    }
    case 'P': {
      const fwd = side === 0 ? -1 : 1;
      const home = side === 0 ? [5,6,7,8,9] : [0,1,2,3,4];
      addIfValid(r + fwd, c);
      if (!home.includes(r)) { addIfValid(r, c - 1); addIfValid(r, c + 1); }
      break;
    }
  }
  return moves;
}

function isInCheck(board, side) {
  const king = findKing(board, side);
  if (!king) return true;
  const enemy = side === 0 ? 1 : 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].side === enemy) {
        for (const m of getPieceMoves(board, r, c)) {
          if (m.toRow === king.row && m.toCol === king.col) return true;
        }
      }
    }
  }
  return false;
}

function kingsAreFacing(board) {
  const rk = findKing(board, 0), bk = findKing(board, 1);
  if (!rk || !bk || rk.col !== bk.col) return false;
  for (let r = Math.min(rk.row, bk.row) + 1; r < Math.max(rk.row, bk.row); r++) {
    if (board[r][rk.col]) return false;
  }
  return true;
}

function applyMove(board, move) {
  const captured = board[move.toRow][move.toCol];
  board[move.toRow][move.toCol] = board[move.fromRow][move.fromCol];
  board[move.fromRow][move.fromCol] = null;
  return captured;
}

function undoMove(board, move, captured) {
  board[move.fromRow][move.fromCol] = board[move.toRow][move.toCol];
  board[move.toRow][move.toCol] = captured;
}

function getLegalMoves(board, side) {
  const all = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].side === side) {
        for (const m of getPieceMoves(board, r, c)) {
          const cap = applyMove(board, m);
          if (!isInCheck(board, side) && !kingsAreFacing(board)) all.push(m);
          undoMove(board, m, cap);
        }
      }
    }
  }
  return all;
}

// Transposition table
const TT = new Map();

function minimax(board, depth, alpha, beta, maximizing, side) {
  if (depth === 0) return evaluateBoard(board, side);

  const key = board.map(r => r.map(c => c ? `${c.type}${c.side}` : '0').join('')).join('|') + depth + maximizing;
  if (TT.has(key)) return TT.get(key);

  const currentSide = maximizing ? side : (side === 0 ? 1 : 0);
  const moves = getLegalMoves(board, currentSide);

  if (moves.length === 0) {
    return maximizing ? -99999 + (5 - depth) : 99999 - (5 - depth);
  }

  // Order moves: captures first
  moves.sort((a, b) => {
    const ca = board[a.toRow][a.toCol] ? PIECE_VALUES[board[a.toRow][a.toCol].type] || 0 : 0;
    const cb = board[b.toRow][b.toCol] ? PIECE_VALUES[board[b.toRow][b.toCol].type] || 0 : 0;
    return cb - ca;
  });

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const cap = applyMove(board, move);
      const val = minimax(board, depth - 1, alpha, beta, false, side);
      undoMove(board, move, cap);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    TT.set(key, best);
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const cap = applyMove(board, move);
      const val = minimax(board, depth - 1, alpha, beta, true, side);
      undoMove(board, move, cap);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (alpha >= beta) break;
    }
    TT.set(key, best);
    return best;
  }
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    // Clear TT to prevent memory issues
    if (TT.size > 10000) TT.clear();

    const board = state.board.map(row => row.map(cell => cell ? { ...cell } : null));
    const side = playerIndex;
    const moves = getLegalMoves(board, side);

    if (moves.length === 0) return null;

    // Order by capture value
    moves.sort((a, b) => {
      const ca = board[a.toRow][a.toCol] ? (PIECE_VALUES[board[a.toRow][a.toCol].type] || 0) : 0;
      const cb = board[b.toRow][b.toCol] ? (PIECE_VALUES[board[b.toRow][b.toCol].type] || 0) : 0;
      return cb - ca;
    });

    let bestMove = moves[0];
    let bestVal = -Infinity;
    const depth = getDepth(state, { easy: 1, normal: 2, hard: 3 });

    for (const move of moves) {
      const cap = applyMove(board, move);
      const val = minimax(board, depth - 1, -Infinity, Infinity, false, side);
      undoMove(board, move, cap);
      if (val > bestVal) {
        bestVal = val;
        bestMove = move;
      }
    }

    return {
      from: { row: bestMove.fromRow, col: bestMove.fromCol },
      to: { row: bestMove.toRow, col: bestMove.toCol },
    };
  },
});
