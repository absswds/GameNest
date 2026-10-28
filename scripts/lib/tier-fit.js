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

function pickInitialDepth(entries, targetRate) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  for (const e of entries) {
    if (e.winRate <= targetRate) return e.depth;
  }
  return entries[entries.length - 1].depth;
}

function pickClosestDepth(entries, targetRate) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  let bestDepth = entries[0].depth;
  let bestDist = Math.abs(entries[0].winRate - targetRate);
  for (let i = 1; i < entries.length; i++) {
    const d = Math.abs(entries[i].winRate - targetRate);
    if (d < bestDist - 1e-12) {
      bestDist = d;
      bestDepth = entries[i].depth;
    }
  }
  return bestDepth;
}

function evalEntryReachability(entry, targetRate, opts) {
  opts = opts || {};
  const tlo = opts.tlo !== undefined ? opts.tlo : 1;
  const thi = opts.thi !== undefined ? opts.thi : 2000;
  const targetLogit = logit(targetRate);
  if (entry && entry.fit) {
    const xStar = solveX(entry.fit, targetLogit);
    const rawT = xStar !== null ? Math.exp(xStar) : null;
    if (rawT !== null && rawT >= tlo && rawT <= thi) {
      return { reachable: true, bestRate: targetRate };
    }
    if (rawT !== null) {
      const clampedT = Math.min(thi, Math.max(tlo, rawT));
      return { reachable: false, bestRate: sigmoid(entry.fit.a + entry.fit.b * Math.log(clampedT)) };
    }
    const pLo = sigmoid(entry.fit.a + entry.fit.b * Math.log(tlo));
    const pHi = sigmoid(entry.fit.a + entry.fit.b * Math.log(thi));
    const bestRate = Math.abs(pLo - targetRate) <= Math.abs(pHi - targetRate) ? pLo : pHi;
    return { reachable: false, bestRate };
  }
  const hi = entry && typeof entry.maxWinRate === 'number'
    ? entry.maxWinRate
    : (typeof opts.maxWinRate === 'number' ? opts.maxWinRate : undefined);
  if (typeof hi === 'number') {
    const lo = typeof entry.winRate === 'number' ? entry.winRate : hi;
    const minR = Math.min(lo, hi);
    const maxR = Math.max(lo, hi);
    if (targetRate >= minR && targetRate <= maxR) {
      return { reachable: true, bestRate: targetRate };
    }
    const bestRate = Math.abs(lo - targetRate) <= Math.abs(hi - targetRate) ? lo : hi;
    return { reachable: false, bestRate };
  }
  const rate = entry && typeof entry.winRate === 'number' ? entry.winRate : 0.5;
  return { reachable: false, bestRate: rate };
}

function chooseDepthWithFallback(entries, targetRate, opts) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { depth: null, candidateDepth: null, fallback: false, reason: 'no depths' };
  }
  opts = opts || {};
  let candIdx = entries.findIndex((e) => e.winRate <= targetRate);
  if (candIdx < 0) candIdx = entries.length - 1;
  const cand = entries[candIdx];
  const candEval = evalEntryReachability(cand, targetRate, opts);
  if (candEval.reachable) {
    return {
      depth: cand.depth,
      candidateDepth: cand.depth,
      fallback: false,
      candidateRate: candEval.bestRate,
      chosenRate: candEval.bestRate,
      reason: 'target ' + (targetRate * 100).toFixed(1) + '% reachable at candidate d=' + cand.depth,
    };
  }
  if (candIdx === 0) {
    return {
      depth: cand.depth,
      candidateDepth: cand.depth,
      fallback: false,
      candidateRate: candEval.bestRate,
      chosenRate: candEval.bestRate,
      reason: 'target ' + (targetRate * 100).toFixed(1) + '% unreachable at shallowest d=' + cand.depth +
        ' (best ' + (candEval.bestRate * 100).toFixed(1) + '%)',
    };
  }
  const shallow = entries[candIdx - 1];
  const shallowEval = evalEntryReachability(shallow, targetRate, {});
  const candDist = Math.abs(candEval.bestRate - targetRate);
  const shallowDist = Math.abs(shallowEval.bestRate - targetRate);
  if (shallowDist <= candDist + 1e-12) {
    return {
      depth: shallow.depth,
      candidateDepth: cand.depth,
      fallback: true,
      candidateRate: candEval.bestRate,
      chosenRate: shallowEval.bestRate,
      reason: 'candidate d=' + cand.depth + ' maxes at ' + (candEval.bestRate * 100).toFixed(1) +
        '% vs target ' + (targetRate * 100).toFixed(1) + '%; shallower d=' + shallow.depth +
        ' (' + (shallowEval.bestRate * 100).toFixed(1) + '%) is closer',
    };
  }
  return {
    depth: cand.depth,
    candidateDepth: cand.depth,
    fallback: false,
    candidateRate: candEval.bestRate,
    chosenRate: candEval.bestRate,
    reason: 'candidate d=' + cand.depth + ' (' + (candEval.bestRate * 100).toFixed(1) +
      '%) is closer to target ' + (targetRate * 100).toFixed(1) + '% than shallower d=' +
      shallow.depth + ' (' + (shallowEval.bestRate * 100).toFixed(1) + '%)',
  };
}

module.exports = {
  logit,
  sigmoid,
  eloTargetLogit,
  wilson,
  fitLogistic,
  solveX,
  pavDecreasing,
  pickInitialDepth,
  pickClosestDepth,
  chooseDepthWithFallback,
};
