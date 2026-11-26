'use strict';

const pool = require('../games/pool');
const { pickFor } = require('./lib/difficulty');

// Provisional — run `node scripts/bot-tier-eval.js pool --calibrate --dup` to tune.
const PICK = {
  temp: { easy: 140, normal: 35 },
  maxLoss: { easy: 500, normal: 120 },
};

const { W, H, BALL_R, FOOT_SPOT_X, FOOT_SPOT_Y, MIN_POWER, MAX_POWER, POCKETS } = pool.TABLE;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function ballType(id) {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  if (id >= 1 && id <= 7) return 'solid';
  return 'stripe';
}

function legalTargetBalls(state, playerIndex) {
  const myGroup = state.groups ? state.groups[playerIndex] : null;
  const active = state.balls.filter((b) => b && !b.potted && b.id !== 0);
  if (state.isBreak || !myGroup) {
    const nonEight = active.filter((b) => b.id !== 8);
    return nonEight.length > 0 ? nonEight : active;
  }
  const own = active.filter((b) => (b.type || ballType(b.id)) === myGroup);
  return own.length > 0 ? own : active.filter((b) => b.id === 8);
}

function isSegmentClear(balls, x1, y1, x2, y2, ignoreA, ignoreB) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return true;
  const minD = 2 * BALL_R - 1;
  const minD2 = minD * minD;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b || b.potted || b.id === 0 || b.id === ignoreA || b.id === ignoreB) continue;
    const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / len2));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const ox = b.x - px;
    const oy = b.y - py;
    if (ox * ox + oy * oy < minD2) return false;
  }
  return true;
}

function minPocketDist(x, y) {
  let best = Infinity;
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < best) best = d;
  }
  return best;
}

function chooseBallInHand(state, playerIndex) {
  const targets = legalTargetBalls(state, playerIndex);
  const cands = [];
  const distances = [110, 180];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    for (let k = 0; k < POCKETS.length; k++) {
      const p = POCKETS[k];
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const distTP = Math.hypot(dx, dy);
      if (distTP < 1) continue;
      const ux = dx / distTP;
      const uy = dy / distTP;
      for (let m = 0; m < distances.length; m++) {
        const behind = distances[m];
        const cx = round1(t.x + ux * behind);
        const cy = round1(t.y + uy * behind);
        if (!pool.isValidCuePos(state.balls, cx, cy)) continue;
        const clearCue = isSegmentClear(state.balls, cx, cy, t.x, t.y, t.id, -1);
        const clearPocket = isSegmentClear(state.balls, t.x, t.y, p.x, p.y, t.id, -1);
        const pDist = minPocketDist(cx, cy);
        const score =
          (clearCue ? 130 : -40) +
          (clearPocket ? 150 : -50) -
          distTP * 0.16 -
          behind * 0.08 +
          (pDist < 65 ? -60 : 20);
        cands.push({
          move: { type: 'place', x: cx, y: cy },
          score,
        });
      }
    }
  }

  const safe = pool.findSafeCueSpot(state.balls);
  cands.push({
    move: { type: 'place', x: safe.x, y: safe.y },
    score: -80,
  });

  const chosen = pickFor(state, cands, PICK);
  if (chosen && pool.isValidCuePos(state.balls, chosen.x, chosen.y)) {
    return chosen;
  }
  return { type: 'place', x: safe.x, y: safe.y };
}

