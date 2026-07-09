// games/reversi.js — 黑白棋 (2 players)
// Variable board size 8×8 / 10×10 / 12×12

exports.name = 'reversi';
exports.maxPlayers = 2;

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function getSize(state) {
  var bs = (state._options && state._options.boardSize) || 8;
  return { ROWS: bs, COLS: bs };
}

exports.createState = () => ({
  currentPlayer: 0,
  winner: null,
  board: null,
  passCount: 0,
  lastMove: null,
  scores: { 0: 2, 1: 2 },
  moveHistory: [],
  _playerCount: 2,
  _options: {},
});

exports.initGame = (state) => {
  var sz = getSize(state);
  var ROWS = sz.ROWS, COLS = sz.COLS;
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  var mid = Math.floor(ROWS / 2);
  state.board[mid - 1][mid - 1] = 1;
  state.board[mid][mid] = 1;
  state.board[mid - 1][mid] = 0;
  state.board[mid][mid - 1] = 0;
  state.scores = { 0: 2, 1: 2 };
  state.passCount = 0;
  state.lastMove = null;
  state.moveHistory = [];
  state._playerCount = 2;
};

function inBounds(r, c, ROWS, COLS) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function getFlips(board, row, col, side, ROWS, COLS) {
  if (board[row][col] !== null) return [];
  var enemy = 1 - side;
  var allFlips = [];
  for (var d = 0; d < DIRS.length; d++) {
    var dr = DIRS[d][0], dc = DIRS[d][1];
    var dirFlips = [];
    var r = row + dr, c = col + dc;
    while (inBounds(r, c, ROWS, COLS) && board[r][c] === enemy) {
      dirFlips.push({ row: r, col: c });
      r += dr; c += dc;
    }
    if (dirFlips.length > 0 && inBounds(r, c, ROWS, COLS) && board[r][c] === side) {
      for (var f = 0; f < dirFlips.length; f++) allFlips.push(dirFlips[f]);
    }
  }
  return allFlips;
}

function getLegalMoves(board, side, ROWS, COLS) {
  var moves = [];
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (board[r][c] !== null) continue;
      var flips = getFlips(board, r, c, side, ROWS, COLS);
      if (flips.length > 0) {
        moves.push({ row: r, col: c, flips: flips });
      }
    }
  }
  return moves;
}

function countPieces(board, ROWS, COLS) {
  var c0 = 0, c1 = 0;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (board[r][c] === 0) c0++;
      else if (board[r][c] === 1) c1++;
    }
  }
  return { 0: c0, 1: c1 };
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

  var sz = getSize(state);
  var ROWS = sz.ROWS, COLS = sz.COLS;

  if (data && data.pass) {
    state.passCount++;
    if (state.passCount >= 2) {
      var scores = countPieces(state.board, ROWS, COLS);
      state.scores = scores;
      state.winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
      return null;
    }
    state.currentPlayer = 1 - playerIndex;
    return null;
  }

  var row = data && data.row, col = data && data.col;
  if (row === undefined || col === undefined) return 'rv_invalid_move';
  if (!inBounds(row, col, ROWS, COLS)) return 'rv_out_of_bounds';
  if (state.board[row][col] !== null) return 'rv_cell_occupied';

  var legalMoves = getLegalMoves(state.board, playerIndex, ROWS, COLS);
  var matched = null;
  for (var i = 0; i < legalMoves.length; i++) {
    if (legalMoves[i].row === row && legalMoves[i].col === col) {
      matched = legalMoves[i];
      break;
    }
  }
  if (!matched) return 'rv_illegal_move';

  state.board[row][col] = playerIndex;
  for (var fi = 0; fi < matched.flips.length; fi++) {
    var f = matched.flips[fi];
    state.board[f.row][f.col] = playerIndex;
  }
  state.lastMove = { row: row, col: col };
  state.scores = countPieces(state.board, ROWS, COLS);
  state.passCount = 0;
  state.moveHistory.push({ row: row, col: col, flips: matched.flips, player: playerIndex });

  var opponent = 1 - playerIndex;
  var opponentMoves = getLegalMoves(state.board, opponent, ROWS, COLS);
  if (opponentMoves.length > 0) {
    state.currentPlayer = opponent;
  } else {
    var myMoves = getLegalMoves(state.board, playerIndex, ROWS, COLS);
    if (myMoves.length === 0) {
      var finalScores = countPieces(state.board, ROWS, COLS);
      state.scores = finalScores;
      state.winner = finalScores[0] > finalScores[1] ? 0 : finalScores[1] > finalScores[0] ? 1 : -1;
    }
    state.currentPlayer = playerIndex;
  }

  return null;
};

exports.playerView = function(state, playerIndex) {
  var sz = getSize(state);
  var ROWS = sz.ROWS, COLS = sz.COLS;
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    board: state.board,
    passCount: state.passCount,
    scores: state.scores,
    lastMove: state.lastMove,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount,
    boardSize: sz.ROWS,
  };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = getLegalMoves(state.board, playerIndex, ROWS, COLS);
  } else {
    view.legalMoves = [];
  }
  return view;
};
