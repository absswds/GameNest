'use strict';
// Drawing helpers for the drawguess MCP tools. No dependencies: SVG -> stroke polylines, strokes -> PNG.
const zlib = require('zlib');

const CANVAS = 280; // stroke coordinate space; the smallest canvas any client gets
const NAMED = {
  black: '#000000', white: '#ffffff', red: '#e53935', green: '#43a047', blue: '#1e88e5', yellow: '#fdd835',
  orange: '#fb8c00', purple: '#8e24aa', brown: '#6d4c41', gray: '#9e9e9e', grey: '#9e9e9e', pink: '#ec407a',
};

function parseColor(c) {
  c = String(c || '').trim().toLowerCase();
  if (NAMED[c]) c = NAMED[c];
  let m = /^#([0-9a-f]{3})$/.exec(c);
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
  m = /^#([0-9a-f]{6})$/.exec(c);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16));
  return [34, 34, 34];
}

// ---------- SVG -> strokes ----------
function attrs(tag) {
  const a = {};
  tag.replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, k, _v, d, s) => { a[k] = d !== undefined ? d : s; });
  return a;
}
const nums = (s) => (String(s || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);

function bezier(pts, steps) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps; let p = pts;
    while (p.length > 1) p = p.slice(1).map((q, j) => ({ x: p[j].x + (q.x - p[j].x) * t, y: p[j].y + (q.y - p[j].y) * t }));
    out.push(p[0]);
  }
  return out;
}
function arcPoints(x1, y1, rx, ry, rot, large, sweep, x2, y2) {
  if (!rx || !ry) return [{ x: x2, y: y2 }];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rot * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(8, Math.ceil(Math.abs(dth) / (Math.PI / 16))), out = [];
  for (let i = 1; i <= n; i++) {
    const th = th1 + (dth * i) / n, px = rx * Math.cos(th), py = ry * Math.sin(th);
    out.push({ x: c * px - s * py + cx, y: s * px + c * py + cy });
  }
  return out;
}

// Returns an array of polylines (each an array of {x,y}); every M starts a new one.
function pathToPolylines(d) {
  const toks = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const argc = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const lines = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', last = null, i = 0;
  const begin = (px, py) => { cur = [{ x: px, y: py }]; lines.push(cur); sx = px; sy = py; };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) { cmd = toks[i++]; if (!argc.hasOwnProperty(cmd.toUpperCase())) throw new Error('unsupported path command ' + cmd); }
    else if (!cmd) throw new Error('path must start with a command');
    const C = cmd.toUpperCase(), rel = cmd !== C, n = argc[C];
    if (C === 'Z') { if (cur) cur.push({ x: sx, y: sy }); x = sx; y = sy; last = null; cur = null; continue; }
    const a = toks.slice(i, i + n).map(Number);
    if (a.length < n || a.some(isNaN)) throw new Error('bad path data near ' + cmd);
    i += n;
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { x = a[0] + ox; y = a[1] + oy; begin(x, y); cmd = rel ? 'l' : 'L'; last = null; continue; }
    if (!cur) begin(x, y);
    let pts;
    if (C === 'L') pts = [{ x: a[0] + ox, y: a[1] + oy }];
    else if (C === 'H') pts = [{ x: a[0] + ox, y }];
    else if (C === 'V') pts = [{ x, y: a[0] + oy }];
    else if (C === 'C') { pts = bezier([{ x, y }, { x: a[0] + ox, y: a[1] + oy }, { x: a[2] + ox, y: a[3] + oy }, { x: a[4] + ox, y: a[5] + oy }], 16); last = { k: 'C', x: a[2] + ox, y: a[3] + oy }; }
    else if (C === 'S') {
      const r = last && last.k === 'C' ? { x: 2 * x - last.x, y: 2 * y - last.y } : { x, y };
      pts = bezier([{ x, y }, r, { x: a[0] + ox, y: a[1] + oy }, { x: a[2] + ox, y: a[3] + oy }], 16); last = { k: 'C', x: a[0] + ox, y: a[1] + oy };
    } else if (C === 'Q') { pts = bezier([{ x, y }, { x: a[0] + ox, y: a[1] + oy }, { x: a[2] + ox, y: a[3] + oy }], 12); last = { k: 'Q', x: a[0] + ox, y: a[1] + oy }; }
    else if (C === 'T') {
      const r = last && last.k === 'Q' ? { x: 2 * x - last.x, y: 2 * y - last.y } : { x, y };
      pts = bezier([{ x, y }, r, { x: a[0] + ox, y: a[1] + oy }], 12); last = { k: 'Q', x: r.x, y: r.y };
    } else pts = arcPoints(x, y, a[0], a[1], a[2], a[3], a[4], a[5] + ox, a[6] + oy);
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') last = null;
    for (const p of pts) cur.push(p);
    x = pts[pts.length - 1].x; y = pts[pts.length - 1].y;
  }
  return lines.filter((l) => l.length >= 2);
}

