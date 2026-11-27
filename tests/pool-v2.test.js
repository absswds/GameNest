'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../games/pool');
const poolBot = require('../bots/pool');
const serverZh = require('../lang/server-zh');
const serverEn = require('../lang/server-en');

const { TABLE } = pool;

function makeClearState(ballsList, overrides = {}) {
  const s = pool.createState();
  pool.initGame(s, 2);
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

describe('Pool v2 — spin (english)', () => {
  it('allows shots without spinX/spinY and clamps out-of-range finite spin without throwing', () => {
    const s1 = makeClearState([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 500, y: 250 },
      { id: 8, x: 500, y: 420 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.45 }, s1, 0), null);
    assert.equal(s1.lastShot.spinX, 0);
    assert.equal(s1.lastShot.spinY, 0);

    const s2 = makeClearState([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 500, y: 250 },
      { id: 8, x: 500, y: 420 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.45, spinX: 5, spinY: -3 }, s2, 0), null);
    assert.equal(s2.lastShot.spinX, 1);
    assert.equal(s2.lastShot.spinY, -1);

    const s3 = makeClearState([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 500, y: 250 },
      { id: 8, x: 500, y: 420 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    const errNan = pool.handleMove({ type: 'shot', angle: 0, power: 0.45, spinX: NaN }, s3, 0);
    const errStr = pool.handleMove({ type: 'shot', angle: 0, power: 0.45, spinY: 'high' }, s3, 0);
    assert.equal(errNan, 'pool_invalid_shot');
    assert.equal(errStr, 'pool_invalid_shot');
    assert.ok(serverZh[errNan]);
    assert.ok(serverEn[errNan]);
  });

  it('backspin draws cue ball further back than stun and topspin follows further forward', () => {
    const balls = [
      { id: 0, x: 300, y: 250, potted: false, type: 'cue' },
      { id: 1, x: 500, y: 250, potted: false, type: 'solid' },
      { id: 8, x: 500, y: 420, potted: false, type: 'eight' },
    ];

    const simBack = pool.simulateShot(balls, 0, 0.45, { recordFrames: false, spinX: 0, spinY: -1 });
    const simStun = pool.simulateShot(balls, 0, 0.45, { recordFrames: false, spinX: 0, spinY: 0 });
    const simTop = pool.simulateShot(balls, 0, 0.45, { recordFrames: false, spinX: 0, spinY: 1 });

    const cueBack = simBack.balls.find((b) => b.id === 0);
    const cueStun = simStun.balls.find((b) => b.id === 0);
    const cueTop = simTop.balls.find((b) => b.id === 0);

    assert.ok(cueBack.x < cueStun.x - 40, `Expected backspin (${cueBack.x}) < stun (${cueStun.x})`);
    assert.ok(cueTop.x > cueStun.x + 40, `Expected topspin (${cueTop.x}) > stun (${cueStun.x})`);
  });

  it('side spin changes cue ball angle off a cushion in opposite directions', () => {
    const balls = [
      // x=300, not 500: straight down from the centre falls into the side pocket.
      { id: 0, x: 300, y: 350, potted: false, type: 'cue' },
      { id: 8, x: 100, y: 100, potted: false, type: 'eight' },
    ];

    const simRight = pool.simulateShot(balls, Math.PI / 2, 0.6, { recordFrames: false, spinX: 1, spinY: 0 });
    const simLeft = pool.simulateShot(balls, Math.PI / 2, 0.6, { recordFrames: false, spinX: -1, spinY: 0 });

    const cueRight = simRight.balls.find((b) => b.id === 0);
    const cueLeft = simLeft.balls.find((b) => b.id === 0);

    assert.ok(cueRight.x < 280,`Right english off bottom rail should deflect left, got ${cueRight.x}`);
    assert.ok(cueLeft.x > 320,`Left english off bottom rail should deflect right, got ${cueLeft.x}`);
  });
});

describe('Pool v2 — kitchen ball-in-hand rules', () => {
  it('refuses break-time placement outside the kitchen with pool_place_kitchen and accepts inside', () => {
    const s = pool.createState();
    pool.initGame(s, 2);
    s.phase = 'ball_in_hand';

    const errOut = pool.handleMove({ type: 'place', x: 500, y: 250 }, s, 0);
    assert.equal(errOut, 'pool_place_kitchen');
    assert.ok(serverZh[errOut]);
    assert.ok(serverEn[errOut]);

    assert.equal(pool.handleMove({ type: 'place', x: 180, y: 250 }, s, 0), null);
    assert.equal(s.phase, 'shoot');
    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(cue.x, 180);
    assert.equal(cue.y, 250);
  });

  it('scratch on the break restricts opponent ball-in-hand to the kitchen', () => {
    const s = makeClearState([
      { id: 0, x: 100, y: 100 },
      { id: 1, x: 750, y: 250 },
      { id: 8, x: 820, y: 250 },
    ], { isBreak: true, currentPlayer: 0, groups: [null, null] });

    const scratchAngle = Math.atan2(0 - 100, 0 - 100);
    assert.equal(pool.handleMove({ type: 'shot', angle: scratchAngle, power: 0.7 }, s, 0), null);
    assert.equal(s.lastShot.foul, 'scratch');
    assert.equal(s.phase, 'ball_in_hand');
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.kitchenOnly, true);

    const cueAfterScratch = s.balls.find((b) => b.id === 0);
    assert.ok(cueAfterScratch.x <= TABLE.HEAD_STRING_X);

    assert.equal(pool.handleMove({ type: 'place', x: 400, y: 250 }, s, 1), 'pool_place_kitchen');
    assert.equal(pool.handleMove({ type: 'place', x: 200, y: 300 }, s, 1), null);
    assert.equal(s.phase, 'shoot');
    assert.equal(s.kitchenOnly, false);
  });

  it('after a non-break foul, placement anywhere valid on the table is accepted', () => {
    const s = makeClearState([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 150, y: 400 },
      { id: 8, x: 250, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.3 }, s, 0), null);
    assert.equal(s.phase, 'ball_in_hand');
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.kitchenOnly, false);

    assert.equal(pool.handleMove({ type: 'place', x: 650, y: 250 }, s, 1), null);
    assert.equal(s.phase, 'shoot');
    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(cue.x, 650);
    assert.equal(cue.y, 250);
  });

  it('findSafeCueSpot respects kitchenOnly even when head string center is blocked', () => {
    const balls = [
      { id: 0, x: 250, y: 250, potted: true, type: 'cue' },
      { id: 1, x: 250, y: 250, potted: false, type: 'solid' },
    ];
    const spot = pool.findSafeCueSpot(balls, { kitchenOnly: true });
    assert.ok(spot.x <= TABLE.HEAD_STRING_X);
    assert.equal(pool.isValidCuePos(balls, spot.x, spot.y, { kitchenOnly: true }), true);
  });
});

