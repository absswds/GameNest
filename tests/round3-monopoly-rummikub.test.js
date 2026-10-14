const test = require('node:test');
const assert = require('node:assert');
const monopoly = require('../games/monopoly');
const monoBot = require('../bots/monopoly');
const rk = require('../games/rummikub');
const rkBot = require('../bots/rummikub');

function started(n) {
  const s = monopoly.createState();
  monopoly.initGame(s, n || 2);
  return s;
}
// rollDice uses Math.random twice: ceil(r*6) per die
function rollWith(state, a, b, pi) {
  const orig = Math.random;
  const vals = [(a - 0.5) / 6, (b - 0.5) / 6];
  let i = 0;
  Math.random = () => vals[Math.min(i++, 1)];
  try { return monopoly.handleMove({ type: 'roll' }, state, pi === undefined ? state.currentPlayer : pi); }
  finally { Math.random = orig; }
}

test('monopoly: rent uses card face value, monopoly doubles unimproved only', () => {
  const b = monopoly.createState().board;
  assert.strictEqual(monopoly.calculatePropertyRent(b[8], 0, false), 6);
  assert.strictEqual(monopoly.calculatePropertyRent(b[8], 0, true), 12);
  assert.strictEqual(monopoly.calculatePropertyRent(b[8], 1, true), 30);
});

test('monopoly: railroad rent is 25/50/100/200', () => {
  const expected = [25, 50, 100, 200];
  for (let count = 1; count <= 4; count++) {
    const s = started(2);
    const rails = [5, 12, 20, 25];
    for (let i = 0; i < count; i++) s.properties[rails[i]] = { owner: 1, houses: 0 };
    s.positions[0] = 3; s.cash = [1500, 1500];
    rollWith(s, 1, 1);
    assert.strictEqual(s.cash[0], 1500 - expected[count - 1]);
  }
});

test('monopoly: doubles give another roll after landing is settled', () => {
  const s = started(2);
  s.positions[0] = 0;
  assert.strictEqual(rollWith(s, 2, 2), null); // pos 4 = tax
  assert.strictEqual(s.currentPlayer, 0);
  assert.strictEqual(s.phase, 'waiting');
  assert.strictEqual(rollWith(s, 1, 2), null);
  assert.strictEqual(s.phase === 'end_turn' || s.phase === 'landed', true);
});

test('monopoly: double landing on buyable space waits for buy decision, then rolls again', () => {
  const s = started(2);
  rollWith(s, 1, 1); // pos 2 = chance? use pos 3 instead
  const t = started(2);
  t.positions[0] = 1;
  rollWith(t, 1, 1); // pos 3 property
  assert.strictEqual(t.phase, 'landed');
  assert.strictEqual(monopoly.handleMove({ type: 'skip_buy' }, t, 0), null);
  assert.strictEqual(t.phase, 'waiting');
  assert.strictEqual(t.currentPlayer, 0);
});

test('monopoly: non-double clears streak and ends turn normally', () => {
  const s = started(2);
  s.positions[0] = 1;
  rollWith(s, 1, 1);
  monopoly.handleMove({ type: 'skip_buy' }, s, 0);
  rollWith(s, 3, 4); // pos 3+7=10 property
  assert.strictEqual(s.doublesCount, 0);
  monopoly.handleMove({ type: 'skip_buy' }, s, 0);
  assert.strictEqual(s.phase, 'end_turn');
  monopoly.handleMove({ type: 'end_turn' }, s, 0);
  assert.strictEqual(s.currentPlayer, 1);
});

test('monopoly: third double in a row goes to jail without moving', () => {
  const s = started(2);
  s.positions[0] = 1;
  s.doublesCount = 2; s.rollAgain = false; s.phase = 'waiting';
  rollWith(s, 3, 3);
  assert.strictEqual(s.inJail[0], true);
  assert.strictEqual(s.positions[0], 7);
  assert.strictEqual(s.phase, 'end_turn');
  assert.strictEqual(monopoly.handleMove({ type: 'end_turn' }, s, 0), null);
  assert.strictEqual(s.currentPlayer, 1);
  assert.strictEqual(s.doublesCount, 0);
});

test('monopoly: doubles that free you from jail give no extra roll', () => {
  const s = started(2);
  s.positions[0] = 7; s.inJail[0] = true;
  rollWith(s, 2, 2); // to pos 11, a property
  assert.strictEqual(s.inJail[0], false);
  monopoly.handleMove({ type: 'skip_buy' }, s, 0);
  assert.strictEqual(s.phase, 'end_turn');
});

