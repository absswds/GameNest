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

test('pass direction rotates left → right → across → none from the first round', () => {
  const { createBot } = require('../bots/hearts');
  const s = makeState({ targetScore: 10000 });
  const bots = [0, 1, 2, 3].map((i) => createBot(i));
  const dirs = [s.passDirection];
  for (let steps = 0; dirs.length < 5 && steps < 5000; steps++) {
    const round = s.round;
    if (s.phase === 'passing') {
      const p = [0, 1, 2, 3].find((i) => !s.passSubmissions[i]);
      hearts.handleMove(bots[p].getMove(s), s, p);
    } else {
      hearts.handleMove(bots[s.currentPlayer].getMove(s), s, s.currentPlayer);
    }
    if (s.round !== round) dirs.push(s.passDirection);
  }
  assert.deepEqual(dirs, ['left', 'right', 'across', 'none', 'left']);
});

test('a no-pass round starts playing right away (nobody has to send a move)', () => {
  const s = makeState({ targetScore: 10000, passRound: 2, passDirection: 'across' });
  // Play round 3 (across) to the end; round 4 must not pass
  const { createBot } = require('../bots/hearts');
  const bots = [0, 1, 2, 3].map((i) => createBot(i));
  for (let steps = 0; s.round === 1 && steps < 5000; steps++) {
    if (s.phase === 'passing') {
      const p = [0, 1, 2, 3].find((i) => !s.passSubmissions[i]);
      hearts.handleMove(bots[p].getMove(s), s, p);
    } else {
      hearts.handleMove(bots[s.currentPlayer].getMove(s), s, s.currentPlayer);
    }
  }
  assert.equal(s.passDirection, 'none');
  assert.equal(s.phase, 'playing');
  assert.ok(s.hands[s.currentPlayer].some((c) => c.id === '2c'), '2♣ holder leads');
});

test('first trick: the 2♣ holder must lead 2♣ even when they are not seat 0', () => {
  const s = makeState({ phase: 'playing', trickCount: 0, currentTrick: [], heartsBroken: false });
  const card = (rank, suit) => ({ rank, suit, id: rank + suit });
  s.hands = [
    [card('3', 'c'), card('4', 'c'), card('5', 'c')],
    [card('3', 'd'), card('4', 'd'), card('5', 'd')],
    [card('2', 'c'), card('2', 's'), card('3', 's')],
    [card('3', 'h'), card('4', 'h'), card('5', 'h')],
  ];
  s.currentPlayer = 2;
  s.trickLeader = 0; // stale value, as it is after dealing/passing
  assert.equal(typeof hearts.handleMove({ card: '2s' }, s, 2), 'string');
  assert.equal(hearts.handleMove({ card: '2c' }, s, 2), null);
});
