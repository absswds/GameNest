const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../games/liarsdice');
const botMod = require('../bots/liarsdice');

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function makeFixedState(hands, opts = {}) {
  const s = game.createState();
  s._options = Object.assign({ startDice: 5, onesWild: true, turnTime: 20 }, opts);
  game.initGame(s, hands.length);
  s.dice = hands.map((h) => h.slice());
  s.diceCounts = hands.map((h) => h.length);
  s.currentPlayer = opts.starter !== undefined ? opts.starter : 0;
  s.roundStarter = s.currentPlayer;
  return s;
}

test('raise legality: 2 < 3 < 4 < 5 < 6 < 1', () => {
  const s = makeFixedState([[2, 3, 4], [5, 6, 1]], { starter: 0 });
  assert.equal(game.handleMove({ type: 'challenge' }, s, 0), 'ld_nothing_to_challenge');

  // Cannot play out of turn
  assert.equal(game.handleMove({ type: 'bid', qty: 1, face: 2 }, s, 1), 'not_your_turn');

  // Invalid bids
  assert.equal(game.handleMove({ type: 'bid', qty: 0, face: 2 }, s, 0), 'ld_invalid_bid');
  assert.equal(game.handleMove({ type: 'bid', qty: 1, face: 7 }, s, 0), 'ld_invalid_bid');

  // Legal opening bid: 2 x 4
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 4 }, s, 0), null);
  assert.equal(s.currentPlayer, 1);

  // Equal qty with same or lower face rejected
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 4 }, s, 1), 'ld_bid_too_low');
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 3 }, s, 1), 'ld_bid_too_low');
  assert.equal(game.handleMove({ type: 'bid', qty: 1, face: 1 }, s, 1), 'ld_bid_too_low');

  // Equal qty with 1 (highest face) is legal
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 1 }, s, 1), null);

  // After face 1 at qty 2, must increase qty to 3 (any face allowed)
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 6 }, s, 0), 'ld_bid_too_low');
  assert.equal(game.handleMove({ type: 'bid', qty: 3, face: 2 }, s, 0), null);
});

test('onesWild counts 1s as wild until someone bids face 1, resets next round', () => {
  // Ones wild stays active when bidding 2..6
  const s1 = makeFixedState([[1, 2], [4, 6]], { starter: 0, onesWild: true });
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 4 }, s1, 0), null);
  assert.equal(s1.onesWildNow, true);
  assert.equal(game.handleMove({ type: 'challenge' }, s1, 1), null);
  // One 4 + one wild 1 = 2 >= 2 -> challenger (1) loses a die
  assert.equal(s1.phase, 'reveal');
  assert.equal(s1.lastReveal.count, 2);
  assert.equal(s1.lastReveal.loser, 1);
  assert.equal(s1.diceCounts[1], 1);

  // Bidding 1 disables onesWildNow for rest of that round
  const s2 = makeFixedState([[1, 2], [1, 5], [5, 6]], { starter: 0, onesWild: true });
  assert.equal(game.handleMove({ type: 'bid', qty: 1, face: 1 }, s2, 0), null);
  assert.equal(s2.onesWildNow, false);
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 5 }, s2, 1), null);
  assert.equal(s2.onesWildNow, false);
  assert.equal(game.handleMove({ type: 'challenge' }, s2, 2), null);
  // Only two 5s exist; 1s no longer wild!
  assert.equal(s2.lastReveal.count, 2);
  assert.equal(s2.lastReveal.loser, 2);

  // Same test when 3 of 5s needed: bidder loses because 1s stopped being wild
  const s3 = makeFixedState([[1, 2], [1, 5], [5, 6]], { starter: 0, onesWild: true });
  assert.equal(game.handleMove({ type: 'bid', qty: 1, face: 1 }, s3, 0), null);
  assert.equal(game.handleMove({ type: 'bid', qty: 3, face: 5 }, s3, 1), null);
  assert.equal(game.handleMove({ type: 'challenge' }, s3, 2), null);
  assert.equal(s3.lastReveal.count, 2);
  assert.equal(s3.lastReveal.loser, 1);

  // Advancing past reveal resets onesWildNow back to state.onesWild
  assert.equal(game.handleMove({ type: 'next' }, s3, 0), null);
  assert.equal(s3.phase, 'playing');
  assert.equal(s3.onesWildNow, true);
});

