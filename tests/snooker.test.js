'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pool = require('../games/pool');
const poolBot = require('../bots/pool');
const serverZh = require('../lang/server-zh');
const serverEn = require('../lang/server-en');

const { SNOOKER_TABLE, snooker } = pool;

function makeSnookerState(ballsList, overrides = {}) {
  const s = pool.createState();
  s._options = { variant: 'snooker' };
  pool.initGame(s, 2);
  const byId = new Map(ballsList.map((b) => [b.id, b]));
  for (let i = 0; i < s.balls.length; i++) {
    const b = s.balls[i];
    const custom = byId.get(b.id);
    if (custom) {
      b.x = custom.x;
      b.y = custom.y;
      b.potted = !!custom.potted;
    } else {
      b.potted = true;
    }
  }
  Object.assign(s, overrides);
  s.pointsRemaining = snooker.computePointsRemaining(s.balls, s.ballOn);
  return s;
}

describe('Snooker — default variant & initial setup', () => {
  it('defaults to 8-ball when _options.variant is missing', () => {
    const s = pool.createState();
    pool.initGame(s, 2);
    assert.equal(s.variant, '8ball');
    assert.equal(s.balls.length, 16);
    assert.equal(s.phase, 'ball_in_hand');
    assert.equal(s.kitchenOnly, true);
    assert.deepEqual(s.groups, [null, null]);
  });

  it('sets up 22 balls in place, scores 0, ballOn red, and ball in hand in the D', () => {
    const s = pool.createState();
    s._options = { variant: 'snooker' };
    pool.initGame(s, 2);

    assert.equal(s.variant, 'snooker');
    assert.equal(s.balls.length, 22);
    assert.deepEqual(s.scores, [0, 0]);
    assert.equal(s.currentBreak, 0);
    assert.equal(s.ballOn, 'red');
    assert.equal(s.phase, 'ball_in_hand');
    assert.equal(s.inDOnly, true);
    assert.equal(s.pointsRemaining, 147);
    assert.equal(s.winner, null);

    const cue = s.balls.find((b) => b.id === 0);
    assert.ok(cue && !cue.potted);
    assert.equal(snooker.isInD(cue.x, cue.y), true);

    const reds = s.balls.filter((b) => b.id >= 1 && b.id <= 15);
    assert.equal(reds.length, 15);

    const expectedColours = [
      { id: 16, type: 'yellow', value: 2, x: 250, y: 400 },
      { id: 17, type: 'green', value: 3, x: 250, y: 200 },
      { id: 18, type: 'brown', value: 4, x: 250, y: 300 },
      { id: 19, type: 'blue', value: 5, x: 600, y: 300 },
      { id: 20, type: 'pink', value: 6, x: 900, y: 300 },
      { id: 21, type: 'black', value: 7, x: 1090, y: 300 },
    ];
    for (const exp of expectedColours) {
      const ball = s.balls.find((b) => b.id === exp.id);
      assert.ok(ball);
      assert.equal(ball.type, exp.type);
      assert.equal(ball.value, exp.value);
      assert.equal(ball.x, exp.x);
      assert.equal(ball.y, exp.y);
      assert.equal(ball.potted, false);
    }

    // All balls non-overlapping and inside table bounds
    for (let i = 0; i < s.balls.length; i++) {
      const a = s.balls[i];
      assert.equal(a.potted, false);
      assert.ok(a.x >= SNOOKER_TABLE.BALL_R && a.x <= SNOOKER_TABLE.W - SNOOKER_TABLE.BALL_R);
      assert.ok(a.y >= SNOOKER_TABLE.BALL_R && a.y <= SNOOKER_TABLE.H - SNOOKER_TABLE.BALL_R);
      for (let j = i + 1; j < s.balls.length; j++) {
        const b = s.balls[j];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 2 * SNOOKER_TABLE.BALL_R);
      }
    }

    // Reject placement outside the D, accept placement inside the D
    assert.equal(pool.handleMove({ type: 'place', x: 500, y: 300 }, s, 0), 'pool_place_d');
    assert.equal(pool.handleMove({ type: 'place', x: 120, y: 300 }, s, 0), 'pool_place_d');
    assert.equal(pool.handleMove({ type: 'place', x: 200, y: 300 }, s, 0), null);
    assert.equal(s.phase, 'shoot');
    assert.equal(s.inDOnly, false);
  });
});

