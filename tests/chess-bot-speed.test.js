const test = require('node:test');
const assert = require('node:assert/strict');
const chess = require('../games/chess');
const chessBot = require('../bots/chess');

test('hard bot plays 20 plies from start position under 30s without error', () => {
  const state = chess.createState();
  state._options = { difficulty: 'hard' };
  chess.initGame(state);

  const bots = [chessBot.createBot(0), chessBot.createBot(1)];
  const t0 = Date.now();

  for (let ply = 0; ply < 20; ply++) {
    assert.equal(state.winner, null, `game should still be ongoing at ply ${ply}`);
    const player = state.currentPlayer;
    const move = bots[player].getMove(state);
    assert.ok(move && move.from && move.to, `bot ${player} should return a move at ply ${ply}`);
    const err = chess.handleMove(move, state, player);
    assert.equal(err, null, `handleMove failed at ply ${ply}: ${err}`);
  }

  const elapsedMs = Date.now() - t0;
  assert.ok(elapsedMs < 30000, `expected 20 plies < 30000ms, got ${elapsedMs}ms`);
});

test('mate-in-1 position is solved at easy, normal and hard', () => {
  // Scholar's mate setup: White to move has Qxf7# among many legal moves
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

  for (const difficulty of ['easy', 'normal', 'hard']) {
    for (let trial = 0; trial < 5; trial++) {
      const state = chess.createState();
      state.fen = fen;
      state._options = { difficulty };
      chess.initGame(state);

      const bot = chessBot.createBot(0);
      const move = bot.getMove(state);
      assert.ok(move && move.from && move.to, `bot should return a move at ${difficulty}`);
      const err = chess.handleMove(move, state, 0);
      assert.equal(err, null, `handleMove should accept move at ${difficulty}`);
      assert.equal(state.winner, 0, `bot should deliver checkmate at ${difficulty}`);
    }
  }
});

test('bot does not mutate the state passed in', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const state = chess.createState();
    state._options = { difficulty };
    chess.initGame(state);

    const before = JSON.stringify(state);
    const bot = chessBot.createBot(0);
    const move = bot.getMove(state);
    const after = JSON.stringify(state);

    assert.ok(move && move.from && move.to);
    assert.equal(after, before, `state was mutated at ${difficulty}`);
  }
});