const ellipse = (cx, cy, rx, ry) => Array.from({ length: 49 }, (_, i) => ({ x: cx + rx * Math.cos((i / 48) * 2 * Math.PI), y: cy + ry * Math.sin((i / 48) * 2 * Math.PI) }));

// svg string -> [{color,width,pts:[{x,y}]}] fitted into the 0..280 canvas. Outlines only: fills are not painted.
function svgToStrokes(svg) {
  const root = /<svg\b[^>]*>/i.exec(String(svg));
  const vb = root && nums(attrs(root[0]).viewBox);
  const [vx, vy, vw, vh] = vb && vb.length === 4 ? vb : [0, 0, CANVAS, CANVAS];
  const k = CANVAS / Math.max(vw, vh);
  const strokes = [];
  const tags = String(svg).match(/<(line|rect|circle|ellipse|polyline|polygon|path)\b[^>]*>/gi) || [];
  if (!tags.length) throw new Error('no drawable SVG elements (supported: line rect circle ellipse polyline polygon path)');
  for (const tag of tags) {
    const name = /^<(\w+)/.exec(tag)[1].toLowerCase(), a = attrs(tag), n = (key, d) => (a[key] === undefined ? d : parseFloat(a[key]) || 0);
    if (a.transform) throw new Error('transform is not supported: put the final coordinates in each element');
    let lines;
    if (name === 'line') lines = [[{ x: n('x1', 0), y: n('y1', 0) }, { x: n('x2', 0), y: n('y2', 0) }]];
    else if (name === 'rect') { const x = n('x', 0), y = n('y', 0), w = n('width', 0), h = n('height', 0); lines = [[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }]]; }
    else if (name === 'circle') lines = [ellipse(n('cx', 0), n('cy', 0), n('r', 0), n('r', 0))];
    else if (name === 'ellipse') lines = [ellipse(n('cx', 0), n('cy', 0), n('rx', 0), n('ry', 0))];
    else if (name === 'path') lines = pathToPolylines(a.d || '');
    else {
      const v = nums(a.points), pts = [];
      for (let i = 0; i + 1 < v.length; i += 2) pts.push({ x: v[i], y: v[i + 1] });
      if (name === 'polygon' && pts.length) pts.push(pts[0]);
      lines = [pts];
    }
    // a shape with only a fill is drawn as an outline in that colour
    const hasStroke = a.stroke && a.stroke !== 'none';
    const color = hasStroke ? a.stroke : a.fill && a.fill !== 'none' ? a.fill : '#222222';
    const [r, g, b] = parseColor(color);
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    const width = Math.min(30, Math.max(1, Math.round(n('stroke-width', 3) * k)));
    for (const l of lines) {
      if (l.length < 2) continue;
      strokes.push({ color: hex, width, pts: l.map((p) => ({ x: +((p.x - vx) * k).toFixed(1), y: +((p.y - vy) * k).toFixed(1) })) });
    }
  }
  return strokes;
}

// ---------- strokes -> PNG ----------
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'latin1'); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Draws every stroke (round caps, antialiased) on a white 280*scale square and returns a PNG Buffer.
function renderPng(strokes, scale) {
  const sc = scale || 2, size = CANVAS * sc, px = Buffer.alloc(size * size * 3, 255);
  const blend = (x, y, rgb, a) => { const o = (y * size + x) * 3; for (let c = 0; c < 3; c++) px[o + c] = Math.round(px[o + c] * (1 - a) + rgb[c] * a); };
  const seg = (ax, ay, bx, by, hw, rgb) => {
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - hw - 1)), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx) + hw + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - hw - 1)), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by) + hw + 1));
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = len2 ? Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len2)) : 0;
      const d = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy));
      const a = Math.max(0, Math.min(1, hw + 0.5 - d));
      if (a > 0) blend(x, y, rgb, a);
    }
  };
  for (const s of strokes || []) {
    if (!s || !Array.isArray(s.pts)) continue;
    const rgb = parseColor(s.color), hw = ((s.width || 3) * sc) / 2, p = s.pts;
    for (let i = 1; i < p.length; i++) seg(p[i - 1].x * sc, p[i - 1].y * sc, p[i].x * sc, p[i].y * sc, hw, rgb);
  }
  return encodePng(size, size, px);
}

module.exports = { svgToStrokes, pathToPolylines, renderPng, CANVAS };
