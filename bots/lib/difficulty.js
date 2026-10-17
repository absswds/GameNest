// bots/lib/difficulty.js
// Read difficulty option from state and map to depth or heuristic behavior.

function getDifficulty(state) {
  return (state && state._options && state._options.difficulty) || 'normal';
}

function getDepth(state, depthMap) {
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
// hard: best (ties random). easy/normal: softmax over scores with a temperature, never worse than best - maxLoss.
function pickByDifficulty(cands, diff, opts) {
  if (!cands || !cands.length) return null;
  opts = opts || {};
  const rnd = opts.random || Math.random;
  let best = -Infinity;
  for (const c of cands) if (c.score > best) best = c.score;
  if (diff === 'hard') {
    const top = cands.filter((c) => c.score >= best - 1e-9);
    return top[Math.floor(rnd() * top.length)].move;
  }
  const temp = Object.assign({ easy: 60, normal: 15 }, opts.temp)[diff] || 15;
  const maxLoss = Object.assign({ easy: 250, normal: 40 }, opts.maxLoss)[diff];
  const pool = cands.filter((c) => c.score >= best - (maxLoss === undefined ? 40 : maxLoss));
  const ws = pool.map((c) => Math.exp((c.score - best) / temp));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i].move; }
  return pool[pool.length - 1].move;
}

module.exports = { getDepth, getDifficulty, isEasy, isHard, maybeBlunder, pickByDifficulty };