describe('Snooker — red/colour alternation & re-spotting', () => {
  it('potting a red gives 1 point and sets ballOn to colour; nominated colour scores its value and re-spots', () => {
    const s = makeSnookerState([
      { id: 0, x: 1050, y: 150 },
      { id: 1, x: 1150, y: 50 },
      { id: 2, x: 400, y: 450 },
      { id: 16, x: 250, y: 400 },
      { id: 17, x: 250, y: 200 },
      { id: 18, x: 250, y: 300 },
      { id: 19, x: 500, y: 450 },
      { id: 20, x: 900, y: 300 },
      { id: 21, x: 1090, y: 300 },
    ], { phase: 'shoot', isBreak: false, inDOnly: false, ballOn: 'red', currentPlayer: 0 });

    const angleToRed = Math.atan2(50 - 150, 1150 - 1050);
    assert.equal(pool.handleMove({ type: 'shot', angle: angleToRed, power: 0.5 }, s, 0), null);

    assert.equal(s.scores[0], 1);
    assert.equal(s.currentBreak, 1);
    assert.equal(s.currentPlayer, 0);
    assert.equal(s.ballOn, 'colour');
    assert.equal(s.balls.find((b) => b.id === 1).potted, true);

    // Shooting without nomination or with invalid nomination is rejected
    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.4 }, s, 0), 'pool_nominate_required');
    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.4, nominate: 'red' }, s, 0), 'pool_invalid_nominate');

    // Line up cue and blue (id 19) for a clean corner pot
    s.balls.find((b) => b.id === 0).x = 1050;
    s.balls.find((b) => b.id === 0).y = 150;
    s.balls.find((b) => b.id === 19).x = 1150;
    s.balls.find((b) => b.id === 19).y = 50;

    const angleToBlue = Math.atan2(50 - 150, 1150 - 1050);
    assert.equal(pool.handleMove({ type: 'shot', angle: angleToBlue, power: 0.5, nominate: 'blue' }, s, 0), null);

    assert.equal(s.scores[0], 6); // 1 + 5
    assert.equal(s.currentBreak, 6);
    assert.equal(s.currentPlayer, 0);
    assert.equal(s.ballOn, 'red');

    // Blue must be re-spotted on its own spot (600, 300)
    const blue = s.balls.find((b) => b.id === 19);
    assert.equal(blue.potted, false);
    assert.equal(blue.x, 600);
    assert.equal(blue.y, 300);
  });

  it('re-spots a colour on highest available spot when its own spot is occupied, or behind when all occupied', () => {
    const s = makeSnookerState([
      { id: 0, x: 200, y: 100 },
      { id: 1, x: 600, y: 300 }, // occupies blue spot
      { id: 16, x: 250, y: 400 },
      { id: 17, x: 250, y: 200 },
      { id: 18, x: 250, y: 300 },
      { id: 19, x: 600, y: 300, potted: true },
      { id: 20, x: 900, y: 300 },
      { id: 21, x: 400, y: 400 }, // black spot is free
    ]);
    snooker.respotSnookerColour(s.balls, 19);
    const blue = s.balls.find((b) => b.id === 19);
    assert.equal(blue.potted, false);
    assert.equal(blue.x, 1090);
    assert.equal(blue.y, 300);

    // Now occupy all 6 spots and respot black
    const sAll = makeSnookerState([
      { id: 0, x: 150, y: 100 },
      { id: 1, x: 250, y: 400 },
      { id: 2, x: 250, y: 200 },
      { id: 3, x: 250, y: 300 },
      { id: 4, x: 600, y: 300 },
      { id: 5, x: 900, y: 300 },
      { id: 6, x: 1090, y: 300 },
      { id: 21, x: 1090, y: 300, potted: true },
    ]);
    snooker.respotSnookerColour(sAll.balls, 21);
    const black = sAll.balls.find((b) => b.id === 21);
    assert.equal(black.potted, false);
    assert.ok(black.x > 1090 && black.y === 300);
  });
});

