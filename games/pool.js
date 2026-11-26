// games/pool.js — 2-player 8-Ball Pool with deterministic 2D physics
'use strict';

const TABLE = {
  W: 1000,
  H: 500,
  BALL_R: 14,
  HEAD_STRING_X: 250,
  FOOT_SPOT_X: 750,
  FOOT_SPOT_Y: 250,
  MAX_SPEED: 1450,
  MIN_POWER: 0.05,
  MAX_POWER: 1.0,
  FRICTION: 260,
  STOP_SPEED: 6,
  E_BALL: 0.96,
  E_RAIL: 0.80,
  DT: 1 / 180,
  MAX_TICKS: 1800,
  FRAME_STRIDE: 6,
  POCKETS: [
    { id: 0, x: 0, y: 0, r: 28 },
    { id: 1, x: 500, y: -4, r: 25 },
    { id: 2, x: 1000, y: 0, r: 28 },
    { id: 3, x: 0, y: 500, r: 28 },
    { id: 4, x: 500, y: 504, r: 25 },
    { id: 5, x: 1000, y: 500, r: 28 },
  ],
};

const MAX_FRAMES = 300;
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

function round1(v) {
  return Math.round(v * 10) / 10;
}

function encodeFrame(simBalls) {
  const frame = [];
  for (let i = 0; i < simBalls.length; i++) {
    const b = simBalls[i];
    if (!b.potted) {
      frame.push(b.id, round1(b.x), round1(b.y));
    }
  }
  return frame;
}

function framesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function simulateShot(balls, angle, power, opts) {
  const recordFrames = opts && opts.recordFrames !== undefined ? !!opts.recordFrames : true;
  const simBalls = balls.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: 0,
    vy: 0,
    potted: !!b.potted,
    type: b.type || ballType(b.id),
  }));

  const clampedPower = Math.max(0, Math.min(TABLE.MAX_POWER, Number(power) || 0));
  const cue = simBalls.find((b) => b.id === 0);
  if (cue && !cue.potted) {
    cue.vx = Math.cos(angle) * clampedPower * TABLE.MAX_SPEED;
    cue.vy = Math.sin(angle) * clampedPower * TABLE.MAX_SPEED;
  }

  let firstHit = null;
  const potted = [];
  const frames = recordFrames ? [encodeFrame(simBalls)] : [];
  let ticks = 0;

  const { W, H, BALL_R, FRICTION, STOP_SPEED, E_BALL, E_RAIL, DT, MAX_TICKS, FRAME_STRIDE, POCKETS } = TABLE;
  const minD = 2 * BALL_R;
  const minD2 = minD * minD;
  const n = simBalls.length;

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    ticks = tick;

    // 1. Integrate positions
    for (let i = 0; i < n; i++) {
      const b = simBalls[i];
      if (b.potted) continue;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
    }

    // 2. Pocket check BEFORE cushions
    for (let i = 0; i < n; i++) {
      const b = simBalls[i];
      if (b.potted) continue;
      for (let k = 0; k < POCKETS.length; k++) {
        const p = POCKETS[k];
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r) {
          b.potted = true;
          b.vx = 0;
          b.vy = 0;
          potted.push(b.id);
          break;
        }
      }
    }

    // 3. Cushion collisions
    for (let i = 0; i < n; i++) {
      const b = simBalls[i];
      if (b.potted) continue;
      if (b.x < BALL_R) {
        b.x = BALL_R;
        if (b.vx < 0) b.vx *= -E_RAIL;
      } else if (b.x > W - BALL_R) {
        b.x = W - BALL_R;
        if (b.vx > 0) b.vx *= -E_RAIL;
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (b.vy < 0) b.vy *= -E_RAIL;
      } else if (b.y > H - BALL_R) {
        b.y = H - BALL_R;
        if (b.vy > 0) b.vy *= -E_RAIL;
      }
    }

    // 4. Ball-ball collisions (2 passes keep break rack crisp without sticking)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const a = simBalls[i];
        if (a.potted) continue;
        for (let j = i + 1; j < n; j++) {
          const b = simBalls[j];
          if (b.potted) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < minD2) {
            if (firstHit === null) {
              if (a.id === 0) firstHit = b.id;
              else if (b.id === 0) firstHit = a.id;
            }
            const d = Math.sqrt(d2) || 0.0001;
            const nx = dx / d;
            const ny = dy / d;
            const overlap = (minD - d) * 0.5;
            a.x -= overlap * nx;
            a.y -= overlap * ny;
            b.x += overlap * nx;
            b.y += overlap * ny;

            const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (vn < 0) {
              const imp = -(1 + E_BALL) * vn * 0.5;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              b.vx += imp * nx;
              b.vy += imp * ny;
            }
          }
        }
      }
    }

    // 5. Rolling friction & stop check
    let anyMoving = false;
    for (let i = 0; i < n; i++) {
      const b = simBalls[i];
      if (b.potted) continue;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd <= STOP_SPEED || spd <= FRICTION * DT) {
        b.vx = 0;
        b.vy = 0;
      } else {
        const scale = (spd - FRICTION * DT) / spd;
        b.vx *= scale;
        b.vy *= scale;
        anyMoving = true;
      }
    }

    if (recordFrames && tick % FRAME_STRIDE === 0 && frames.length < MAX_FRAMES) {
      frames.push(encodeFrame(simBalls));
    }

    if (!anyMoving) break;
  }

  const outBalls = simBalls.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    potted: b.potted,
    type: b.type,
  }));

  if (recordFrames) {
    const finalFrame = encodeFrame(simBalls);
    if (!framesEqual(frames[frames.length - 1], finalFrame)) {
      if (frames.length < MAX_FRAMES) frames.push(finalFrame);
      else frames[frames.length - 1] = finalFrame;
    }
  }

  return { balls: outBalls, firstHit, potted, frames, ticks };
}