test('monopoly: landing in jail on a double does not roll again', () => {
  const s = started(2);
  s.positions[0] = 15; // 15+6 = 21 go_to_jail with (3,3)
  rollWith(s, 3, 3);
  assert.strictEqual(s.inJail[0], true);
  assert.strictEqual(s.phase, 'end_turn');
});

test('monopoly bot: bots never get a move rejected across doubles', () => {
  const s = started(3);
  const bots = [0, 1, 2].map(i => monoBot.createBot(i));
  let steps = 0;
  while (s.phase !== 'gameover' && steps++ < 3000) {
    const cp = s.currentPlayer;
    const err = monopoly.handleMove(bots[cp].getMove(s), s, cp);
    assert.strictEqual(err, null, 'bot move rejected: ' + err + ' phase ' + s.phase);
  }
});

// ---- rummikub ----
const T = (color, num, n) => ({ id: color + '-' + num + '-' + (n || 'a'), color, num });

test('rummikub bot: breaks ice with several sets totalling 30+', () => {
  const s = rk.createState();
  rk.initGame(s, 2);
  s.hands[0] = [
    T('red', 3), T('red', 4), T('red', 5),          // 12
    T('blue', 7), T('orange', 7), T('black', 7),    // 21 (group)
    T('blue', 1), T('red', 12, 'b'),
  ];
  s.currentPlayer = 0;
  s.phase = 'play';
  s.table = [];
  const bot = rkBot.createBot(0);
  let guard = 0;
  while (!s.hasBroken[0] && guard++ < 6) {
    const mv = bot.getMove(s);
    assert.ok(mv.tileIds, 'expected a set play, got ' + JSON.stringify(mv));
    assert.strictEqual(rk.handleMove(mv, s, 0), null);
  }
  assert.strictEqual(s.hasBroken[0], true);
  assert.strictEqual(s.table.length, 2);
  assert.strictEqual(s.hands[0].length, 2);
});

test('rummikub bot: draws when total of disjoint sets is below 30', () => {
  const s = rk.createState();
  rk.initGame(s, 2);
  s.hands[0] = [T('red', 1), T('red', 2), T('red', 3), T('blue', 9)];
  s.currentPlayer = 0; s.phase = 'play'; s.table = [];
  const mv = rkBot.createBot(0).getMove(s);
  assert.deepStrictEqual(mv, { pass: true });
});

// ---- monopoly round limit ----
function limited(n, limit) {
  const s = monopoly.createState();
  s._playerCount = n; s._options = limit === undefined ? {} : { roundLimit: limit };
  monopoly.initGame(s, n);
  return s;
}
function endTurnNow(s) { s.phase = 'end_turn'; return monopoly.handleMove({ type: 'end_turn' }, s, s.currentPlayer); }

test('monopoly round limit: default 50, rounds count full laps', () => {
  const s = limited(3);
  assert.strictEqual(s.round, 1);
  endTurnNow(s); endTurnNow(s);
  assert.strictEqual(s.round, 1);
  endTurnNow(s);
  assert.strictEqual(s.round, 2);
  assert.strictEqual(s.roundLimit, 50);
});

test('monopoly round limit: richest player wins when the last round ends', () => {
  const s = limited(2, 30);
  s.round = 30; s.currentPlayer = 1;
  s.cash = [500, 400];
  s.properties[1] = { owner: 1, houses: 2 };  // 60 + 2*30 = 120 -> 520
  s.properties[3] = { owner: 0, houses: 0 };  // 60 -> 560
  endTurnNow(s);
  assert.strictEqual(s.phase, 'gameover');
  assert.strictEqual(s.endReason, 'rounds');
  assert.deepStrictEqual(s.assets, [560, 520]);
  assert.strictEqual(s.winner, 0);
  assert.strictEqual(s.round, 30);
});

test('monopoly round limit: equal assets go to the player with more cash', () => {
  const s = limited(2, 30);
  s.round = 30; s.currentPlayer = 1;
  s.cash = [400, 460];
  s.properties[1] = { owner: 0, houses: 0 };  // 400+60 = 460
  endTurnNow(s);
  assert.deepStrictEqual(s.assets, [460, 460]);
  assert.strictEqual(s.winner, 1);
});

test('monopoly round limit: 0 means unlimited', () => {
  const s = limited(2, 0);
  s.round = 500; s.currentPlayer = 1;
  endTurnNow(s);
  assert.notStrictEqual(s.phase, 'gameover');
  assert.strictEqual(s.round, 501);
});

test('monopoly round limit: doubles re-roll does not start a new round', () => {
  const s = limited(2, 30);
  s.positions[0] = 0;
  rollWith(s, 2, 2);
  assert.strictEqual(s.currentPlayer, 0);
  assert.strictEqual(s.round, 1);
});
