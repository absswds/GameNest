// games/chess.js — Chess (2 players)
// Full FIDE rules via vendored chess.js v0.12.1

const Chess = require('./vendor/chessjs').Chess;

const files = 'abcdefgh';

exports.name = 'chess';
exports.maxPlayers = 2;

exports.createState = () => ({
  currentPlayer: 0,
  winner: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  board: null,
  moveHistory: [],
  _playerCount: 2,
  _positions: {},   // position key -> times seen (threefold repetition)
});

// Position identity for repetition: board, side to move, castling, en passant (not the clocks).
function posKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function validSquare(p) {
  return !!p && Number.isInteger(p.row) && Number.isInteger(p.col) && p.row >= 0 && p.row < 8 && p.col >= 0 && p.col < 8;
}

function snapshotBoard(c) {
  var raw = c.board();
  var board = [];
  for (var r = 0; r < 8; r++) {
    var row = [];
    for (var col = 0; col < 8; col++) {
      var cell = raw[r][col];
      if (cell) {
        row.push({ type: cell.type.toUpperCase(), side: cell.color === 'w' ? 0 : 1 });
      } else {
        row.push(null);
      }
    }
    board.push(row);
  }
  return board;
}

function sqToCoord(sq) {
  return { row: 8 - parseInt(sq[1]), col: files.indexOf(sq[0]) };
}

function coordToSq(coord) {
  return files[coord.col] + (8 - coord.row);
}

exports.initGame = (state) => {
  var c = new Chess(state.fen);
  state.board = snapshotBoard(c);
  state._positions = {};
  state._positions[posKey(state.fen)] = 1;
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

  var from = data && data.from;
  var to = data && data.to;
  if (!validSquare(from) || !validSquare(to)) return 'ch_invalid_move';

  var sqFrom = coordToSq(from);
  var sqTo = coordToSq(to);

  var c = new Chess(state.fen);
  var promotion = (typeof data.promote === 'string' && data.promote ? data.promote : 'q').toLowerCase();
  var mv = c.move({ from: sqFrom, to: sqTo, promotion: promotion }, { sloppy: true });
  if (!mv) return 'ch_illegal_move';

  state.fen = c.fen();
  state.board = snapshotBoard(c);
  state.moveHistory.push({
    from: from,
    to: to,
    promotion: mv.promotion || null,
    piece: mv.piece,
    captured: mv.captured || null,
    san: mv.san,
  });

  // A fresh Chess(fen) has no move history, so its own repetition check never fires: count here.
  if (!state._positions) state._positions = {};
  var key = posKey(state.fen);
  state._positions[key] = (state._positions[key] || 0) + 1;

  if (c.in_checkmate()) {
    state.winner = playerIndex;
  } else if (c.in_draw() || state._positions[key] >= 3) { // in_draw: stalemate, insufficient material, 50-move
    state.winner = -1;
  } else {
    state.currentPlayer = 1 - state.currentPlayer;
  }

  return null;
};

exports.playerView = function (state, playerIndex) {
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    fen: state.fen,
    board: state.board,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount,
  };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    var c = new Chess(state.fen);
    view.legalMoves = c.moves({ verbose: true }).map(function (m) {
      return {
        from: sqToCoord(m.from),
        to: sqToCoord(m.to),
        promotion: m.promotion || null,
      };
    });
  } else {
    view.legalMoves = [];
  }
  return view;
};
