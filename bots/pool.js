'use strict';

const pool = require('../games/pool');
const { pickFor } = require('./lib/difficulty');

// Provisional — run `node scripts/bot-tier-eval.js pool --calibrate --dup` to tune.
const PICK = {
  temp: { easy: 140, normal: 35 },
  maxLoss: { easy: 500, normal: 120 },
};

const { W, H, BALL_R, HEAD_STRING_X, FOOT_SPOT_X, FOOT_SPOT_Y, MIN_POWER, MAX_POWER, POCKETS } = pool.TABLE;
const SNOOKER_TABLE = pool.SNOOKER_TABLE;
const snooker = pool.snooker;

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

function isSegmentClear(balls, x1, y1, x2, y2, ignoreA, ignoreB, ballR) {
  const r = ballR || BALL_R;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return true;
  const minD = 2 * r - 1;
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

function minPocketDist(x, y, pockets) {
  const list = pockets || POCKETS;
  let best = Infinity;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < best) best = d;
  }
  return best;
}

function chooseBallInHand(state, playerIndex) {
  const kitchenOnly = !!(state.isBreak || state.kitchenOnly);
  const posOpts = { kitchenOnly };
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
        if (!pool.isValidCuePos(state.balls, cx, cy, posOpts)) continue;
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

  if (kitchenOnly) {
    if (state.isBreak) {
      const breakSpots = [
        [HEAD_STRING_X, 250, 120],
        [HEAD_STRING_X, 210, 95],
        [HEAD_STRING_X, 290, 95],
        [HEAD_STRING_X, 170, 80],
        [HEAD_STRING_X, 330, 80],
        [130, 250, 85],
      ];
      for (let b = 0; b < breakSpots.length; b++) {
        const [bx, by, bScore] = breakSpots[b];
        if (pool.isValidCuePos(state.balls, bx, by, posOpts)) {
          cands.push({ move: { type: 'place', x: bx, y: by }, score: bScore });
        }
      }
    }
    const kxList = [60, 120, HEAD_STRING_X];
    const kyList = [90, 170, 250, 330, 410];
    for (let ix = 0; ix < kxList.length; ix++) {
      for (let iy = 0; iy < kyList.length; iy++) {
        const cx = kxList[ix];
        const cy = kyList[iy];
        if (!pool.isValidCuePos(state.balls, cx, cy, posOpts)) continue;
        let hasClear = false;
        let minTDist = Infinity;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          const d = Math.hypot(t.x - cx, t.y - cy);
          if (d < minTDist) minTDist = d;
          if (isSegmentClear(state.balls, cx, cy, t.x, t.y, t.id, -1)) {
            hasClear = true;
          }
        }
        const pDist = minPocketDist(cx, cy);
        const score = (hasClear ? 40 : -30) - minTDist * 0.04 + (pDist < 65 ? -40 : 15);
        cands.push({
          move: { type: 'place', x: cx, y: cy },
          score,
        });
      }
    }
  }

  const safe = pool.findSafeCueSpot(state.balls, posOpts);
  cands.push({
    move: { type: 'place', x: safe.x, y: safe.y },
    score: -80,
  });

  const chosen = pickFor(state, cands, PICK);
  if (chosen && pool.isValidCuePos(state.balls, chosen.x, chosen.y, posOpts)) {
    return chosen;
  }
  return { type: 'place', x: safe.x, y: safe.y };
}

