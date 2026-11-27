// games/lib/snooker.js — Simplified Snooker rules, geometry, and helpers
'use strict';

const { simulateShot, isValidBallSpot } = require('./pool-physics');

const SNOOKER_TABLE = {
  W: 1200,
  H: 600,
  BALL_R: 11,
  BAULK_X: 250,
  D_RADIUS: 100,
  CENTER_Y: 300,
  MAX_SPEED: 1650,
  MIN_POWER: 0.05,
  MAX_POWER: 1.0,
  FRICTION: 240,
  STOP_SPEED: 6,
  E_BALL: 0.96,
  E_RAIL: 0.80,
  DT: 1 / 180,
  MAX_TICKS: 2000,
  FRAME_STRIDE: 6,
  TURN_LIMIT: 250,
  POCKETS: [
    { id: 0, x: 0, y: 0, r: 21 },
    { id: 1, x: 600, y: -3, r: 19 },
    { id: 2, x: 1200, y: 0, r: 21 },
    { id: 3, x: 0, y: 600, r: 21 },
    { id: 4, x: 600, y: 603, r: 19 },
    { id: 5, x: 1200, y: 600, r: 21 },
  ],
};

const COLOURS = [
  { id: 16, name: 'yellow', value: 2, spot: { x: 250, y: 400 } },
  { id: 17, name: 'green', value: 3, spot: { x: 250, y: 200 } },
  { id: 18, name: 'brown', value: 4, spot: { x: 250, y: 300 } },
  { id: 19, name: 'blue', value: 5, spot: { x: 600, y: 300 } },
  { id: 20, name: 'pink', value: 6, spot: { x: 900, y: 300 } },
  { id: 21, name: 'black', value: 7, spot: { x: 1090, y: 300 } },
];

const COLOUR_ORDER = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
const COLOUR_VALUES = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
};

const COLOURS_BY_ID = {};
for (let i = 0; i < COLOURS.length; i++) {
  COLOURS_BY_ID[COLOURS[i].id] = COLOURS[i];
}

function snookerBallType(id) {
  if (id === 0) return 'cue';
  if (id >= 1 && id <= 15) return 'red';
  const c = COLOURS_BY_ID[id];
  return c ? c.name : 'red';
}

function snookerBallValue(id) {
  if (id === 0) return 0;
  if (id >= 1 && id <= 15) return 1;
  const c = COLOURS_BY_ID[id];
  return c ? c.value : 0;
}

function buildSnookerBalls() {
  const balls = [
    { id: 0, x: 205, y: 340, potted: false, type: 'cue', value: 0 },
  ];

  const apexX = 900 + 2 * SNOOKER_TABLE.BALL_R + 2; // 924, directly behind pink (900, 300)
  const apexY = SNOOKER_TABLE.CENTER_Y;
  const spacing = 2 * SNOOKER_TABLE.BALL_R + 0.6;
  const dx = spacing * Math.cos(Math.PI / 6);
  const dy = spacing;

  let nextRedId = 1;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c <= r; c++) {
      balls.push({
        id: nextRedId++,
        x: apexX + r * dx,
        y: apexY + (c - r / 2) * dy,
        potted: false,
        type: 'red',
        value: 1,
      });
    }
  }

  for (let i = 0; i < COLOURS.length; i++) {
    const col = COLOURS[i];
    balls.push({
      id: col.id,
      x: col.spot.x,
      y: col.spot.y,
      potted: false,
      type: col.name,
      value: col.value,
    });
  }

  balls.sort((a, b) => a.id - b.id);
  return balls;
}

function isInD(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x > SNOOKER_TABLE.BAULK_X + 1e-6) return false;
  const dx = x - SNOOKER_TABLE.BAULK_X;
  const dy = y - SNOOKER_TABLE.CENTER_Y;
  return dx * dx + dy * dy <= SNOOKER_TABLE.D_RADIUS * SNOOKER_TABLE.D_RADIUS + 1e-6;
}

function isValidSnookerCuePos(balls, x, y) {
  return isInD(x, y) && isValidBallSpot(balls, x, y, 0, SNOOKER_TABLE);
}

