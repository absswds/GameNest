// games/checkers.js — English Draughts / 西洋跳棋 (2 players)
// 8×8 board, dark squares only, forced captures, king promotion

const ROWS = 8, COLS = 8;

exports.name = 'checkers';
exports.maxPlayers = 2;

// ---- Initial Board ----

function createInitialBoard() {
  var board = Array.from({ length: ROWS }, function() { return Array(COLS).fill(null); });
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r <= 2) board[r][c] = { type: 'm', side: 1 }; // black top
        else if (r >= 5) board[r][c] = { type: 'm', side: 0 }; // red bottom
      }
    }
  }
  return board;
}

exports.createState = function() {
  return {
    currentPlayer: 0, // 0=red 1=black, red first
    winner: null,     // null|0|1|-1(draw)
    board: null,
    mustCapture: false,
    moveHistory: [],
    _playerCount: 2,
  };
};

exports.initGame = function(state) {
  state.board = createInitialBoard();
  state.mustCapture = false;
  state.moveHistory = [];
};

// ---- Bounds Check ----

function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

// ---- Move Generation ----

// Returns all legal moves for a side.
// If mustCapture is true (forced continuation), only captures from a specific origin are returned.
// Format: [{ from:{row,col}, to:{row,col}, captures:[{row,col}] }]
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
  // Forced capture rule: if any captures exist, only captures are allowed
  if (captures.length > 0) return captures;
  return normals;
}

// Get normal (non-capture) moves for a piece
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

// Get all capture moves from (r,c) — multi-capture not included here (handled by server loop)
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

// Forward directions for a man: red(0) goes up (row-1), black(1) goes down (row+1)
function getForwardDirs(side, type) {
  if (type === 'k') return [[-1,-1],[-1,1],[1,-1],[1,1]];
  if (side === 0) return [[-1,-1],[-1,1]]; // red goes up
  return [[1,-1],[1,1]]; // black goes down
}

// All 4 diagonal directions for king
function getAllDirs(type) {
  return [[-1,-1],[-1,1],[1,-1],[1,1]];
}

// ---- Handle Move ----

exports.handleMove = function(data, state, playerIndex) {
  if (state.winner !== null) return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

  var from = data && data.from;
  var to = data && data.to;
  if (!from || !to) return 'g_invalid_action';
  var fr = from.row, fc = from.col, tr = to.row, tc = to.col;
  if (!inBounds(fr, fc) || !inBounds(tr, tc)) return 'ck_out_of_bounds';

  var piece = state.board[fr][fc];
  if (!piece) return 'ck_no_piece_there';
  if (piece.side !== playerIndex) return 'ck_not_your_piece';

  // Generate legal moves
  var origin = state.mustCapture ? { row: state._lastCaptureRow, col: state._lastCaptureCol } : null;
  var legalMoves = getLegalMoves(state.board, playerIndex, state.mustCapture, origin);

  // Find matching move
  var found = null;
  for (var i = 0; i < legalMoves.length; i++) {
    var m = legalMoves[i];
    if (m.from.row === fr && m.from.col === fc && m.to.row === tr && m.to.col === tc) {
      found = m;
      break;
    }
  }
  if (!found) return 'ck_illegal_move';

  // Execute move
  state.board[tr][tc] = piece;
  state.board[fr][fc] = null;

  // Remove captured piece
  var isCapture = found.captures && found.captures.length > 0;
  if (isCapture) {
    var cap = found.captures[0];
    state.board[cap.row][cap.col] = null;
  }

  state.moveHistory.push({ from: { row: fr, col: fc }, to: { row: tr, col: tc }, piece: { type: piece.type, side: piece.side }, captures: found.captures });

  // King promotion
  var promoted = false;
  if (piece.type === 'm') {
    if ((piece.side === 0 && tr === 0) || (piece.side === 1 && tr === 7)) {
      state.board[tr][tc] = { type: 'k', side: piece.side };
      promoted = true;
    }
  }

  // Check for further captures (multi-jump)
  if (isCapture) {
    var afterBoard = state.board;
    var canContinue = false;
    // Check if the piece that just moved can capture again from its new position
    var pieceAfter = afterBoard[tr][tc];
    if (pieceAfter) {
      var contCaptures = [];
      getCaptures(afterBoard, tr, tc, pieceAfter, playerIndex, contCaptures);
      canContinue = contCaptures.length > 0;
    }
    if (canContinue) {
      state.mustCapture = true;
      state._lastCaptureRow = tr;
      state._lastCaptureCol = tc;
      // Don't switch player — frontend sends next capture step
      return null;
    }
  }

  state.mustCapture = false;
  state._lastCaptureRow = undefined;
  state._lastCaptureCol = undefined;

  // Switch player
  state.currentPlayer = 1 - state.currentPlayer;

  // Check if opponent has any legal moves or pieces
  var opponent = state.currentPlayer;
  var opponentMoves = getLegalMoves(state.board, opponent, false, null);
  var hasOpponentPieces = false;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (state.board[r][c] && state.board[r][c].side === opponent) { hasOpponentPieces = true; break; }
    }
    if (hasOpponentPieces) break;
  }
  if (!hasOpponentPieces || opponentMoves.length === 0) {
    state.winner = playerIndex;
  }

  return null;
};

// ---- Per-player View ----

exports.playerView = function(state, playerIndex) {
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    board: state.board,
    mustCapture: state.mustCapture,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount,
  };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    var origin = state.mustCapture ? { row: state._lastCaptureRow, col: state._lastCaptureCol } : null;
    view.legalMoves = getLegalMoves(state.board, playerIndex, state.mustCapture, origin);
  } else {
    view.legalMoves = [];
  }
  return view;
};

// Expose getLegalMoves for bot
exports.getLegalMoves = getLegalMoves;
