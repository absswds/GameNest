const test = require('node:test');
const assert = require('node:assert/strict');

const liarsbar = require('../games/liarsbar');
const ek = require('../games/exploding-kittens');
const liarsBot = require('../bots/liarsbar');
const battleship = require('../games/battleship');

function lbGame(n) {
  const s = liarsbar.createState();
  liarsbar.initGame(s, n);
  return s;
}

test('liarsbar: players with no cards are skipped', () => {
  const s = lbGame(3);
  s.currentPlayer = 0;
  s.hands[1] = [];
  const err = liarsbar.handleMove({ action: 'play', cardIds: [s.hands[0][0].id] }, s, 0);
  assert.equal(err, null);
  assert.equal(s.currentPlayer, 2);
});

test('liarsbar: when nobody else has cards, the next player must challenge (bot suspects)', () => {
  const s = lbGame(3);
  s.currentPlayer = 0;
  s.hands[1] = [];
  s.hands[2] = [];
  liarsbar.handleMove({ action: 'play', cardIds: [s.hands[0][0].id] }, s, 0);
  assert.equal(s.currentPlayer, 1);
  const move = liarsBot.createBot(1).getMove(s);
  assert.equal(move.action, 'suspect');
  assert.equal(liarsbar.handleMove(move, s, 1), null);
  assert.equal(s.phase, 'shooting');
});

test('exploding-kittens: {draw:true} in the play phase draws in one move', () => {
  const s = ek.createState();
  ek.initGame(s, 2);
  const p = s.currentPlayer;
  assert.equal(s.phase, 'play');
  // Make sure the top card is harmless so the turn simply passes
  s.deck.push({ type: 'skip', id: 'test-skip' });
  const before = s.hands[p].length;
  assert.equal(ek.handleMove({ draw: true }, s, p), null);
  assert.equal(s.hands[p].length, before + 1);
  assert.notEqual(s.currentPlayer, p);
});

test('battleship: adjacent ships get distinct shipIds in the player view', () => {
  const s = battleship.createState();
  const sizes = s.shipSizes;
  // Two ships side by side in rows 0 and 1
  battleship.handleMove({ r: 0, c: 0, orientation: 'h', size: sizes[0] }, s, 0);
  battleship.handleMove({ r: 1, c: 0, orientation: 'h', size: sizes[1] }, s, 0);
  const v = battleship.playerView(s, 0);
  assert.equal(v.myBoard[0][0].hasShip, true);
  assert.equal(v.myBoard[1][0].hasShip, true);
  assert.notEqual(v.myBoard[0][0].shipId, v.myBoard[1][0].shipId);
});

test('battleship: every cell of a sunk enemy ship is reported as sunk', () => {
  const s = battleship.createState();
  s.ships[1] = [{ type: 'destroyer', cells: [{ r: 0, c: 0, hit: true }, { r: 0, c: 1, hit: true }] }];
  s.shots[0] = [{ r: 0, c: 0, result: 'hit' }, { r: 0, c: 1, result: 'sunk' }];
  const v = battleship.playerView(s, 0);
  assert.equal(v.enemyBoard[0][0].shot, 'sunk');
  assert.equal(v.enemyBoard[0][1].shot, 'sunk');
  assert.equal(v.enemyBoard[0][0].shipId, v.enemyBoard[0][1].shipId);
});

test('exploding-kittens: the deck has no Nope cards', () => {
  const s = ek.createState();
  ek.initGame(s, 4);
  const all = s.deck.concat(...s.hands);
  assert.equal(all.filter(c => c.type === 'nope').length, 0);
});

test('checkers: playerView before the game starts does not throw', () => {
  const checkers = require('../games/checkers');
  const s = checkers.createState();
  assert.doesNotThrow(() => checkers.playerView(s, 0));
  assert.deepEqual(checkers.playerView(s, 0).legalMoves, []);
});
