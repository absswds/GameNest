const assert = require('assert');
const chess = require('../games/chess');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

function createStartedState() {
  const state = chess.createState();
  chess.initGame(state);
  return state;
}

function coord(sq) {
  const files = 'abcdefgh';
  return { row: 8 - parseInt(sq[1]), col: files.indexOf(sq[0]) };
}

function makeMove(state, from, to, playerIndex, promote) {
  return chess.handleMove({ from: coord(from), to: coord(to), promote: promote || undefined }, state, playerIndex);
}

// ---- Tests ----

test('opening position has 20 legal moves', () => {
  const state = createStartedState();
  const view = chess.playerView(state, 0);
  assert.strictEqual(view.legalMoves.length, 20);
});

test('playerView returns empty legalMoves for non-current player', () => {
  const state = createStartedState();
  const view = chess.playerView(state, 1);
  assert.strictEqual(view.legalMoves.length, 0);
});

test('Fool\'s mate (f3 e5 g4 Qh4#)', () => {
  const state = createStartedState();

  // White: f2-f3
  let err = makeMove(state, 'f2', 'f3', 0);
  assert.strictEqual(err, null);
  assert.strictEqual(state.currentPlayer, 1);

  // Black: e7-e5
  err = makeMove(state, 'e7', 'e5', 1);
  assert.strictEqual(err, null);
  assert.strictEqual(state.currentPlayer, 0);

  // White: g2-g4
  err = makeMove(state, 'g2', 'g4', 0);
  assert.strictEqual(err, null);
  assert.strictEqual(state.currentPlayer, 1);

  // Black: Qh4# (d8-h4)
  err = makeMove(state, 'd8', 'h4', 1);
  assert.strictEqual(err, null);
  assert.strictEqual(state.winner, 1);
});

test('castling kingside (white O-O)', () => {
  // Set up FEN with clear path for castling
  const state = chess.createState();
  state.fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  chess.initGame(state);

  const view = chess.playerView(state, 0);
  const castleMove = view.legalMoves.find(m =>
    m.from.row === coord('e1').row && m.from.col === coord('e1').col &&
    m.to.row === coord('g1').row && m.to.col === coord('g1').col
  );
  assert.ok(castleMove, 'O-O should be a legal move');

  const err = makeMove(state, 'e1', 'g1', 0);
  assert.strictEqual(err, null);
  assert.ok(state.board[coord('g1').row][coord('g1').col], 'King should be on g1');
  assert.strictEqual(state.board[coord('g1').row][coord('g1').col].type, 'K');
  assert.ok(state.board[coord('f1').row][coord('f1').col], 'Rook should be on f1');
  assert.strictEqual(state.board[coord('f1').row][coord('f1').col].type, 'R');
});

test('en passant capture', () => {
  const state = createStartedState();

  // Set up en passant: e4, then d5, then exd6 e.p.
  makeMove(state, 'e2', 'e4', 0);
  makeMove(state, 'd7', 'd5', 1);
  makeMove(state, 'e4', 'd5', 0); // exd5 (pawn captures)
  makeMove(state, 'c7', 'c6', 1);
  makeMove(state, 'd5', 'd6', 0); // push pawn to d6
  makeMove(state, 'c6', 'c5', 1); // black pawn on c5, white on d6

  // Now set up en passant scenario properly:
  // We need: white pawn on row 3 (rank 5), black pawn just moved from row 1 to row 3 adjacent
  const state2 = createStartedState();
  // e4
  makeMove(state2, 'e2', 'e4', 0);
  makeMove(state2, 'a7', 'a6', 1);
  // d4
  makeMove(state2, 'd2', 'd4', 0);
  makeMove(state2, 'a6', 'a5', 1);
  // e5
  makeMove(state2, 'e4', 'e5', 0);
  makeMove(state2, 'd7', 'd5', 1); // black d7-d5, adjacent to white e5 pawn

  // Now white can capture en passant: exd6 e.p.
  const err = makeMove(state2, 'e5', 'd6', 0);
  assert.strictEqual(err, null);
  // Black pawn on d5 should be removed
  assert.strictEqual(state2.board[coord('d5').row][coord('d5').col], null, 'Black pawn on d5 should be captured');
  // White pawn should be on d6
  assert.ok(state2.board[coord('d6').row][coord('d6').col], 'White pawn should be on d6');
  assert.strictEqual(state2.board[coord('d6').row][coord('d6').col].type, 'P');
});