function findSafeSnookerCueSpot(balls) {
  const preferred = [
    { x: 205, y: 340 },
    { x: 205, y: 260 },
    { x: 195, y: 300 },
    { x: 225, y: 345 },
    { x: 225, y: 255 },
    { x: 175, y: 300 },
  ];
  for (let i = 0; i < preferred.length; i++) {
    if (isValidSnookerCuePos(balls, preferred[i].x, preferred[i].y)) {
      return preferred[i];
    }
  }

  const minX = SNOOKER_TABLE.BAULK_X - SNOOKER_TABLE.D_RADIUS;
  const maxX = SNOOKER_TABLE.BAULK_X;
  const minY = SNOOKER_TABLE.CENTER_Y - SNOOKER_TABLE.D_RADIUS;
  const maxY = SNOOKER_TABLE.CENTER_Y + SNOOKER_TABLE.D_RADIUS;
  for (let x = maxX; x >= minX; x -= 8) {
    for (let y = minY; y <= maxY; y += 8) {
      if (isValidSnookerCuePos(balls, x, y)) {
        return { x, y };
      }
    }
  }

  return { x: 205, y: 340 };
}

function placeSnookerCueInD(state) {
  const spot = findSafeSnookerCueSpot(state.balls);
  const cue = state.balls.find((b) => b.id === 0);
  if (cue) {
    cue.x = spot.x;
    cue.y = spot.y;
    cue.potted = false;
  }
}

function respotSnookerColour(balls, colourId) {
  const ball = balls.find((b) => b.id === colourId);
  const meta = COLOURS_BY_ID[colourId];
  if (!ball || !meta) return;

  // 1. Own spot
  if (isValidBallSpot(balls, meta.spot.x, meta.spot.y, colourId, SNOOKER_TABLE)) {
    ball.x = meta.spot.x;
    ball.y = meta.spot.y;
    ball.potted = false;
    return;
  }

  // 2. Highest available colour spot (black -> yellow)
  for (let i = COLOURS.length - 1; i >= 0; i--) {
    const sp = COLOURS[i].spot;
    if (isValidBallSpot(balls, sp.x, sp.y, colourId, SNOOKER_TABLE)) {
      ball.x = sp.x;
      ball.y = sp.y;
      ball.potted = false;
      return;
    }
  }

  // 3. As close as possible behind its own spot (towards top cushion +x)
  for (let x = meta.spot.x + 1; x <= SNOOKER_TABLE.W - SNOOKER_TABLE.BALL_R - 1; x += 2) {
    if (isValidBallSpot(balls, x, meta.spot.y, colourId, SNOOKER_TABLE)) {
      ball.x = x;
      ball.y = meta.spot.y;
      ball.potted = false;
      return;
    }
  }

  // 4. Towards baulk if behind spot is completely blocked
  for (let x = meta.spot.x - 1; x >= SNOOKER_TABLE.BALL_R + 1; x -= 2) {
    if (isValidBallSpot(balls, x, meta.spot.y, colourId, SNOOKER_TABLE)) {
      ball.x = x;
      ball.y = meta.spot.y;
      ball.potted = false;
      return;
    }
  }

  // 5. Deterministic grid fallback
  for (let y = SNOOKER_TABLE.BALL_R + 2; y <= SNOOKER_TABLE.H - SNOOKER_TABLE.BALL_R - 2; y += SNOOKER_TABLE.BALL_R) {
    for (let x = SNOOKER_TABLE.BALL_R + 2; x <= SNOOKER_TABLE.W - SNOOKER_TABLE.BALL_R - 2; x += SNOOKER_TABLE.BALL_R) {
      if (isValidBallSpot(balls, x, y, colourId, SNOOKER_TABLE)) {
        ball.x = x;
        ball.y = y;
        ball.potted = false;
        return;
      }
    }
  }

  ball.x = meta.spot.x;
  ball.y = meta.spot.y;
  ball.potted = false;
}

function countReds(balls) {
  let count = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b && !b.potted && b.id >= 1 && b.id <= 15) count++;
  }
  return count;
}

function nextColourOn(balls) {
  for (let i = 0; i < COLOURS.length; i++) {
    const b = balls.find((item) => item.id === COLOURS[i].id);
    if (b && !b.potted) return COLOURS[i].name;
  }
  return null;
}

