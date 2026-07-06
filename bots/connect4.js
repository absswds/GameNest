// bots/connect4.js — AI for Connect Four
// Minimax with alpha-beta pruning, depth 6
// Window-scan evaluation (standard heuristic)

const ROWS = 6, COLS = 7;
const { botName } = require('./lib/bot-name');

exports.name = 'connect4';

// Column move order: center first (best branching)
const MOVE_ORDER = [3, 2, 4, 1, 5, 0, 6];

function cloneBoard(board) {
  return board.map(function(row) { return row.slice(); });
}

function getLegalMoves(board) {
  var moves = [];
  for (var i = 0; i < MOVE_ORDER.length; i++) {
    var c = MOVE_ORDER[i];
    if (board[0][c] === null) moves.push(c);
  }
  return moves;
}

function dropPiece(board, col, side) {
  for (var r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      board[r][col] = side;
      return r;
    }
  }
  return -1;
}

function removePiece(board, row, col) {
  board[row][col] = null;
}

function checkWinAt(board, row, col, side) {
  var dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (var d = 0; d < dirs.length; d++) {
    var dr = dirs[d][0], dc = dirs[d][1];
    var count = 1;
    for (var i = 1; i < 4; i++) {
      var r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === side) count++;
      else break;
    }
    for (var i = 1; i < 4; i++) {
      var r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === side) count++;
      else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

function isBoardFull(board) {
  for (var c = 0; c < COLS; c++) {
    if (board[0][c] === null) return false;
  }
  return true;
}

// Evaluate a window of 4 cells
function evaluateWindow(window, side) {
  var s = 0;
  var cntSide = 0, cntEmpty = 0, cntOpp = 0;
  for (var i = 0; i < 4; i++) {
    if (window[i] === side) cntSide++;
    else if (window[i] === null) cntEmpty++;
    else cntOpp++;
  }
  if (cntSide === 4) s += 10000;
  else if (cntSide === 3 && cntEmpty === 1) s += 100;
  else if (cntSide === 2 && cntEmpty === 2) s += 10;
  if (cntOpp === 3 && cntEmpty === 1) s -= 80;
  return s;
}

// Score entire board from side's perspective
function evaluateBoard(board, side) {
  var score = 0;

  // Center column preference
  var centerCount = 0;
  for (var r = 0; r < ROWS; r++) {
    if (board[r][3] === side) centerCount++;
  }
  score += centerCount * 6;

  // Horizontal windows
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c <= COLS - 4; c++) {
      var win = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
      score += evaluateWindow(win, side);
    }
  }

  // Vertical windows
  for (var c = 0; c < COLS; c++) {
    for (var r = 0; r <= ROWS - 4; r++) {
      var win = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
      score += evaluateWindow(win, side);
    }
  }

  // Diagonal (down-right)
  for (var r = 0; r <= ROWS - 4; r++) {
    for (var c = 0; c <= COLS - 4; c++) {
      var win = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
      score += evaluateWindow(win, side);
    }
  }

  // Diagonal (down-left)
  for (var r = 0; r <= ROWS - 4; r++) {
    for (var c = 3; c < COLS; c++) {
      var win = [board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]];
      score += evaluateWindow(win, side);
    }
  }

  return score;
}

// Terminal check
function isTerminal(board) {
  // Check if anyone won
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (board[r][c] !== null) {
        if (checkWinAt(board, r, c, board[r][c])) return true;
      }
    }
  }
  return isBoardFull(board);
}

// Minimax with alpha-beta
function minimax(board, depth, alpha, beta, maximizing, side) {
  var opponent = 1 - side;

  // Terminal or depth 0
  if (depth === 0 || isTerminal(board)) {
    // Check terminal states for big scores
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c] !== null && checkWinAt(board, r, c, board[r][c])) {
          return board[r][c] === side ? 100000 + depth : -(100000 + depth);
        }
      }
    }
    return evaluateBoard(board, side);
  }

  var moves = getLegalMoves(board);

  if (maximizing) {
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var col = moves[i];
      var row = dropPiece(board, col, side);
      var val = minimax(board, depth - 1, alpha, beta, false, side);
      removePiece(board, row, col);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    var best = Infinity;
    for (var i = 0; i < moves.length; i++) {
      var col = moves[i];
      var row = dropPiece(board, col, opponent);
      var val = minimax(board, depth - 1, alpha, beta, true, side);
      removePiece(board, row, col);
      if (val < best) best = val;
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
    var board = cloneBoard(state.board);
    var side = playerIndex;
    var moves = getLegalMoves(board);

    if (moves.length === 0) return null;

    var bestMove = moves[0];
    var bestVal = -Infinity;
    var depth = 6;

    for (var i = 0; i < moves.length; i++) {
      var col = moves[i];
      var row = dropPiece(board, col, side);
      var val = minimax(board, depth - 1, -Infinity, Infinity, false, side);
      removePiece(board, row, col);
      if (val > bestVal) {
        bestVal = val;
        bestMove = col;
      }
    }

    return { col: bestMove };
  },
});
