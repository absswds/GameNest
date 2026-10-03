const test = require('node:test');
const assert = require('node:assert/strict');

const game = require('../games/rummikub');
const { createBot } = require('../bots/rummikub');

const tile = (color, num, n) => ({ color, num, id: `${color}-${num}-${n || 'a'}` });

function stateWith(hand, table) {
  const s = game.createState();
  game.initGame(s, 2);
  s.hands = [hand, [tile('black', 1)]];
  s.table = table || [];
  s.currentPlayer = 0;
  s.hasBroken = [true, true];
  s.playedThisTurn = [false, false];
  return s;
}

test('rummikub bot: fills a run gap with the joker instead of submitting a hole', () => {
  const joker = { color: 'joker', num: 0, id: 'joker-0', wild: true };
  const s = stateWith([tile('red', 4), tile('red', 5), tile('red', 7), joker]);
  const move = createBot(0).getMove(s);
  assert.ok(move.tileIds, 'bot should play a set');
  assert.ok(move.tileIds.includes('joker-0'));
  assert.equal(game.handleMove(move, s, 0), null);
});

test('rummikub bot: does not try to extend a 13-tile run', () => {
  const joker = (n) => ({ color: 'joker', num: 0, id: `joker-${n}`, wild: true });
  const run = [joker(0), joker(1)];
  for (let n = 3; n <= 13; n++) run.push(tile('orange', n));
  const s = stateWith([tile('orange', 2)], [run]);
  assert.deepEqual(createBot(0).getMove(s), { pass: true });
});

test('rummikub bot: whole games never produce a rejected set play', () => {
  const rejected = [];
  for (let g = 0; g < 20; g++) {
    const s = game.createState();
    game.initGame(s, 3);
    const bots = [0, 1, 2].map(createBot);
    for (let step = 0; s.winner === null && step < 3000; step++) {
      const p = s.currentPlayer;
      const move = bots[p].getMove(JSON.parse(JSON.stringify(s)));
      const err = game.handleMove(move, s, p);
      if (err) {
        rejected.push(err);
        game.handleMove({ pass: true }, s, p);
      }
    }
    assert.notEqual(s.winner, null, 'game should finish');
  }
  assert.deepEqual(rejected, []);
});

test('rummikub rules: a full 1-13 run with a joker filling the gap is a legal table set', () => {
  const joker = { color: 'joker', num: 0, id: 'joker-0', wild: true };
  const run = [joker];
  for (let n = 1; n <= 13; n++) if (n !== 5) run.push(tile('blue', n));
  const s = stateWith([tile('blue', 13, 'b')], [run.slice(0, -1)]);
  assert.equal(game.handleMove({ tileIds: ['blue-13-b'], targetSet: 0 }, s, 0), null);
});