function chooseBreakShot(state) {
  const cue = state.balls.find((b) => b && b.id === 0 && !b.potted);
  if (!cue) return { type: 'shot', angle: 0, power: 0.9 };
  const baseAngle = Math.atan2(FOOT_SPOT_Y - cue.y, FOOT_SPOT_X - cue.x);
  const candidates = [
    { angle: baseAngle, power: 1.0 },
    { angle: baseAngle - 0.01, power: 1.0 },
    { angle: baseAngle + 0.01, power: 1.0 },
    { angle: baseAngle - 0.03, power: 1.0 },
    { angle: baseAngle + 0.03, power: 1.0 },
    { angle: baseAngle, power: 0.92 },
  ];

  const cands = candidates.map((c) => {
    const sim = pool.simulateShot(state.balls, c.angle, c.power, { recordFrames: false });
    const scratched = sim.potted.includes(0);
    const pottedEight = sim.potted.includes(8);
    if (pottedEight && scratched) {
      return { move: { type: 'shot', angle: c.angle, power: c.power }, score: -1000 };
    }
    const pottedObj = sim.potted.filter((id) => id !== 0 && id !== 8).length;
    let spread = 0;
    for (let i = 0; i < sim.balls.length; i++) {
      const b = sim.balls[i];
      if (!b.potted && b.id !== 0) {
        spread += Math.hypot(b.x - FOOT_SPOT_X, b.y - FOOT_SPOT_Y);
      }
    }
    const score =
      pottedObj * 180 +
      (scratched ? -220 : 0) +
      (sim.firstHit === null ? -250 : 25) +
      spread * 0.02;
    return {
      move: { type: 'shot', angle: c.angle, power: c.power },
      score,
    };
  });

  return pickFor(state, cands, PICK);
}

function nearestPocketDist(ball) {
  let best = Infinity;
  for (let i = 0; i < POCKETS.length; i++) {
    const p = POCKETS[i];
    const d = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (d < best) best = d;
  }
  return best;
}

function scoreSim(state, playerIndex, sim, targetsBefore) {
  const myGroup = state.groups ? state.groups[playerIndex] : null;
  let remOwnBefore = 7;
  if (myGroup !== null) {
    remOwnBefore = 0;
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b && !b.potted && (b.type || ballType(b.id)) === myGroup) remOwnBefore++;
    }
  }

  const scratched = sim.potted.includes(0);
  const pottedEight = sim.potted.includes(8);
  let foul = false;
  if (scratched) {
    foul = true;
  } else if (sim.firstHit === null) {
    foul = true;
  } else if (myGroup === null) {
    if (sim.firstHit === 8) foul = true;
  } else if (remOwnBefore > 0) {
    if (ballType(sim.firstHit) !== myGroup) foul = true;
  } else if (sim.firstHit !== 8) {
    foul = true;
  }

  if (pottedEight) {
    if (myGroup !== null && remOwnBefore === 0 && !foul) {
      return 1000;
    }
    return -1000;
  }

  let score = 0;
  if (scratched) score -= 220;
  if (sim.firstHit === null) score -= 250;
  else if (foul) score -= 200;

  let ownPotted = 0;
  let oppPotted = 0;
  for (let i = 0; i < sim.potted.length; i++) {
    const id = sim.potted[i];
    if (id === 0 || id === 8) continue;
    const bt = ballType(id);
    if (!myGroup || bt === myGroup) ownPotted++;
    else oppPotted++;
  }

  if (!foul) {
    score += ownPotted * 180;
    score -= oppPotted * 60;
    if (ownPotted === 0) {
      score += 25;
      let progress = 0;
      for (let i = 0; i < targetsBefore.length; i++) {
        const tb = targetsBefore[i];
        const ta = sim.balls.find((b) => b.id === tb.id);
        if (ta && !ta.potted) {
          progress += nearestPocketDist(tb) - nearestPocketDist(ta);
        }
      }
      score += clamp(progress * 0.05, -10, 20);
    }
  } else {
    score -= oppPotted * 30;
  }

  const cueAfter = sim.balls.find((b) => b.id === 0);
  if (cueAfter && !cueAfter.potted) {
    score += minPocketDist(cueAfter.x, cueAfter.y) > 55 ? 15 : -10;
  }

  return score;
}

