// games/pool.js — 2-player 8-Ball Pool & Snooker with deterministic 2D physics
'use strict';

const physics = require('./lib/pool-physics');
const snooker = require('./lib/snooker');

const TABLE = physics.DEFAULT_TABLE;
const TURN_LIMIT = 150;

// Fixed deterministic 8-ball rack layout by (row, col) -> ball id.
// Apex = 1 (solid), row 2 center = 8 (eight), back corners = 2 (solid) and 9 (stripe).
const RACK_IDS = [
  [1],
  [10, 3],
  [11, 8, 4],
  [12, 5, 13, 6],
  [2, 14, 7, 15, 9],
];

function ballType(id) {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  if (id >= 1 && id <= 7) return 'solid';
  return 'stripe';
}

function buildRackBalls() {
  const balls = [
    { id: 0, x: TABLE.HEAD_STRING_X, y: TABLE.FOOT_SPOT_Y, potted: false, type: 'cue' },
  ];
  const spacing = 2 * TABLE.BALL_R + 0.6;
  const dx = spacing * Math.cos(Math.PI / 6);
  const dy = spacing;

  for (let r = 0; r < RACK_IDS.length; r++) {
    const row = RACK_IDS[r];
    for (let c = 0; c < row.length; c++) {
      const id = row[c];
      balls.push({
        id,
        x: TABLE.FOOT_SPOT_X + r * dx,
        y: TABLE.FOOT_SPOT_Y + (c - r / 2) * dy,
        potted: false,
        type: ballType(id),
      });
    }
  }

  balls.sort((a, b) => a.id - b.id);
  return balls;
}

function simulateShot(balls, angle, power, opts) {
  const simOpts = opts ? Object.assign({}, opts) : {};
  if (!simOpts.table) simOpts.table = TABLE;
  if (!simOpts.ballType) simOpts.ballType = ballType;
  return physics.simulateShot(balls, angle, power, simOpts);
}

function isValidCuePos(balls, x, y, opts) {
  if (opts && opts.variant === 'snooker') {
    return snooker.isValidSnookerCuePos(balls, x, y);
  }
  const kitchenOnly = !!(opts === true || (opts && opts.kitchenOnly));
  if (kitchenOnly && (!Number.isFinite(x) || x > TABLE.HEAD_STRING_X)) return false;
  return physics.isValidBallSpot(balls, x, y, 0, TABLE);
}

function findSafeCueSpot(balls, opts) {
  if (opts && opts.variant === 'snooker') {
    return snooker.findSafeSnookerCueSpot(balls);
  }
  const kitchenOnly = !!(opts === true || (opts && opts.kitchenOnly));
  const startX = TABLE.HEAD_STRING_X;
  const startY = TABLE.FOOT_SPOT_Y;
  if (isValidCuePos(balls, startX, startY, { kitchenOnly })) {
    return { x: startX, y: startY };
  }

  // Scan outward in concentric rings around (250, 250)
  const step = TABLE.BALL_R + 2;
  for (let r = step; r <= TABLE.W; r += step) {
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      const cx = Math.round(startX + Math.cos(a) * r);
      const cy = Math.round(startY + Math.sin(a) * r);
      if (isValidCuePos(balls, cx, cy, { kitchenOnly })) {
        return { x: cx, y: cy };
      }
    }
  }

  // Deterministic grid fallback (restricted to kitchen when kitchenOnly is set)
  const maxX = kitchenOnly ? TABLE.HEAD_STRING_X : (TABLE.W - TABLE.BALL_R - 2);
  for (let y = TABLE.BALL_R + 2; y <= TABLE.H - TABLE.BALL_R - 2; y += 10) {
    for (let x = TABLE.BALL_R + 2; x <= maxX; x += 10) {
      if (isValidCuePos(balls, x, y, { kitchenOnly })) {
        return { x, y };
      }
    }
  }

  return { x: kitchenOnly ? Math.min(startX, TABLE.HEAD_STRING_X) : startX, y: startY };
}

