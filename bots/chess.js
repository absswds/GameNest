// bots/chess.js — AI for Chess
// Iterative-deepening negamax with alpha-beta, PVS, TT, killer/history heuristics, and quiescence search

const Chess = require('../games/vendor/chessjs').Chess;
const { botName } = require('./lib/bot-name');
const { getDepth, getDifficulty, pickFor } = require('./lib/difficulty');

const files = 'abcdefgh';

exports.name = 'chess';

const PIECE_VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const MATE = 100000;
const MAX_Q_DEPTH = 4;
const MAX_PLY = 32;

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;
const TT_MAX_SIZE = 50000;

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

function isEndgame(board) {
  if (!Array.isArray(board)) board = board.board();
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
  var endgame = isEndgame(board);
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
  return PIECE_VAL[piece] || PIECE_VAL[piece.type] || 0;
}

function moveKey(m) {
  return m.promotion ? (m.from + m.to + m.promotion) : (m.from + m.to);
}

function posKey(fen) {
  var i = fen.lastIndexOf(' ');
  i = fen.lastIndexOf(' ', i - 1);
  return fen.slice(0, i);
}

function toTTScore(score, ply) {
  if (score > MATE - 1000) return score + ply;
  if (score < -MATE + 1000) return score - ply;
  return score;
}

function fromTTScore(score, ply) {
  if (score > MATE - 1000) return score - ply;
  if (score < -MATE + 1000) return score + ply;
  return score;
}

function getNodes(state, nodeMap) {
  var n = state && state._options && state._options.botNodes;
  if (Number.isInteger(n) && n > 0) return n;
  var diff = getDifficulty(state);
  return nodeMap[diff] || nodeMap.normal || 10000;
}

// Transposition table & search state
var TT = new Map();
var killers = [];
var history = {};
var searchNodes = 0;
var searchMaxNodes = 0;
var searchAborted = false;

function resetHeuristics() {
  killers = [];
  for (var i = 0; i < MAX_PLY; i++) {
    killers.push([null, null]);
  }
  history = {};
}

function recordKiller(ply, mKey, m, depth) {
  if (ply < MAX_PLY) {
    var kp = killers[ply];
    if (kp[0] !== mKey) {
      kp[1] = kp[0];
      kp[0] = mKey;
    }
  }
  var hKey = m.piece + m.to;
  var bonus = (history[hKey] || 0) + depth * depth;
  history[hKey] = bonus > 50000 ? 50000 : bonus;
}

function scoreMove(m, ttBestMove, ply) {
  var mKey = moveKey(m);
  if (ttBestMove && mKey === ttBestMove) return 1000000;
  if (m.captured || m.promotion) {
    var capVal = m.captured ? (PIECE_VAL[m.captured] || 0) : 0;
    var promoVal = m.promotion ? (PIECE_VAL[m.promotion] || 0) : 0;
    var atkVal = PIECE_VAL[m.piece] || 0;
    return 100000 + promoVal + capVal * 10 - (atkVal >> 4);
  }
  if (ply < MAX_PLY) {
    var kp = killers[ply];
    if (kp[0] === mKey) return 90000;
    if (kp[1] === mKey) return 80000;
  }
  return history[m.piece + m.to] || 0;
}

function sortByOrder(arr) {
  for (var i = 1; i < arr.length; i++) {
    var item = arr[i];
    var ord = item._order;
    var j = i - 1;
    while (j >= 0 && arr[j]._order < ord) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = item;
  }
}