describe('Pool v2 — bot spin & kitchen placement', () => {
  it('bot getMove returns a legal shot with spin fields in [-1, 1]', () => {
    const s = makeClearState([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 600, y: 200 },
      { id: 9, x: 700, y: 350 },
      { id: 8, x: 500, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'], _options: { difficulty: 'normal' } });

    const bot = poolBot.createBot(0);
    const mv = bot.getMove(s, 0);
    assert.equal(mv.type, 'shot');
    assert.equal(typeof mv.spinX, 'number');
    assert.equal(typeof mv.spinY, 'number');
    assert.ok(mv.spinX >= -1 && mv.spinX <= 1);
    assert.ok(mv.spinY >= -1 && mv.spinY <= 1);
    assert.equal(pool.handleMove(mv, s, 0), null);
  });

  it('bot placement respects the kitchen on break and after break scratch', () => {
    const sBreakPlace = makeClearState([
      { id: 0, x: 250, y: 250 },
      { id: 1, x: 880, y: 80 },
      { id: 9, x: 700, y: 350 },
      { id: 8, x: 500, y: 400 },
    ], { isBreak: true, currentPlayer: 0, phase: 'ball_in_hand', groups: [null, null], _options: { difficulty: 'hard' } });

    const bot0 = poolBot.createBot(0);
    const mvBreakPlace = bot0.getMove(sBreakPlace, 0);
    assert.equal(mvBreakPlace.type, 'place');
    assert.ok(mvBreakPlace.x <= TABLE.HEAD_STRING_X, `Expected break place x <= 250, got ${mvBreakPlace.x}`);
    assert.equal(pool.handleMove(mvBreakPlace, sBreakPlace, 0), null);

    const sScratchPlace = makeClearState([
      { id: 0, x: 250, y: 250 },
      { id: 1, x: 880, y: 80 },
      { id: 9, x: 700, y: 350 },
      { id: 8, x: 500, y: 400 },
    ], { isBreak: false, kitchenOnly: true, currentPlayer: 1, phase: 'ball_in_hand', groups: [null, null], _options: { difficulty: 'hard' } });

    const bot1 = poolBot.createBot(1);
    const mvScratchPlace = bot1.getMove(sScratchPlace, 1);
    assert.equal(mvScratchPlace.type, 'place');
    assert.ok(mvScratchPlace.x <= TABLE.HEAD_STRING_X, `Expected kitchenOnly place x <= 250, got ${mvScratchPlace.x}`);
    assert.equal(pool.handleMove(mvScratchPlace, sScratchPlace, 1), null);
  });
});
