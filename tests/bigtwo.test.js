const test = require('node:test');
const assert = require('node:assert/strict');
const bt = require('../games/bigtwo');
const bot = require('../bots/bigtwo');

const C = (id) => ({ rank: id.slice(0, -1), suit: id.slice(-1), id });
const type = (ids) => bt.detectType(ids.map(C));

// A mid-game state: opening done, player 0 to move, the given hands.
function midGame(hands, extra) {
  const s = bt.createState();
  s.hands = hands.map((h) => h.map(C));
  s.passed = hands.map(() => false);
  s.cumulativeScore = hands.map(() => 0);
  s._opened = true;
  return Object.assign(s, extra || {});
}

// Player 0 leads `lead`, player 1 answers with `answer`; returns player 1's result.
function answer(lead, ans) {
  const s = midGame([lead.concat(['2s']), ans.concat(['2h']), ['3c', '4c']]);
  assert.equal(bt.handleMove({ cards: lead }, s, 0), null);
  return bt.handleMove({ cards: ans }, s, 1);
}

test('straight flush is detected as a straight flush, not a straight', () => {
  assert.equal(type(['3h', '4h', '5h', '6h', '7h']).type, 'straight_flush');
  assert.equal(type(['10s', 'Js', 'Qs', 'Ks', 'As']).type, 'straight_flush');
});

test('straights: A only at either end, A-2-3-4-5 lowest, 10-J-Q-K-A highest, 5 cards only', () => {
  assert.equal(type(['Ad', '2c', '3c', '4c', '5c']).type, 'straight');
  assert.equal(type(['2d', '3c', '4c', '5c', '6c']).type, 'straight');
  assert.equal(type(['10d', 'Jc', 'Qc', 'Kc', 'Ac']).type, 'straight');
  assert.equal(type(['Jd', 'Qc', 'Kc', 'Ac', '2c']), null);
  assert.equal(type(['Qd', 'Kc', 'Ac', '2c', '3c']), null);
  assert.equal(type(['3d', '4c', '5c', '6c', '7c', '8c']), null);
  const low = type(['Ad', '2c', '3c', '4c', '5c']);
  const next = type(['2d', '3c', '4c', '5c', '6c']);
  const high = type(['10d', 'Jc', 'Qc', 'Kc', 'Ac']);
  const mid = type(['9d', '10c', 'Jc', 'Qc', 'Kc']);
  assert.ok(bt.canBeat(next, low));
  assert.ok(bt.canBeat(mid, next));
  assert.ok(bt.canBeat(high, mid));
  assert.ok(!bt.canBeat(low, high));
});

test('equal straights are decided by the suit of the top card', () => {
  assert.equal(answer(['3d', '4c', '5c', '6c', '7c'], ['3s', '4d', '5d', '6d', '7s']), null);
  assert.equal(answer(['3s', '4d', '5d', '6d', '7s'], ['3d', '4c', '5c', '6c', '7c']), 'bt_doesnt_beat');
});

test('five-card kinds beat lower kinds: straight < flush < full house < four+1 < straight flush', () => {
  const hands = [
    ['10d', 'Jc', 'Qc', 'Kc', 'Ac'],
    ['3d', '5d', '7d', '9d', 'Jd'],
    ['4s', '4h', '4c', '5s', '5h'],
    ['6s', '6h', '6c', '6d', '8s'],
    ['3h', '4h', '5h', '6h', '7h'],
  ].map(type);
  for (let i = 1; i < hands.length; i++) {
    assert.ok(bt.canBeat(hands[i], hands[i - 1]), hands[i].type + ' beats ' + hands[i - 1].type);
    assert.ok(!bt.canBeat(hands[i - 1], hands[i]), hands[i - 1].type + ' does not beat ' + hands[i].type);
  }
  assert.equal(answer(['3d', '4c', '5c', '6c', '7c'], ['9s', '9h', '9c', 'Kd', 'Ks']), null);
});

test('flushes compare by highest card, then suit', () => {
  assert.equal(answer(['3s', '5s', '7s', '9s', 'Js'], ['4d', '6d', '8d', '10d', 'Ad']), null);
  assert.equal(answer(['4d', '6d', '8d', '10d', 'Ad'], ['3s', '5s', '7s', '9s', 'Js']), 'bt_doesnt_beat');
  assert.equal(answer(['3d', '5d', '7d', '9d', 'Ad'], ['4h', '6h', '8h', '10h', 'Ah']), null);
});

test('answers must use the same number of cards', () => {
  assert.equal(answer(['5d'], ['6s', '6h']), 'bt_doesnt_beat');
  assert.equal(answer(['5d', '5c'], ['9s', '9h', '9c', 'Kd', 'Ks']), 'bt_doesnt_beat');
});