describe('Snooker — fouls', () => {
  it('hitting a colour first while red is on is a foul worth at least 4 to the opponent', () => {
    const s1 = makeSnookerState([
      { id: 0, x: 200, y: 400 },
      { id: 16, x: 250, y: 400 }, // yellow (2)
      { id: 1, x: 900, y: 200 },
      { id: 21, x: 1090, y: 300 },
    ], { phase: 'shoot', isBreak: false, inDOnly: false, ballOn: 'red', currentPlayer: 0, currentBreak: 8 });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.2 }, s1, 0), null);
    assert.equal(s1.lastShot.foul, 'wrong_ball');
    assert.equal(s1.lastShot.foulPoints, 4); // max(4, 2) = 4
    assert.equal(s1.scores[1], 4);
    assert.equal(s1.currentBreak, 0);
    assert.equal(s1.currentPlayer, 1);
    assert.equal(s1.phase, 'shoot');

    // Hitting black (7) first while red is on awards 7 points
    const s2 = makeSnookerState([
      { id: 0, x: 1030, y: 300 },
      { id: 21, x: 1090, y: 300 },
      { id: 1, x: 400, y: 200 },
    ], { phase: 'shoot', isBreak: false, inDOnly: false, ballOn: 'red', currentPlayer: 0 });

    assert.equal(pool.handleMove({ type: 'shot', angle: 0, power: 0.2 }, s2, 0), null);
    assert.equal(s2.lastShot.foul, 'wrong_ball');
    assert.equal(s2.lastShot.foulPoints, 7);
    assert.equal(s2.scores[1], 7);
    assert.equal(s2.currentPlayer, 1);
  });

  it('scratch gives opponent >= 4 points and ball in hand inside the D', () => {
    const s = makeSnookerState([
      { id: 0, x: 1120, y: 80 },
      { id: 1, x: 400, y: 300 },
      { id: 21, x: 1090, y: 300 },
    ], { phase: 'shoot', isBreak: false, inDOnly: false, ballOn: 'red', currentPlayer: 0 });

    const ang = Math.atan2(0 - 80, 1200 - 1120);
    assert.equal(pool.handleMove({ type: 'shot', angle: ang, power: 0.55 }, s, 0), null);
    assert.equal(s.lastShot.foul, 'scratch');
    assert.ok(s.lastShot.foulPoints >= 4);
    assert.equal(s.scores[1], s.lastShot.foulPoints);
    assert.equal(s.currentPlayer, 1);
    assert.equal(s.phase, 'ball_in_hand');
    assert.equal(s.inDOnly, true);

    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(cue.potted, false);
    assert.equal(snooker.isInD(cue.x, cue.y), true);
  });
});

