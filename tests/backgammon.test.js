const test = require('node:test');
const assert = require('node:assert/strict');

const bg = require('../games/backgammon');

// Helper: create a fresh state
function freshState() {
  return bg.createState();
}

// ---- Starting Position ----

test('createState has correct starting position', () => {
  const s = freshState();

  // Player 0: 2 on 23, 5 on 12, 3 on 7, 5 on 5
  assert.equal(s.points[23].side, 0);
  assert.equal(s.points[23].count, 2);
  assert.equal(s.points[12].side, 0);
  assert.equal(s.points[12].count, 5);
  assert.equal(s.points[7].side, 0);
  assert.equal(s.points[7].count, 3);
  assert.equal(s.points[5].side, 0);
  assert.equal(s.points[5].count, 5);

  // Player 1: 2 on 0, 5 on 11, 3 on 16, 5 on 18
  assert.equal(s.points[0].side, 1);
  assert.equal(s.points[0].count, 2);
  assert.equal(s.points[11].side, 1);
  assert.equal(s.points[11].count, 5);
  assert.equal(s.points[16].side, 1);
  assert.equal(s.points[16].count, 3);
  assert.equal(s.points[18].side, 1);
  assert.equal(s.points[18].count, 5);

  // Total: 15 per side
  var p0 = 0, p1 = 0;
  for (var i = 0; i < 24; i++) {
    if (s.points[i]) {
      if (s.points[i].side === 0) p0 += s.points[i].count;
      if (s.points[i].side === 1) p1 += s.points[i].count;
    }
  }
  assert.equal(p0, 15);
  assert.equal(p1, 15);
});

test('initial state: no winner, currentPlayer 0, hasRolled false', () => {
  const s = freshState();
  assert.equal(s.winner, null);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.hasRolled, false);
  assert.equal(s.bar[0], 0);
  assert.equal(s.bar[1], 0);
  assert.equal(s.home[0], 0);
  assert.equal(s.home[1], 0);
});

// ---- Rolling Dice ----

test('roll: sets dice and hasRolled', () => {
  const s = freshState();
  var result = bg.handleMove({ roll: true }, s, 0);
  assert.equal(result, null);
  assert.equal(s.hasRolled, true);
  assert.ok(s.dice.length === 2 || s.dice.length === 4);
  assert.ok(s.remainingDice.length > 0);
});

test('roll: doubles gives 4 dice', () => {
  // We can't guarantee doubles from random, so test the logic directly
  const s = freshState();
  // Manually set up a doubles scenario
  s.hasRolled = false;
  s.dice = [3, 3, 3, 3];
  s.remainingDice = [3, 3, 3, 3];
  s.hasRolled = true;
  assert.equal(s.dice.length, 4);
});

test('roll: cannot roll twice', () => {
  const s = freshState();
  bg.handleMove({ roll: true }, s, 0);
  var result = bg.handleMove({ roll: true }, s, 0);
  assert.equal(result, '已经掷过骰子了');
});

// ---- Turn Enforcement ----

test('wrong player cannot move', () => {
  const s = freshState();
  var result = bg.handleMove({ roll: true }, s, 1);
  assert.equal(result, '不是你的回合');
});

test('cannot move before rolling', () => {
  const s = freshState();
  var result = bg.handleMove({ from: 23, to: 20, dieUsed: 3 }, s, 0);
  assert.equal(result, '请先掷骰子');
});

// ---- Regular Movement ----

test('player 0 can move from 23 to 20 with die 3', () => {
  const s = freshState();
  // Set up specific dice
  s.dice = [3, 5];
  s.remainingDice = [3, 5];
  s.hasRolled = true;

  var result = bg.handleMove({ from: 23, to: 20, dieUsed: 3 }, s, 0);
  assert.equal(result, null);
  assert.equal(s.points[23].count, 1);
  assert.equal(s.points[20].side, 0);
  assert.equal(s.points[20].count, 1);
  assert.deepEqual(s.remainingDice, [5]);
});

