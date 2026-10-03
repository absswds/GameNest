'use strict';
const test = require('node:test');
const assert = require('node:assert');
const dg = require('../games/drawguess');

const stroke = (i) => ({ color: '#000', width: 3, pts: [{ x: i, y: 0 }, { x: i, y: 9 }] });
const mk = () => ({ mode: 'stage', phase: 'playing', drawerIndex: 1, word: 'cat', strokes: [stroke(1), stroke(2), stroke(3)], correct: {} });

test('stage_undo removes the last strokes, stage_clear wipes the canvas', () => {
  const st = mk();
  assert.strictEqual(dg.handleMove({ type: 'stage_undo' }, st, 1), null);
  assert.strictEqual(st.strokes.length, 2);
  assert.strictEqual(dg.handleMove({ type: 'stage_undo', count: 99 }, st, 1), null);
  assert.strictEqual(st.strokes.length, 0);
  st.strokes = [stroke(1)];
  assert.strictEqual(dg.handleMove({ type: 'stage_clear' }, st, 1), null);
  assert.deepStrictEqual(st.strokes, []);
});

test('only the drawer may undo or clear', () => {
  const st = mk();
  assert.strictEqual(dg.handleMove({ type: 'stage_undo' }, st, 0), 'dg_cannot_draw_now');
  assert.strictEqual(dg.handleMove({ type: 'stage_clear' }, st, 0), 'dg_cannot_draw_now');
  assert.strictEqual(st.strokes.length, 3);
});