function respotBall(balls, ballId, targetX, targetY) {
  const ball = balls.find((b) => b.id === ballId);
  if (!ball) return;

  if (physics.isValidBallSpot(balls, targetX, targetY, ballId, TABLE)) {
    ball.x = targetX;
    ball.y = targetY;
    ball.potted = false;
    return;
  }

  // Shift along +x in steps of BALL_R
  for (let x = targetX + TABLE.BALL_R; x <= TABLE.W - TABLE.BALL_R - 1; x += TABLE.BALL_R) {
    if (physics.isValidBallSpot(balls, x, targetY, ballId, TABLE)) {
      ball.x = x;
      ball.y = targetY;
      ball.potted = false;
      return;
    }
  }

  // Grid fallback if +x line is completely blocked
  for (let y = TABLE.BALL_R + 2; y <= TABLE.H - TABLE.BALL_R - 2; y += TABLE.BALL_R) {
    for (let x = TABLE.BALL_R + 2; x <= TABLE.W - TABLE.BALL_R - 2; x += TABLE.BALL_R) {
      if (physics.isValidBallSpot(balls, x, y, ballId, TABLE)) {
        ball.x = x;
        ball.y = y;
        ball.potted = false;
        return;
      }
    }
  }

  ball.x = targetX;
  ball.y = targetY;
  ball.potted = false;
}

function countRemaining(balls, group) {
  let count = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b.potted && b.type === group) count++;
  }
  return count;
}

function placeCueAtSafeSpot(state, kitchenOnly) {
  const spot = findSafeCueSpot(state.balls, { kitchenOnly: !!kitchenOnly });
  const cue = state.balls.find((b) => b.id === 0);
  if (cue) {
    cue.x = spot.x;
    cue.y = spot.y;
    cue.potted = false;
  }
}

function applyShotRules(state, playerIndex, angle, power, sim, spinX, spinY) {
  const shooter = playerIndex;
  const opp = 1 - shooter;
  const myGroup = state.groups[shooter];
  const remOwnBefore = myGroup !== null ? countRemaining(state.balls, myGroup) : 7;

  state.balls = sim.balls;
  state.shotSeq += 1;

  const { firstHit, potted } = sim;
  const railHits = Array.isArray(sim.railHits) ? sim.railHits : [];
  const railAfterContact = !!sim.railAfterContact;
  const scratched = potted.includes(0);
  const pottedEight = potted.includes(8);
  const pottedSolids = potted.filter((id) => id >= 1 && id <= 7);
  const pottedStripes = potted.filter((id) => id >= 9 && id <= 15);
  const pottedObjCount = pottedSolids.length + pottedStripes.length + (pottedEight ? 1 : 0);
  const objRailHits = railHits.filter((id) => id !== 0).length;

  let foul = null;
  let respotEight = false;
  let illegalBreak = false;

  if (state.isBreak) {
    const legalBreak = pottedObjCount >= 1 || objRailHits >= 4;
    if (!legalBreak) {
      illegalBreak = true;
      foul = 'illegal_break';
      state.balls = buildRackBalls();
      state.currentPlayer = opp;
      state.isBreak = true;
      state.kitchenOnly = true;
      state.phase = 'ball_in_hand';
      state.groups = [null, null];
    } else {
      state.isBreak = false;
      state.groups = [null, null];
      if (pottedEight) {
        respotBall(state.balls, 8, TABLE.FOOT_SPOT_X, TABLE.FOOT_SPOT_Y);
        respotEight = true;
        if (scratched) {
          foul = 'scratch';
          state.foulCount[shooter] += 1;
          state.kitchenOnly = true;
          placeCueAtSafeSpot(state, true);
          state.currentPlayer = opp;
          state.phase = 'ball_in_hand';
        } else {
          state.kitchenOnly = false;
          state.phase = 'shoot';
        }
      } else if (scratched) {
        foul = 'scratch';
        state.foulCount[shooter] += 1;
        state.kitchenOnly = true;
        placeCueAtSafeSpot(state, true);
        state.currentPlayer = opp;
        state.phase = 'ball_in_hand';
      } else if (pottedSolids.length + pottedStripes.length > 0) {
        state.kitchenOnly = false;
        state.phase = 'shoot';
      } else {
        state.kitchenOnly = false;
        state.currentPlayer = opp;
        state.phase = 'shoot';
      }
    }
  } else {
    state.kitchenOnly = false;
    if (scratched) {
      foul = 'scratch';
    } else if (firstHit === null) {
      foul = 'no_hit';
    } else if (myGroup === null) {
      if (firstHit === 8) foul = 'wrong_ball';
    } else if (remOwnBefore > 0) {
      if (ballType(firstHit) !== myGroup) foul = 'wrong_ball';
    } else if (firstHit !== 8) {
      foul = 'wrong_ball';
    }
    if (!foul && pottedObjCount === 0 && !railAfterContact) {
      foul = 'no_rail';
    }

    if (pottedEight) {
      if (foul) state.foulCount[shooter] += 1;
      if (myGroup !== null && remOwnBefore === 0 && !foul) {
        state.winner = shooter;
        state.phase = 'over';
        state.winReason = 'eight_potted';
      } else {
        state.winner = opp;
        state.phase = 'over';
        state.winReason = (myGroup !== null && remOwnBefore === 0) ? 'eight_foul' : 'early_eight';
        foul = foul || 'early_eight';
      }
    } else if (foul) {
      state.foulCount[shooter] += 1;
      placeCueAtSafeSpot(state, false);
      state.currentPlayer = opp;
      state.phase = 'ball_in_hand';
      state.kitchenOnly = false;
    } else if (myGroup === null) {
      const firstHitGroup = ballType(firstHit);
      const pottedSameGroup = (firstHitGroup === 'solid' ? pottedSolids.length : pottedStripes.length) > 0;
      if (pottedSameGroup) {
        state.groups[shooter] = firstHitGroup;
        state.groups[opp] = firstHitGroup === 'solid' ? 'stripe' : 'solid';
        state.phase = 'shoot';
      } else {
        state.currentPlayer = opp;
        state.phase = 'shoot';
      }
    } else {
      const pottedOwn = (myGroup === 'solid' ? pottedSolids.length : pottedStripes.length) > 0;
      if (pottedOwn) {
        state.phase = 'shoot';
      } else {
        state.currentPlayer = opp;
        state.phase = 'shoot';
      }
    }
  }

  state.turnCount += 1;
  if (state.winner === null && state.turnCount >= TURN_LIMIT) {
    if (state.groups[0] !== null && state.groups[1] !== null) {
      const rem0 = countRemaining(state.balls, state.groups[0]);
      const rem1 = countRemaining(state.balls, state.groups[1]);
      if (rem0 < rem1) state.winner = 0;
      else if (rem1 < rem0) state.winner = 1;
      else state.winner = -1;
    } else {
      state.winner = -1;
    }
    state.phase = 'over';
    state.winReason = 'turn_limit';
  }

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
    respotEight,
    illegalBreak,
    frames: sim.frames,
  };
}

