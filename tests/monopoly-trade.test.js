const test = require('node:test');
const assert = require('node:assert/strict');

const game = require('../games/monopoly');
const botMod = require('../bots/monopoly');

function createTestState() {
  const state = game.createState();
  game.initGame(state, 3);
  return state;
}

test('Monopoly Trade: Basic cash and property swap succeeds', () => {
  const state = createTestState();
  // Player 0 owns property 1 (廉租房, group 0, price 60)
  state.properties[1] = { owner: 0, houses: 0 };
  // Player 1 owns property 6 (东方路, group 1, price 100)
  state.properties[6] = { owner: 1, houses: 0 };

  const cash0Before = state.cash[0];
  const cash1Before = state.cash[1];

  // Player 0 proposes: gives property 1 + $50 cash in exchange for property 6
  const errOffer = game.handleMove({
    type: 'trade_offer',
    to: 1,
    offerCash: 50,
    offerProps: [1],
    requestCash: 0,
    requestProps: [6],
  }, state, 0);

  assert.equal(errOffer, null);
  assert.ok(state.tradeOffer, 'Trade offer should be recorded');
  assert.equal(state.tradeOffer.from, 0);
  assert.equal(state.tradeOffer.to, 1);

  // Player 1 accepts
  const errAccept = game.handleMove({ type: 'trade_accept' }, state, 1);
  assert.equal(errAccept, null);
  assert.equal(state.tradeOffer, null, 'Trade offer should be cleared on accept');

  // Verify ownership transferred
  assert.equal(state.properties[1].owner, 1);
  assert.equal(state.properties[6].owner, 0);

  // Verify cash transferred
  assert.equal(state.cash[0], cash0Before - 50);
  assert.equal(state.cash[1], cash1Before + 50);
});

test('Monopoly Trade: Rejects trading properties from a group with houses', () => {
  const state = createTestState();
  // Group 0 has properties 1 and 3
  state.properties[1] = { owner: 0, houses: 1 }; // Has 1 house built!
  state.properties[3] = { owner: 0, houses: 0 };

  state.properties[6] = { owner: 1, houses: 0 };

  // Attempting to trade property 3 (which is in group 0 where property 1 has houses)
  const err = game.handleMove({
    type: 'trade_offer',
    to: 1,
    offerCash: 0,
    offerProps: [3],
    requestCash: 0,
    requestProps: [6],
  }, state, 0);

  assert.equal(err, 'mp_group_has_houses', 'Must reject trade when group has houses');
});

test('Monopoly Trade: Decline clears trade offer without state changes', () => {
  const state = createTestState();
  state.properties[1] = { owner: 0, houses: 0 };
  state.properties[6] = { owner: 1, houses: 0 };

  game.handleMove({
    type: 'trade_offer',
    to: 1,
    offerCash: 10,
    offerProps: [1],
    requestCash: 0,
    requestProps: [6],
  }, state, 0);

  assert.ok(state.tradeOffer);
  const errDecline = game.handleMove({ type: 'trade_decline' }, state, 1);
  assert.equal(errDecline, null);
  assert.equal(state.tradeOffer, null);
  assert.equal(state.properties[1].owner, 0);
  assert.equal(state.properties[6].owner, 1);
});

test('Monopoly Trade: Cancel can only be performed by the proposer', () => {
  const state = createTestState();
  state.properties[1] = { owner: 0, houses: 0 };

  game.handleMove({
    type: 'trade_offer',
    to: 1,
    offerCash: 10,
    offerProps: [1],
    requestCash: 10,
    requestProps: [],
  }, state, 0);

  // Player 1 tries to cancel (should fail, player 1 can only decline)
  const errBadCancel = game.handleMove({ type: 'trade_cancel' }, state, 1);
  assert.equal(errBadCancel, 'mp_not_trade_sender');

  // Player 0 cancels (succeeds)
  const errCancel = game.handleMove({ type: 'trade_cancel' }, state, 0);
  assert.equal(errCancel, null);
  assert.equal(state.tradeOffer, null);
});

test('Monopoly Bot: Evaluates incoming trade intelligently based on monopoly completion', () => {
  const bot1 = botMod.createBot(1);
  const state = createTestState();
  // Bot 1 owns property 6 and 8 (Group 1: 6, 8, 9).
  state.properties[6] = { owner: 1, houses: 0 };
  state.properties[8] = { owner: 1, houses: 0 };
  // Player 0 owns property 9 (completes Group 1 for Bot 1!)
  state.properties[9] = { owner: 0, houses: 0 };
  // Bot 1 owns property 1 (isolated)
  state.properties[1] = { owner: 1, houses: 0 };

  state.tradeOffer = {
    from: 0,
    to: 1,
    offerCash: 0,
    offerProps: [9], // Gives Bot 1 the missing piece for monopoly!
    requestCash: 0,
    requestProps: [1], // Requests isolated property 1
  };

  const move = bot1.getMove(state);
  assert.equal(move.type, 'trade_accept', 'Bot accepts trade that completes its own monopoly');

  // Conversely: Player 0 lowballs asking for Bot 1's key property that gives Player 0 monopoly
  state.properties[11] = { owner: 0, houses: 0 };
  state.properties[13] = { owner: 0, houses: 0 };
  state.properties[15] = { owner: 1, houses: 0 }; // Property 15 completes Group 2 for Player 0!

  state.tradeOffer = {
    from: 0,
    to: 1,
    offerCash: 50, // Tiny cash
    offerProps: [],
    requestCash: 0,
    requestProps: [15], // Demands property that would give Player 0 monopoly
  };

  const moveDecline = bot1.getMove(state);
  assert.equal(moveDecline.type, 'trade_decline', 'Bot rejects trade that hands opponent a monopoly for cheap');
});

