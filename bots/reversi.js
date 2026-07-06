// bots/reversi.js — AI for 黑白棋
// Minimax + alpha-beta pruning, variable board size (8/10/12)
// Standard Othello heuristics with dynamic PST generation

const { botName } = require('./lib/bot-name');
const { getDepth } = require('./lib/difficulty');

exports.name = 'reversi';

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function getSize(state) {
  var bs = (state._options && state._options.boardSize) || 8;
  return { ROWS: bs, COLS: bs };
}

function generateWeights(n) {
  var w = [];
  for (var r = 0; r < n; r++) {
    w[r] = [];
    for (var c = 0; c < n; c++) {
      var cornerDist = Math.min(r, c, n - 1 - r, n - 1 - c);
      if (cornerDist === 0) {
        w[r][c] = 120;
      } else if (cornerDist === 1) {
        var edgeDist = Math.min(r, n - 1 - r, c, n - 1 - c);
        w[r][c] = edgeDist === 0 ? -20 : -40;
      } else {
        w[r][c] = Math.max(0, 20 - cornerDist * 3);
      }
    }
  }
  return w;
}

var cachedPST = null;
var cachedN = 0;

function getPST(n) {
  if (cachedN === n && cachedPST) return cachedPST;
  cachedPST = generateWeights(n);
  cachedN = n;
  return cachedPST;
}

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

function cloneBoard(board) {
  return board.map(function(row) { return row.slice(); });
}

function applyMove(board, move, side) {
  var flipped = [];
  board[move.row][move.col] = side;
  for (var i = 0; i < move.flips.length; i++) {
    var f = move.flips[i];
    flipped.push({ row: f.row, col: f.col, prev: board[f.row][f.col] });
    board[f.row][f.col] = side;
  }
  return flipped;
}

function undoMove(board, move, flipped) {
  board[move.row][move.col] = null;
  for (var i = 0; i < flipped.length; i++) {
    var f = flipped[i];
    board[f.row][f.col] = f.prev;
  }
}

function evaluate(board, side, ROWS, COLS, PST) {
  var enemy = 1 - side;
  var score = 0;
  var myCount = 0, oppCount = 0;

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var v = board[r][c];
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

  var last = ROWS - 1;
  var corners = [[0,0],[0,last],[last,0],[last,last]];
  for (var ci = 0; ci < corners.length; ci++) {
    var cr = corners[ci][0], cc = corners[ci][1];
    if (board[cr][cc] === side) score += 25;
    else if (board[cr][cc] === enemy) score -= 25;
  }

  var xSquares = [[1,1],[1,last-1],[last-1,1],[last-1,last-1]];
  for (var xi = 0; xi < xSquares.length; xi++) {
    var xr = xSquares[xi][0], xc = xSquares[xi][1];
    var cornerR = xr === 1 ? 0 : last;
    var cornerC = xc === 1 ? 0 : last;
    if (board[xr][xc] === side) {
      if (board[cornerR][cornerC] === null) score -= 10;
    } else if (board[xr][xc] === enemy) {
      if (board[cornerR][cornerC] === null) score += 10;
    }
  }

  var myMoves = getLegalMoves(board, side, ROWS, COLS).length;
  var oppMoves = getLegalMoves(board, enemy, ROWS, COLS).length;
  score += (myMoves - oppMoves) * 5;

  var totalCells = ROWS * COLS;
  if (myCount + oppCount > totalCells * 0.8) {
    score += (myCount - oppCount) * 20;
  }

  return score;
}

function minimax(board, depth, alpha, beta, maximizing, side, ROWS, COLS, PST) {
  if (depth === 0) return evaluate(board, side, ROWS, COLS, PST);

  var currentSide = maximizing ? side : (1 - side);
  var moves = getLegalMoves(board, currentSide, ROWS, COLS);

  if (moves.length === 0) {
    return minimax(board, depth - 1, alpha, beta, !maximizing, side, ROWS, COLS, PST);
  }

  if (maximizing) {
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var move = moves[i];
      var flipped = applyMove(board, move, currentSide);
      var val = minimax(board, depth - 1, alpha, beta, false, side, ROWS, COLS, PST);
      undoMove(board, move, flipped);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    var best = Infinity;
    for (var i = 0; i < moves.length; i++) {
      var move = moves[i];
      var flipped = applyMove(board, move, currentSide);
      var val = minimax(board, depth - 1, alpha, beta, true, side, ROWS, COLS, PST);
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
    var sz = getSize(state);
    var ROWS = sz.ROWS, COLS = sz.COLS;
    var PST = getPST(ROWS);
    var board = cloneBoard(state.board);
    var side = playerIndex;
    var moves = getLegalMoves(board, side, ROWS, COLS);

    if (moves.length === 0) return { pass: true };
    if (moves.length === 1) return { row: moves[0].row, col: moves[0].col };

    moves.sort(function(a, b) {
      var va = PST[a.row][a.col] + a.flips.length * 2;
      var vb = PST[b.row][b.col] + b.flips.length * 2;
      return vb - va;
    });

    var depth = getDepth(state, { easy: 2, normal: 4, hard: 6 });
    var bestMove = moves[0];
    var bestVal = -Infinity;

    for (var i = 0; i < moves.length; i++) {
      var move = moves[i];
      var flipped = applyMove(board, move, side);
      var val = minimax(board, depth - 1, -Infinity, Infinity, false, side, ROWS, COLS, PST);
      undoMove(board, move, flipped);
      if (val > bestVal) {
        bestVal = val;
        bestMove = move;
      }
    }

    return { row: bestMove.row, col: bestMove.col };
  },
});