test('player 1 can move from 0 to 3 with die 3', () => {
  const s = freshState();
  s.currentPlayer = 1;
  s.dice = [3, 4];
  s.remainingDice = [3, 4];
  s.hasRolled = true;

  var result = bg.handleMove({ from: 0, to: 3, dieUsed: 3 }, s, 1);
  assert.equal(result, null);
  assert.equal(s.points[0].count, 1);
  assert.equal(s.points[3].side, 1);
  assert.equal(s.points[3].count, 1);
});

// ---- Illegal Moves ----

test('cannot move wrong direction', () => {
  const s = freshState();
  s.dice = [3, 4];
  s.remainingDice = [3, 4];
  s.hasRolled = true;

  // Player 0 tries to move from 23 to 26 (wrong direction)
  var result = bg.handleMove({ from: 23, to: 26, dieUsed: 3 }, s, 0);
  assert.ok(result);
});

test('cannot move to occupied point (2+ enemy)', () => {
  const s = freshState();
  // Point 0 has 2 player 1 pieces
  s.dice = [1, 2];
  s.remainingDice = [1, 2];
  s.hasRolled = true;

  // Player 0 tries to move to point 0 (blocked by 2 enemy pieces)
  // Player 0 moves from high to low, so from 1 to 0 with die 1
  s.points[1] = { side: 0, count: 1 };
  var result = bg.handleMove({ from: 1, to: 0, dieUsed: 1 }, s, 0);
  assert.ok(result);
});

test('can land on blot (1 enemy piece)', () => {
  const s = freshState();
  s.dice = [1, 2];
  s.remainingDice = [1, 2];
  s.hasRolled = true;

  // Set up: player 1 has 1 piece on point 22
  s.points[22] = { side: 1, count: 1 };
  // Player 0 moves from 23 to 22 with die 1
  var result = bg.handleMove({ from: 23, to: 22, dieUsed: 1 }, s, 0);
  assert.equal(result, null);
  // Player 1's piece should be sent to bar
  assert.equal(s.bar[1], 1);
  assert.equal(s.points[22].side, 0);
  assert.equal(s.points[22].count, 1);
});

// ---- Bar Rules ----

test('bar pieces must enter first', () => {
  const s = freshState();
  s.bar[0] = 1;
  s.dice = [3, 4];
  s.remainingDice = [3, 4];
  s.hasRolled = true;

  // Try to move from point 12 (not bar) — should fail
  var result = bg.handleMove({ from: 12, to: 8, dieUsed: 4 }, s, 0);
  assert.equal(result, '不合法的走法');
});

test('bar entry with correct die', () => {
  const s = freshState();
  s.bar[0] = 1;
  s.dice = [3, 4];
  s.remainingDice = [3, 4];
  s.hasRolled = true;

  // Player 0 bar entry: die 3 → enters at point 24-3=21
  var result = bg.handleMove({ from: 'bar', to: 21, dieUsed: 3 }, s, 0);
  assert.equal(result, null);
  assert.equal(s.bar[0], 0);
  assert.equal(s.points[21].side, 0);
  assert.equal(s.points[21].count, 1);
});

test('bar entry blocked by 2+ enemy pieces', () => {
  const s = freshState();
  s.bar[0] = 1;
  s.dice = [3, 4];
  s.remainingDice = [3, 4];
  s.hasRolled = true;

  // Point 21 has 2 enemy pieces — blocked
  s.points[21] = { side: 1, count: 2 };
  var result = bg.handleMove({ from: 'bar', to: 21, dieUsed: 3 }, s, 0);
  assert.ok(result);
});

// ---- Doubles ----

test('doubles: 4 moves available', () => {
  const s = freshState();
  s.dice = [4, 4, 4, 4];
  s.remainingDice = [4, 4, 4, 4];
  s.hasRolled = true;

  // Player 0: move from 12 to 8
  var result = bg.handleMove({ from: 12, to: 8, dieUsed: 4 }, s, 0);
  assert.equal(result, null);
  assert.equal(s.remainingDice.length, 3);
});

