// bots/chess.js — AI for Chess
// Negamax with alpha-beta pruning, depth 3, piece-square table evaluation

const Chess = require('../games/vendor/chessjs').Chess;
const { botName } = require('./lib/bot-name');

const files = 'abcdefgh';

exports.name = 'chess';

const PIECE_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const MATE = 100000;

// Piece-square tables (white perspective, index 0 = row 8 = white back rank)
// Source: Chess Programming Wiki public tables
const PST = {
  p: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5,  5,  5,  5,  5,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20],
  ],
  k_end: [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50],
  ],
};

function isEndgame(c) {
  var board = c.board();
  var queens = 0;
  var minors = 0;
  for (var r = 0; r < 8; r++) {
    for (var col = 0; col < 8; col++) {
      var p = board[r][col];
      if (p) {
        if (p.type === 'q') queens++;
        else if (p.type === 'n' || p.type === 'b') minors++;
      }
    }
  }
  return queens === 0 || (queens === 2 && minors <= 1);
}

function evaluate(c) {
  var board = c.board();
  var endgame = isEndgame(c);
  var score = 0;
  for (var r = 0; r < 8; r++) {
    for (var col = 0; col < 8; col++) {
      var p = board[r][col];
      if (!p) continue;
      var val = PIECE_VAL[p.type] || 0;
      var pstTable = (p.type === 'k' && endgame) ? PST.k_end : PST[p.type];
      // White perspective: row 0 = rank 8 (black back rank)
      var pstRow = p.color === 'w' ? r : 7 - r;
      var pst = pstTable[pstRow][col];
      if (p.color === 'w') {
        score += val + pst;
      } else {
        score -= val + pst;
      }
    }
  }
  // Return relative to side to move
  return c.turn() === 'w' ? score : -score;
}

function pieceVal(piece) {
  if (!piece) return 0;
  return PIECE_VAL[piece.type] || 0;
}

// Transposition table
var TT = new Map();

function negamax(c, depth, alpha, beta) {
  if (depth === 0) return evaluate(c);

  var key = c.fen() + '|' + depth;
  if (TT.has(key)) return TT.get(key);

  if (c.game_over()) {
    if (c.in_checkmate()) {
      var val = -MATE + (3 - depth);
      TT.set(key, val);
      return val;
    }
    TT.set(key, 0);
    return 0;
  }

  var moves = c.moves({ verbose: true });
  // Sort by capture value (MVV-LVA heuristic)
  moves.sort(function (a, b) {
    return pieceVal(b.captured) - pieceVal(a.captured);
  });

  var best = -Infinity;
  for (var i = 0; i < moves.length; i++) {
    c.move(moves[i]);
    var val = -negamax(c, depth - 1, -beta, -alpha);
    c.undo();
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  TT.set(key, best);
  return best;
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex: playerIndex,
  getMove: function (state) {
    if (TT.size > 10000) TT.clear();

    var c = new Chess(state.fen);
    if (c.game_over()) return null;

    var moves = c.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Sort by capture value
    moves.sort(function (a, b) {
      return pieceVal(b.captured) - pieceVal(a.captured);
    });

    var bestMove = moves[0];
    var bestVal = -Infinity;
    var depth = 3; // root + 2 layers

    for (var i = 0; i < moves.length; i++) {
      c.move(moves[i]);
      var val = -negamax(c, depth - 1, -Infinity, Infinity);
      c.undo();
      if (val > bestVal) {
        bestVal = val;
        bestMove = moves[i];
      }
    }

    return {
      from: { row: 8 - parseInt(bestMove.from[1]), col: files.indexOf(bestMove.from[0]) },
      to: { row: 8 - parseInt(bestMove.to[1]), col: files.indexOf(bestMove.to[0]) },
      promote: bestMove.promotion ? bestMove.promotion.toUpperCase() : undefined,
    };
  },
});
