'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../games/pool');
const serverZh = require('../lang/server-zh');
const serverEn = require('../lang/server-en');

const { TABLE } = pool;

function makeClearState(ballsList, overrides = {}) {
  const s = pool.createState();
  pool.initGame(s, 2);
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

describe('Pool — initial rack & exports', () => {
  it('exports required interface and TABLE constants', () => {
    assert.equal(pool.name, 'pool');
    assert.equal(pool.minPlayers, 2);
    assert.equal(pool.maxPlayers, 2);
    assert.equal(TABLE.W, 1000);
    assert.equal(TABLE.H, 500);
    assert.equal(TABLE.BALL_R, 14);
    assert.equal(TABLE.POCKETS.length, 6);
  });

  it('sets up 16 non-overlapping balls with cue at (250,250), 8-ball at row 2 center, and valid back corners', () => {
    const s = pool.createState();
    pool.initGame(s, 2);

    assert.equal(s.balls.length, 16);
    assert.equal(s.currentPlayer, 0);
    assert.equal(s.phase, 'shoot');
    assert.deepEqual(s.groups, [null, null]);
    assert.equal(s.isBreak, true);
    assert.equal(s.winner, null);

    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(cue.x, 250);
    assert.equal(cue.y, 250);
    assert.equal(cue.type, 'cue');
    assert.equal(cue.potted, false);

    const spacing = 2 * TABLE.BALL_R + 0.6;
    const dx = spacing * Math.cos(Math.PI / 6);
    const dy = spacing;

    // Apex ball = 1 (solid)
    const apex = s.balls.find((b) => b.id === 1);
    assert.ok(Math.abs(apex.x - TABLE.FOOT_SPOT_X) < 1e-6);
    assert.ok(Math.abs(apex.y - TABLE.FOOT_SPOT_Y) < 1e-6);

    // Row 2 center = 8
    const eight = s.balls.find((b) => b.id === 8);
    assert.equal(eight.type, 'eight');
    assert.ok(Math.abs(eight.x - (TABLE.FOOT_SPOT_X + 2 * dx)) < 1e-6);
    assert.ok(Math.abs(eight.y - TABLE.FOOT_SPOT_Y) < 1e-6);

    // Back corners: one solid (2), one stripe (9)
    const cornerTop = s.balls.find((b) =>
      Math.abs(b.x - (TABLE.FOOT_SPOT_X + 4 * dx)) < 1e-6 &&
      Math.abs(b.y - (TABLE.FOOT_SPOT_Y - 2 * dy)) < 1e-6
    );
    const cornerBot = s.balls.find((b) =>
      Math.abs(b.x - (TABLE.FOOT_SPOT_X + 4 * dx)) < 1e-6 &&
      Math.abs(b.y - (TABLE.FOOT_SPOT_Y + 2 * dy)) < 1e-6
    );
    assert.ok(cornerTop && cornerBot);
    assert.notEqual(cornerTop.type, cornerBot.type);
    assert.ok(
      (cornerTop.type === 'solid' && cornerBot.type === 'stripe') ||
      (cornerTop.type === 'stripe' && cornerBot.type === 'solid')
    );

    // No overlapping pairs and all inside table bounds
    for (let i = 0; i < s.balls.length; i++) {
      const a = s.balls[i];
      assert.equal(a.potted, false);
      assert.ok(a.x >= TABLE.BALL_R && a.x <= TABLE.W - TABLE.BALL_R);
      assert.ok(a.y >= TABLE.BALL_R && a.y <= TABLE.H - TABLE.BALL_R);
      for (let j = i + 1; j < s.balls.length; j++) {
        const b = s.balls[j];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * TABLE.BALL_R);
      }
    }
  });
});

