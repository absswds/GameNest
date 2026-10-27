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
} = require('../scripts/lib/tier-fit');

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