describe('Snooker — end colour sequence, frame end, and re-spotted black', () => {
  it('after last red and its colour, colours go in order yellow -> black and stay down; potting black ends frame', () => {
    const s = makeSnookerState([
      { id: 0, x: 1050, y: 150 },
      { id: 1, x: 1150, y: 50 }, // last red
      { id: 16, x: 250, y: 400 },
      { id: 17, x: 250, y: 200 },
      { id: 18, x: 250, y: 300 },
      { id: 19, x: 600, y: 300 },
      { id: 20, x: 900, y: 300 },
      { id: 21, x: 1090, y: 300 },
    ], { phase: 'shoot', isBreak: false, inDOnly: false, ballOn: 'red', currentPlayer: 0 });

    // 1. Pot last red
    const ang = Math.atan2(50 - 150, 1150 - 1050);
    assert.equal(pool.handleMove({ type: 'shot', angle: ang, power: 0.5 }, s, 0), null);
    assert.equal(s.ballOn, 'colour');
    assert.equal(s.scores[0], 1);

    // 2. Pot pink after last red -> pink re-spots, ballOn becomes yellow
    s.balls.find((b) => b.id === 0).x = 1050;
    s.balls.find((b) => b.id === 0).y = 150;
    s.balls.find((b) => b.id === 20).x = 1150;
    s.balls.find((b) => b.id === 20).y = 50;
    assert.equal(pool.handleMove({ type: 'shot', angle: ang, power: 0.5, nominate: 'pink' }, s, 0), null);
    assert.equal(s.scores[0], 7);
    assert.equal(s.balls.find((b) => b.id === 20).potted, false);
    assert.equal(s.ballOn, 'yellow');

    // 3. Pot yellow through black in order and verify they stay down
    const order = [
      { id: 16, name: 'yellow', val: 2, next: 'green' },
      { id: 17, name: 'green', val: 3, next: 'brown' },
      { id: 18, name: 'brown', val: 4, next: 'blue' },
      { id: 19, name: 'blue', val: 5, next: 'pink' },
      { id: 20, name: 'pink', val: 6, next: 'black' },
    ];
    for (const item of order) {
      assert.equal(s.ballOn, item.name);
      s.balls.find((b) => b.id === 0).x = 1050;
      s.balls.find((b) => b.id === 0).y = 150;
      s.balls.find((b) => b.id === item.id).x = 1150;
      s.balls.find((b) => b.id === item.id).y = 50;
      assert.equal(pool.handleMove({ type: 'shot', angle: ang, power: 0.5 }, s, 0), null);
      assert.equal(s.balls.find((b) => b.id === item.id).potted, true);
      assert.equal(s.ballOn, item.next);
    }

    // 4. Pot final black with player 0 ahead -> frame over, player 0 wins
    s.balls.find((b) => b.id === 0).x = 1050;
    s.balls.find((b) => b.id === 0).y = 150;
    s.balls.find((b) => b.id === 21).x = 1150;
    s.balls.find((b) => b.id === 21).y = 50;
    assert.equal(pool.handleMove({ type: 'shot', angle: ang, power: 0.5 }, s, 0), null);
    assert.equal(s.scores[0], 34); // 1 + 6 + 2 + 3 + 4 + 5 + 6 + 7
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 0);
    assert.equal(s.winReason, 'snooker_frame');
  });

  it('tie on final black re-spots black and gives opponent ball in hand in the D', () => {
    const s = makeSnookerState([
      { id: 0, x: 1050, y: 150 },
      { id: 21, x: 1150, y: 50 },
    ], {
      phase: 'shoot',
      isBreak: false,
      inDOnly: false,
      ballOn: 'black',
      currentPlayer: 0,
      scores: [20, 27], // potting black (7) ties at 27-27
    });

    const ang = Math.atan2(50 - 150, 1150 - 1050);
    assert.equal(pool.handleMove({ type: 'shot', angle: ang, power: 0.5 }, s, 0), null);

    assert.deepEqual(s.scores, [27, 27]);
    assert.equal(s.winner, null);
    assert.equal(s.phase, 'ball_in_hand');
    assert.equal(s.inDOnly, true);
    assert.equal(s.respotBlackTie, true);
    assert.equal(s.ballOn, 'black');
    assert.equal(s.currentPlayer, 1);

    const black = s.balls.find((b) => b.id === 21);
    assert.equal(black.potted, false);
    assert.equal(black.x, 1090);
    assert.equal(black.y, 300);

    const cue = s.balls.find((b) => b.id === 0);
    assert.equal(snooker.isInD(cue.x, cue.y), true);
  });

  it('foul on final black ends the frame with higher score winning', () => {
    const s = makeSnookerState([
      { id: 0, x: 400, y: 300 },
      { id: 21, x: 1090, y: 300 },
    ], {
      phase: 'shoot',
      isBreak: false,
      inDOnly: false,
      ballOn: 'black',
      currentPlayer: 0,
      scores: [30, 25], // +7 foul makes opponent 32 > 30
    });

    // Miss all balls vertically
    assert.equal(pool.handleMove({ type: 'shot', angle: Math.PI / 2, power: 0.2 }, s, 0), null);
    assert.deepEqual(s.scores, [30, 32]);
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 1);
    assert.equal(s.winReason, 'snooker_black_foul');
  });
});

