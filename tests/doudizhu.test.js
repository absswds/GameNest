const assert = require('assert');
const ddz = require('../games/doudizhu');

function test(name, fn) {
  try {
    fn();
    console.log('ok - ' + name);
  } catch (err) {
    console.error('not ok - ' + name);
    throw err;
  }
}

function makeState(opts) {
  var state = ddz.createState();
  state._playerCount = 3;
  state._options = opts || { bidMode: 'rob', totalRounds: 1 };
  ddz.initGame(state, 3);
  return state;
}

function callCall(state, pi) { return ddz.handleMove({ call: true }, state, pi); }
function noCall(state, pi) { return ddz.handleMove({ pass: true }, state, pi); }
function rob(state, pi) { return ddz.handleMove({ rob: true }, state, pi); }
function noRob(state, pi) { return ddz.handleMove({ passRob: true }, state, pi); }
function bid(state, pi, score) { return ddz.handleMove({ score: score }, state, pi); }
function playCards(state, pi, ids) { return ddz.handleMove({ cards: ids === undefined ? [] : ids }, state, pi); }

function getFirstId(hand) { return hand.length > 0 ? hand[hand.length - 1].id : null; }

// ── 叫分 mode ──
test('叫分: first player bids 3 → instant landlord', function() {
  var state = makeState({ bidMode: 'score', totalRounds: 1 });
  var first = state.currentBidder;
  assert.equal(bid(state, first, 3), null);
  assert.equal(state.landlord, first);
  assert.equal(state.phase, 'playing');
  assert.equal(state.hands[first].length, 20);
});

test('叫分: all pass → re-deal', function() {
  var state = makeState({ bidMode: 'score', totalRounds: 1 });
  var first = state.currentBidder;
  var second = (first + 1) % 3;
  var third = (first + 2) % 3;
  assert.equal(bid(state, first, 0), null);
  assert.equal(bid(state, second, 0), null);
  assert.equal(bid(state, third, 0), null);
  // After all pass, bidMode='score' triggers re-deal
  assert.equal(state.phase, 'bidding');
  assert.equal(state.landlord, null);
});

test('叫分: P2 bids 2 → landlord', function() {
  var state = makeState({ bidMode: 'score', totalRounds: 1 });
  // Force bidding phase with consistent starting point
  state.phase = 'bidding';
  var first = 0, second = 1, third = 2;
  state.currentBidder = 0;
  state.currentPlayer = 0;
  assert.equal(bid(state, first, 0), null);
  assert.equal(bid(state, second, 2), null);
  assert.equal(bid(state, third, 0), null);
  assert.equal(state.landlord, second);
  assert.equal(state.phase, 'playing');
});

// ── 叫抢 mode ──
test('叫抢: A calls, B passes, C robs, A passes → C landlord', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 1 });
  var first = state.currentBidder;
  var second = (first + 1) % 3;
  var third = (first + 2) % 3;
  assert.equal(callCall(state, first), null);
  assert.equal(state.callPhase, 'rob');
  assert.equal(noRob(state, second), null);
  assert.equal(rob(state, third), null);
  assert.equal(state.landlord, third);
  // original caller also gets a rob turn
  assert.equal(noRob(state, first), null);
  assert.equal(state.landlord, third);
  assert.equal(state.phase, 'playing');
  assert.equal(state.hands[third].length, 20);
});

test('叫抢: all pass in call phase → re-deal', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 1 });
  var first = state.currentBidder;
  var second = (first + 1) % 3;
  var third = (first + 2) % 3;
  assert.equal(noCall(state, first), null);
  assert.equal(noCall(state, second), null);
  assert.equal(noCall(state, third), null);
  assert.equal(state.phase, 'bidding');
});

test('叫抢: A calls, others no rob → A landlord automatically', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 1 });
  var first = state.currentBidder;
  var second = (first + 1) % 3;
  var third = (first + 2) % 3;
  assert.equal(callCall(state, first), null);
  assert.equal(noRob(state, second), null);
  assert.equal(noRob(state, third), null);
  assert.equal(state.landlord, first);
  assert.equal(state.phase, 'playing');
});

