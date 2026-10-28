'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
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
} = require('../scripts/lib/tier-fit');
const { pickByDifficulty, pickFor } = require('../bots/lib/difficulty');

test('fitLogistic recovers a and b from synthetic exact data', () => {
  const trueA = -1;
  const trueB = 0.8;
  const n = 1000;
  const points = [];
  for (let x = 0; x <= 5; x++) {
    points.push({ x, score: n * sigmoid(trueA + trueB * x), n });
  }
  const fit = fitLogistic(points);
  assert.equal(fit.ok, true);
  assert.ok(Math.abs(fit.a - trueA) <= 0.15, `expected a near ${trueA}, got ${fit.a}`);
  assert.ok(Math.abs(fit.b - trueB) <= 0.15, `expected b near ${trueB}, got ${fit.b}`);
});

test('solveX returns null for b = 0 and returns the right x otherwise', () => {
  assert.equal(solveX({ a: -1, b: 0, ok: true }, 0), null);
  assert.equal(solveX({ a: -1, b: -0.2, ok: true }, 0), null);
  const x = solveX({ a: -1, b: 0.8, ok: true }, 0.6);
  assert.ok(Math.abs(x - 2) < 1e-9);
});

test('pavDecreasing pools adjacent violators into non-increasing sequence', () => {
  const out = pavDecreasing([0.9, 0.6, 0.7, 0.4], [1, 1, 1, 1]);
  assert.equal(out.length, 4);
  const expected = [0.9, 0.65, 0.65, 0.4];
  for (let i = 0; i < expected.length; i++) {
    assert.ok(Math.abs(out[i] - expected[i]) < 1e-12, `index ${i}: ${out[i]} vs ${expected[i]}`);
  }
});

test('wilson interval bounds', () => {
  const half = wilson(20, 40);
  assert.ok(half.lo < 0.5 && 0.5 < half.hi, `expected lo < 0.5 < hi, got [${half.lo}, ${half.hi}]`);
  const full = wilson(40, 40);
  assert.ok(full.hi <= 1, `expected hi <= 1, got ${full.hi}`);
  assert.ok(full.lo > 0.85 && full.lo <= 1);
});

test('eloTargetLogit two-step 0.65 sigmoid is about 0.775', () => {
  const z = eloTargetLogit(0.65, 2);
  const p = sigmoid(z);
  assert.ok(Math.abs(p - 0.775) <= 0.005, `expected ~0.775, got ${p}`);
  assert.ok(Math.abs(sigmoid(logit(0.65)) - 0.65) < 1e-9);
});

test('pickByDifficulty lossK scales maxLoss with temp and preserves existing behaviour when absent', () => {
  const cands = [
    { move: 'best', score: 100 },
    { move: 'mid', score: 50 },   // loss 50 (filtered out by default normal maxLoss=40)
    { move: 'worst', score: -200 }, // loss 300
  ];

  // Without lossK, default normal maxLoss=40 filters out 'mid' (loss 50) even when r -> 1
  const withoutLossK = pickByDifficulty(cands, 'normal', {
    temp: { normal: 20 },
    random: () => 0.9999,
  });
  assert.equal(withoutLossK, 'best');

  // With lossK=4 and temp=20, maxLoss = 80, so 'mid' (loss 50) is included in pool while 'worst' (loss 300) is excluded
  const withLossK = pickByDifficulty(cands, 'normal', {
    temp: { normal: 20 },
    lossK: { normal: 4 },
    random: () => 0.9999,
  });
  assert.equal(withLossK, 'mid');

  // Scaling with higher temp=100 and lossK=4 gives maxLoss = 400, including 'worst' (loss 300)
  const withHighTemp = pickByDifficulty(cands, 'normal', {
    temp: { normal: 100 },
    lossK: { normal: 4 },
    random: () => 0.9999,
  });
  assert.equal(withHighTemp, 'worst');

  // Explicit maxLoss override takes precedence over lossK
  const withExplicitMaxLoss = pickByDifficulty(cands, 'normal', {
    temp: { normal: 100 },
    lossK: { normal: 4 },
    maxLoss: { normal: 30 },
    random: () => 0.9999,
  });
  assert.equal(withExplicitMaxLoss, 'best');

  // pickFor reads state._options.botLossK and overrides bot maxLoss when botMaxLoss is not set
  const state = { _options: { difficulty: 'normal', botTemp: 20, botLossK: 4 } };
  const fromPickFor = pickFor(state, cands, {
    temp: { normal: 15 },
    maxLoss: { normal: 30 },
    random: () => 0.9999,
  });
  assert.equal(fromPickFor, 'mid');
});

test('chooseDepthWithFallback picks depth 2 in chinesechess easy example when depth 3 cannot reach target', () => {
  const targetRate = sigmoid(eloTargetLogit(0.70, 2)); // ~0.845
  const table = [
    { depth: 1, winRate: 0.98 },
    { depth: 2, winRate: 0.92 },
    { depth: 3, winRate: 0.40, maxWinRate: 0.67 },
  ];
  assert.equal(pickInitialDepth(table, targetRate), 3);
  const res = chooseDepthWithFallback(table, targetRate);
  assert.equal(res.candidateDepth, 3);
  assert.equal(res.depth, 2);
  assert.equal(res.fallback, true);
  assert.equal(pickClosestDepth(table, targetRate), 2);
});