function createState() {
  return {
    variant: '8ball',
    balls: buildRackBalls(),
    currentPlayer: 0,
    phase: 'ball_in_hand',
    groups: [null, null],
    isBreak: true,
    kitchenOnly: true,
    inDOnly: false,
    shotSeq: 0,
    turnCount: 0,
    lastShot: null,
    winner: null,
    winReason: null,
    foulCount: [0, 0],
  };
}

function initGame(state, _playerCount) {
  // Read room options from state._options (never state.options)
  const variant = state && state._options && state._options.variant === 'snooker' ? 'snooker' : '8ball';
  if (variant === 'snooker') {
    snooker.initSnookerState(state);
    return;
  }

  state.variant = '8ball';
  state.balls = buildRackBalls();
  state.currentPlayer = 0;
  state.phase = 'ball_in_hand';
  state.groups = [null, null];
  state.isBreak = true;
  state.kitchenOnly = true;
  state.inDOnly = false;
  state.shotSeq = 0;
  state.turnCount = 0;
  state.lastShot = null;
  state.winner = null;
  state.winReason = null;
  state.foulCount = [0, 0];
  delete state.scores;
  delete state.currentBreak;
  delete state.ballOn;
  delete state.nominatedColour;
  delete state.pointsRemaining;
  delete state.respotBlackTie;
}