describe('Pool — deterministic physics', () => {
  it('simulateShot is pure, deterministic, and produces compact keyframes', () => {
    const s = pool.createState();
    pool.initGame(s, 2);
    const before = JSON.parse(JSON.stringify(s.balls));

    const r1 = pool.simulateShot(s.balls, 0.02, 0.9);
    // Does not mutate input balls
    assert.deepEqual(s.balls, before);

    const r2 = pool.simulateShot(s.balls, 0.02, 0.9);
    assert.deepEqual(r1, r2);

    assert.ok(r1.frames.length >= 2);
    assert.ok(r1.frames.length <= 300);
    assert.equal(r1.firstHit, 1);
    assert.ok(r1.ticks > 0);

    // Frame 0 matches pre-shot coordinates rounded to 1 decimal
    const f0 = r1.frames[0];
    assert.equal(f0.length, 16 * 3);
    assert.equal(f0[0], 0);
    assert.equal(f0[1], 250);
    assert.equal(f0[2], 250);

    // recordFrames: false returns empty frames with identical outcome
    const rNoFrames = pool.simulateShot(s.balls, 0.02, 0.9, { recordFrames: false });
    assert.deepEqual(rNoFrames.frames, []);
    assert.deepEqual(rNoFrames.balls, r1.balls);
    assert.equal(rNoFrames.firstHit, r1.firstHit);
    assert.deepEqual(rNoFrames.potted, r1.potted);
    assert.equal(rNoFrames.ticks, r1.ticks);
  });
});

describe('Pool — potting & open table group assignment', () => {
  it('direct pot pockets ball 1, assigns solid to shooter, and keeps turn', () => {
    const s = makeClearState([
      { id: 0, x: 850, y: 150 },
      { id: 1, x: 950, y: 50 },
      { id: 2, x: 200, y: 400 },
      { id: 9, x: 300, y: 400 },
      { id: 8, x: 400, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: [null, null] });

    const angle = Math.atan2(50 - 150, 950 - 850);
    assert.equal(pool.handleMove({ type: 'shot', angle, power: 0.6 }, s, 0), null);

    assert.equal(s.lastShot.firstHit, 1);
    assert.ok(s.lastShot.potted.includes(1));
    assert.equal(s.lastShot.foul, null);
    assert.equal(s.balls.find((b) => b.id === 1).potted, true);
    assert.deepEqual(s.groups, ['solid', 'stripe']);
    assert.equal(s.currentPlayer, 0);
    assert.equal(s.phase, 'shoot');
    assert.equal(s.winner, null);
  });

  it('potting a stripe on open non-break table assigns stripe to shooter and solid to opponent', () => {
    const s = makeClearState([
      { id: 0, x: 850, y: 150 },
      { id: 9, x: 950, y: 50 },
      { id: 1, x: 200, y: 400 },
      { id: 8, x: 400, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: [null, null] });

    const angle = Math.atan2(50 - 150, 950 - 850);
    assert.equal(pool.handleMove({ type: 'shot', angle, power: 0.6 }, s, 0), null);

    assert.equal(s.lastShot.firstHit, 9);
    assert.ok(s.lastShot.potted.includes(9));
    assert.deepEqual(s.groups, ['stripe', 'solid']);
    assert.equal(s.currentPlayer, 0);
    assert.equal(s.phase, 'shoot');
  });

  it('miss without potting switches turn without ball-in-hand', () => {
    const s = makeClearState([
      { id: 0, x: 500, y: 250 },
      { id: 1, x: 560, y: 250 },
      { id: 9, x: 200, y: 400 },
      { id: 8, x: 300, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.2 }, s, 0), null);
    assert.equal(s.lastShot.firstHit, 1);
    assert.equal(s.lastShot.foul, null);
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.phase, 'shoot');
  });
});

describe('Pool — fouls & ball-in-hand', () => {
  it('scratch switches turn, sets ball_in_hand, and respots cue ball safely', () => {
    const s = makeClearState([
      { id: 0, x: 900, y: 100 },
      { id: 1, x: 250, y: 250 },
      { id: 8, x: 500, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    const angle = Math.atan2(0 - 100, 1000 - 900);
    assert.equal(pool.handleMove({ type: 'shot', angle, power: 0.7 }, s, 0), null);

    assert.equal(s.lastShot.foul, 'scratch');
    assert.ok(s.lastShot.potted.includes(0));
    assert.equal(s.foulCount[0], 1);
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.phase, 'ball_in_hand');

    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(cue.potted, false);
    assert.equal(pool.isValidCuePos(s.balls, cue.x, cue.y), true);
  });

  it('no_hit foul switches turn and sets ball_in_hand', () => {
    const s = makeClearState([
      { id: 0, x: 300, y: 250 },
      { id: 1, x: 150, y: 400 },
      { id: 8, x: 250, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.3 }, s, 0), null);
    assert.equal(s.lastShot.firstHit, null);
    assert.equal(s.lastShot.foul, 'no_hit');
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.phase, 'ball_in_hand');
  });

  it('wrong_ball foul when hitting opponent ball first or hitting 8-ball first on open table', () => {
    const s1 = makeClearState([
      { id: 0, x: 500, y: 250 },
      { id: 9, x: 560, y: 250 },
      { id: 1, x: 200, y: 400 },
      { id: 8, x: 300, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.25 }, s1, 0), null);
    assert.equal(s1.lastShot.firstHit, 9);
    assert.equal(s1.lastShot.foul, 'wrong_ball');
    assert.equal(s1.currentPlayer, 1);
    assert.equal(s1.phase, 'ball_in_hand');

    const s2 = makeClearState([
      { id: 0, x: 500, y: 250 },
      { id: 8, x: 560, y: 250 },
      { id: 1, x: 200, y: 400 },
      { id: 9, x: 300, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: [null, null] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.25 }, s2, 0), null);
    assert.equal(s2.lastShot.firstHit, 8);
    assert.equal(s2.lastShot.foul, 'wrong_ball');
    assert.equal(s2.currentPlayer, 1);
    assert.equal(s2.phase, 'ball_in_hand');
    assert.deepEqual(s2.groups, [null, null]);
  });

  it('validates place moves in ball_in_hand and rejects wrong-phase moves', () => {
    const s = makeClearState([
      { id: 0, x: 250, y: 250 },
      { id: 1, x: 400, y: 250 },
      { id: 8, x: 600, y: 250 },
    ], { isBreak: false, currentPlayer: 1, phase: 'ball_in_hand' });

    // Cannot shoot during ball_in_hand
    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.5 }, s, 1), 'pool_wrong_phase');

    // Out of bounds
    assert.equal(pool.handleMove({ type: 'place', x: 5, y: 250 }, s, 1), 'pool_invalid_place');
    // Overlapping ball 1
    assert.equal(pool.handleMove({ type: 'place', x: 410, y: 250 }, s, 1), 'pool_invalid_place');

    // Valid placement transitions to shoot for the same player
    assert.equal(pool.handleMove({ type: 'place', x: 200, y: 200 }, s, 1), null);
    assert.equal(s.phase, 'shoot');
    assert.equal(s.currentPlayer, 1);
    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(cue.x, 200);
    assert.equal(cue.y, 200);

    // Cannot place during shoot
    assert.equal(pool.handleMove({ type: 'place', x: 220, y: 200 }, s, 1), 'pool_wrong_phase');
  });
});

