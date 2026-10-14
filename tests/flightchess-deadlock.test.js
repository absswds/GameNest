const test = require('node:test');
const assert = require('node:assert/strict');

const game = require('../games/flightchess');
const bot = require('../bots/flightchess');

test('flightchess bot never picks an unlaunchable base plane over a bouncing plane', () => {
  const state = game.createState();
  game.initGame(state, 2);
  state.players[0].planes = [-1, 57, 58, 58];
  state.players[0].finished = 2;
  state.dice = 3; // 57+3 overshoots and bounces back to 55
  state.hasRolled = true;
  const move = bot.createBot(0).getMove(state);
  assert.equal(move.planeIndex, 1);
  assert.equal(game.handleMove(move, state, 0), null);
});

test('flightchess bot-vs-bot games always finish', () => {
  for (let g = 0; g < 5; g++) {
    const state = game.createState();
    game.initGame(state, 4);
    const bots = [0, 1, 2, 3].map((i) => bot.createBot(i));
    let steps = 0;
    while (state.winner === null && steps++ < 200000) {
      const err = game.handleMove(bots[state.currentPlayer].getMove(state), state, state.currentPlayer);
      assert.equal(err, null);
    }
    assert.notEqual(state.winner, null, 'game ' + g + ' stuck');
  }
});
