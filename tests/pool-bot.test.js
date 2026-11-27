'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../games/pool');
const poolBot = require('../bots/pool');

function makeStateWithBalls(ballsList, overrides = {}) {
  const s = pool.createState();
  pool.initGame(s, 2);
  s.phase = 'shoot';
  s.kitchenOnly = false;
  const byId = new Map(ballsList.map((b) => [b.id, b]));
  for (let i = 0; i < s.balls.length; i++) {
    const custom = byId.get(s.balls[i].id);
    if (custom) {
      s.balls[i].x = custom.x;
      s.balls[i].y = custom.y;
      s.balls[i].potted = !!custom.potted;
    } else {
      s.balls[i].potted = true;
    }
  }
  Object.assign(s, overrides);
  return s;
}

describe('Pool bot', () => {
  it('exports pool bot interface', () => {
    assert.equal(poolBot.name, 'pool');
    assert.equal(typeof poolBot.createBot, 'function');
  });

  it('does not mutate state on shoot (break and normal) or ball_in_hand', () => {
    const bot = poolBot.createBot(0);

    // Break ball-in-hand placement behind head string
    const sBreakPlace = pool.createState();
    pool.initGame(sBreakPlace, 2);
    sBreakPlace._options = { difficulty: 'normal' };
    const snapBreakPlace = JSON.stringify(sBreakPlace);
    const mvBreakPlace = bot.getMove(sBreakPlace, 0);
    assert.equal(mvBreakPlace.type, 'place');
    assert.ok(mvBreakPlace.x <= pool.TABLE.HEAD_STRING_X);
    assert.equal(JSON.stringify(sBreakPlace), snapBreakPlace);

    // Break shot
    const sBreak = pool.createState();
    pool.initGame(sBreak, 2);
    sBreak.phase = 'shoot';
    sBreak.kitchenOnly = false;
    sBreak._options = { difficulty: 'normal' };
    const snapBreak = JSON.stringify(sBreak);
    const mvBreak = bot.getMove(sBreak, 0);
    assert.equal(mvBreak.type, 'shot');
    assert.equal(JSON.stringify(sBreak), snapBreak);

    // Normal shot
    const sNormal = makeStateWithBalls([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 600, y: 200 },
      { id: 9, x: 700, y: 350 },
      { id: 8, x: 500, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'], _options: { difficulty: 'hard' } });
    const snapNormal = JSON.stringify(sNormal);
    const mvNormal = bot.getMove(sNormal, 0);
    assert.equal(mvNormal.type, 'shot');
    assert.equal(JSON.stringify(sNormal), snapNormal);

    // Ball-in-hand
    const sPlace = makeStateWithBalls([
      { id: 0, x: 250, y: 250 },
      { id: 1, x: 850, y: 120 },
      { id: 9, x: 300, y: 400 },
      { id: 8, x: 500, y: 400 },
    ], { isBreak: false, currentPlayer: 0, phase: 'ball_in_hand', groups: ['solid', 'stripe'], _options: { difficulty: 'normal' } });
    const snapPlace = JSON.stringify(sPlace);
    const mvPlace = bot.getMove(sPlace, 0);
    assert.equal(mvPlace.type, 'place');
    assert.equal(JSON.stringify(sPlace), snapPlace);
  });

  it('pots a trivial straight-in shot cleanly on hard difficulty', () => {
    const s = makeStateWithBalls([
      { id: 0, x: 800, y: 200 },
      { id: 1, x: 910, y: 90 },
      { id: 9, x: 200, y: 420 },
      { id: 8, x: 400, y: 420 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'], _options: { difficulty: 'hard' } });

    const bot = poolBot.createBot(0);
    const mv = bot.getMove(s, 0);
    assert.equal(mv.type, 'shot');
    assert.equal(pool.handleMove(mv, s, 0), null);
    assert.equal(s.lastShot.foul, null);
    assert.equal(s.balls.find((b) => b.id === 1).potted, true);
  });

  it('returns a legal place move in ball_in_hand accepted by handleMove', () => {
    const s = makeStateWithBalls([
      { id: 0, x: 250, y: 250 },
      { id: 2, x: 750, y: 250 },
      { id: 10, x: 450, y: 350 },
      { id: 8, x: 600, y: 400 },
    ], { isBreak: false, currentPlayer: 1, phase: 'ball_in_hand', groups: ['solid', 'stripe'], _options: { difficulty: 'normal' } });

    const bot = poolBot.createBot(1);
    const mv = bot.getMove(s, 1);
    assert.equal(mv.type, 'place');
    assert.equal(pool.handleMove(mv, s, 1), null);
    assert.equal(s.phase, 'shoot');
    assert.equal(s.currentPlayer, 1);
  });

  it('completes a full bot-vs-bot game cleanly with zero rejected moves', () => {
    const s = pool.createState();
    pool.initGame(s, 2);
    const bots = [poolBot.createBot(0), poolBot.createBot(1)];
    const diffs = ['hard', 'normal'];

    let steps = 0;
    while (s.phase !== 'over' && s.winner === null && steps < 350) {
      const cp = s.currentPlayer;
      const view = Object.assign({}, s, { _options: { difficulty: diffs[cp] } });
      const mv = bots[cp].getMove(view, cp);
      assert.ok(mv, 'Bot should return a move');
      const err = pool.handleMove(mv, s, cp);
      assert.equal(err, null, `Move rejected on step ${steps}: ${err}`);
      steps++;
    }

    assert.equal(s.phase, 'over');
    assert.ok(s.turnCount <= 150);
    assert.ok([0, 1, -1].includes(s.winner));
  });
});
