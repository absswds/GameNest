const test = require('node:test');
const assert = require('node:assert/strict');

const rk = require('../games/rummikub');
const nb = require('../games/numberbomb');
const ms = require('../games/minesweeper');
const su = require('../games/sudoku');
const sh = require('../games/sheeptile');
const sk = require('../games/suikabattle');
const sn = require('../games/snakebattle');
const tf = require('../games/twentyfour');
const g48 = require('../games/2048');

function init(mod, n) {
  const s = mod.createState();
  s._options = s._options || {};
  s._playerCount = n;
  mod.initGame(s, n);
  return s;
}

// ---- rummikub ----
const T = (color, num, s = 'a') => ({ color, num, id: color + '-' + num + '-' + s });
const J = (n = 0) => ({ color: 'joker', num: 0, id: 'joker-' + n, wild: true });

function rkState(hand0, table = [], broken = false) {
  const s = init(rk, 2);
  s.hands[0] = hand0;
  s.table = table;
  s.hasBroken = [broken, true];
  s.currentPlayer = 0;
  return s;
}

test('rummikub: forged tiles / unknown ids / duplicate ids are rejected in manipulate', () => {
  const table = [[T('black', 1), T('black', 2), T('black', 3)]];
  const s = rkState([T('red', 5), T('red', 9)], table, true);
  assert.equal(rk.handleMove({ action: 'start_manipulate' }, s, 0), null);
  const forged = { id: 'red-5-a', color: 'black', num: 4 };
  assert.equal(
    rk.handleMove({ action: 'submit', groups: [[table[0][0], table[0][1], table[0][2], forged]] }, s, 0),
    'rk_illegal_sets', 'a forged colour/number must not be trusted');
  assert.equal(
    rk.handleMove({ action: 'submit', groups: [[{ id: 'x', color: 'black', num: 4 }]] }, s, 0), 'rk_invalid_tile');
  const a = table[0][0];
  assert.equal(
    rk.handleMove({ action: 'submit', groups: [[a, a, a]] }, s, 0), 'rk_invalid_tile', 'one id used twice');
});

test('rummikub: initial meld totals the sets of the turn, jokers count as their stand-in', () => {
  // 1-2-3 (6) + 7-8-9 (24) = 30
  let s = rkState([T('black', 1), T('black', 2), T('black', 3), T('red', 7), T('red', 8), T('red', 9), T('blue', 4)]);
  assert.equal(rk.handleMove({ tileIds: ['black-1-a', 'black-2-a', 'black-3-a'] }, s, 0), null);
  assert.equal(s.hasBroken[0], false);
  assert.equal(rk.handleMove({ tileIds: ['red-7-a', 'red-8-a', 'red-9-a'] }, s, 0), null);
  assert.equal(s.hasBroken[0], true);

  // 1-joker-3 is worth 6, not 34: turn ends below 30 -> tiles go back and the player draws
  s = rkState([T('black', 1), J(), T('black', 3), T('blue', 4)]);
  const before = s.hands[0].length;
  assert.equal(rk.handleMove({ tileIds: ['black-1-a', 'joker-0', 'black-3-a'] }, s, 0), null);
  assert.equal(rk.handleMove({ endTurn: true }, s, 0), null);
  assert.equal(s.table.length, 0);
  assert.equal(s.hasBroken[0], false);
  assert.equal(s.hands[0].length, before + 1);
  assert.equal(s.currentPlayer, 1);
});

test('rummikub: fallback draw is refused after playing; non-integer targetSet does not throw', () => {
  const s = rkState([T('red', 1), T('red', 2), T('red', 3), T('blue', 4)], [], true);
  assert.equal(rk.handleMove({ tileIds: ['red-1-a', 'red-2-a', 'red-3-a'] }, s, 0), null);
  assert.equal(rk.handleMove({}, s, 0), 'rk_already_played');
  assert.doesNotThrow(() => rk.handleMove({ tileIds: ['blue-4-a'], targetSet: 0.5 }, s, 0));
  assert.equal(rk.handleMove({ tileIds: ['blue-4-a'], targetSet: 0.5 }, s, 0), 'rk_invalid_play');
});

test('rummikub: a joker keeps its slot when a tile is added to a run', () => {
  const s = rkState([T('red', 7)], [[T('red', 4), J(), T('red', 6)]], true);
  s.hands[0].push(T('blue', 1));
  assert.equal(rk.handleMove({ tileIds: ['red-7-a'], targetSet: 0 }, s, 0), null);
  assert.deepEqual(s.table[0].map(t => (t.wild ? 'J' : t.num)), [4, 'J', 6, 7]);
});

test('rummikub: playerView hides workspace and saved hand of the manipulating player', () => {
  const s = rkState([T('red', 5), T('red', 9)], [[T('black', 1), T('black', 2), T('black', 3)]], true);
  rk.handleMove({ action: 'start_manipulate' }, s, 0);
  const other = rk.playerView(s, 1);
  assert.ok(!JSON.stringify([other.workspace, other.savedHand, other.savedHandIds]).includes('red-'));
  const own = rk.playerView(s, 0);
  assert.ok(own.workspace.some(t => t && t.id === 'red-5-a'));
});

// ---- numberbomb ----
test('numberbomb: playerView hides the bomb until the game ends; solo play uses all lives', () => {
  const s = init(nb, 1);
  assert.equal(nb.playerView(s, 0).bomb, null);
  for (let i = 0; i < 2; i++) {
    assert.equal(nb.handleMove({ guess: s.bomb }, s, 0), null);
    assert.equal(s.winner, null, 'game continues while lives remain');
  }
  assert.equal(nb.handleMove({ guess: s.bomb }, s, 0), null);
  assert.notEqual(s.winner, null);
  assert.equal(nb.playerView(s, 0).bomb, s.bomb);
});