function chooseNormalShot(state, playerIndex) {
  const cue = state.balls.find((b) => b && b.id === 0 && !b.potted);
  if (!cue) return { type: 'shot', angle: 0, power: 0.5 };

  const targets = legalTargetBalls(state, playerIndex);
  if (targets.length === 0) return { type: 'shot', angle: 0, power: 0.5 };

  const pocketCands = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    for (let k = 0; k < POCKETS.length; k++) {
      const p = POCKETS[k];
      const dxTP = p.x - t.x;
      const dyTP = p.y - t.y;
      const distTP = Math.hypot(dxTP, dyTP);
      if (distTP < 1) continue;
      const uxTP = dxTP / distTP;
      const uyTP = dyTP / distTP;

      const gx = t.x - uxTP * (2 * BALL_R);
      const gy = t.y - uyTP * (2 * BALL_R);
      if (gx < BALL_R - 2 || gx > W - BALL_R + 2 || gy < BALL_R - 2 || gy > H - BALL_R + 2) continue;

      const dxCG = gx - cue.x;
      const dyCG = gy - cue.y;
      const distCG = Math.hypot(dxCG, dyCG);
      if (distCG < 1) continue;

      const cosCut = (dxCG * dxTP + dyCG * dyTP) / (distCG * distTP);
      if (cosCut < 0.25) continue;

      const angle = Math.atan2(dyCG, dxCG);
      const power = clamp(0.28 + (distCG + distTP) / 1400, 0.3, 0.92);
      const clearCG = isSegmentClear(state.balls, cue.x, cue.y, gx, gy, t.id, -1);
      const clearTP = isSegmentClear(state.balls, t.x, t.y, p.x, p.y, t.id, -1);
      const heur =
        (clearCG ? 200 : 0) +
        (clearTP ? 200 : 0) +
        cosCut * 120 -
        (distCG + distTP) * 0.15;

      pocketCands.push({ angle, power, heur });
    }
  }

  pocketCands.sort((a, b) => b.heur - a.heur);

  const shotList = [];
  const topExact = Math.min(18, pocketCands.length);
  for (let i = 0; i < topExact; i++) {
    shotList.push({ angle: pocketCands[i].angle, power: pocketCands[i].power });
  }

  const topNoisy = Math.min(4, pocketCands.length);
  const offsets = [-0.08, -0.035, 0.035, 0.08];
  for (let i = 0; i < topNoisy; i++) {
    const base = pocketCands[i];
    for (let j = 0; j < offsets.length; j++) {
      shotList.push({ angle: base.angle + offsets[j], power: base.power });
    }
  }

  // Fallback direct-hit / safety shots so cands is never empty
  const sortedTargets = targets
    .slice()
    .sort((a, b) => {
      const da = (a.x - cue.x) * (a.x - cue.x) + (a.y - cue.y) * (a.y - cue.y);
      const db = (b.x - cue.x) * (b.x - cue.x) + (b.y - cue.y) * (b.y - cue.y);
      return da - db;
    });
  const directCount = Math.min(2, sortedTargets.length);
  for (let i = 0; i < directCount; i++) {
    const t = sortedTargets[i];
    const ang = Math.atan2(t.y - cue.y, t.x - cue.x);
    shotList.push({ angle: ang, power: 0.45 });
    shotList.push({ angle: ang, power: 0.65 });
  }

  const capped = shotList.slice(0, 40);
  const cands = capped.map((c) => {
    const sim = pool.simulateShot(state.balls, c.angle, c.power, { recordFrames: false });
    return {
      move: { type: 'shot', angle: c.angle, power: c.power },
      score: scoreSim(state, playerIndex, sim, targets),
    };
  });

  const chosen = pickFor(state, cands, PICK);
  if (
    chosen &&
    chosen.type === 'shot' &&
    Number.isFinite(chosen.angle) &&
    Number.isFinite(chosen.power)
  ) {
    return {
      type: 'shot',
      angle: chosen.angle,
      power: clamp(chosen.power, MIN_POWER, MAX_POWER),
    };
  }
  const fallbackAngle = Math.atan2(sortedTargets[0].y - cue.y, sortedTargets[0].x - cue.x);
  return { type: 'shot', angle: Number.isFinite(fallbackAngle) ? fallbackAngle : 0, power: 0.55 };
}

function createBot(playerIndex) {
  return {
    getMove(state, seatArg) {
      if (!state || state.phase === 'over' || state.winner !== null) return null;
      const idx = typeof seatArg === 'number' ? seatArg : playerIndex;
      if (state.phase === 'ball_in_hand') {
        return chooseBallInHand(state, idx);
      }
      if (state.phase === 'shoot') {
        if (state.isBreak) return chooseBreakShot(state);
        return chooseNormalShot(state, idx);
      }
      return null;
    },
  };
}

module.exports = {
  name: 'pool',
  createBot,
};
