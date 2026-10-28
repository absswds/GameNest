// bots/lib/difficulty.js
// Read difficulty option from state and map to depth or heuristic behavior.

function getDifficulty(state) {
  return (state && state._options && state._options.difficulty) || 'normal';
}

function getDepth(state, depthMap) {
  const d = state && state._options && state._options.botDepth;
  if (Number.isInteger(d) && d > 0) return d;
  const diff = getDifficulty(state);
  return depthMap[diff] || depthMap.normal || 3;
}

function isEasy(state) {
  return getDifficulty(state) === 'easy';
}

function isHard(state) {
  return getDifficulty(state) === 'hard';
}

function maybeBlunder(diff, blunderProb, bestAction, fallbackAction) {
  if (diff === 'easy' && Math.random() < blunderProb) {
    return typeof fallbackAction === 'function' ? fallbackAction() : fallbackAction;
  }
  return typeof bestAction === 'function' ? bestAction() : bestAction;
}

// Stockfish-skill-style move choice. cands = [{move, score}] (higher is better).
// hard: best (ties random). random: uniform over all cands.
// easy/normal: softmax over scores with a temperature, never worse than best - maxLoss.
function pickByDifficulty(cands, diff, opts) {
  if (!cands || !cands.length) return null;
  opts = opts || {};
  const rnd = opts.random || Math.random;
  if (diff === 'random') return cands[Math.floor(rnd() * cands.length)].move;
  let best = -Infinity;
  for (const c of cands) if (c.score > best) best = c.score;
  if (diff === 'hard') {
    const top = cands.filter((c) => c.score >= best - 1e-9);
    return top[Math.floor(rnd() * top.length)].move;
  }
  const temp = Object.assign({ easy: 60, normal: 15 }, opts.temp)[diff] || 15;
  const explicitMaxLoss = opts.maxLoss && opts.maxLoss[diff];
  const lossK = opts.lossK && opts.lossK[diff];
  const maxLoss = explicitMaxLoss !== undefined
    ? explicitMaxLoss
    : (typeof lossK === 'number' && !Number.isNaN(lossK)
      ? lossK * temp
      : { easy: 250, normal: 40 }[diff]);
  const pool = cands.filter((c) => c.score >= best - (maxLoss === undefined ? 40 : maxLoss));
  const ws = pool.map((c) => Math.exp((c.score - best) / temp));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i].move; }
  return pool[pool.length - 1].move;
}

function pickFor(state, cands, opts) {
  const diff = getDifficulty(state);
  const o = (state && state._options) || {};
  const hasTemp = typeof o.botTemp === 'number' && Number.isFinite(o.botTemp) && o.botTemp > 0;
  const hasMaxLoss = typeof o.botMaxLoss === 'number' && !Number.isNaN(o.botMaxLoss);
  const hasLossK = typeof o.botLossK === 'number' && Number.isFinite(o.botLossK) && o.botLossK > 0;
  if (!hasTemp && !hasMaxLoss && !hasLossK) return pickByDifficulty(cands, diff, opts);
  const opts2 = Object.assign({}, opts);
  if (hasTemp) opts2.temp = Object.assign({}, opts && opts.temp, { [diff]: o.botTemp });
  if (hasLossK) {
    opts2.lossK = Object.assign({}, opts && opts.lossK, { [diff]: o.botLossK });
    if (!hasMaxLoss && opts2.maxLoss) {
      opts2.maxLoss = Object.assign({}, opts.maxLoss, { [diff]: undefined });
    }
  }
  if (hasMaxLoss) opts2.maxLoss = Object.assign({}, opts && opts.maxLoss, { [diff]: o.botMaxLoss });
  return pickByDifficulty(cands, diff, opts2);
}

module.exports = { getDepth, getDifficulty, isEasy, isHard, maybeBlunder, pickByDifficulty, pickFor };