// ---- minesweeper ----
test('minesweeper: views hide mines, bad coordinates do not throw, first click is safe per player', () => {
  const s = init(ms, 2);
  const v = ms.playerView(s, 0);
  assert.deepEqual(v.mines, []);
  assert.equal(v.revealed[1], null);
  assert.equal(v.flagged[1], null);
  assert.ok(!JSON.stringify(v.board).includes('"mine":true'));
  assert.doesNotThrow(() => ms.handleMove({ action: 'reveal', row: 0.5, col: 0 }, s, 0));
  assert.equal(ms.handleMove({ action: 'reveal', row: NaN, col: 0 }, s, 0), 'ms_invalid_action');
  for (let p = 0; p < 2; p++) {
    let r = 0, c = 0;
    outer: for (r = 0; r < s.rows; r++) for (c = 0; c < s.cols; c++) if (s.mines[p][r][c]) break outer;
    ms.handleMove({ action: 'reveal', row: r, col: c }, s, p);
    assert.equal(s.alive[p], true, 'player ' + p + ' first reveal is safe');
  }
});

// ---- sudoku ----
test('sudoku: malformed moves are rejected; playerView works before init; fatal mistake broadcasts', () => {
  const empty = su.createState();
  assert.doesNotThrow(() => su.playerView(empty, 0));
  const s = init(su, 2);
  assert.equal(su.handleMove(undefined, s, 0), 'su_invalid');
  assert.equal(su.handleMove({ val: 5 }, s, 0), 'su_invalid');
  assert.equal(su.handleMove({ row: 0.5, col: 0, val: 5 }, s, 0), 'su_invalid');
  let r = 0, c = 0;
  outer: for (r = 0; r < 9; r++) for (c = 0; c < 9; c++) if (!s.given[r][c]) break outer;
  const wrong = (s.solution[r][c] % 9) + 1;
  const lives = s.lives[0];
  for (let i = 1; i < lives; i++) assert.equal(su.handleMove({ row: r, col: c, val: wrong }, s, 0), 'su_wrong');
  assert.equal(su.handleMove({ row: r, col: c, val: wrong }, s, 0), null);
  assert.equal(s.eliminated[0], true);
});

// ---- sheeptile ----
test('sheeptile: missing data does not throw; bots are scheduled; patterns are filtered', () => {
  const s = init(sh, 3);
  assert.doesNotThrow(() => sh.handleMove(undefined, s, 0));
  assert.deepEqual(sh.getPendingActors(s), [0, 1, 2]);
  const view = sh.playerView(s, 0);
  assert.ok(Object.keys(view.patterns[0]).length <= Object.keys(s.patterns[0]).length);
});

// ---- suikabattle ----
test('suikabattle: invalid fruit types and merges beyond drops are rejected', () => {
  const s = init(sk, 1);
  assert.doesNotThrow(() => sk.handleMove(undefined, s, 0));
  sk.handleMove({ type: 'drop' }, s, 0);
  assert.equal(sk.handleMove({ type: 'merge', fruitType: 'constructor' }, s, 0), 'g_unknown_action');
  assert.equal(sk.handleMove({ type: 'merge', fruitType: 99 }, s, 0), 'g_unknown_action');
  assert.equal(sk.handleMove({ type: 'merge', fruitType: 3 }, s, 0), null);
  assert.equal(sk.handleMove({ type: 'merge', fruitType: 3 }, s, 0), 'g_unknown_action', 'only one merge per drop');
  assert.equal(typeof s.scores[0], 'number');
});

// ---- snakebattle ----
test('snakebattle: stepping onto the tail of a snake that crashes this tick is a crash', () => {
  const s = init(sn, 2);
  // A heads into the right wall (dies) and keeps its tail cell; B steps onto that cell.
  s.snakes[0].body = [{ x: 27, y: 5 }, { x: 27, y: 6 }, { x: 26, y: 6 }];
  s.snakes[0].direction = s.snakes[0].nextDirection = 'right';
  s.snakes[1].body = [{ x: 25, y: 6 }, { x: 24, y: 6 }, { x: 23, y: 6 }];
  s.snakes[1].direction = s.snakes[1].nextDirection = 'right';
  s.food = { x: 0, y: 0 };
  sn.tick(s);
  assert.equal(s.snakes[0].alive, false);
  assert.equal(s.snakes[1].alive, false, 'B hit the tail that A did not vacate');
});

// ---- twentyfour ----
test('twentyfour: power, comments and decimals are rejected; timed answers are hidden', () => {
  const s = init(tf, 2);
  s.numbers = [3, 5, 7, 8];
  s.roundTime = 0;
  s.phase = 'playing';
  for (const e of ['8*3 /*5 7*/', '2**3*3*1', '1.5*4*4', '8*3//5 7']) {
    assert.equal(tf.handleMove({ expression: e }, s, 0), 'tf_invalid_chars', e);
  }
  s.numbers = [1, 2, 3, 4];
  assert.equal(tf.handleMove({ expression: '1*2*3*5' }, s, 0), 'tf_wrong_numbers');

  s.roundTime = 30;
  s.solutions = ['secret'];
  s.playerSubmissions = { 1: { correct: true, expression: '1*2*3*4' } };
  const view = tf.playerView(s, 0);
  assert.deepEqual(view.solutions, []);
  assert.equal(view.playerSubmissions[1].expression, undefined);
  assert.equal(view.playerSubmissions[1].correct, true);
});

// ---- 2048 ----
test('2048: playerView before initGame does not throw', () => {
  const s = g48.createState();
  assert.doesNotThrow(() => g48.playerView(s, 0));
});
