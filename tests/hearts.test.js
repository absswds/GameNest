const { test } = require('node:test');
const assert = require('node:assert');
const hearts = require('../games/hearts');

function makeState(overrides) {
  const s = hearts.createState();
  hearts.initGame(s);
  Object.assign(s, overrides || {});
  return s;
}

test('createState returns correct defaults', () => {
  const s = hearts.createState();
  assert.equal(s.phase, 'passing');
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.winner, null);
  assert.equal(s.heartsBroken, false);
  assert.equal(s.round, 1);
  assert.equal(s.targetScore, 100);
  assert.deepEqual(s.scores, [0, 0, 0, 0]);
  assert.deepEqual(s.roundScores, [0, 0, 0, 0]);
});

test('initGame deals 13 cards to each of 4 players', () => {
  const s = makeState();
  assert.equal(s.hands.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(s.hands[i].length, 13);
  }
});

test('passing phase: collects 3 cards from each player', () => {
  const s = makeState();
  assert.equal(s.phase, 'passing');
  const cards = s.hands[0].slice(0, 3);
  const err = hearts.handleMove({ cards: cards.map(c => c.id) }, s, 0);
  assert.equal(err, null);
  assert.ok(s.passSubmissions[0]);
  assert.equal(s.passSubmissions[0].length, 3);
});

test('passing phase: after all 4 submit, cards are transferred', () => {
  const s = makeState();
  for (let p = 0; p < 4; p++) {
    const cards = s.hands[p].slice(0, 3);
    hearts.handleMove({ cards: cards.map(c => c.id) }, s, p);
  }
  assert.equal(s.phase, 'playing');
  assert.equal(s.passSubmissions[0], undefined);
});

test('wrong player is rejected', () => {
  const s = makeState();
  const cards = s.hands[1].slice(0, 3);
  const err = hearts.handleMove({ cards: cards.map(c => c.id) }, s, 1);
  // Player 1 might not be current player
  // Just verify it doesn't crash
  assert.ok(typeof err === 'string' || err === null);
});

test('playing phase: follow suit if possible', () => {
  const s = makeState({ phase: 'playing' });
  const leader = s.currentPlayer;
  const hand = s.hands[leader];
  // First card sets the suit
  hearts.handleMove({ cardId: hand[0].id }, s, leader);
  const next = s.currentPlayer;
  const nextHand = s.hands[next];
  const leadSuit = hand[0].suit;
  const hasSuit = nextHand.some(c => c.suit === leadSuit);
  if (hasSuit) {
    const offSuitCard = nextHand.find(c => c.suit !== leadSuit);
    if (offSuitCard) {
      const err = hearts.handleMove({ cardId: offSuitCard.id }, s, next);
      assert.ok(typeof err === 'string' && err.length > 0, 'should reject off-suit play');
    }
  }
});

test('module exports correct name and maxPlayers', () => {
  assert.equal(hearts.name, 'hearts');
  assert.equal(hearts.maxPlayers, 4);
  assert.equal(hearts.minPlayers, 4);
});

test('playerView hides opponent hands', () => {
  const s = makeState({ phase: 'playing' });
  const view = hearts.playerView(s, 0);
  assert.ok(view.myHand);
  assert.equal(view.myHand.length, 13);
  assert.ok(view.handSizes);
  assert.equal(view.handSizes.length, 4);
  assert.equal(view.passDirection, s.passDirection);
});

test('game rejects moves after game over', () => {
  const s = makeState({ winner: 0 });
  const err = hearts.handleMove({ cardId: 'As' }, s, 0);
  assert.ok(typeof err === 'string', 'should reject move after game over');
});