test('onesWild: false never counts 1s for other faces', () => {
  const s = makeFixedState([[1, 1, 2], [4, 5, 6]], { starter: 0, onesWild: false });
  assert.equal(s.onesWildNow, false);
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 4 }, s, 0), null);
  assert.equal(game.handleMove({ type: 'challenge' }, s, 1), null);
  assert.equal(s.lastReveal.count, 1);
  assert.equal(s.lastReveal.loser, 0);
});

test('elimination, loser starts or next clockwise, and winner on last survivor', () => {
  const s = makeFixedState([[2], [6]], { starter: 0, onesWild: false });
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 6 }, s, 0), null); // bluff (only one 6)
  assert.equal(game.handleMove({ type: 'challenge' }, s, 1), null);
  assert.equal(s.lastReveal.loser, 0);
  assert.equal(s.diceCounts[0], 0);
  assert.equal(s.diceCounts[1], 1);
  assert.equal(s.phase, 'ended');
  assert.equal(s.winner, 1);
  assert.equal(game.getCurrentActor(s), -1);
  assert.equal(game.getPhaseDeadline(s), 0);

  // 3 players: eliminated loser passes starter clockwise
  const s3 = makeFixedState([[2], [5, 5], [3, 4]], { starter: 0, onesWild: false });
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 6 }, s3, 0), null); // false
  assert.equal(game.handleMove({ type: 'challenge' }, s3, 1), null);
  assert.equal(s3.lastReveal.loser, 0);
  assert.equal(s3.diceCounts[0], 0);
  assert.equal(s3.phase, 'reveal');
  game.onTimeout(s3);
  assert.equal(s3.phase, 'playing');
  assert.equal(s3.currentPlayer, 1);
});

test('reveal phase timeout vs early next and playing timeout heuristic', () => {
  const s = makeFixedState([[2, 3], [4, 5]], { starter: 0, turnTime: 15 });
  assert.ok(game.getPhaseDeadline(s) > Date.now());

  // First bid timeout -> {qty:1, face:2}
  game.onTimeout(s);
  assert.deepEqual(s.currentBid, { qty: 1, face: 2, player: 0 });
  assert.equal(s.currentPlayer, 1);

  // Absurd bid timeout -> challenge
  assert.equal(game.handleMove({ type: 'bid', qty: 10, face: 6 }, s, 1), null);
  assert.equal(s.currentPlayer, 0);
  game.onTimeout(s);
  assert.equal(s.phase, 'reveal');
  assert.equal(s.lastReveal.challenger, 0);
  assert.equal(s.lastReveal.loser, 1);
  assert.equal(game.getCurrentActor(s), -1);
  assert.ok(game.getPhaseDeadline(s) > Date.now());

  // Early next advances immediately
  assert.equal(game.handleMove({ type: 'next' }, s, 0), null);
  assert.equal(s.phase, 'playing');
  assert.equal(s.round, 2);

  // turnTime: 0 returns 0 deadline during playing
  const sNoLimit = makeFixedState([[2, 3], [4, 5]], { starter: 0, turnTime: 0 });
  assert.equal(game.getPhaseDeadline(sNoLimit), 0);
});

