// bots/checkers.js — AI for 西洋跳棋 (English Draughts)
// Negamax with alpha-beta; searches whole turns (multi-jump continuation, promotion)

const ROWS = 8, COLS = 8;

const { botName } = require('./lib/bot-name');
const { getDepth, pickFor } = require('./lib/difficulty');

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
  var dirs = getForwardDirs(side, piece.type); // men capture forward only, same as games/checkers.js
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
// Returns undo info. A man reaching the far row is promoted (and ends its jump), matching games/checkers.js.

function applyMove(board, move) {
  var piece = board[move.from.row][move.from.col];
  var info = { piece: piece, captured: null, promoted: false };
  var placed = piece;
  if (piece.type === 'm' && ((piece.side === 0 && move.to.row === 0) || (piece.side === 1 && move.to.row === 7))) {
    placed = { type: 'k', side: piece.side };
    info.promoted = true;
  }
  board[move.to.row][move.to.col] = placed;
  board[move.from.row][move.from.col] = null;
  if (move.captures && move.captures.length > 0) {
    var cap = move.captures[0];
    info.captured = board[cap.row][cap.col];
    board[cap.row][cap.col] = null;
  }
  return info;
}

function undoMove(board, move, info) {
  board[move.from.row][move.from.col] = info.piece;
  board[move.to.row][move.to.col] = null;
  if (move.captures && move.captures.length > 0) {
    var cap = move.captures[0];
    board[cap.row][cap.col] = info.captured;
  }
}

// ---- Evaluation (from `side` point of view) ----

function evaluateBoard(board, side) {
  var score = 0;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var piece = board[r][c];
      if (!piece) continue;
      var val;
      if (piece.type === 'k') {
        val = 200;
      } else {
        val = 100 + (piece.side === 0 ? (7 - r) : r) * 6;
        // back-rank men guard the promotion squares
        if ((piece.side === 0 && r === 7) || (piece.side === 1 && r === 0)) val += 8;
      }
      var centerDist = Math.abs(c - 3.5) + Math.abs(r - 3.5);
      val += Math.max(0, (7 - centerDist)) * 2;
      score += piece.side === side ? val : -val;
    }
  }
  return score;
}

// ---- Negamax with Alpha-Beta ----
// cont = {row,col} when `side` must keep jumping with that piece, else null.

function turnMoves(board, side, cont) {
  var moves;
  if (cont) {
    moves = [];
    var p = board[cont.row][cont.col];
    if (p && p.side === side) getCaptures(board, cont.row, cont.col, p, side, moves);
  } else {
    moves = getAllMovesForSide(board, side);
  }
  return moves;
}

function search(board, side, cont, depth, alpha, beta) {
  var moves = turnMoves(board, side, cont);
  if (moves.length === 0) return -10000 - depth;
  if (depth <= 0 && !cont) return evaluateBoard(board, side);
  var best = -Infinity;
  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    var info = applyMove(board, m);
    var val;
    var next = null;
    if (m.captures.length > 0 && !info.promoted) {
      var more = [];
      getCaptures(board, m.to.row, m.to.col, board[m.to.row][m.to.col], side, more);
      if (more.length > 0) next = { row: m.to.row, col: m.to.col };
    }
    if (next) val = search(board, side, next, depth, alpha, beta);
    else val = -search(board, 1 - side, null, depth - 1, -beta, -alpha);
    undoMove(board, m, info);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// ---- Bot Exports ----

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      var board = state.board.map(function(row) {
        return row.map(function(cell) { return cell ? { type: cell.type, side: cell.side } : null; });
      });
      var side = playerIndex;
      var cont = state.mustCapture ? { row: state._lastCaptureRow, col: state._lastCaptureCol } : null;
      var moves = turnMoves(board, side, cont);
      if (moves.length === 0 && cont && Array.isArray(state.legalMoves)) moves = state.legalMoves;
      if (moves.length === 0) return null;
      if (moves.length === 1) return { from: moves[0].from, to: moves[0].to };

      var depth = getDepth(state, DEPTHS);
      var cands = [];
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i];
        var info = applyMove(board, m);
        var next = null;
        if (m.captures.length > 0 && !info.promoted) {
          var more = [];
          getCaptures(board, m.to.row, m.to.col, board[m.to.row][m.to.col], side, more);
          if (more.length > 0) next = { row: m.to.row, col: m.to.col };
        }
        var val = next ? search(board, side, next, depth - 1, -Infinity, Infinity)
                       : -search(board, 1 - side, null, depth - 1, -Infinity, Infinity);
        undoMove(board, m, info);
        cands.push({ move: m, score: val });
      }
      var pick = pickFor(state, cands, PICK);
      return { from: pick.from, to: pick.to };
    }
  };
};

var DEPTHS = { easy: 2, normal: 4, hard: 8 };
var PICK = { temp: { easy: 80, normal: 20 }, maxLoss: { easy: 300, normal: 60 } };