function quiesce(c, alpha, beta, qDepth, ply) {
  if (searchNodes >= searchMaxNodes) {
    searchAborted = true;
    return evaluate(c);
  }
  searchNodes++;

  if (c.in_checkmate()) return -MATE + ply;

  var key = posKey(c.fen());
  var entry = TT.get(key);
  var standPat = (entry && entry.eval !== undefined) ? entry.eval : evaluate(c);
  if (entry && entry.eval === undefined) entry.eval = standPat;

  if (standPat >= beta) return standPat;
  if (standPat > alpha) alpha = standPat;
  if (qDepth <= 0) return standPat;

  var allMoves;
  if (entry && entry.moves) {
    allMoves = entry.moves;
  } else {
    allMoves = c.moves({ verbose: true });
    if (entry) {
      entry.moves = allMoves;
    } else if (TT.size < TT_MAX_SIZE) {
      TT.set(key, {
        depth: -1,
        score: 0,
        flag: TT_UPPER,
        bestMove: null,
        moves: allMoves,
        eval: standPat,
      });
    }
  }

  if (allMoves.length === 0) return 0;

  var caps = [];
  for (var i = 0; i < allMoves.length; i++) {
    var m = allMoves[i];
    if (m.captured || m.promotion) {
      var capVal = m.captured ? (PIECE_VAL[m.captured] || 0) : 0;
      var promoVal = m.promotion ? (PIECE_VAL[m.promotion] || 0) : 0;
      var atkVal = PIECE_VAL[m.piece] || 0;
      m._order = promoVal + capVal * 10 - (atkVal >> 4);
      caps.push(m);
    }
  }

  if (caps.length === 0) return standPat;
  sortByOrder(caps);

  for (var j = 0; j < caps.length; j++) {
    c.move(caps[j]);
    var val = -quiesce(c, -beta, -alpha, qDepth - 1, ply + 1);
    c.undo();
    if (searchAborted) return standPat;
    if (val > standPat) standPat = val;
    if (standPat > alpha) alpha = standPat;
    if (alpha >= beta) break;
  }

  return standPat;
}

