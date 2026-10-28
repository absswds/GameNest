// bots/numberbomb.js — Number Bomb AI with candidate scoring
const { botName } = require('./lib/bot-name');
const { pickFor, isHard } = require('./lib/difficulty');

exports.name = 'numberbomb';

// Provisional values; will be set by scripts/bot-tier-eval.js --calibrate
const PICK = { temp: { easy: 80, normal: 15 }, maxLoss: { easy: 400, normal: 30 } };

// The bomb is uniform in [low, high], so a guess g in a range of m numbers kills with probability 1/m and
// otherwise hands the next player a range of g-1 or m-g numbers. Whoever is left with one number dies, so the
// seat/parity matters. R[m][k] is our own chance of dying this round when k turns remain before ours
// and the other n-1 players either split the range in the middle or guess at random.
const MID_W = 0.8;
const tables = {};
function getRTable(n, M) {
  if (tables[n] && tables[n].M >= M) return tables[n].R;
  const R = [null]; // R[m][k]: our death probability, k turns before ours
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
    let bv = Infinity;
    for (let x = 1; x <= m; x++) {
      const xa = x - 1, xb = m - x;
      let v = 1 / m;
      if (xa) v += (xa / m) * R[xa][n - 1];
      if (xb) v += (xb / m) * R[xb][n - 1];
      if (v < bv - 1e-12) bv = v;
    }
    r[0] = bv; R[m] = r;
  }
  tables[n] = { M, R };
  return R;
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const low = state.low;
    const high = state.high;
    if (low >= high) return { guess: low };

    const m = high - low + 1;
    const n = Math.max(2, (state.lives || []).filter((l) => l > 0).length);
    const R = getRTable(n, Math.max(100, m));
    const gm = Math.ceil(m / 2);
    const cands = [];
    const hard = isHard(state);

    for (let x = 1; x <= m; x++) {
      const xa = x - 1, xb = m - x;
      let v = 1 / m;
      if (xa) v += (xa / m) * R[xa][n - 1];
      if (xb) v += (xb / m) * R[xb][n - 1];
      // hard plays the seat/parity optimum; easy/normal split the range around the midpoint (a few numbers of spread)
      const score = hard ? -v * 1000 - (x === gm ? 0 : 1e-4 * Math.abs(x - gm)) : -10 * Math.abs(x - gm);
      cands.push({ move: { guess: low + x - 1 }, score });
    }

    cands.sort((a, b) => b.score - a.score);
    return pickFor(state, cands, PICK);
  },
});
