// bots/numberbomb.js — Number Bomb AI with easy, normal, and hard difficulties
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'numberbomb';

// Hard: the bomb is uniform in [low, high], so a guess g in a range of m numbers kills with probability 1/m and
// otherwise hands the next player a range of g-1 or m-g numbers. Whoever is left with one number dies, so the
// seat/parity matters. best[n][m] is the 1-based guess that minimises our own chance of dying this round
// when n players are alive and the other n-1 either split the range in the middle (normal bots) or guess at random (easy bots).
const MID_W = 0.8;
const tables = {};
function bestTable(n, M) {
  if (tables[n] && tables[n].M >= M) return tables[n].best;
  const R = [null]; // R[m][k]: our death probability, k turns before ours
  const best = [null];
  R[1] = new Array(n).fill(0); R[1][0] = 1;
  for (let m = 2; m <= M; m++) {
    const r = new Array(n).fill(0);
    const gm = Math.ceil(m / 2);
    for (let k = 1; k < n; k++) {
      let v = 0;
      for (let g = 1; g <= m; g++) {
        const w = (g === gm ? MID_W : 0) + (1 - MID_W) / m; // opponent: midpoint, else uniform random
        const a = g - 1, b = m - g;
        if (a) v += w * (a / m) * R[a][k - 1];
        if (b) v += w * (b / m) * R[b][k - 1];
      }
      r[k] = v;
    }
    let bv = Infinity, bg = Math.ceil(m / 2);
    for (let x = 1; x <= m; x++) {
      const xa = x - 1, xb = m - x;
      let v = 1 / m;
      if (xa) v += (xa / m) * R[xa][n - 1];
      if (xb) v += (xb / m) * R[xb][n - 1];
      if (v < bv - 1e-12) { bv = v; bg = x; }
    }
    r[0] = bv; R[m] = r; best[m] = bg;
  }
  tables[n] = { M, best };
  return best;
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const low = state.low;
    const high = state.high;
    if (low >= high) return { guess: low };

    const diff = getDifficulty(state);

    if (diff === 'easy') {
      // Easy: guesses randomly in the remaining inclusive range [low, high]
      return { guess: low + Math.floor(Math.random() * (high - low + 1)) };
    }

    if (diff === 'hard') {
      const n = Math.max(2, (state.lives || []).filter((l) => l > 0).length);
      const best = bestTable(n, Math.max(100, high - low + 1));
      return { guess: low + best[high - low + 1] - 1 };
    }

    // Normal: midpoint
    return { guess: Math.floor((low + high) / 2) };
  },
});
