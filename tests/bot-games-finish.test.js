const test = require('node:test');
const assert = require('node:assert/strict');

// Bot-vs-bot games must reach a result without a rejected move. Each case below used to get stuck.
function play(id, n, seats) {
  const g = require('../games/' + id);
  const b = require('../bots/' + id);
  const s = g.createState();
  s._playerCount = n; s._options = {}; s._hasBots = true;
  if (g.initGame) g.initGame(s, n);
  const bots = [...Array(n).keys()].map((i) => b.createBot(i));
  for (let step = 0; s.winner === null && step < 3000; step++) {
    const p = typeof g.getCurrentActor === 'function' ? g.getCurrentActor(s) : s.currentPlayer;
    const mv = bots[p].getMove(s, p) || { pass: true };
    const err = g.handleMove(mv, s, p);
    assert.equal(err, null, id + ' rejected ' + JSON.stringify(mv) + ': ' + err);
  }
  return s;
}

test('numberbomb: a player eliminated by the bomb never starts the next round', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < 10; i++) assert.notEqual(play('numberbomb', n).winner, null);
});

test('bigtwo: any seat can lead freely after the opening play', () => {
  for (let i = 0; i < 10; i++) assert.notEqual(play('bigtwo', 4).winner, null);
});

test('oldmaid: draws skip players who are out of cards and the game ends', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < 10; i++) {
    const s = play('oldmaid', n);
    assert.notEqual(s.loser, null);
  }
});

test('go9: bots end the game instead of playing forever', () => {
  for (let i = 0; i < 4; i++) assert.notEqual(play('go9', 2).winner, null);
});

test('chinesechess: repetition and quiet moves end in a result', () => {
  for (let i = 0; i < 2; i++) assert.notEqual(play('chinesechess', 2).winner, null);
});