function getBallsOn(state) {
  const balls = state.balls || [];
  if (state.ballOn === 'red') {
    return balls.filter((b) => b && !b.potted && b.id >= 1 && b.id <= 15);
  }
  if (state.ballOn === 'colour') {
    return balls.filter((b) => b && !b.potted && b.id >= 16);
  }
  return balls.filter((b) => b && !b.potted && b.type === state.ballOn);
}

function computePointsRemaining(balls, ballOn) {
  const reds = countReds(balls);
  let activeColoursSum = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b && !b.potted && b.id >= 16) {
      activeColoursSum += snookerBallValue(b.id);
    }
  }
  if (ballOn === 'red') {
    return reds * 8 + activeColoursSum;
  }
  if (ballOn === 'colour') {
    return reds * 8 + 7 + activeColoursSum;
  }
  return activeColoursSum;
}

function initSnookerState(state) {
  state.variant = 'snooker';
  state.balls = buildSnookerBalls();
  state.currentPlayer = 0;
  state.phase = 'ball_in_hand';
  state.isBreak = true;
  state.inDOnly = true;
  state.kitchenOnly = false;
  state.groups = [null, null];
  state.scores = [0, 0];
  state.currentBreak = 0;
  state.ballOn = 'red';
  state.nominatedColour = null;
  state.respotBlackTie = false;
  state.pointsRemaining = 147;
  state.shotSeq = 0;
  state.turnCount = 0;
  state.lastShot = null;
  state.winner = null;
  state.winReason = null;
  state.foulCount = [0, 0];
}

