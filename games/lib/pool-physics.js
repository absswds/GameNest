// games/lib/pool-physics.js — Shared deterministic 2D billiards physics
'use strict';

const DEFAULT_TABLE = {
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

function defaultBallType(id) {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  if (id >= 1 && id <= 7) return 'solid';
  return 'stripe';
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
  const table = (opts && opts.table) || DEFAULT_TABLE;
  const getBallType = (opts && opts.ballType) || defaultBallType;
  const recordFrames = opts && opts.recordFrames !== undefined ? !!opts.recordFrames : true;
  let cueSpinX = Math.max(-1, Math.min(1, Number(opts && opts.spinX) || 0));
  let cueSpinY = Math.max(-1, Math.min(1, Number(opts && opts.spinY) || 0));
  let cueSpinYApplied = false;
  const K_SPIN_FOLLOW = 0.42;
  const K_SPIN_RAIL = 0.45;

  const simBalls = balls.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: 0,
    vy: 0,
    potted: !!b.potted,
    type: b.type || getBallType(b.id),
    value: b.value,
  }));

  const clampedPower = Math.max(0, Math.min(table.MAX_POWER, Number(power) || 0));
  const cue = simBalls.find((b) => b.id === 0);
  if (cue && !cue.potted) {
    cue.vx = Math.cos(angle) * clampedPower * table.MAX_SPEED;
    cue.vy = Math.sin(angle) * clampedPower * table.MAX_SPEED;
  }

  let firstHit = null;
  const potted = [];
  const frames = recordFrames ? [encodeFrame(simBalls)] : [];
  let ticks = 0;

  const { W, H, BALL_R, FRICTION, STOP_SPEED, E_BALL, E_RAIL, DT, MAX_TICKS, FRAME_STRIDE, POCKETS } = table;
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
        if (b.vx < 0) {
          const imp = Math.abs(b.vx);
          b.vx *= -E_RAIL;
          if (b.id === 0) {
            if (cueSpinX !== 0) {
              b.vy -= cueSpinX * imp * K_SPIN_RAIL;
              cueSpinX *= 0.45;
            }
            if (cueSpinY !== 0) cueSpinY *= 0.7;
          }
        }
      } else if (b.x > W - BALL_R) {
        b.x = W - BALL_R;
        if (b.vx > 0) {
          const imp = Math.abs(b.vx);
          b.vx *= -E_RAIL;
          if (b.id === 0) {
            if (cueSpinX !== 0) {
              b.vy += cueSpinX * imp * K_SPIN_RAIL;
              cueSpinX *= 0.45;
            }
            if (cueSpinY !== 0) cueSpinY *= 0.7;
          }
        }
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (b.vy < 0) {
          const imp = Math.abs(b.vy);
          b.vy *= -E_RAIL;
          if (b.id === 0) {
            if (cueSpinX !== 0) {
              b.vx += cueSpinX * imp * K_SPIN_RAIL;
              cueSpinX *= 0.45;
            }
            if (cueSpinY !== 0) cueSpinY *= 0.7;
          }
        }
      } else if (b.y > H - BALL_R) {
        b.y = H - BALL_R;
        if (b.vy > 0) {
          const imp = Math.abs(b.vy);
          b.vy *= -E_RAIL;
          if (b.id === 0) {
            if (cueSpinX !== 0) {
              b.vx -= cueSpinX * imp * K_SPIN_RAIL;
              cueSpinX *= 0.45;
            }
            if (cueSpinY !== 0) cueSpinY *= 0.7;
          }
        }
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
              const cueBall = a.id === 0 ? a : (b.id === 0 ? b : null);
              let preSpd = 0;
              let dirX = 0;
              let dirY = 0;
              let cutFactor = 0;
              if (cueBall && !cueSpinYApplied && cueSpinY !== 0) {
                preSpd = Math.hypot(cueBall.vx, cueBall.vy);
                if (preSpd > 1e-6) {
                  dirX = cueBall.vx / preSpd;
                  dirY = cueBall.vy / preSpd;
                  cutFactor = Math.abs(dirX * nx + dirY * ny);
                }
              }

              const imp = -(1 + E_BALL) * vn * 0.5;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              b.vx += imp * nx;
              b.vy += imp * ny;

              if (cueBall && !cueSpinYApplied && cueSpinY !== 0 && preSpd > 1e-6) {
                const deltaV = cueSpinY * preSpd * K_SPIN_FOLLOW * (0.35 + 0.65 * cutFactor);
                cueBall.vx += dirX * deltaV;
                cueBall.vy += dirY * deltaV;
                cueSpinYApplied = true;
                cueSpinY = 0;
              }
              if (cueBall && cueSpinX !== 0) {
                cueSpinX *= 0.8;
              }
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

  const outBalls = simBalls.map((b) => {
    const out = {
      id: b.id,
      x: b.x,
      y: b.y,
      potted: b.potted,
      type: b.type,
    };
    if (b.value !== undefined) out.value = b.value;
    return out;
  });

  if (recordFrames) {
    const finalFrame = encodeFrame(simBalls);
    if (!framesEqual(frames[frames.length - 1], finalFrame)) {
      if (frames.length < MAX_FRAMES) frames.push(finalFrame);
      else frames[frames.length - 1] = finalFrame;
    }
  }

  return { balls: outBalls, firstHit, potted, frames, ticks };
}

function isValidBallSpot(balls, x, y, ignoreBallId, table) {
  const t = table || DEFAULT_TABLE;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const minX = t.BALL_R + 1;
  const maxX = t.W - t.BALL_R - 1;
  const minY = t.BALL_R + 1;
  const maxY = t.H - t.BALL_R - 1;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;

  const minDist = 2 * t.BALL_R + 1;
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

module.exports = {
  DEFAULT_TABLE,
  MAX_FRAMES,
  round1,
  encodeFrame,
  framesEqual,
  simulateShot,
  isValidBallSpot,
};