test('叫抢: pass in call phase → not eligible to rob', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 1 });
  var first = 0, second = 1, third = 2;
  state.currentBidder = 0;
  state.currentPlayer = 0;
  assert.equal(noCall(state, first), null);
  assert.equal(callCall(state, second), null);
  assert.equal(state.callPhase, 'rob');
  assert.equal(state.currentBidder, third);
  // Third passes → no one else eligible → auto-finalize second as landlord
  assert.equal(noRob(state, third), null);
  assert.equal(state.landlord, second);
  assert.equal(state.phase, 'playing');
});

test('叫抢: full rob round with multiple robs', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 1 });
  var first = 0, second = 1, third = 2;
  state.currentBidder = 0;
  state.currentPlayer = 0;
  assert.equal(callCall(state, first), null);
  // Rob phase: second, third, first
  assert.equal(rob(state, second), null);  // second robs
  assert.equal(rob(state, third), null);   // third robs (beats second)
  assert.equal(noRob(state, first), null); // first passes
  // Last robber = third → landlord
  assert.equal(state.landlord, third);
  assert.equal(state.phase, 'playing');
});

// ── Playing phase ──
test('playing: cannot pass when must lead', function() {
  var state = makeState({ bidMode: 'score', totalRounds: 1 });
  var first = state.currentBidder;
  bid(state, first, 3);
  assert.equal(state.phase, 'playing');
  assert.equal(playCards(state, state.landlord, []), 'ddz_must_lead');
});

test('playing: play a single card then pass', function() {
  var state = makeState({ bidMode: 'score', totalRounds: 1 });
  var first = state.currentBidder;
  bid(state, first, 3);
  var land = state.landlord;
  var hand = state.hands[land];
  var id = getFirstId(hand);
  assert.ok(id !== null);
  assert.equal(playCards(state, land, [id]), null);

  // Next player can pass
  var next = (land + 1) % 3;
  state.lastPlay = { player: land, cards: [], play: { type: 'single', rank: 5 } };
  assert.equal(playCards(state, next, []), null);
  assert.equal(state.passed[next], true);
});

// ── 叫抢 multiplier tracking ──
test('叫抢: each rob doubles the multiplier', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 1 });
  var first = state.currentBidder;
  var second = (first + 1) % 3;
  var third = (first + 2) % 3;
  assert.equal(callCall(state, first), null);
  assert.equal(state.gameMultiplier, 3);
  assert.equal(rob(state, second), null);
  assert.equal(state.gameMultiplier, 6); // 3*2
  assert.equal(rob(state, third), null);
  assert.equal(state.gameMultiplier, 12); // 6*2
});

// ── Continue vote ──
test('continue vote: all yes → totalRounds + 3', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 4 });
  state.phase = 'continue_vote';
  state.continueVoting = { continueYesVotes: 0, continueNoVotes: 0, votes: [], totalPlayers: 3, resolved: false };
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'yes' }, state, 0), null);
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'yes' }, state, 1), null);
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'yes' }, state, 2), null);
  assert.equal(state.totalRounds, 7);
  assert.equal(state.continueVoting, null);
});

test('continue vote: one no → skips to last round', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 4 });
  state.phase = 'continue_vote';
  state.continueVoting = { continueYesVotes: 0, continueNoVotes: 0, votes: [], totalPlayers: 3, resolved: false };
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'yes' }, state, 0), null);
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'no' }, state, 1), null);
  assert.equal(state.totalRounds, 4);
  assert.equal(state.continueVoting, null);
});

test('continue vote: cannot vote twice', function() {
  var state = makeState({ bidMode: 'rob', totalRounds: 4 });
  state.phase = 'continue_vote';
  state.continueVoting = { continueYesVotes: 0, continueNoVotes: 0, votes: [], totalPlayers: 3, resolved: false };
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'yes' }, state, 0), null);
  assert.equal(ddz.handleMove({ action: 'continue_vote', vote: 'yes' }, state, 0), 'ddz_already_voted');
});

// ── Round end ──
test('roundEnd: click next_round advances', function() {
  var state = makeState({ bidMode: 'score', totalRounds: 3 });
  state.phase = 'roundEnd';
  assert.equal(ddz.handleMove({ action: 'next_round' }, state, 0), null);
  assert.equal(state.phase, 'bidding');
});