function applySnookerShotRules(state, playerIndex, angle, power, sim, spinX, spinY, nominate) {
  const shooter = playerIndex;
  const opp = 1 - shooter;
  const ballOnBefore = state.ballOn;
  const targetName = ballOnBefore === 'colour' ? nominate : ballOnBefore;
  const targetValue = COLOUR_VALUES[targetName] || 1;
  const wasOnlyBlackLeft =
    ballOnBefore === 'black' &&
    countReds(state.balls) === 0 &&
    !state.balls.some((b) => b && !b.potted && b.id >= 16 && b.id <= 20);

  state.balls = sim.balls;
  state.shotSeq += 1;
  state.isBreak = false;
  state.inDOnly = false;
  state.nominatedColour = ballOnBefore === 'colour' ? targetName : null;

  const { firstHit, potted } = sim;
  const scratched = potted.includes(0);
  const wrongFirstHit = firstHit !== null && snookerBallType(firstHit) !== targetName;
  const wrongPotted = potted.filter((id) => id !== 0 && snookerBallType(id) !== targetName);

  let foul = null;
  if (scratched) foul = 'scratch';
  else if (firstHit === null) foul = 'no_hit';
  else if (wrongFirstHit) foul = 'wrong_ball';
  else if (wrongPotted.length > 0) foul = 'wrong_pot';

  let foulPoints = 0;
  let pointsScored = 0;
  const respottedColours = [];
  let triggeredTieRespot = false;

  if (foul !== null) {
    let maxInvolved = targetValue;
    if (firstHit !== null) {
      maxInvolved = Math.max(maxInvolved, snookerBallValue(firstHit));
    }
    for (let i = 0; i < potted.length; i++) {
      maxInvolved = Math.max(maxInvolved, snookerBallValue(potted[i]));
    }
    foulPoints = Math.max(4, maxInvolved);
    state.foulCount[shooter] += 1;
    state.scores[opp] += foulPoints;
    state.currentBreak = 0;

    if (wasOnlyBlackLeft) {
      if (state.scores[0] !== state.scores[1]) {
        state.winner = state.scores[0] > state.scores[1] ? 0 : 1;
        state.phase = 'over';
        state.winReason = 'snooker_black_foul';
      } else {
        respotSnookerColour(state.balls, 21);
        respottedColours.push('black');
        state.respotBlackTie = true;
        triggeredTieRespot = true;
        state.ballOn = 'black';
        state.currentPlayer = opp;
        placeSnookerCueInD(state);
        state.phase = 'ball_in_hand';
        state.inDOnly = true;
      }
    } else {
      const pottedColours = potted.filter((id) => id >= 16).sort((a, b) => b - a);
      for (let i = 0; i < pottedColours.length; i++) {
        respotSnookerColour(state.balls, pottedColours[i]);
        respottedColours.push(snookerBallType(pottedColours[i]));
      }
      const redsLeft = countReds(state.balls);
      state.ballOn = redsLeft > 0 ? 'red' : (nextColourOn(state.balls) || 'black');
      state.currentPlayer = opp;
      if (scratched) {
        placeSnookerCueInD(state);
        state.phase = 'ball_in_hand';
        state.inDOnly = true;
      } else {
        state.phase = 'shoot';
        state.inDOnly = false;
      }
    }
  } else {
    const pottedTargets = potted.filter((id) => id !== 0 && snookerBallType(id) === targetName);
    const redsLeft = countReds(state.balls);

    if (pottedTargets.length > 0) {
      for (let i = 0; i < pottedTargets.length; i++) {
        pointsScored += snookerBallValue(pottedTargets[i]);
      }
      state.scores[shooter] += pointsScored;
      state.currentBreak += pointsScored;

      if (ballOnBefore === 'red') {
        state.ballOn = 'colour';
        state.phase = 'shoot';
      } else if (ballOnBefore === 'colour') {
        const toRespot = pottedTargets.slice().sort((a, b) => b - a);
        for (let i = 0; i < toRespot.length; i++) {
          respotSnookerColour(state.balls, toRespot[i]);
          respottedColours.push(snookerBallType(toRespot[i]));
        }
        state.ballOn = redsLeft > 0 ? 'red' : (nextColourOn(state.balls) || 'yellow');
        state.phase = 'shoot';
      } else {
        if (ballOnBefore === 'black') {
          if (state.scores[0] !== state.scores[1]) {
            state.winner = state.scores[0] > state.scores[1] ? 0 : 1;
            state.phase = 'over';
            state.winReason = 'snooker_frame';
          } else {
            respotSnookerColour(state.balls, 21);
            respottedColours.push('black');
            state.respotBlackTie = true;
            triggeredTieRespot = true;
            state.ballOn = 'black';
            state.currentBreak = 0;
            state.currentPlayer = opp;
            placeSnookerCueInD(state);
            state.phase = 'ball_in_hand';
            state.inDOnly = true;
          }
        } else {
          state.ballOn = nextColourOn(state.balls) || 'black';
          state.phase = 'shoot';
        }
      }
    } else {
      state.currentBreak = 0;
      state.currentPlayer = opp;
      state.phase = 'shoot';
      state.inDOnly = false;
      state.ballOn = redsLeft > 0 ? 'red' : (nextColourOn(state.balls) || 'black');
    }
  }

  state.turnCount += 1;
  if (state.winner === null && state.turnCount >= SNOOKER_TABLE.TURN_LIMIT) {
    if (state.scores[0] > state.scores[1]) state.winner = 0;
    else if (state.scores[1] > state.scores[0]) state.winner = 1;
    else state.winner = state.foulCount[0] <= state.foulCount[1] ? 0 : 1;
    state.phase = 'over';
    state.winReason = 'turn_limit';
  }

  state.pointsRemaining = state.phase === 'over' ? 0 : computePointsRemaining(state.balls, state.ballOn);

  state.lastShot = {
    seq: state.shotSeq,
    shooter,
    angle,
    power,
    spinX: spinX || 0,
    spinY: spinY || 0,
    fps: 30,
    firstHit,
    potted,
    foul,
    foulPoints,
    pointsScored,
    nominate: ballOnBefore === 'colour' ? targetName : null,
    respottedColours,
    respotBlackTie: triggeredTieRespot,
    frames: sim.frames,
  };
}