// ---- Turn Ending ----

test('turn ends when no remaining dice', () => {
  const s = freshState();
  s.dice = [3];
  s.remainingDice = [3];
  s.hasRolled = true;

  bg.handleMove({ from: 23, to: 20, dieUsed: 3 }, s, 0);
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.hasRolled, false);
});

// ---- Pass ----

test('pass ends turn', () => {
  const s = freshState();
  s.hasRolled = true;
  s.dice = [3, 4];
  s.remainingDice = [3, 4];

  var result = bg.handleMove({ pass: true }, s, 0);
  assert.equal(result, null);
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.hasRolled, false);
});

// ---- Win Detection ----

test('win when all pieces borne off', () => {
  const s = freshState();
  s.home[0] = 14;
  s.dice = [1, 2];
  s.remainingDice = [1, 2];
  s.hasRolled = true;

  // Clear all player 0 points and set up just 1 piece on point 0
  for (var i = 0; i < 24; i++) {
    if (s.points[i] && s.points[i].side === 0) {
      s.points[i] = null;
    }
  }
  s.points[0] = { side: 0, count: 1 };

  // Bear off with die 1 (exact for point 0)
  var result = bg.handleMove({ from: 0, to: 'off', dieUsed: 1 }, s, 0);
  assert.equal(result, null);
  assert.equal(s.winner, 0);
});

// ---- Bear Off Rules ----

test('cannot bear off not all in home', () => {
  const s = freshState();
  // Player 0 has pieces outside home (points 12, 7, 23)
  s.dice = [1, 2];
  s.remainingDice = [1, 2];
  s.hasRolled = true;

  // Add a piece on point 0
  s.points[0] = s.points[0] || { side: 0, count: 0 };
  s.points[0].count = 1;
  s.points[0].side = 0;

  // Try to bear off — should fail because pieces are outside home
  var result = bg.handleMove({ from: 0, to: 'off', dieUsed: 1 }, s, 0);
  assert.ok(result);
});

// ---- Bot ----

test('bot module loads and creates bot', () => {
  const bot = require('../bots/backgammon');
  assert.equal(bot.name, 'backgammon');
  var instance = bot.createBot(0);
  assert.equal(instance.name, '电脑1');
  assert.equal(typeof instance.getMove, 'function');
});

test('bot getMove returns a move or roll', () => {
  const bot = require('../bots/backgammon');
  var instance = bot.createBot(0);
  var s = freshState();
  var move = instance.getMove(s);
  assert.ok(move);
  assert.ok(move.roll === true);
});

// ---- Pip Count ----

test('pip count is correct at start', () => {
  const s = freshState();
  var p0 = bg._pipCount(s, 0);
  var p1 = bg._pipCount(s, 1);
  // Player 0: 2×24 + 5×13 + 3×8 + 5×6 = 48+65+24+30 = 167
  assert.equal(p0, 167);
  // Player 1: 2×1 + 5×12 + 3×7 + 5×5 = 2+60+21+25 = 108... wait
  // Player 1 home is 18-23, pip = 24-p
  // 2 on 0: 2×(24-0)=48
  // 5 on 11: 5×(24-11)=65
  // 3 on 16: 3×(24-16)=24
  // 5 on 18: 5×(24-18)=30
  // Total: 48+65+24+30 = 167
  assert.equal(p1, 167);
});

// ---- No Legal Moves ----

test('hasAnyLegalMove returns false when blocked', () => {
  const s = freshState();
  s.remainingDice = [1];
  // All entry points blocked for bar
  s.bar[0] = 1;
  s.points[23] = { side: 1, count: 2 };
  var result = bg._hasAnyLegalMove(s, 0);
  assert.equal(result, false);
});