test('playerView masks other players dice, safe pre-init, exposes reveal & ended', () => {
  const pre = game.createState();
  assert.doesNotThrow(() => game.playerView(pre, 0));

  const s = makeFixedState([[6, 5, 4], [1, 2, 3], [6, 6]], { starter: 0 });
  const v0 = game.playerView(s, 0);
  assert.deepEqual(v0.dice[0], [6, 5, 4]);
  assert.deepEqual(v0.dice[1], [null, null, null]);
  assert.deepEqual(v0.dice[2], [null, null]);
  assert.equal(v0.lastReveal, null);

  // Challenge into reveal -> lastReveal.dice becomes public while ongoing dice stay masked
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 6 }, s, 0), null);
  assert.equal(game.handleMove({ type: 'challenge' }, s, 1), null);
  const revV1 = game.playerView(s, 1);
  assert.ok(revV1.lastReveal);
  assert.deepEqual(revV1.lastReveal.dice, [[6, 5, 4], [1, 2, 3], [6, 6]]);
  assert.deepEqual(revV1.dice[0], [null, null, null]);
  assert.deepEqual(revV1.dice[2], [null, null]);

  // Ended game exposes everything
  const sEnd = makeFixedState([[2], [6]], { starter: 0, onesWild: false });
  assert.equal(game.handleMove({ type: 'bid', qty: 2, face: 6 }, sEnd, 0), null);
  assert.equal(game.handleMove({ type: 'challenge' }, sEnd, 1), null);
  const endV0 = game.playerView(sEnd, 0);
  assert.equal(endV0.phase, 'ended');
  assert.ok(endV0.lastReveal);
  assert.deepEqual(endV0.lastReveal.dice, [[2], [6]]);
});

test('bot never mutates state and returns legal moves across 200 random positions (full + view)', () => {
  const diffs = ['easy', 'normal', 'hard'];
  for (let i = 0; i < 200; i++) {
    const n = 2 + (i % 5); // 2..6 players
    const s = game.createState();
    s._options = { startDice: 3 + (i % 3), onesWild: i % 2 === 0, difficulty: diffs[i % 3] };
    game.initGame(s, n);

    // Advance 0..4 random legal steps
    const preSteps = i % 5;
    for (let k = 0; k < preSteps && s.phase === 'playing'; k++) {
      const actor = s.currentPlayer;
      const move = (k === 3 && s.currentBid && i % 7 === 0)
        ? { type: 'challenge' }
        : game.minimalRaise(s.currentBid);
      game.handleMove(move, s, actor);
    }
    if (s.phase !== 'playing') continue;

    const actor = s.currentPlayer;
    const bot = botMod.createBot(actor);

    // Test on full state
    const fullSnap = clone(s);
    const moveFull = bot.getMove(s, actor);
    assert.deepEqual(s, fullSnap, 'bot mutated full state');
    const errFull = game.handleMove(moveFull, clone(s), actor);
    assert.equal(errFull, null, 'illegal bot move on full state: ' + JSON.stringify(moveFull));

    // Test on masked playerView
    const view = game.playerView(s, actor);
    const viewSnap = clone(view);
    const moveView = bot.getMove(view, actor);
    assert.deepEqual(view, viewSnap, 'bot mutated view state');
    const errView = game.handleMove(moveView, clone(s), actor);
    assert.equal(errView, null, 'illegal bot move on playerView: ' + JSON.stringify(moveView));
  }
});

test('full bot-only games finish cleanly', () => {
  for (const playerCount of [2, 3, 4]) {
    const s = game.createState();
    s._options = { startDice: 4, onesWild: true, turnTime: 20, difficulty: 'normal' };
    game.initGame(s, playerCount);
    const bots = Array.from({ length: playerCount }, (_, i) => botMod.createBot(i));

    let steps = 0;
    while (s.phase !== 'ended' && steps < 2000) {
      if (s.phase === 'reveal') {
        game.onTimeout(s);
      } else {
        const cp = game.getCurrentActor(s);
        const mv = bots[cp].getMove(game.playerView(s, cp), cp);
        const err = game.handleMove(mv, s, cp);
        assert.equal(err, null, 'bot move failed: ' + err);
      }
      steps++;
    }
    assert.equal(s.phase, 'ended');
    assert.ok(s.winner >= 0 && s.winner < playerCount);
  }
});