test('bad move payloads are rejected without throwing', () => {
  const s = midGame([['3d', '4d'], ['5d', '6d'], ['7d', '8d']]);
  for (const data of [null, undefined, 'x', 5, {}, { cards: 'x' }, { cards: ['3d', '3d'] }]) {
    assert.equal(typeof bt.handleMove(data, s, 0), 'string', JSON.stringify(data));
  }
  assert.equal(bt.handleMove({ cards: ['9s'] }, s, 0), 'bt_card_not_in_hand');
  assert.deepEqual(s.hands[0].map((c) => c.id), ['3d', '4d']);
});

test('{pass:true} passes like {cards:[]}', () => {
  const s = midGame([['3d', '4d'], ['5d', '6d'], ['7d', '8d']]);
  assert.equal(bt.handleMove({ cards: ['3d'] }, s, 0), null);
  assert.equal(bt.handleMove({ pass: true }, s, 1), null);
  assert.equal(s.currentPlayer, 2);
  assert.equal(bt.handleMove({ pass: true }, s, 2), null);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.lastPlay, null);
  assert.equal(bt.handleMove({ pass: true }, s, 0), 'bt_must_lead');
});

test('the first play must include the 3 of diamonds', () => {
  const s = bt.createState();
  bt.initGame(s, 4);
  const p = s.currentPlayer;
  assert.ok(s.hands[p].some((c) => c.id === '3d'));
  const other = s.hands[p].find((c) => c.id !== '3d');
  assert.equal(bt.handleMove({ cards: [other.id] }, s, p), 'bt_first_must_have_d3');
  assert.equal(bt.handleMove({ cards: ['3d'] }, s, p), null);
});

test('3 players: 17/17/18 and the 3 of diamonds holder gets the extra card', () => {
  assert.equal(bt.minPlayers, 3);
  for (let i = 0; i < 50; i++) {
    const s = bt.createState();
    bt.initGame(s, 3);
    assert.deepEqual(s.hands.map((h) => h.length).sort(), [17, 17, 18]);
    const holder = s.hands.findIndex((h) => h.some((c) => c.id === '3d'));
    assert.equal(s.hands[holder].length, 18);
    assert.equal(s.currentPlayer, holder);
  }
  const s4 = bt.createState();
  bt.initGame(s4, 4);
  assert.deepEqual(s4.hands.map((h) => h.length), [13, 13, 13, 13]);
});

test('next player on one card: a single must be your highest card (on by default)', () => {
  const s = midGame([['3d', '9s', 'Kh'], ['5c'], ['7d', '8d']]);
  assert.equal(s.oneCardRule, true);
  assert.equal(bt.handleMove({ cards: ['3d'] }, s, 0), 'bt_must_play_highest_single');
  assert.equal(bt.handleMove({ cards: ['Kh'] }, s, 0), null);

  const off = midGame([['3d', '9s', 'Kh'], ['5c'], ['7d', '8d']], { oneCardRule: false });
  assert.equal(bt.handleMove({ cards: ['3d'] }, off, 0), null);

  const opt = bt.createState();
  opt._options = { oneCardRule: false };
  bt.initGame(opt, 4);
  assert.equal(opt.oneCardRule, false);
});

test('HK scoring: x1 under 10, x2 for 10-12, x3 for 13+; winner collects; totals carry over', () => {
  assert.deepEqual([1, 9, 10, 12, 13, 17].map(bt.penaltyMultiplier), [1, 1, 2, 2, 3, 3]);
  const many = (n) => ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'].slice(0, n).map((r) => r + 'c');
  const s = midGame([['2s'], many(5), many(11).map((id) => id.replace('c', 'h')), many(13).map((id) => id.replace('c', 'd'))]);
  s.cumulativeScore = [10, 0, 0, -10];
  assert.equal(bt.handleMove({ cards: ['2s'] }, s, 0), null);
  assert.equal(s.winner, 0);
  assert.deepEqual(s.scores, [5 + 22 + 39, -5, -22, -39]);
  assert.deepEqual(s.cumulativeScore, [76, -5, -22, -49]);
  assert.equal(s.scores.reduce((a, b) => a + b, 0), 0);
});

test('bots finish 3- and 4-player games with every rule on', () => {
  for (const n of [3, 4]) for (let g = 0; g < 15; g++) {
    const s = bt.createState();
    bt.initGame(s, n);
    const bots = [...Array(n).keys()].map((i) => bot.createBot(i));
    for (let step = 0; s.winner === null && step < 2000; step++) {
      const p = s.currentPlayer;
      const mv = bots[p].getMove(s);
      assert.equal(bt.handleMove(mv, s, p), null, JSON.stringify(mv));
    }
    assert.notEqual(s.winner, null);
    assert.equal(s.scores.reduce((a, b) => a + b, 0), 0);
  }
});
