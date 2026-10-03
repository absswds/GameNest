'use strict';
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const { svgToStrokes, renderPng } = require('../mcp/draw');

function decode(png) {
  assert.deepStrictEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  let off = 8, idat = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off), type = png.toString('latin1', off + 4, off + 8);
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  return { w, h, px: (x, y) => { const o = y * (w * 3 + 1) + 1 + x * 3; return [raw[o], raw[o + 1], raw[o + 2]]; } };
}

test('svgToStrokes: shapes become point strokes inside the 280 canvas', () => {
  const s = svgToStrokes('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="red" stroke-width="2"/><rect x="0" y="0" width="100" height="100" stroke="#00f"/><path d="M10 10 L90 10 Q50 50 10 90 Z" stroke="black"/></svg>');
  assert.strictEqual(s.length, 3);
  assert.strictEqual(s[0].color, '#e53935');
  assert.strictEqual(s[0].width, 6); // 2 * 2.8
  for (const st of s) for (const p of st.pts) assert.ok(p.x >= -0.1 && p.x <= 280.1 && p.y >= -0.1 && p.y <= 280.1);
  assert.deepStrictEqual(s[1].pts[2], { x: 280, y: 280 });
});

test('svgToStrokes: relative path, arc, and bad input', () => {
  const s = svgToStrokes('<path d="m 10,10 h 50 v 50 a 25 25 0 0 1 -50 0 z" stroke="black"/>');
  assert.strictEqual(s.length, 1);
  assert.deepStrictEqual(s[0].pts[1], { x: 60, y: 10 });
  assert.throws(() => svgToStrokes('<svg></svg>'), /no drawable/);
  assert.throws(() => svgToStrokes('<line x1="0" y1="0" x2="5" y2="5" transform="scale(2)"/>'), /transform/);
});

test('renderPng: valid PNG with the stroke painted on a white background', () => {
  const png = renderPng([{ color: '#ff0000', width: 10, pts: [{ x: 20, y: 140 }, { x: 260, y: 140 }] }], 2);
  const img = decode(png);
  assert.strictEqual(img.w, 560);
  assert.deepStrictEqual(img.px(280, 280), [255, 0, 0]);
  assert.deepStrictEqual(img.px(280, 20), [255, 255, 255]);
});