function isValidBallSpot(balls, x, y, ignoreBallId) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const minX = TABLE.BALL_R + 1;
  const maxX = TABLE.W - TABLE.BALL_R - 1;
  const minY = TABLE.BALL_R + 1;
  const maxY = TABLE.H - TABLE.BALL_R - 1;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;

  const minDist = 2 * TABLE.BALL_R + 1;
  const minDist2 = minDist * minDist;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b || b.potted || b.id === ignoreBallId) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy < minDist2) return false;
  }
  return true;
}

function isValidCuePos(balls, x, y) {
  return isValidBallSpot(balls, x, y, 0);
}

function findSafeCueSpot(balls) {
  const startX = TABLE.HEAD_STRING_X;
  const startY = TABLE.FOOT_SPOT_Y;
  if (isValidCuePos(balls, startX, startY)) {
    return { x: startX, y: startY };
  }

  // Scan outward in concentric rings around (250, 250)
  const step = TABLE.BALL_R + 2;
  for (let r = step; r <= TABLE.W; r += step) {
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      const cx = Math.round(startX + Math.cos(a) * r);
      const cy = Math.round(startY + Math.sin(a) * r);
      if (isValidCuePos(balls, cx, cy)) {
        return { x: cx, y: cy };
      }
    }
  }

  // Deterministic full-table grid fallback
  for (let y = TABLE.BALL_R + 2; y <= TABLE.H - TABLE.BALL_R - 2; y += 10) {
    for (let x = TABLE.BALL_R + 2; x <= TABLE.W - TABLE.BALL_R - 2; x += 10) {
      if (isValidCuePos(balls, x, y)) {
        return { x, y };
      }
    }
  }

  return { x: startX, y: startY };
}