function negamax(c, depth, alpha, beta, ply) {
  if (depth <= 0) {
    return quiesce(c, alpha, beta, MAX_Q_DEPTH, ply);
  }
  if (searchNodes >= searchMaxNodes) {
    searchAborted = true;
    return evaluate(c);
  }
  searchNodes++;

  var alpha0 = alpha;
  var key = posKey(c.fen());
  var entry = TT.get(key);
  var ttMove = null;

  if (entry) {
    ttMove = entry.bestMove;
    if (entry.depth >= depth) {
      var ttScore = fromTTScore(entry.score, ply);
      if (entry.flag === TT_EXACT) return ttScore;
      if (entry.flag === TT_LOWER && ttScore > alpha) alpha = ttScore;
      else if (entry.flag === TT_UPPER && ttScore < beta) beta = ttScore;
      if (alpha >= beta) return ttScore;
    }
  }

  var rawMoves;
  if (entry && entry.moves) {
    rawMoves = entry.moves;
  } else {
    rawMoves = c.moves({ verbose: true });
    if (entry) {
      entry.moves = rawMoves;
    }
  }

  if (rawMoves.length === 0) {
    return c.in_check() ? -MATE + ply : 0;
  }

  var moves = rawMoves.slice();
  for (var k = 0; k < moves.length; k++) {
    moves[k]._order = scoreMove(moves[k], ttMove, ply);
  }
  sortByOrder(moves);

  var best = -Infinity;
  var bestMoveKey = ttMove;

  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    c.move(m);
    var val;
    if (i === 0) {
      val = -negamax(c, depth - 1, -beta, -alpha, ply + 1);
    } else {
      val = -negamax(c, depth - 1, -alpha - 1, -alpha, ply + 1);
      if (!searchAborted && val > alpha && val < beta) {
        val = -negamax(c, depth - 1, -beta, -alpha, ply + 1);
      }
    }
    c.undo();

    if (searchAborted) return best > -Infinity ? best : evaluate(c);

    if (val > best) {
      best = val;
      bestMoveKey = moveKey(m);
    }
    if (best > alpha) {
      alpha = best;
    }
    if (alpha >= beta) {
      if (!m.captured && !m.promotion) {
        recordKiller(ply, moveKey(m), m, depth);
      }
      break;
    }
  }

  if (!searchAborted && TT.size < TT_MAX_SIZE) {
    var flag = best <= alpha0 ? TT_UPPER : (best >= beta ? TT_LOWER : TT_EXACT);
    TT.set(key, {
      depth: depth,
      score: toTTScore(best, ply),
      flag: flag,
      bestMove: bestMoveKey,
      moves: rawMoves,
      eval: entry ? entry.eval : undefined,
    });
  }

  return best;
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex: playerIndex,
  getMove: function (state) {
    var c = new Chess(state.fen);
    if (c.game_over()) return null;

    var moves = c.moves({ verbose: true });
    if (moves.length === 0) return null;

    var bestMove = null;

    // Forced fast path 1: single legal move -> return immediately
    if (moves.length === 1) {
      bestMove = moves[0];
    } else {
      // Forced fast path 2: mate-in-1 must always be played at every difficulty
      var mateCands = [];
      for (var mi = 0; mi < moves.length; mi++) {
        c.move(moves[mi]);
        if (c.in_checkmate()) {
          mateCands.push({ move: moves[mi], score: MATE - 1 });
        }
        c.undo();
      }

      if (mateCands.length > 0) {
        bestMove = pickFor(state, mateCands, PICK);
      } else {
        TT.clear();
        resetHeuristics();

        var maxDepth = getDepth(state, DEPTHS);
        var maxNodes = getNodes(state, NODES);
        searchNodes = 0;
        searchMaxNodes = maxNodes;
        searchAborted = false;

        var orderedMoves = moves.slice();
        for (var i = 0; i < orderedMoves.length; i++) {
          orderedMoves[i]._order = scoreMove(orderedMoves[i], null, 0);
        }
        sortByOrder(orderedMoves);

        var lastCands = orderedMoves.map(function (m) {
          return { move: m, score: m._order };
        });

        var diff = getDifficulty(state);
        var o = (state && state._options) || {};
        var hasCustomPick = typeof o.botTemp === 'number' || typeof o.botMaxLoss === 'number' || typeof o.botLossK === 'number';
        var rootMargin = (diff === 'hard' && !hasCustomPick) ? 1 : 260;
        if (typeof o.botMaxLoss === 'number' && o.botMaxLoss + 10 > rootMargin) {
          rootMargin = o.botMaxLoss + 10;
        }

        var positions = state && state._positions;

        for (var d = 1; d <= maxDepth; d++) {
          var currentCands = [];
          var bestRootScore = -Infinity;

          for (var r = 0; r < orderedMoves.length; r++) {
            var rm = orderedMoves[r];
            c.move(rm);

            var repKey = positions ? posKey(c.fen()) : null;
            var repCount = (repKey && positions[repKey]) || 0;

            var val;
            if (repCount >= 2) {
              val = 0;
            } else if (d === 1 || r === 0) {
              val = -negamax(c, d - 1, -Infinity, Infinity, 1);
            } else {
              var rootAlpha = bestRootScore - rootMargin;
              val = -negamax(c, d - 1, -rootAlpha - 1, -rootAlpha, 1);
              if (!searchAborted && val > rootAlpha) {
                val = -negamax(c, d - 1, -Infinity, -rootAlpha, 1);
              }
            }
            c.undo();

            if (searchAborted) break;

            if (repCount === 1 && val > 0 && val < MATE - 1000) {
              val -= 15;
            }

            if (val > bestRootScore) {
              bestRootScore = val;
            }
            currentCands.push({ move: rm, score: val });
          }

          if (searchAborted) break;

          lastCands = currentCands;
          lastCands.sort(function (a, b) {
            return b.score - a.score;
          });
          for (var u = 0; u < lastCands.length; u++) {
            orderedMoves[u] = lastCands[u].move;
          }
        }

        bestMove = pickFor(state, lastCands, PICK);
      }
    }

    return {
      from: { row: 8 - parseInt(bestMove.from[1]), col: files.indexOf(bestMove.from[0]) },
      to: { row: 8 - parseInt(bestMove.to[1]), col: files.indexOf(bestMove.to[0]) },
      promote: bestMove.promotion ? bestMove.promotion.toUpperCase() : undefined,
    };
  },
});

var DEPTHS = { easy: 1, normal: 3, hard: 4 };
// chess.js move generation manages only ~3-4k nodes/s in Node, so budgets keep hard near 1 s per move on a desktop
var NODES = { easy: 800, normal: 1800, hard: 3000 };
var PICK = { temp: { easy: 60, normal: 15 }, maxLoss: { easy: 200, normal: 60 } };
