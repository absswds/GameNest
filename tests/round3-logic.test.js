const test = require('node:test');
const assert = require('node:assert/strict');

const bigtwo = require('../games/bigtwo');
const bigtwoBot = require('../bots/bigtwo');
const go9 = require('../games/go9');
const xq = require('../games/chinesechess');
const texas = require('../games/texas');
const davinci = require('../games/davinci');
const ek = require('../games/exploding-kittens');
const guides = require('../mcp/move-guides');

const cards = (...ids) => ids.map(id => {
  const suit = id.slice(-1), rank = id.slice(0, -1);
  return { rank, suit, id };
});
const play = (...ids) => bigtwo.detectType(cards(...ids));

const STRAIGHT = ['3s', '4h', '5d', '6c', '7s'];
const FLUSH = ['3h', '5h', '8h', 'Jh', 'Kh'];
const FULL = ['4s', '4h', '4d', '9s', '9h'];
const FOUR = ['5s', '5h', '5d', '5c', '9s'];
const SFLUSH = ['3d', '4d', '5d', '6d', '7d'];

test('bigtwo: five-card types rank straight < flush < full house < four+one < straight flush', () => {
  const order = [STRAIGHT, FLUSH, FULL, FOUR, SFLUSH].map(ids => play(...ids));
  order.forEach(p => assert.ok(p, 'valid type'));
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < order.length; j++) {
      if (i === j) continue;
      assert.equal(bigtwo.canBeat(order[i], order[j]), i > j, `type ${i} vs ${j}`);
    }
  }
});

test('bigtwo: same five-card type still compares by rank then suit', () => {
  assert.equal(bigtwo.canBeat(play('9s', '9h', '9d', '3s', '3h'), play(...FULL)), true);
  assert.equal(bigtwo.canBeat(play(...FULL), play('9s', '9h', '9d', '3s', '3h')), false);
  assert.equal(bigtwo.canBeat(play('3s', '4s', '5s', '6s', '7s'), play(...SFLUSH)), true); // same rank, higher suit
  assert.equal(bigtwo.canBeat(play(...SFLUSH), play('3s', '4s', '5s', '6s', '7s')), false);
});

test('bigtwo: 2 may still be used in a straight', () => {
  assert.equal(play('Js', 'Qh', 'Kd', 'Ac', '2s').type, 'straight');
});

test('bigtwo: a straight longer than 5 is only beaten by a same-length straight', () => {
  const six = play('3s', '4h', '5d', '6c', '7s', '8h');
  assert.equal(six.type, 'straight');
  assert.equal(bigtwo.canBeat(play(...SFLUSH), six), false);
  assert.equal(bigtwo.canBeat(play(...FULL), six), false);
  assert.equal(bigtwo.canBeat(play('9s', '10h', 'Jd', 'Qc', 'Ks', 'Ah'), six), true);
  // and a 6-straight cannot beat a five-card hand
  assert.equal(bigtwo.canBeat(six, play(...STRAIGHT)), false);
  assert.equal(bigtwo.canBeat(six, play(...FLUSH)), false);
});

test('bigtwo: five-card hands do not beat singles, pairs or triples', () => {
  assert.equal(bigtwo.canBeat(play(...FULL), play('2s')), false);
  assert.equal(bigtwo.canBeat(play('2s'), play(...FULL)), false);
});

test('bigtwo bot: answers a straight with a flush or higher, and a flush with a full house', () => {
  const mk = (ids, last) => {
    const state = { hands: [cards(...ids), []], lastPlay: { play: play(...last), player: 1, cards: cards(...last) }, lastPlayPlayer: 1 };
    return bigtwoBot.createBot(0).getMove(state);
  };
  const mv1 = mk(['4h', '6h', '9h', 'Qh', 'Ah', '3c'], STRAIGHT);
  assert.equal(mv1.cards.length, 5);
  assert.equal(bigtwo.detectType(cards(...mv1.cards)).type, 'flush');
  const mv2 = mk(['4s', '4h', '4d', '9s', '9h', '3c'], FLUSH);
  assert.equal(bigtwo.detectType(cards(...mv2.cards)).type, 'full_house');
  assert.deepEqual(mk(['3c', '5d', '9s', 'Kh', 'Ad'], SFLUSH).cards, []);
});

test('go9: both passes are recorded in moveHistory', () => {
  const state = go9.createState();
  go9.initGame(state, 2);
  assert.equal(go9.handleMove({ pass: true }, state, state.currentPlayer), null);
  assert.equal(go9.handleMove({ pass: true }, state, state.currentPlayer), null);
  assert.equal(state.phase, 'scoring');
  assert.equal(state.moveHistory.filter(m => m.pass).length, 2);
});

test('chinesechess: flat legalMoves shape is accepted', () => {
  const state = xq.createState();
  const m = xq.playerView(state, 0).legalMoves[0];
  assert.equal(xq.handleMove(m, state, 0), null);
  assert.equal(state.currentPlayer, 1);
});

test('texas: fold-out leaves a clean state', () => {
  const state = texas.createState();
  texas.initGame(state, 3);
  const a = state.currentPlayer;
  assert.equal(texas.handleMove({ action: 'fold' }, state, a), null);
  const b = state.currentPlayer;
  assert.equal(texas.handleMove({ action: 'fold' }, state, b), null);
  assert.notEqual(state.winner, null);
  assert.equal(state.currentPlayer, state.winner);
  assert.ok(state.bets.every(x => x === 0));
});

test('davinci: out-of-range or malformed guessNum is rejected without changing state', () => {
  const state = davinci.createState();
  davinci.initGame(state, 3);
  state.phase = 'guess';
  state.currentPlayer = 0;
  const idx = state.numRevealed[1].findIndex(r => !r);
  for (const bad of [12, -1, 1.5, '3', undefined]) {
    const before = JSON.stringify(state);
    assert.equal(davinci.handleMove({ targetPlayer: 1, tileIndex: idx, guessNum: bad }, state, 0), 'dv_invalid_guess');
    assert.equal(JSON.stringify(state), before);
  }
  // a joker claim on a number tile stays an ordinary wrong guess (an error would reveal the tile)
  state.tiles[1][idx] = { color: 'white', num: 5, id: 'w5' };
  assert.equal(davinci.handleMove({ targetPlayer: 1, tileIndex: idx, guessJoker: true }, state, 0), null);
  assert.equal(state.lastGuessResult.correct, false);
});

test('exploding-kittens: attack with an invalid target is rejected and keeps the card', () => {
  const state = ek.createState();
  ek.initGame(state, 3);
  state.phase = 'play';
  state.currentPlayer = 0;
  state.hands[0].push({ id: 'attack-x', type: 'attack' });
  const before = state.hands[0].length;
  for (const bad of [7, -1, 0, 1.5, 'x']) {
    assert.equal(ek.handleMove({ cardId: 'attack-x', targetPlayer: bad }, state, 0), 'ek_invalid_target');
    assert.equal(state.hands[0].length, before);
    assert.equal(state.currentPlayer, 0);
  }
  assert.equal(ek.handleMove({ cardId: 'attack-x', targetPlayer: 2 }, state, 0), null);
  assert.equal(state.currentPlayer, 2);
  assert.equal(state.extraTurns[2], 1);
});

test('move guides match the server formats', () => {
  assert.match(guides.texas, /all_in/);
  assert.doesNotMatch(guides.texas, /"allin"/);
  assert.match(guides.chess, /row,col/);
  assert.match(guides.bigtwo, /straight flush/);
});
