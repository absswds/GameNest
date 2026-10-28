// The checkers bot must also work on a playerView (MCP suggest_move), which has no _lastCapture* fields.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../games/checkers');
const B = require('../bots/checkers');

test('checkers bot plays legal moves from a playerView, including multi-jumps', () => {
  let multiJumps = 0;
  for (let g = 0; g < 20; g++) {
    const s = G.createState();
    G.initGame(s, 2);
    s._options = { difficulty: 'easy' };
    const bots = [B.createBot(0), B.createBot(1)];
    for (let t = 0; t < 400 && s.winner === null; t++) {
      const p = s.currentPlayer;
      if (s.mustCapture) multiJumps++;
      const v = JSON.parse(JSON.stringify(G.playerView(s, p)));
      v._options = s._options;
      const m = bots[p].getMove(v);
      assert.equal(G.handleMove(m, s, p), null, `game ${g} turn ${t}: ${JSON.stringify(m)}`);
    }
  }
  assert.ok(multiJumps > 0, 'some multi-jump continuations were exercised');
});