function chooseBreakShot(state) {
  const cue = state.balls.find((b) => b && b.id === 0 && !b.potted);
  if (!cue) return { type: 'shot', angle: 0, power: 0.9, spinX: 0, spinY: 0 };
  const baseAngle = Math.atan2(FOOT_SPOT_Y - cue.y, FOOT_SPOT_X - cue.x);
  const candidates = [
    { angle: baseAngle, power: 1.0, spinX: 0, spinY: 0 },
    { angle: baseAngle - 0.01, power: 1.0, spinX: 0, spinY: 0 },
    { angle: baseAngle + 0.01, power: 1.0, spinX: 0, spinY: 0 },
    { angle: baseAngle - 0.03, power: 1.0, spinX: 0, spinY: 0 },
    { angle: baseAngle + 0.03, power: 1.0, spinX: 0, spinY: 0 },
    { angle: baseAngle, power: 0.92, spinX: 0, spinY: 0 },
  ];

  const cands = candidates.map((c) => {
    const sim = pool.simulateShot(state.balls, c.angle, c.power, {
      recordFrames: false,
      spinX: c.spinX,
      spinY: c.spinY,
      isBreak: true,
    });
    const scratched = sim.potted.includes(0);
    const pottedObj = sim.potted.filter((id) => id !== 0).length;
    const objRailHits = (sim.railHits || []).filter((id) => id !== 0).length;
    const legalBreak = pottedObj >= 1 || objRailHits >= 4;
    let spread = 0;
    for (let i = 0; i < sim.balls.length; i++) {
      const b = sim.balls[i];
      if (!b.potted && b.id !== 0) {
        spread += Math.hypot(b.x - FOOT_SPOT_X, b.y - FOOT_SPOT_Y);
      }
    }
    const score =
      pottedObj * 180 +
      (!legalBreak ? -350 : 0) +
      (scratched ? -220 : 0) +
      (sim.firstHit === null ? -250 : 25) +
      spread * 0.02;
    return {
      move: { type: 'shot', angle: c.angle, power: c.power, spinX: c.spinX, spinY: c.spinY },
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
  const pottedAnyObj = sim.potted.some((id) => id !== 0);
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
  if (!foul && !pottedAnyObj && !sim.railAfterContact) {
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
  const firstHitGroup = sim.firstHit !== null ? ballType(sim.firstHit) : null;
  for (let i = 0; i < sim.potted.length; i++) {
    const id = sim.potted[i];
    if (id === 0 || id === 8) continue;
    const bt = ballType(id);
    if (myGroup ? bt === myGroup : bt === firstHitGroup) ownPotted++;
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
  if (!cue) return { type: 'shot', angle: 0, power: 0.5, spinX: 0, spinY: 0 };

  const targets = legalTargetBalls(state, playerIndex);
  if (targets.length === 0) return { type: 'shot', angle: 0, power: 0.5, spinX: 0, spinY: 0 };

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
    shotList.push({ angle: ang, power: 0.55 });
    shotList.push({ angle: ang, power: 0.75 });
  }

  const capped = shotList.slice(0, 40);
  const cands = capped.map((c) => {
    const sx = clamp(Number(c.spinX) || 0, -1, 1);
    const sy = clamp(Number(c.spinY) || 0, -1, 1);
    const sim = pool.simulateShot(state.balls, c.angle, c.power, { recordFrames: false, spinX: sx, spinY: sy });
    return {
      move: { type: 'shot', angle: c.angle, power: c.power, spinX: sx, spinY: sy },
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
      spinX: clamp(Number(chosen.spinX) || 0, -1, 1),
      spinY: clamp(Number(chosen.spinY) || 0, -1, 1),
    };
  }
  const fallbackAngle = Math.atan2(sortedTargets[0].y - cue.y, sortedTargets[0].x - cue.x);
  return { type: 'shot', angle: Number.isFinite(fallbackAngle) ? fallbackAngle : 0, power: 0.55, spinX: 0, spinY: 0 };
}

// ---- Snooker Bot ----

function chooseSnookerBallInHand(state) {
  const targets = snooker.getBallsOn(state);
  const cands = [];
  const br = SNOOKER_TABLE.BALL_R;
  const distances = [90, 160, 240];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    for (let k = 0; k < SNOOKER_TABLE.POCKETS.length; k++) {
      const p = SNOOKER_TABLE.POCKETS[k];
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
        if (!snooker.isValidSnookerCuePos(state.balls, cx, cy)) continue;
        const clearCue = isSegmentClear(state.balls, cx, cy, t.x, t.y, t.id, -1, br);
        const clearPocket = isSegmentClear(state.balls, t.x, t.y, p.x, p.y, t.id, -1, br);
        const pDist = minPocketDist(cx, cy, SNOOKER_TABLE.POCKETS);
        const score =
          (clearCue ? 140 : -40) +
          (clearPocket ? 150 : -50) -
          distTP * 0.14 -
          behind * 0.06 +
          (pDist < 55 ? -60 : 20);
        cands.push({
          move: { type: 'place', x: cx, y: cy },
          score,
        });
      }
    }
  }

  const dSpots = [
    [250, 220], [250, 260], [250, 300], [250, 340], [250, 380],
    [215, 235], [215, 270], [215, 300], [215, 330], [215, 365],
    [180, 265], [180, 300], [180, 335],
  ];
  for (let s = 0; s < dSpots.length; s++) {
    const cx = dSpots[s][0];
    const cy = dSpots[s][1];
    if (!snooker.isValidSnookerCuePos(state.balls, cx, cy)) continue;
    let hasClear = false;
    let minTDist = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const d = Math.hypot(t.x - cx, t.y - cy);
      if (d < minTDist) minTDist = d;
      if (isSegmentClear(state.balls, cx, cy, t.x, t.y, t.id, -1, br)) {
        hasClear = true;
      }
    }
    const pDist = minPocketDist(cx, cy, SNOOKER_TABLE.POCKETS);
    const score = (hasClear ? 45 : -30) - minTDist * 0.03 + (pDist < 55 ? -40 : 15);
    cands.push({
      move: { type: 'place', x: cx, y: cy },
      score,
    });
  }

  const safe = snooker.findSafeSnookerCueSpot(state.balls);
  cands.push({
    move: { type: 'place', x: safe.x, y: safe.y },
    score: -80,
  });

  const chosen = pickFor(state, cands, PICK);
  if (chosen && snooker.isValidSnookerCuePos(state.balls, chosen.x, chosen.y)) {
    return chosen;
  }
  return { type: 'place', x: safe.x, y: safe.y };
}

function scoreSnookerSim(state, sim, targetName) {
  const targetVal = snooker.COLOUR_VALUES[targetName] || 1;
  const scratched = sim.potted.includes(0);
  const wrongFirstHit = sim.firstHit !== null && snooker.snookerBallType(sim.firstHit) !== targetName;
  const wrongPotted = sim.potted.filter((id) => id !== 0 && snooker.snookerBallType(id) !== targetName);
  const foul = scratched || sim.firstHit === null || wrongFirstHit || wrongPotted.length > 0;

  let maxInvolved = targetVal;
  if (sim.firstHit !== null) maxInvolved = Math.max(maxInvolved, snooker.snookerBallValue(sim.firstHit));
  for (let i = 0; i < sim.potted.length; i++) {
    maxInvolved = Math.max(maxInvolved, snooker.snookerBallValue(sim.potted[i]));
  }
  const foulPoints = foul ? Math.max(4, maxInvolved) : 0;

  const wasOnlyBlackLeft =
    state.ballOn === 'black' &&
    snooker.countReds(state.balls) === 0 &&
    !state.balls.some((b) => b && !b.potted && b.id >= 16 && b.id <= 20);
  if (wasOnlyBlackLeft) {
    if (!foul && sim.potted.includes(21)) return 1200;
    if (foul) return -1200;
  }

  if (foul) {
    return -260 - foulPoints * 25;
  }

  const pottedTargets = sim.potted.filter((id) => id !== 0 && snooker.snookerBallType(id) === targetName);
  const cueAfter = sim.balls.find((b) => b.id === 0);

  if (pottedTargets.length > 0) {
    let pts = 0;
    for (let i = 0; i < pottedTargets.length; i++) {
      pts += snooker.snookerBallValue(pottedTargets[i]);
    }
    let score = 180 + pts * 35;
    if (cueAfter && !cueAfter.potted) {
      score += minPocketDist(cueAfter.x, cueAfter.y, SNOOKER_TABLE.POCKETS) > 50 ? 15 : -15;
    }
    return score;
  }

  // Clean non-pot: prefer safe shots leaving cue ball far from reds (or next ball on) and near baulk
  let score = 30;
  if (cueAfter && !cueAfter.potted) {
    const dangerBalls = sim.balls.filter((b) => b && !b.potted && b.id >= 1 && b.id <= 15);
    const refBalls = dangerBalls.length > 0
      ? dangerBalls
      : sim.balls.filter((b) => b && !b.potted && b.id !== 0);
    if (refBalls.length > 0) {
      let minDist = Infinity;
      let maxRefX = 0;
      for (let i = 0; i < refBalls.length; i++) {
        const rb = refBalls[i];
        const d = Math.hypot(rb.x - cueAfter.x, rb.y - cueAfter.y);
        if (d < minDist) minDist = d;
        if (rb.x > maxRefX) maxRefX = rb.x;
      }
      score += clamp(minDist * 0.14, 0, 95);
      if (dangerBalls.length > 0 && maxRefX > 600 && cueAfter.x < SNOOKER_TABLE.BAULK_X + 70) {
        score += 25;
      }
    }
    score += minPocketDist(cueAfter.x, cueAfter.y, SNOOKER_TABLE.POCKETS) > 45 ? 10 : -20;
  }

  return score;
}

function chooseSnookerBreakShot(state) {
  const cue = state.balls.find((b) => b && b.id === 0 && !b.potted);
  if (!cue) return { type: 'shot', angle: 0, power: 0.65, spinX: 0, spinY: 0 };

  const edgeTargets = [
    { x: 965, y: 256 },
    { x: 970, y: 344 },
    { x: 945, y: 274 },
    { x: 945, y: 326 },
    { x: 924, y: 300 },
  ];
  const powers = [0.58, 0.72];
  const rawCands = [];
  for (let i = 0; i < edgeTargets.length; i++) {
    const ang = Math.atan2(edgeTargets[i].y - cue.y, edgeTargets[i].x - cue.x);
    for (let j = 0; j < powers.length; j++) {
      rawCands.push({ angle: ang, power: powers[j] });
    }
  }

  const cands = rawCands.map((c) => {
    const sim = pool.simulateShot(state.balls, c.angle, c.power, {
      recordFrames: false,
      spinX: 0,
      spinY: 0,
      table: SNOOKER_TABLE,
      ballType: snooker.snookerBallType,
      isBreak: true,
    });
    return {
      move: { type: 'shot', angle: c.angle, power: c.power, spinX: 0, spinY: 0 },
      score: scoreSnookerSim(state, sim, 'red'),
    };
  });

  return pickFor(state, cands, PICK);
}

function chooseSnookerShot(state) {
  const cue = state.balls.find((b) => b && b.id === 0 && !b.potted);
  const targets = snooker.getBallsOn(state);
  const needNominate = state.ballOn === 'colour';
  const fallbackNom = needNominate && targets.length > 0 ? targets[0].type : undefined;

  if (!cue || targets.length === 0) {
    const mv = { type: 'shot', angle: 0, power: 0.5, spinX: 0, spinY: 0 };
    if (fallbackNom) mv.nominate = fallbackNom;
    return mv;
  }

  const br = SNOOKER_TABLE.BALL_R;
  const pocketCands = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    for (let k = 0; k < SNOOKER_TABLE.POCKETS.length; k++) {
      const p = SNOOKER_TABLE.POCKETS[k];
      const dxTP = p.x - t.x;
      const dyTP = p.y - t.y;
      const distTP = Math.hypot(dxTP, dyTP);
      if (distTP < 1) continue;
      const uxTP = dxTP / distTP;
      const uyTP = dyTP / distTP;

      const gx = t.x - uxTP * (2 * br);
      const gy = t.y - uyTP * (2 * br);
      if (gx < br - 2 || gx > SNOOKER_TABLE.W - br + 2 || gy < br - 2 || gy > SNOOKER_TABLE.H - br + 2) continue;

      const dxCG = gx - cue.x;
      const dyCG = gy - cue.y;
      const distCG = Math.hypot(dxCG, dyCG);
      if (distCG < 1) continue;

      const cosCut = (dxCG * dxTP + dyCG * dyTP) / (distCG * distTP);
      if (cosCut < 0.22) continue;

      const angle = Math.atan2(dyCG, dxCG);
      const power = clamp(0.26 + (distCG + distTP) / 1650, 0.26, 0.92);
      const clearCG = isSegmentClear(state.balls, cue.x, cue.y, gx, gy, t.id, -1, br);
      const clearTP = isSegmentClear(state.balls, t.x, t.y, p.x, p.y, t.id, -1, br);
      const heur =
        (clearCG ? 200 : 0) +
        (clearTP ? 200 : 0) +
        cosCut * 120 -
        (distCG + distTP) * 0.13 +
        (needNominate ? (t.value || 1) * 18 : 0);

      pocketCands.push({ angle, power, heur, targetType: t.type });
    }
  }

  pocketCands.sort((a, b) => b.heur - a.heur);

  const shotList = [];
  const topExact = Math.min(16, pocketCands.length);
  for (let i = 0; i < topExact; i++) {
    shotList.push({
      angle: pocketCands[i].angle,
      power: pocketCands[i].power,
      targetType: pocketCands[i].targetType,
    });
  }

  const topNoisy = Math.min(3, pocketCands.length);
  const offsets = [-0.04, 0.04];
  for (let i = 0; i < topNoisy; i++) {
    const base = pocketCands[i];
    for (let j = 0; j < offsets.length; j++) {
      shotList.push({
        angle: base.angle + offsets[j],
        power: base.power,
        targetType: base.targetType,
      });
    }
  }

  // Safety / escape shots on nearest targets (soft taps, thin clips, 1-cushion escapes)
  const sortedTargets = targets
    .slice()
    .sort((a, b) => {
      const da = (a.x - cue.x) * (a.x - cue.x) + (a.y - cue.y) * (a.y - cue.y);
      const db = (b.x - cue.x) * (b.x - cue.x) + (b.y - cue.y) * (b.y - cue.y);
      return da - db;
    });
  const directCount = Math.min(4, sortedTargets.length);
  for (let i = 0; i < directCount; i++) {
    const t = sortedTargets[i];
    const ang = Math.atan2(t.y - cue.y, t.x - cue.x);
    shotList.push({ angle: ang, power: 0.24, targetType: t.type });
    shotList.push({ angle: ang, power: 0.36, targetType: t.type });
    shotList.push({ angle: ang, power: 0.55, targetType: t.type });
    shotList.push({ angle: ang + 0.055, power: 0.45, targetType: t.type });
    shotList.push({ angle: ang - 0.055, power: 0.45, targetType: t.type });
  }
  if (sortedTargets.length > 0) {
    const t0 = sortedTargets[0];
    const bankTopY = 2 * br - t0.y;
    const bankBotY = 2 * (SNOOKER_TABLE.H - br) - t0.y;
    shotList.push({ angle: Math.atan2(bankTopY - cue.y, t0.x - cue.x), power: 0.52, targetType: t0.type });
    shotList.push({ angle: Math.atan2(bankBotY - cue.y, t0.x - cue.x), power: 0.52, targetType: t0.type });
  }

  const capped = shotList.slice(0, 42);
  const cands = capped.map((c) => {
    const targetName = needNominate ? c.targetType : state.ballOn;
    const sim = pool.simulateShot(state.balls, c.angle, c.power, {
      recordFrames: false,
      spinX: 0,
      spinY: 0,
      table: SNOOKER_TABLE,
      ballType: snooker.snookerBallType,
    });
    const mv = { type: 'shot', angle: c.angle, power: c.power, spinX: 0, spinY: 0 };
    if (needNominate) mv.nominate = c.targetType;
    return {
      move: mv,
      score: scoreSnookerSim(state, sim, targetName),
    };
  });

  const chosen = pickFor(state, cands, PICK);
  if (
    chosen &&
    chosen.type === 'shot' &&
    Number.isFinite(chosen.angle) &&
    Number.isFinite(chosen.power)
  ) {
    const mv = {
      type: 'shot',
      angle: chosen.angle,
      power: clamp(chosen.power, SNOOKER_TABLE.MIN_POWER, SNOOKER_TABLE.MAX_POWER),
      spinX: clamp(Number(chosen.spinX) || 0, -1, 1),
      spinY: clamp(Number(chosen.spinY) || 0, -1, 1),
    };
    if (needNominate) {
      mv.nominate = chosen.nominate || fallbackNom;
    }
    return mv;
  }

  const fallbackAngle = Math.atan2(sortedTargets[0].y - cue.y, sortedTargets[0].x - cue.x);
  const fb = {
    type: 'shot',
    angle: Number.isFinite(fallbackAngle) ? fallbackAngle : 0,
    power: 0.5,
    spinX: 0,
    spinY: 0,
  };
  if (needNominate) fb.nominate = fallbackNom;
  return fb;
}

function createBot(playerIndex) {
  return {
    getMove(state, seatArg) {
      if (!state || state.phase === 'over' || state.winner !== null) return null;
      const idx = typeof seatArg === 'number' ? seatArg : playerIndex;
      if (state.variant === 'snooker') {
        if (state.phase === 'ball_in_hand') {
          return chooseSnookerBallInHand(state);
        }
        if (state.phase === 'shoot') {
          if (state.isBreak) return chooseSnookerBreakShot(state);
          return chooseSnookerShot(state);
        }
        return null;
      }
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
