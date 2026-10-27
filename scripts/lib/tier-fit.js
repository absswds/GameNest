'use strict';

function logit(p) {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  return Math.log(q / (1 - q));
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function eloTargetLogit(target, steps) {
  return steps * logit(target);
}

function wilson(score, n, z = 1.96) {
  if (!(n > 0)) return { lo: 0, hi: 1 };
  const p = Math.min(1, Math.max(0, score / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lo: Math.max(0, center - half),
    hi: Math.min(1, center + half),
  };
}

function fitLogistic(points) {
  if (!Array.isArray(points) || points.length === 0 || points.some((pt) => !pt || !(pt.n > 0))) {
    return { a: 0, b: 0, ok: false };
  }
  const ridge = 1e-6;
  let a = 0;
  let b = 0;
  let ok = false;
  for (let it = 0; it < 50; it++) {
    let ga = -ridge * a;
    let gb = -ridge * b;
    let haa = ridge;
    let hab = 0;
    let hbb = ridge;
    for (const pt of points) {
      const p = sigmoid(a + b * pt.x);
      const diff = pt.score - pt.n * p;
      const w = pt.n * p * (1 - p);
      ga += diff;
      gb += diff * pt.x;
      haa += w;
      hab += w * pt.x;
      hbb += w * pt.x * pt.x;
    }
    const det = haa * hbb - hab * hab;
    if (!(det > 0) || !Number.isFinite(det)) return { a, b, ok: false };
    const da = (hbb * ga - hab * gb) / det;
    const db = (haa * gb - hab * ga) / det;
    a += da;
    b += db;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { a: 0, b: 0, ok: false };
    if (Math.hypot(da, db) < 1e-9) {
      ok = true;
      break;
    }
  }
  return { a, b, ok };
}

function solveX(fit, targetLogit) {
  if (!fit || fit.ok === false || !(fit.b > 1e-6)) return null;
  return (targetLogit - fit.a) / fit.b;
}

function pavDecreasing(values, weights) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const blocks = [];
  for (let i = 0; i < values.length; i++) {
    const w = weights && weights[i] > 0 ? weights[i] : 1;
    blocks.push({ sumW: w, sumWV: w * values[i], count: 1 });
    while (blocks.length >= 2) {
      const prev = blocks[blocks.length - 2];
      const curr = blocks[blocks.length - 1];
      if (prev.sumWV / prev.sumW < curr.sumWV / curr.sumW) {
        prev.sumW += curr.sumW;
        prev.sumWV += curr.sumWV;
        prev.count += curr.count;
        blocks.pop();
      } else {
        break;
      }
    }
  }
  const out = [];
  for (const b of blocks) {
    const mean = b.sumWV / b.sumW;
    for (let k = 0; k < b.count; k++) out.push(mean);
  }
  return out;
}

module.exports = {
  logit,
  sigmoid,
  eloTargetLogit,
  wilson,
  fitLogistic,
  solveX,
  pavDecreasing,
};