function respotBall(balls, ballId, targetX, targetY) {
  const ball = balls.find((b) => b.id === ballId);
  if (!ball) return;

  if (isValidBallSpot(balls, targetX, targetY, ballId)) {
    ball.x = targetX;
    ball.y = targetY;
    ball.potted = false;
    return;
  }

  // Shift along +x in steps of BALL_R
  for (let x = targetX + TABLE.BALL_R; x <= TABLE.W - TABLE.BALL_R - 1; x += TABLE.BALL_R) {
    if (isValidBallSpot(balls, x, targetY, ballId)) {
      ball.x = x;
      ball.y = targetY;
      ball.potted = false;
      return;
    }
  }

  // Grid fallback if +x line is completely blocked
  for (let y = TABLE.BALL_R + 2; y <= TABLE.H - TABLE.BALL_R - 2; y += TABLE.BALL_R) {
    for (let x = TABLE.BALL_R + 2; x <= TABLE.W - TABLE.BALL_R - 2; x += TABLE.BALL_R) {
      if (isValidBallSpot(balls, x, y, ballId)) {
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

function placeCueAtSafeSpot(state) {
  const spot = findSafeCueSpot(state.balls);
  const cue = state.balls.find((b) => b.id === 0);
  if (cue) {
    cue.x = spot.x;
    cue.y = spot.y;
    cue.potted = false;
  }
}

function applyShotRules(state, playerIndex, angle, power, sim) {
  const shooter = playerIndex;
  const opp = 1 - shooter;
  const myGroup = state.groups[shooter];
  const remOwnBefore = myGroup !== null ? countRemaining(state.balls, myGroup) : 7;

  state.balls = sim.balls;
  state.shotSeq += 1;

  const { firstHit, potted } = sim;
  const scratched = potted.includes(0);
  const pottedEight = potted.includes(8);
  const pottedSolids = potted.filter((id) => id >= 1 && id <= 7);
  const pottedStripes = potted.filter((id) => id >= 9 && id <= 15);

  let foul = null;
  let respotEight = false;

  if (state.isBreak) {
    state.isBreak = false;
    if (pottedEight) {
      if (scratched) {
        foul = 'scratch';
        state.foulCount[shooter] += 1;
        state.winner = opp;
        state.phase = 'over';
        state.winReason = 'eight_foul';
      } else {
        respotBall(state.balls, 8, TABLE.FOOT_SPOT_X, TABLE.FOOT_SPOT_Y);
        respotEight = true;
        state.groups = [null, null];
        state.phase = 'shoot';
      }
    } else {
      foul = scratched ? 'scratch' : (firstHit === null ? 'no_hit' : null);
      if (foul) {
        state.foulCount[shooter] += 1;
        placeCueAtSafeSpot(state);
        state.currentPlayer = opp;
        state.phase = 'ball_in_hand';
      } else if (pottedSolids.length + pottedStripes.length > 0) {
        state.phase = 'shoot';
      } else {
        state.currentPlayer = opp;
        state.phase = 'shoot';
      }
    }
  } else {
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
      placeCueAtSafeSpot(state);
      state.currentPlayer = opp;
      state.phase = 'ball_in_hand';
    } else if (myGroup === null && pottedSolids.length + pottedStripes.length > 0) {
      const firstObjId = potted.find((id) => id !== 0 && id !== 8);
      const chosen = firstObjId <= 7 ? 'solid' : 'stripe';
      state.groups[shooter] = chosen;
      state.groups[opp] = chosen === 'solid' ? 'stripe' : 'solid';
      state.phase = 'shoot';
    } else if (myGroup !== null) {
      const pottedOwn = (myGroup === 'solid' ? pottedSolids.length : pottedStripes.length) > 0;
      if (pottedOwn) {
        state.phase = 'shoot';
      } else {
        state.currentPlayer = opp;
        state.phase = 'shoot';
      }
    } else {
      state.currentPlayer = opp;
      state.phase = 'shoot';
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
    fps: 30,
    firstHit,
    potted,
    foul,
    respotEight,
    frames: sim.frames,
  };
}

function createState() {
  return {
    balls: buildRackBalls(),
    currentPlayer: 0,
    phase: 'shoot',
    groups: [null, null],
    isBreak: true,
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
  void state._options;
  state.balls = buildRackBalls();
  state.currentPlayer = 0;
  state.phase = 'shoot';
  state.groups = [null, null];
  state.isBreak = true;
  state.shotSeq = 0;
  state.turnCount = 0;
  state.lastShot = null;
  state.winner = null;
  state.winReason = null;
  state.foulCount = [0, 0];
}

function handleMove(data, state, playerIndex) {
  if (state.winner !== null || state.phase === 'over') return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
  if (!data || typeof data !== 'object') return 'g_unknown_action';

  if (data.type === 'place') {
    if (state.phase !== 'ball_in_hand') return 'pool_wrong_phase';
    const { x, y } = data;
    if (!isValidCuePos(state.balls, x, y)) return 'pool_invalid_place';
    const cue = state.balls.find((b) => b.id === 0);
    if (!cue) return 'pool_invalid_place';
    cue.x = x;
    cue.y = y;
    cue.potted = false;
    state.phase = 'shoot';
    return null;
  }

  if (data.type === 'shot') {
    if (state.phase !== 'shoot') return 'pool_wrong_phase';
    const { angle, power } = data;
    if (typeof angle !== 'number' || !Number.isFinite(angle)) return 'pool_invalid_shot';
    if (typeof power !== 'number' || !Number.isFinite(power) || power < TABLE.MIN_POWER || power > 1.05) {
      return 'pool_invalid_shot';
    }
    const clampedPower = Math.max(TABLE.MIN_POWER, Math.min(TABLE.MAX_POWER, power));
    const sim = simulateShot(state.balls, angle, clampedPower, { recordFrames: true });
    applyShotRules(state, playerIndex, angle, clampedPower, sim);
    return null;
  }

  return 'g_unknown_action';
}

function botFallback(state, idx) {
  if (state.phase === 'ball_in_hand') {
    const spot = findSafeCueSpot(state.balls);
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
    return { type: 'shot', angle: 0, power: 0.5 };
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
  return { type: 'shot', angle, power: state.isBreak ? 0.9 : 0.6 };
}

exports.name = 'pool';
exports.maxPlayers = 2;
exports.minPlayers = 2;
exports.TABLE = TABLE;
exports.createState = createState;
exports.initGame = initGame;
exports.handleMove = handleMove;
exports.simulateShot = simulateShot;
exports.isValidCuePos = isValidCuePos;
exports.findSafeCueSpot = findSafeCueSpot;
exports.botFallback = botFallback;