describe('Pool — 8-ball rules', () => {
  it('early 8-ball pot loses immediately', () => {
    const s = makeClearState([
      { id: 0, x: 850, y: 150 },
      { id: 8, x: 950, y: 50 },
      { id: 1, x: 200, y: 400 },
      { id: 9, x: 300, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    const angle = Math.atan2(50 - 150, 950 - 850);
    assert.equal(pool.handleMove({ type: 'shot', angle, power: 0.6 }, s, 0), null);

    assert.equal(s.winner, 1);
    assert.equal(s.phase, 'over');
    assert.equal(s.winReason, 'early_eight');
  });

  it('8-ball potted on break without scratch respots 8-ball and keeps turn with open table', () => {
    const s = makeClearState([
      { id: 0, x: 850, y: 150 },
      { id: 8, x: 950, y: 50 },
      { id: 1, x: 200, y: 400 },
      { id: 9, x: 300, y: 400 },
    ], { isBreak: true, currentPlayer: 0, groups: [null, null] });

    const angle = Math.atan2(50 - 150, 950 - 850);
    assert.equal(pool.handleMove({ type: 'shot', angle, power: 0.6 }, s, 0), null);

    assert.equal(s.isBreak, false);
    assert.equal(s.winner, null);
    assert.equal(s.phase, 'shoot');
    assert.equal(s.currentPlayer, 0);
    assert.deepEqual(s.groups, [null, null]);
    assert.equal(s.lastShot.respotEight, true);

    const eight = s.balls.find((b) => b.id === 8);
    assert.equal(eight.potted, false);
    assert.equal(eight.x, TABLE.FOOT_SPOT_X);
    assert.equal(eight.y, TABLE.FOOT_SPOT_Y);
  });

  it('8-ball potted legally when 0 own balls remain wins', () => {
    const s = makeClearState([
      { id: 0, x: 850, y: 150 },
      { id: 8, x: 950, y: 50 },
      { id: 9, x: 300, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    const angle = Math.atan2(50 - 150, 950 - 850);
    assert.equal(pool.handleMove({ type: 'shot', angle, power: 0.6 }, s, 0), null);

    assert.equal(s.winner, 0);
    assert.equal(s.phase, 'over');
    assert.equal(s.winReason, 'eight_potted');
    assert.equal(s.lastShot.foul, null);
  });

  it('8-ball potted with scratch when 0 own balls remain loses', () => {
    const s = makeClearState([
      { id: 0, x: 464.38, y: 48 },
      { id: 8, x: 490, y: 27 },
      { id: 9, x: 200, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'] });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.9 }, s, 0), null);

    assert.ok(s.lastShot.potted.includes(8));
    assert.ok(s.lastShot.potted.includes(0));
    assert.equal(s.lastShot.foul, 'scratch');
    assert.equal(s.winner, 1);
    assert.equal(s.phase, 'over');
    assert.equal(s.winReason, 'eight_foul');
  });

  it('turn limit ends game and awards win to player with fewer remaining balls', () => {
    const s = makeClearState([
      { id: 0, x: 250, y: 250 },
      { id: 1, x: 100, y: 400 },
      { id: 9, x: 150, y: 400 },
      { id: 10, x: 200, y: 400 },
      { id: 8, x: 800, y: 400 },
    ], { isBreak: false, currentPlayer: 0, groups: ['solid', 'stripe'], turnCount: 149 });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.1 }, s, 0), null);
    assert.equal(s.turnCount, 150);
    assert.equal(s.phase, 'over');
    assert.equal(s.winReason, 'turn_limit');
    assert.equal(s.winner, 0);
  });
});

describe('Pool — error keys, i18n, and botFallback', () => {
  it('every error key returned by handleMove exists in both server-zh and server-en', () => {
    const s = pool.createState();
    pool.initGame(s, 2);

    const errors = [];
    errors.push(pool.handleMove({ type: 'shot', angle: 0, power: 0.5 }, s, 1)); // g_not_your_turn
    errors.push(pool.handleMove({ type: 'unknown' }, s, 0)); // g_unknown_action
    errors.push(pool.handleMove({ type: 'place', x: 200, y: 200 }, s, 0)); // pool_wrong_phase
    errors.push(pool.handleMove({ type: 'shot', angle: NaN, power: 0.5 }, s, 0)); // pool_invalid_shot
    errors.push(pool.handleMove({ type: 'shot', angle: 0, power: 0.01 }, s, 0)); // pool_invalid_shot
    errors.push(pool.handleMove({ type: 'shot', angle: 0, power: 1.5 }, s, 0)); // pool_invalid_shot

    s.phase = 'ball_in_hand';
    errors.push(pool.handleMove({ type: 'place', x: 5, y: 5 }, s, 0)); // pool_invalid_place
    errors.push(pool.handleMove({ type: 'shot', angle: 0, power: 0.5 }, s, 0)); // pool_wrong_phase

    s.phase = 'over';
    s.winner = 0;
    errors.push(pool.handleMove({ type: 'shot', angle: 0, power: 0.5 }, s, 0)); // g_game_over

    for (const key of errors) {
      assert.equal(typeof key, 'string');
      assert.ok(serverZh[key], `Missing zh key: ${key}`);
      assert.ok(serverEn[key], `Missing en key: ${key}`);
    }
  });

  it('botFallback returns legal moves in both shoot and ball_in_hand phases', () => {
    const s = pool.createState();
    pool.initGame(s, 2);

    const mvShoot = pool.botFallback(s, 0);
    assert.equal(mvShoot.type, 'shot');
    assert.equal(pool.handleMove(mvShoot, s, 0), null);

    // Force ball_in_hand for current player
    s.winner = null;
    s.phase = 'ball_in_hand';
    const cp = s.currentPlayer;
    const mvPlace = pool.botFallback(s, cp);
    assert.equal(mvPlace.type, 'place');
    assert.equal(pool.handleMove(mvPlace, s, cp), null);
    assert.equal(s.phase, 'shoot');

    const mvNext = pool.botFallback(s, cp);
    assert.equal(mvNext.type, 'shot');
    assert.equal(pool.handleMove(mvNext, s, cp), null);
  });
});
