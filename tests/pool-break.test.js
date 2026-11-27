'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../games/pool');
const poolBot = require('../bots/pool');

const { TABLE } = pool;

function isLegalBreak(sim) {
  const pottedObj = sim.potted.filter((id) => id !== 0).length;
  const objRailHits = (sim.railHits || []).filter((id) => id !== 0).length;
  return pottedObj >= 1 || objRailHits >= 4;
}

describe('Pool — break physics & bot break', () => {
  it('40 full-power breaks over +-0.03 rad yield >= 32 legal breaks and rare scratches', () => {
    const s = pool.createState();
    pool.initGame(s, 2);
    const cue = s.balls.find((b) => b.id === 0);
    const baseAngle = Math.atan2(TABLE.FOOT_SPOT_Y - cue.y, TABLE.FOOT_SPOT_X - cue.x);

    let legalCount = 0;
    let scratchCount = 0;
    for (let i = 0; i < 40; i++) {
      const angle = baseAngle + i * 0.0015 - 0.03;
      const sim = pool.simulateShot(s.balls, angle, 1.0, { recordFrames: false, isBreak: true });
      if (isLegalBreak(sim)) legalCount++;
      if (sim.potted.includes(0)) scratchCount++;
    }

    assert.ok(legalCount >= 32, `Expected >= 32 legal breaks out of 40, got ${legalCount}`);
    assert.ok(scratchCount < 6, `Expected < 6 scratches (< 15%) out of 40, got ${scratchCount}`);
  });

  it('40 soft breaks at power 0.3 yield <= 4 legal breaks', () => {
    const s = pool.createState();
    pool.initGame(s, 2);
    const cue = s.balls.find((b) => b.id === 0);
    const baseAngle = Math.atan2(TABLE.FOOT_SPOT_Y - cue.y, TABLE.FOOT_SPOT_X - cue.x);

    let legalCount = 0;
    for (let i = 0; i < 40; i++) {
      const angle = baseAngle + i * 0.0015 - 0.03;
      const sim = pool.simulateShot(s.balls, angle, 0.3, { recordFrames: false, isBreak: true });
      if (isLegalBreak(sim)) legalCount++;
    }

    assert.ok(legalCount <= 4, `Expected <= 4 legal soft breaks out of 40, got ${legalCount}`);
  });

  it('same break inputs twice produce identical resulting ball positions', () => {
    const s = pool.createState();
    pool.initGame(s, 2);

    const r1 = pool.simulateShot(s.balls, 0.012, 0.95, { isBreak: true });
    const r2 = pool.simulateShot(s.balls, 0.012, 0.95, { isBreak: true });

    assert.deepEqual(r1.balls, r2.balls);
    assert.deepEqual(r1.potted, r2.potted);
    assert.deepEqual(r1.railHits, r2.railHits);
    assert.deepEqual(r1.frames, r2.frames);
  });

  it('hard bot produces >= 16 legal breaks across 20 fresh games', () => {
    const bot = poolBot.createBot(0);
    let legalCount = 0;

    for (let g = 0; g < 20; g++) {
      const s = pool.createState();
      pool.initGame(s, 2);
      s._options = { difficulty: 'hard' };

      const placeMove = bot.getMove(s, 0);
      assert.equal(placeMove.type, 'place');
      assert.equal(pool.handleMove(placeMove, s, 0), null);

      const shotMove = bot.getMove(s, 0);
      assert.equal(shotMove.type, 'shot');
      assert.ok(shotMove.power >= 0.9, `Expected bot break power >= 0.9, got ${shotMove.power}`);
      assert.equal(pool.handleMove(shotMove, s, 0), null);

      if (!s.lastShot.illegalBreak) legalCount++;
    }

    assert.ok(legalCount >= 16, `Expected >= 16 legal bot breaks out of 20, got ${legalCount}`);
  });
});
