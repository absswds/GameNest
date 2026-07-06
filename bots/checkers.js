// bots/checkers.js — AI for 西洋跳棋 (English Draughts)
// Minimax with alpha-beta pruning, depth 5

const ROWS = 8, COLS = 8;

const { botName } = require('./lib/bot-name');
const { getDepth } = require('./lib/difficulty');

exports.name = 'checkers';

// ---- Move Generation (independent copy from games/checkers.js) ----

function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function getForwardDirs(side, type) {
  if (type === 'k') return [[-1,-1],[-1,1],[1,-1],[1,1]];
  if (side === 0) return [[-1,-1],[-1,1]];
  return [[1,-1],[1,1]];
}

function getAllDirs(type) {
  return [[-1,-1],[-1,1],[1,-1],[1,1]];
}

function getCaptures(board, r, c, piece, side, result) {
  var dirs = getAllDirs(piece.type);
  var enemy = 1 - side;
  for (var d = 0; d < dirs.length; d++) {
    var dr = dirs[d][0], dc = dirs[d][1];
    var mr = r + dr, mc = c + dc;
    var lr = r + 2 * dr, lc = c + 2 * dc;
    if (inBounds(lr, lc) && board[mr][mc] && board[mr][mc].side === enemy && !board[lr][lc]) {
      result.push({ from: { row: r, col: c }, to: { row: lr, col: lc }, captures: [{ row: mr, col: mc }] });
    }
  }
}

function getNormalMoves(board, r, c, piece, side, result) {
  var dirs = getForwardDirs(side, piece.type);
  for (var d = 0; d < dirs.length; d++) {
    var dr = dirs[d][0], dc = dirs[d][1];
    var nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && !board[nr][nc]) {
      result.push({ from: { row: r, col: c }, to: { row: nr, col: nc }, captures: [] });
    }
  }
}

function getLegalMoves(board, side, mustCapture, origin) {
  var captures = [];
  var normals = [];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var piece = board[r][c];
      if (!piece || piece.side !== side) continue;
      if (mustCapture && origin && (r !== origin.row || c !== origin.col)) continue;
      getCaptures(board, r, c, piece, side, captures);
      if (!mustCapture) getNormalMoves(board, r, c, piece, side, normals);
    }
  }
  if (captures.length > 0) return captures;
  return normals;
}

function getAllMovesForSide(board, side) {
  var captures = [];
  var normals = [];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var piece = board[r][c];
      if (!piece || piece.side !== side) continue;
      getCaptures(board, r, c, piece, side, captures);
      getNormalMoves(board, r, c, piece, side, normals);
    }
  }
  if (captures.length > 0) return captures;
  return normals;
}

// ---- Apply / Undo Move ----

function applyMove(board, move) {
  var piece = board[move.from.row][move.from.col];
  var captured = null;
  board[move.to.row][move.to.col] = piece;
  board[move.from.row][move.from.col] = null;
  if (move.captures && move.captures.length > 0) {
    var cap = move.captures[0];
    captured = board[cap.row][cap.col];
    board[cap.row][cap.col] = null;
  }
  return captured;
}

function undoMove(board, move, captured) {
  var piece = board[move.to.row][move.to.col];
  // Check if piece was promoted
  if (piece && piece.type === 'k') {
    var origPiece = null;
    if (captured !== null && move.captures && move.captures.length > 0) {
      // Restore captured piece
    }
    // Check if original was man
    var origSide = piece.side;
    var fromR = move.from.row;
    if ((origSide === 0 && fromR !== 0) || (origSide === 1 && fromR !== 7)) {
      piece = { type: 'm', side: origSide };
    }
  }
  board[move.from.row][move.from.col] = piece;
  board[move.to.row][move.to.col] = null;
  if (move.captures && move.captures.length > 0) {
    var cap = move.captures[0];
    board[cap.row][cap.col] = captured;
  }
}

// ---- Evaluation ----

function evaluateBoard(board, side) {
  var score = 0;
  var MAN_VAL = 100;
  var KING_VAL = 175;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var piece = board[r][c];
      if (!piece) continue;
      var val = piece.type === 'k' ? KING_VAL : MAN_VAL;
      // Advance bonus for men: closer to king row = more valuable
      if (piece.type === 'm') {
        var advance = piece.side === 0 ? (7 - r) : r; // 0 for starting row, 7 for king row
        val += advance * 5;
      }
      // Center control bonus
      var centerDist = Math.abs(c - 3.5) + Math.abs(r - 3.5);
      var centerBonus = Math.max(0, (7 - centerDist) * 2);
      val += centerBonus;
      if (piece.side === side) {
        score += val;
      } else {
        score -= val;
      }
    }
  }
  return score;
}

// ---- Minimax with Alpha-Beta ----

function minimax(board, depth, alpha, beta, maximizing, side) {
  if (depth === 0) return evaluateBoard(board, side);

  var currentSide = maximizing ? side : (1 - side);
  var moves = getAllMovesForSide(board, currentSide);

  if (moves.length === 0) {
    return maximizing ? -10000 + (5 - depth) : 10000 - (5 - depth);
  }

  // Sort captures first
  moves.sort(function(a, b) {
    return (b.captures ? b.captures.length : 0) - (a.captures ? a.captures.length : 0);
  });

  var i, val, cap;
  if (maximizing) {
    var best = -Infinity;
    for (i = 0; i < moves.length; i++) {
      cap = applyMove(board, moves[i]);
      val = minimax(board, depth - 1, alpha, beta, false, side);
      undoMove(board, moves[i], cap);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    var best2 = Infinity;
    for (i = 0; i < moves.length; i++) {
      cap = applyMove(board, moves[i]);
      val = minimax(board, depth - 1, alpha, beta, true, side);
      undoMove(board, moves[i], cap);
      if (val < best2) best2 = val;
      if (best2 < beta) beta = best2;
      if (alpha >= beta) break;
    }
    return best2;
  }
}

// ---- Bot Exports ----

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      // Deep copy board
      var board = state.board.map(function(row) {
        return row.map(function(cell) { return cell ? { type: cell.type, side: cell.side } : null; });
      });
      var side = playerIndex;
      var moves = getAllMovesForSide(board, side);
      if (moves.length === 0) return null;

      // If forced capture continuation, filter to only the capturing piece
      if (state.mustCapture) {
        var origin = { row: state._lastCaptureRow, col: state._lastCaptureCol };
        var contCaptures = [];
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) {
            var piece = board[r][c];
            if (!piece || piece.side !== side) continue;
            if (r !== origin.row || c !== origin.col) continue;
            getCaptures(board, r, c, piece, side, contCaptures);
          }
        }
        if (contCaptures.length > 0) moves = contCaptures;
      }

      // Sort captures first
      moves.sort(function(a, b) {
        return (b.captures ? b.captures.length : 0) - (a.captures ? a.captures.length : 0);
      });

      var depth = getDepth(state, { easy: 2, normal: 5, hard: 7 });
      var bestMove = moves[0];
      var bestVal = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var cap = applyMove(board, moves[i]);
        var val = minimax(board, depth - 1, -Infinity, Infinity, false, side);
        undoMove(board, moves[i], cap);
        if (val > bestVal) {
          bestVal = val;
          bestMove = moves[i];
        }
      }
      return { from: bestMove.from, to: bestMove.to };
    }
  };
};