// ---- timeout / skip / pass semantics ----
function withOffer() {
  const state = createTestState();
  state.properties[1] = { owner: 0, houses: 0 };
  state.properties[6] = { owner: 1, houses: 0 };
  const err = game.handleMove({ type: 'trade_offer', to: 1, offerCash: 10, offerProps: [1], requestCash: 0, requestProps: [6] }, state, 0);
  assert.equal(err, null);
  return state;
}

test('Monopoly Trade: getPhaseDeadline reflects the pending offer only', () => {
  const state = withOffer();
  assert.ok(game.getPhaseDeadline(state) > Date.now());
  game.handleMove({ type: 'trade_decline' }, state, 1);
  assert.equal(game.getPhaseDeadline(state), 0);
});

test('Monopoly Trade: onTimeout declines the pending offer', () => {
  const state = withOffer();
  game.onTimeout(state);
  assert.equal(state.tradeOffer, null);
  assert.equal(state.lastTrade.accepted, false);
  assert.equal(state.lastTrade.from, 0);
  assert.equal(state.lastTrade.to, 1);
});

test('Monopoly Trade: setCurrentActor with pending offer declines it and keeps the turn', () => {
  const state = withOffer();
  game.setCurrentActor(state, 2);
  assert.equal(state.tradeOffer, null);
  assert.equal(state.lastTrade.accepted, false);
  assert.equal(state.currentPlayer, 0);
});

test('Monopoly Trade: setCurrentActor without offer moves the turn and resets turn fields', () => {
  const state = createTestState();
  state.phase = 'end_turn'; state.doublesCount = 2; state.rollAgain = true; state.lastRent = { x: 1 };
  game.setCurrentActor(state, 1);
  assert.equal(state.currentPlayer, 1);
  assert.equal(state.phase, 'waiting');
  assert.equal(state.doublesCount, 0);
  assert.equal(state.rollAgain, false);
  assert.equal(state.lastRent, null);
  assert.equal(state.round, 1);
  game.setCurrentActor(state, 0); // wrapped past seat 0
  assert.equal(state.round, 2);
});

test('Monopoly Trade: third-party pass neither clears the offer nor succeeds', () => {
  const state = withOffer();
  const err = game.handleMove({ pass: true }, state, 2);
  assert.equal(err, 'g_invalid_action');
  assert.ok(state.tradeOffer);
});

test('Monopoly Trade: recipient pass declines and records lastTrade', () => {
  const state = withOffer();
  assert.equal(game.handleMove({ pass: true }, state, 1), null);
  assert.equal(state.tradeOffer, null);
  assert.equal(state.lastTrade.accepted, false);
});

test('Monopoly Trade: no-op pass returns an error key', () => {
  const state = createTestState();
  assert.equal(game.handleMove({ pass: true }, state, 0), 'g_invalid_action');
});

test('Monopoly bot: proposes a monopoly-completing trade, then does not repeat a declined deal', () => {
  const state = createTestState();
  state._realPlayerCount = 1;
  state._options = { difficulty: 'normal' };
  state.phase = 'waiting';
  state.cash[0] = 1500;
  // Bot (seat 0) owns two of the three-space group containing space 1; seat 1 owns the third.
  const grp = state.board[1].group;
  const spaces = state.board.map((s, i) => (s && s.type === 'property' && s.group === grp ? i : -1)).filter(i => i >= 0);
  spaces.slice(0, -1).forEach(i => { state.properties[i] = { owner: 0, houses: 0 }; });
  const target = spaces[spaces.length - 1];
  state.properties[target] = { owner: 1, houses: 0 };

  const bot = botMod.createBot(0);
  const m1 = bot.getMove(state);
  assert.equal(m1.type, 'trade_offer');
  assert.equal(m1.to, 1);
  assert.deepEqual(m1.requestProps, [target]);

  state.lastTrade = { from: 0, to: 1, accepted: false };
  state.round = 2;
  const m2 = bot.getMove(state);
  assert.notEqual(m2.type, 'trade_offer');
  state.round = 3;
  assert.notEqual(bot.getMove(state).type, 'trade_offer');
});