describe('Snooker — bot, fallback, and i18n contracts', () => {
  it('bot returns legal moves with nominate when needed across random positions without mutating state', () => {
    const bot0 = poolBot.createBot(0);
    const bot1 = poolBot.createBot(1);

    const scenarios = [
      // 1. Break D-placement
      (() => {
        const s = pool.createState();
        s._options = { variant: 'snooker', difficulty: 'normal' };
        pool.initGame(s, 2);
        return s;
      })(),
      // 2. Break shot after placement
      makeSnookerState(snooker.buildSnookerBalls(), {
        phase: 'shoot',
        isBreak: true,
        inDOnly: false,
        ballOn: 'red',
        _options: { variant: 'snooker', difficulty: 'hard' },
      }),
      // 3. Colour nomination shot
      makeSnookerState([
        { id: 0, x: 450, y: 260 },
        { id: 1, x: 800, y: 400 },
        { id: 16, x: 250, y: 400 },
        { id: 18, x: 250, y: 300 },
        { id: 19, x: 600, y: 300 },
        { id: 20, x: 900, y: 300 },
        { id: 21, x: 1090, y: 300 },
      ], {
        phase: 'shoot',
        isBreak: false,
        inDOnly: false,
        ballOn: 'colour',
        currentPlayer: 1,
        _options: { variant: 'snooker', difficulty: 'easy' },
      }),
      // 4. End sequence blue on
      makeSnookerState([
        { id: 0, x: 520, y: 310 },
        { id: 19, x: 600, y: 300 },
        { id: 20, x: 900, y: 300 },
        { id: 21, x: 1090, y: 300 },
      ], {
        phase: 'shoot',
        isBreak: false,
        inDOnly: false,
        ballOn: 'blue',
        currentPlayer: 0,
        _options: { variant: 'snooker', difficulty: 'hard' },
      }),
    ];

    for (const st of scenarios) {
      const snap = JSON.stringify(st);
      const cp = st.currentPlayer;
      const mv = (cp === 0 ? bot0 : bot1).getMove(st, cp);
      assert.ok(mv);
      assert.equal(JSON.stringify(st), snap);
      if (st.ballOn === 'colour' && st.phase === 'shoot') {
        assert.ok(snooker.COLOUR_ORDER.includes(mv.nominate));
      }
      // On a copy: the fallback checks below reuse scenarios[0] in its ball-in-hand phase.
      assert.equal(pool.handleMove(mv, JSON.parse(snap), cp), null);
    }

    // botFallback checks
    const fbPlace = pool.botFallback(scenarios[0], 0);
    assert.equal(fbPlace.type, 'place');
    const fbCol = makeSnookerState([
      { id: 0, x: 450, y: 260 },
      { id: 19, x: 600, y: 300 },
    ], { phase: 'shoot', isBreak: false, inDOnly: false, ballOn: 'colour', currentPlayer: 0 });
    const fbShot = pool.botFallback(fbCol, 0);
    assert.equal(fbShot.type, 'shot');
    assert.equal(fbShot.nominate, 'blue');
    assert.equal(pool.handleMove(fbShot, fbCol, 0), null);
  });

  it('all snooker error keys exist in server-zh/en and English strings have no apostrophes', () => {
    const keys = ['pool_place_d', 'pool_nominate_required', 'pool_invalid_nominate'];
    for (const k of keys) {
      assert.ok(serverZh[k], `Missing zh key: ${k}`);
      assert.ok(serverEn[k], `Missing en key: ${k}`);
      assert.equal(serverEn[k].includes("'"), false, `Apostrophe in server-en ${k}`);
    }

    // Verify public/js/lang/zh.js and en.js parse cleanly and new snooker keys contain no apostrophes
    const sandbox = { window: { __LANG: {} }, localStorage: { getItem: () => null, setItem: () => {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'lang', 'zh.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'lang', 'en.js'), 'utf8'), sandbox);
    const enPack = sandbox.window.__LANG.en;
    const zhPack = sandbox.window.__LANG.zh;
    for (const k of Object.keys(zhPack)) {
      if (k.startsWith('pool_') || k.startsWith('snooker_')) {
        assert.ok(enPack[k], `Missing en UI key: ${k}`);
        assert.equal(String(enPack[k]).includes("'"), false, `Apostrophe in en UI key: ${k}`);
      }
    }
  });
});

describe('Snooker — break assist', () => {
  it('opens the red pack moderately and deterministically without scattering reds to all cushions', () => {
    const balls = snooker.buildSnookerBalls();
    const cue = balls.find((b) => b.id === 0);
    const apex = balls.find((b) => b.id === 1);
    // Break off the side of the pack: aiming straight at the apex hits the pink spotted in front of it.
    const angle = Math.atan2(apex.y + SNOOKER_TABLE.BALL_R * 2.2 - cue.y, apex.x + SNOOKER_TABLE.BALL_R - cue.x);

    const sim1 = pool.simulateShot(balls, angle, 0.72, {
      recordFrames: false,
      table: SNOOKER_TABLE,
      ballType: snooker.snookerBallType,
      isBreak: true,
    });
    const sim2 = pool.simulateShot(balls, angle, 0.72, {
      recordFrames: false,
      table: SNOOKER_TABLE,
      ballType: snooker.snookerBallType,
      isBreak: true,
    });
    assert.deepEqual(sim1, sim2);

    const byIdBefore = new Map(balls.map((b) => [b.id, b]));
    let redDispSum = 0;
    for (let i = 0; i < sim1.balls.length; i++) {
      const b = sim1.balls[i];
      if (b.id >= 1 && b.id <= 15 && !b.potted) {
        const before = byIdBefore.get(b.id);
        redDispSum += Math.hypot(b.x - before.x, b.y - before.y);
      }
    }
    const avgRedDisp = redDispSum / 15;
    assert.ok(avgRedDisp > SNOOKER_TABLE.BALL_R, `Expected red pack to open, avgDisp=${avgRedDisp}`);

    const redRailHits = (sim1.railHits || []).filter((id) => id >= 1 && id <= 15).length;
    assert.ok(redRailHits <= 8, `Expected moderate snooker break without all reds hitting cushions, got ${redRailHits}`);
  });
});