function handleSnookerMove(data, state, playerIndex) {
  if (state.winner !== null || state.phase === 'over') return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
  if (!data || typeof data !== 'object') return 'g_unknown_action';

  if (data.type === 'place') {
    if (state.phase !== 'ball_in_hand') return 'pool_wrong_phase';
    const { x, y } = data;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'pool_invalid_place';
    const minX = SNOOKER_TABLE.BALL_R + 1;
    const maxX = SNOOKER_TABLE.W - SNOOKER_TABLE.BALL_R - 1;
    const minY = SNOOKER_TABLE.BALL_R + 1;
    const maxY = SNOOKER_TABLE.H - SNOOKER_TABLE.BALL_R - 1;
    if (x < minX || x > maxX || y < minY || y > maxY) return 'pool_invalid_place';
    if (!isInD(x, y)) return 'pool_place_d';
    if (!isValidBallSpot(state.balls, x, y, 0, SNOOKER_TABLE)) return 'pool_invalid_place';
    const cue = state.balls.find((b) => b.id === 0);
    if (!cue) return 'pool_invalid_place';
    cue.x = x;
    cue.y = y;
    cue.potted = false;
    state.phase = 'shoot';
    state.inDOnly = false;
    return null;
  }

  if (data.type === 'shot') {
    if (state.phase !== 'shoot') return 'pool_wrong_phase';
    const { angle, power } = data;
    if (typeof angle !== 'number' || !Number.isFinite(angle)) return 'pool_invalid_shot';
    if (typeof power !== 'number' || !Number.isFinite(power) || power < SNOOKER_TABLE.MIN_POWER || power > 1.05) {
      return 'pool_invalid_shot';
    }
    let spinX = 0;
    let spinY = 0;
    if (data.spinX !== undefined && data.spinX !== null) {
      if (typeof data.spinX !== 'number' || !Number.isFinite(data.spinX)) return 'pool_invalid_shot';
      spinX = Math.max(-1, Math.min(1, data.spinX));
    }
    if (data.spinY !== undefined && data.spinY !== null) {
      if (typeof data.spinY !== 'number' || !Number.isFinite(data.spinY)) return 'pool_invalid_shot';
      spinY = Math.max(-1, Math.min(1, data.spinY));
    }

    let nominate = null;
    if (state.ballOn === 'colour') {
      if (!data.nominate) return 'pool_nominate_required';
      if (typeof data.nominate !== 'string' || !COLOUR_ORDER.includes(data.nominate)) {
        return 'pool_invalid_nominate';
      }
      const targetBall = state.balls.find((b) => b && !b.potted && b.type === data.nominate);
      if (!targetBall) return 'pool_invalid_nominate';
      nominate = data.nominate;
    }

    const clampedPower = Math.max(SNOOKER_TABLE.MIN_POWER, Math.min(SNOOKER_TABLE.MAX_POWER, power));
    const sim = simulateShot(state.balls, angle, clampedPower, {
      recordFrames: true,
      spinX,
      spinY,
      table: SNOOKER_TABLE,
      ballType: snookerBallType,
      isBreak: !!state.isBreak,
    });
    applySnookerShotRules(state, playerIndex, angle, clampedPower, sim, spinX, spinY, nominate);
    return null;
  }

  return 'g_unknown_action';
}

function snookerBotFallback(state, _idx) {
  if (state.phase === 'ball_in_hand') {
    const spot = findSafeSnookerCueSpot(state.balls);
    return { type: 'place', x: spot.x, y: spot.y };
  }

  const cue = state.balls.find((b) => b.id === 0);
  const targets = getBallsOn(state);
  if (!cue || targets.length === 0) {
    const mv = { type: 'shot', angle: 0, power: 0.5, spinX: 0, spinY: 0 };
    if (state.ballOn === 'colour') {
      const col = state.balls.find((b) => b && !b.potted && b.id >= 16);
      if (col) mv.nominate = col.type;
    }
    return mv;
  }

  let best = targets[0];
  let bestD2 = Infinity;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const d2 = (t.x - cue.x) * (t.x - cue.x) + (t.y - cue.y) * (t.y - cue.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = t;
    }
  }

  const angle = Math.atan2(best.y - cue.y, best.x - cue.x);
  const mv = {
    type: 'shot',
    angle,
    power: state.isBreak ? 0.68 : 0.55,
    spinX: 0,
    spinY: 0,
  };
  if (state.ballOn === 'colour') {
    mv.nominate = best.type;
  }
  return mv;
}

module.exports = {
  SNOOKER_TABLE,
  COLOURS,
  COLOUR_ORDER,
  COLOUR_VALUES,
  snookerBallType,
  snookerBallValue,
  buildSnookerBalls,
  isInD,
  isValidSnookerCuePos,
  findSafeSnookerCueSpot,
  respotSnookerColour,
  countReds,
  nextColourOn,
  getBallsOn,
  computePointsRemaining,
  initSnookerState,
  applySnookerShotRules,
  handleSnookerMove,
  snookerBotFallback,
};
