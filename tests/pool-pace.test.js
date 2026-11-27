'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../games/pool');

function makeClearState(ballsList, overrides = {}) {
  const s = pool.createState();
  pool.initGame(s, 2);
  s.phase = 'shoot';
  s.kitchenOnly = false;
  const byId = new Map(ballsList.map((b) => [b.id, b]));
  for (let i = 0; i < s.balls.length; i++) {
    const id = s.balls[i].id;
    const custom = byId.get(id);
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

describe('Pool — botDelayMs pacing helper', () => {
  it('exports botDelayMs as a function', () => {
    assert.equal(typeof pool.botDelayMs, 'function');
  });

  it('returns ~2500 ms when there is no lastShot or no frames', () => {
    assert.equal(pool.botDelayMs(null), 2500);
    assert.equal(pool.botDelayMs({}), 2500);
    assert.equal(pool.botDelayMs({ lastShot: null }), 2500);
    assert.equal(pool.botDelayMs({ lastShot: { frames: [], fps: 30 } }), 2500);
  });

  it('returns >= 2500, grows with frame count, and defaults fps to 30', () => {
    const d30 = pool.botDelayMs({ lastShot: { frames: new Array(30).fill([]), fps: 30 } });
    const d90 = pool.botDelayMs({ lastShot: { frames: new Array(90).fill([]), fps: 30 } });
    const d180 = pool.botDelayMs({ lastShot: { frames: new Array(180).fill([]), fps: 30 } });
    const dDefaultFps = pool.botDelayMs({ lastShot: { frames: new Array(30).fill([]) } });

    assert.ok(d30 >= 2500);
    assert.equal(d30, 3500);
    assert.equal(dDefaultFps, 3500);
    assert.equal(d90, 5500);
    assert.equal(d180, 8500);
    assert.ok(d30 < d90 && d90 < d180);
  });

  it('clamps botDelayMs to 15000 ms maximum', () => {
    const dHuge = pool.botDelayMs({ lastShot: { frames: new Array(500).fill([]), fps: 30 } });
    assert.equal(dHuge, 15000);
  });

  it('works with real 8-ball and snooker shots', () => {
    const s8 = makeClearState([
      { id: 0, x: 850, y: 150 },
      { id: 1, x: 950, y: 50 },
      { id: 2, x: 200, y: 400 },
      { id: 8, x: 400, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: [null, null] });
    const ang8 = Math.atan2(50 - 150, 950 - 850);
    assert.equal(pool.handleMove({ type: 'shot', angle: ang8, power: 0.6 }, s8, 0), null);
    const delay8 = pool.botDelayMs(s8);
    assert.ok(delay8 > 2500 && delay8 <= 15000);

    const sSn = pool.createState();
    sSn._options = { variant: 'snooker' };
    pool.initGame(sSn, 2);
    sSn.phase = 'shoot';
    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.7 }, sSn, 0), null);
    const delaySn = pool.botDelayMs(sSn);
    assert.ok(delaySn > 2500 && delaySn <= 15000);
  });
});