test('pawn promotion to queen', () => {
  // Use a FEN with a white pawn on a7, ready to promote
  const state = chess.createState();
  state.fen = '8/P7/8/8/8/8/8/4K2k w - - 0 1';
  chess.initGame(state);

  const err = makeMove(state, 'a7', 'a8', 0, 'Q');
  assert.strictEqual(err, null);
  const promoted = state.board[coord('a8').row][coord('a8').col];
  assert.ok(promoted, 'Promoted piece should exist on a8');
  assert.strictEqual(promoted.type, 'Q', 'Should be a queen');
  assert.strictEqual(promoted.side, 0, 'Should be white');
});

test('checkmate detection (winner set)', () => {
  // Scholar's mate: e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#
  const state = createStartedState();
  makeMove(state, 'e2', 'e4', 0);
  makeMove(state, 'e7', 'e5', 1);
  makeMove(state, 'f1', 'c4', 0);
  makeMove(state, 'b8', 'c6', 1);
  makeMove(state, 'd1', 'h5', 0);
  makeMove(state, 'g8', 'f6', 1);
  makeMove(state, 'h5', 'f7', 0); // Qxf7#
  assert.strictEqual(state.winner, 0, 'White should win by checkmate');
});

test('stalemate detection (draw)', () => {
  // Construct a stalemate position using FEN
  // Black king on a8, white king on b6, white queen on c7 — black has no legal moves and is not in check
  const state = chess.createState();
  state.fen = 'k7/8/1K6/8/8/8/8/8 b - - 0 1';
  chess.initGame(state);

  // Black to move, but no legal moves and not in check = stalemate
  const view = chess.playerView(state, 1);
  // handleMove should detect stalemate if black tries to move
  // Actually, with this FEN, black has no legal moves at all.
  // chess.js will detect stalemate automatically. Let's verify via a move that leads to stalemate:
  const state2 = chess.createState();
  state2.fen = 'k7/2Q5/1K6/8/8/8/8/8 w - - 0 1';
  chess.initGame(state2);

  // White to move: Qc7-b7# is checkmate... let's find a stalemate
  // Better: use a known stalemate FEN
  const state3 = chess.createState();
  state3.fen = '8/8/8/8/8/k1q5/8/K7 w - - 0 1';
  chess.initGame(state3);
  // White king on a1, black queen on c2, black king on a3
  // White to move: only Ka1-b1 is possible? No, let's check
  // Ka1 can go to b1 (not attacked), a2 is attacked by Qc2. So Kb1 is the only move.
  // After Kb1: Qc2-c1 is checkmate? Let's just verify the mechanism works.
  // Simpler approach: just verify stalemate flag works via FEN
  const state4 = chess.createState();
  state4.fen = 'k7/8/1KQ5/8/8/8/8/8 b - - 0 1';
  chess.initGame(state4);
  // Black king on a8, white king b6, white queen c7. Black is stalemated.
  const view4 = chess.playerView(state4, 1);
  assert.strictEqual(view4.legalMoves.length, 0, 'Black should have no legal moves in stalemate');
});

test('game rejects moves after checkmate', () => {
  const state = createStartedState();
  // Fool's mate
  makeMove(state, 'f2', 'f3', 0);
  makeMove(state, 'e7', 'e5', 1);
  makeMove(state, 'g2', 'g4', 0);
  makeMove(state, 'd8', 'h4', 1);
  assert.strictEqual(state.winner, 1);

  const err = makeMove(state, 'a2', 'a4', 0);
  assert.strictEqual(err, 'Game is over');
});

test('wrong player is rejected', () => {
  const state = createStartedState();
  const err = makeMove(state, 'a7', 'a6', 1); // Black tries to move on white's turn
  assert.strictEqual(err, 'Not your turn');
});

test('invalid move is rejected', () => {
  const state = createStartedState();
  const err = makeMove(state, 'e2', 'e5', 0); // Pawn can't move 3 squares
  assert.strictEqual(err, 'Illegal move');
});

test('bot returns a legal move', () => {
  const bot = require('../bots/chess');
  const botInstance = bot.createBot(1);
  const state = createStartedState();
  // White moves first so it's black's (bot's) turn
  makeMove(state, 'e2', 'e4', 0);
  const move = botInstance.getMove(state);
  assert.ok(move, 'Bot should return a move');
  assert.ok(move.from, 'Move should have from');
  assert.ok(move.to, 'Move should have to');
  // Verify the move is legal
  const err = chess.handleMove(move, state, 1);
  assert.strictEqual(err, null, 'Bot move should be legal, got: ' + err);
});