function handleMove(data, state, playerIndex) {
  if (state && state.variant === 'snooker') {
    return snooker.handleSnookerMove(data, state, playerIndex);
  }

  if (state.winner !== null || state.phase === 'over') return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
  if (!data || typeof data !== 'object') return 'g_unknown_action';

  if (data.type === 'place') {
    if (state.phase !== 'ball_in_hand') return 'pool_wrong_phase';
    const { x, y } = data;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'pool_invalid_place';
    const minX = TABLE.BALL_R + 1;
    const maxX = TABLE.W - TABLE.BALL_R - 1;
    const minY = TABLE.BALL_R + 1;
    const maxY = TABLE.H - TABLE.BALL_R - 1;
    if (x < minX || x > maxX || y < minY || y > maxY) return 'pool_invalid_place';
    const kitchenOnly = !!(state.isBreak || state.kitchenOnly);
    if (kitchenOnly && x > TABLE.HEAD_STRING_X) return 'pool_place_kitchen';
    if (!isValidCuePos(state.balls, x, y, { kitchenOnly })) return 'pool_invalid_place';
    const cue = state.balls.find((b) => b.id === 0);
    if (!cue) return 'pool_invalid_place';
    cue.x = x;
    cue.y = y;
    cue.potted = false;
    state.phase = 'shoot';
    state.kitchenOnly = false;
    return null;
  }

  if (data.type === 'shot') {
    if (state.phase !== 'shoot') return 'pool_wrong_phase';
    const { angle, power } = data;
    if (typeof angle !== 'number' || !Number.isFinite(angle)) return 'pool_invalid_shot';
    if (typeof power !== 'number' || !Number.isFinite(power) || power < TABLE.MIN_POWER || power > 1.05) {
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
    const clampedPower = Math.max(TABLE.MIN_POWER, Math.min(TABLE.MAX_POWER, power));
    const sim = simulateShot(state.balls, angle, clampedPower, { recordFrames: true, spinX, spinY });
    applyShotRules(state, playerIndex, angle, clampedPower, sim, spinX, spinY);
    return null;
  }

  return 'g_unknown_action';
}

function botFallback(state, idx) {
  if (state && state.variant === 'snooker') {
    return snooker.snookerBotFallback(state, idx);
  }

  if (state.phase === 'ball_in_hand') {
    const kitchenOnly = !!(state.isBreak || state.kitchenOnly);
    const spot = findSafeCueSpot(state.balls, { kitchenOnly });
    return { type: 'place', x: spot.x, y: spot.y };
  }

  const cue = state.balls.find((b) => b.id === 0);
  const myGroup = state.groups ? state.groups[idx] : null;
  let targets;

  if (state.isBreak) {
    targets = state.balls.filter((b) => !b.potted && b.id !== 0);
  } else if (myGroup === null) {
    targets = state.balls.filter((b) => !b.potted && b.id !== 0 && b.id !== 8);
    if (targets.length === 0) {
      targets = state.balls.filter((b) => !b.potted && b.id !== 0);
    }
  } else {
    targets = state.balls.filter((b) => !b.potted && b.type === myGroup);
    if (targets.length === 0) {
      targets = state.balls.filter((b) => !b.potted && b.id === 8);
    }
  }

  if (!cue || targets.length === 0) {
    return { type: 'shot', angle: 0, power: 0.5, spinX: 0, spinY: 0 };
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
  return { type: 'shot', angle, power: state.isBreak ? 0.9 : 0.6, spinX: 0, spinY: 0 };
}

const BOT_PAUSE_MS = 1000;
const BOT_AIM_MS = 1500;
const BOT_DELAY_MAX_MS = 15000;

function botDelayMs(state) {
  const shot = state && state.lastShot;
  const frames = shot && Array.isArray(shot.frames) ? shot.frames : null;
  let replayMs = 0;
  if (frames && frames.length > 0) {
    const fps = (typeof shot.fps === 'number' && Number.isFinite(shot.fps) && shot.fps > 0) ? shot.fps : 30;
    replayMs = frames.length * (1000 / fps);
  }
  return Math.min(BOT_DELAY_MAX_MS, Math.round(replayMs + BOT_PAUSE_MS + BOT_AIM_MS));
}

exports.name = 'pool';
exports.maxPlayers = 2;
exports.minPlayers = 2;
exports.TABLE = TABLE;
exports.SNOOKER_TABLE = snooker.SNOOKER_TABLE;
exports.snooker = snooker;
exports.createState = createState;
exports.initGame = initGame;
exports.handleMove = handleMove;
exports.simulateShot = simulateShot;
exports.isValidCuePos = isValidCuePos;
exports.findSafeCueSpot = findSafeCueSpot;
exports.botFallback = botFallback;
exports.botDelayMs = botDelayMs;
