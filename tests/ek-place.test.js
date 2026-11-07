// Exploding kittens: after a defuse the player chooses where the kitten goes back (phase 'place').
const test = require('node:test');
const assert = require('node:assert/strict');
const ek = require('../games/exploding-kittens');
const bots = require('../bots/exploding-kittens');

function setup() {
  const s = ek.createState();
  ek.initGame(s, 3);
  s.currentPlayer = 0;
  s.phase = 'play';
  s.hands[0] = [{ type: 'defuse', id: 'defuse-a' }];
  // Deck is drawn from the end: the kitten is drawn first
  s.deck = [{ type: 'skip', id: 's1' }, { type: 'skip', id: 's2' }, { type: 'skip', id: 's3' }, { type: 'explode', id: 'boom' }];
  return s;
}

test('drawing a kitten with a defuse waits for the player to place it', () => {
  const s = setup();
  assert.equal(ek.handleMove({ draw: true }, s, 0), null);
  assert.equal(s.phase, 'place');
  assert.equal(s.currentPlayer, 0, 'the turn does not pass before the kitten is placed');
  assert.equal(s.deck.length, 3);
  assert.equal(ek.handleMove({ draw: true }, s, 1), 'g_not_your_turn');
});

for (const [position, depth] of [['top', 0], [1, 1], [2, 2], ['bottom', 3]]) {
  test(`position ${position} puts the kitten ${depth} cards from the top`, () => {
    const s = setup();
    ek.handleMove({ draw: true }, s, 0);
    assert.equal(ek.handleMove({ position }, s, 0), null);
    assert.equal(s.deck.length, 4);
    assert.equal(s.deck[s.deck.length - 1 - depth].type, 'explode');
    assert.equal(s.phase, 'play');
    assert.equal(s.currentPlayer, 1, 'the turn passes once the kitten is placed');
  });
}

test('a missing or bad position (bot fallback {}) places it at random', () => {
  const s = setup();
  ek.handleMove({ draw: true }, s, 0);
  assert.equal(ek.handleMove({}, s, 0), null);
  assert.equal(s.deck.filter(c => c.type === 'explode').length, 1);
  assert.equal(s.phase, 'play');
});

test('an attacked player who defuses keeps the extra turn after placing', () => {
  const s = setup();
  s.extraTurns[0] = 1;
  ek.handleMove({ draw: true }, s, 0);
  ek.handleMove({ position: 'bottom' }, s, 0);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.extraTurns[0], 0);
});

test('the bot answers the place phase, even with an empty hand', () => {
  const s = setup();
  ek.handleMove({ draw: true }, s, 0);
  const move = bots.createBot(0).getMove(s);
  assert.ok(move && move.position, 'bot gives a position');
  assert.equal(ek.handleMove(move, s, 0), null);
  assert.equal(s.phase, 'play');
});
