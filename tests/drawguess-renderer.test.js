'use strict';
// Stage mode broadcasts a full game_state on every stroke. These tests run the real renderer in a vm
// sandbox against a minimal DOM and check that those broadcasts leave the guess input alone
// (replacing it closes the mobile keyboard and breaks IME composition).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const dg = require('../games/drawguess');

const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'renderers', 'drawguess.js'), 'utf8');

// ---- Minimal DOM: just what the drawguess renderer touches ----
const VOID_TAGS = new Set(['br', 'img', 'input', 'hr']);

class Text {
  constructor(text) { this.nodeType = 3; this.textContent = text; this.parentNode = null; }
}

class El {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.id = '';
    this.className = '';
    this.style = {};
    this.value = '';
    this.listeners = {};
    const self = this;
    this.classList = {
      toggle(c, on) { const set = new Set(self.className.split(/\s+/).filter(Boolean)); if (on === undefined ? !set.has(c) : on) set.add(c); else set.delete(c); self.className = [...set].join(' '); },
      contains(c) { return self.className.split(/\s+/).includes(c); },
    };
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) { this._clear(); if (v !== '') this.appendChild(new Text(String(v))); }
  set innerHTML(html) { this._clear(); parseInto(this, String(html)); }
  _clear() { this.childNodes.forEach((n) => { n.parentNode = null; }); this.childNodes = []; }
  appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; const i = this.childNodes.indexOf(ref); this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, n); return n; }
  removeChild(n) { this.childNodes = this.childNodes.filter((c) => c !== n); n.parentNode = null; return n; }
  contains(n) { for (let p = n; p; p = p.parentNode) if (p === this) return true; return false; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  focus() { this.ownerDocument.focusCalls.push(this); this.ownerDocument.activeElement = this; }
  select() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; }
  getContext() { return this.ctx || (this.ctx = fakeContext()); }
  _matches(sel) {
    if (sel[0] === '#') return this.id === sel.slice(1);
    if (sel[0] === '.') return this.classList.contains(sel.slice(1));
    return this.tagName === sel.toUpperCase();
  }
  querySelectorAll(sel) {
    const out = [];
    (function walk(el) { el.children.forEach((c) => { if (c._matches(sel)) out.push(c); walk(c); }); })(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function parseInto(root, html) {
  const doc = root.ownerDocument;
  const stack = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined) { top.appendChild(new Text(m[4])); continue; }
    if (m[1]) { stack.pop(); continue; }
    const el = new El(doc, m[2].toLowerCase());
    const id = /\bid="([^"]*)"/.exec(m[3]); if (id) el.id = id[1];
    const cls = /\bclass="([^"]*)"/.exec(m[3]); if (cls) el.className = cls[1];
    top.appendChild(el);
    if (!VOID_TAGS.has(m[2].toLowerCase()) && !/\/\s*$/.test(m[3])) stack.push(el);
  }
}

function fakeContext() {
  const ctx = { strokes: 0 };
  ['setTransform', 'scale', 'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo'].forEach((k) => { ctx[k] = () => {}; });
  ctx.stroke = () => { ctx.strokes++; };
  return ctx;
}

// Loads a fresh copy of the renderer. coarsePointer=true emulates a phone (matchMedia('(pointer: coarse)')).
function setup({ coarsePointer = false } = {}) {
  const doc = { focusCalls: [], activeElement: null };
  doc.createElement = (tag) => new El(doc, tag);
  doc.body = new El(doc, 'body');
  doc.head = new El(doc, 'head');
  doc.getElementById = (id) => doc.body.querySelector('#' + id);
  const timeouts = [];
  const moves = [];
  const win = {
    document: doc,
    gameRenderers: new Map(),
    innerWidth: 400, innerHeight: 800, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    injectStylesOnce() {},
    boardFit() { return { w: 360, h: 600 }; },
    matchMedia: (q) => ({ matches: coarsePointer && q === '(pointer: coarse)' }),
    makeGameMove: (data) => moves.push(JSON.parse(JSON.stringify(data))), // as sent over the WebSocket
    _players: [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Cat' }],
    _t: (k) => k,
    alert() {},
    setTimeout: (fn) => { timeouts.push(fn); return timeouts.length; },
    clearTimeout: (id) => { if (id) timeouts[id - 1] = () => {}; },
    setInterval: () => 0,
    clearInterval() {},
  };
  win.window = win;
  vm.runInNewContext(rendererSource, win, { filename: 'drawguess.js' });
  const renderer = win.gameRenderers.get('drawguess');
  const container = doc.createElement('div');
  doc.body.appendChild(container);
  renderer.init(container);
  return {
    doc, container, moves,
    render(view) { renderer.render(view, container, view.__pi, view.winner); },
    delta(d) { renderer.applyDelta(JSON.parse(JSON.stringify(d))); },
    // Fires every pending timer (ids stay valid for clearTimeout: fired slots are blanked, not removed)
    flushTimers() { for (let i = 0; i < timeouts.length; i++) { const fn = timeouts[i]; timeouts[i] = () => {}; fn(); } },
    canvas() { return container.querySelector('canvas'); },
    // Mouse path (the sandbox has no PointerEvent); the fake canvas is 300px on screen = 280 logical units
    pointer(type, x, y) { (this.canvas().listeners[type] || []).forEach((fn) => fn({ clientX: x, clientY: y, preventDefault() {} })); },
  };
}

// Server side: a 3-player stage game with a fixed word, Ann (0) drawing.
function newGame() {
  const st = dg.createState();
  st._options = { mode: 'stage', wordChoices: 1 };
  dg.initGame(st, 3);
  st.word = 'cat';
  return st;
}
// What one client receives over the WebSocket
function viewFor(st, pi) { return Object.assign(JSON.parse(JSON.stringify(dg.playerView(st, pi))), { __pi: pi }); }
function stroke(i) { return { color: '#000', width: 4, pts: [{ x: i, y: 1 }, { x: i + 1, y: 2 }, { x: i + 2, y: 3 }] }; }

test('drawguess stage: many incoming strokes keep the same guess input, its text, and never focus it', () => {
  const st = newGame();
  const ui = setup({ coarsePointer: true });
  ui.render(viewFor(st, 1));
  ui.flushTimers();
  const input = ui.container.querySelector('input');
  assert.ok(input, 'guesser gets an input');
  assert.equal(ui.doc.focusCalls.length, 0, 'no autofocus on touch devices (it would pop the keyboard over the canvas)');

  input.value = '小猫';
  for (let i = 0; i < 60; i++) {
    assert.equal(dg.handleMove({ type: 'stage_stroke', stroke: stroke(i) }, st, 0), null);
    ui.render(viewFor(st, 1));
  }
  dg.handleMove({ type: 'stage_undo' }, st, 0);
  ui.render(viewFor(st, 1));
  ui.flushTimers();

  assert.equal(ui.container.querySelector('input'), input, 'input element is never replaced');
  assert.ok(ui.container.contains(input), 'input stays attached');
  assert.equal(ui.container.querySelectorAll('input').length, 1);
  assert.equal(input.value, '小猫', 'typed text survives');
  assert.equal(ui.doc.focusCalls.length, 0, 'drawing updates never call focus()');
  const canvas = ui.container.querySelector('canvas');
  const before = canvas.ctx.strokes;
  dg.handleMove({ type: 'stage_stroke', stroke: stroke(99) }, st, 0);
  ui.render(viewFor(st, 1));
  assert.equal(canvas.ctx.strokes - before, 60, 'canvas is redrawn with all synced strokes (59 after undo + 1 new)');
});

test('drawguess stage: desktop autofocuses once per round, not on every stroke', () => {
  const st = newGame();
  const ui = setup();
  ui.render(viewFor(st, 1));
  for (let i = 0; i < 20; i++) {
    dg.handleMove({ type: 'stage_stroke', stroke: stroke(i) }, st, 0);
    ui.render(viewFor(st, 1));
  }
  ui.flushTimers();
  assert.equal(ui.doc.focusCalls.length, 1);
  assert.equal(ui.doc.focusCalls[0], ui.container.querySelector('input'));
});

test('drawguess stage: guessing, score/side updates and the next round still work', () => {
  const st = newGame();
  const bob = setup({ coarsePointer: true });
  const cat = setup({ coarsePointer: true });
  bob.render(viewFor(st, 1));
  cat.render(viewFor(st, 2));
  const catInput = cat.container.querySelector('input');
  catInput.value = 'do';

  // Bob types and presses Enter: the guess is sent
  const bobInput = bob.container.querySelector('input');
  bobInput.value = ' cat ';
  bobInput.onkeydown({ key: 'Enter' });
  assert.deepEqual(bob.moves, [{ type: 'stage_guess', text: 'cat' }]);
  assert.equal(dg.handleMove({ type: 'stage_guess', text: 'dog' }, st, 2), 'dg_wrong_try_again', 'wrong guesses are rejected without a broadcast');
  assert.equal(dg.handleMove(bob.moves[0], st, 1), null);
  assert.equal(st.phase, 'playing');

  // Bob's screen switches to "guessed correctly" (no input); Cat keeps typing in the same input
  bob.render(viewFor(st, 1));
  assert.equal(bob.container.querySelector('input'), null);
  assert.match(bob.container.querySelector('.dg-hdr').textContent, /dg_guessed_correct/);
  cat.render(viewFor(st, 2));
  assert.equal(cat.container.querySelector('input'), catInput);
  assert.equal(catInput.value, 'do');
  const rank = cat.container.querySelector('#dg-right').textContent;
  assert.match(rank, /Bob✓ dg_side_guessed/, 'side ranking shows who guessed');
  assert.ok(st.scores[1] > 0 && rank.includes(String(st.scores[1])), 'side ranking shows the new score');

  // Round ends, next round: Bob draws, Cat gets a fresh input for the new word
  assert.equal(dg.onTimeout(st), true);
  cat.render(viewFor(st, 2));
  assert.equal(cat.container.querySelector('input'), null, 'round result replaces the stage screen');
  dg.onTimeout(st);
  st.word = 'sun';
  assert.equal(st.drawerIndex, 1);
  bob.render(viewFor(st, 1));
  cat.render(viewFor(st, 2));
  assert.ok(bob.container.querySelector('#dg-toolbar'), 'new drawer gets the toolbar');
  assert.equal(bob.container.querySelector('input'), null);
  const newInput = cat.container.querySelector('input');
  assert.ok(newInput && newInput !== catInput, 'new round builds a new input');
  assert.equal(newInput.value, '');
  assert.match(cat.container.querySelector('.dg-hdr').textContent, /^dg_round_prefix2/);
});

test('drawguess stage: the drawer keeps the same toolbar and canvas while its strokes echo back', () => {
  const st = newGame();
  const ann = setup();
  ann.render(viewFor(st, 0));
  const toolbar = ann.container.querySelector('#dg-toolbar');
  const canvas = ann.container.querySelector('canvas');
  for (let i = 0; i < 10; i++) {
    dg.handleMove({ type: 'stage_stroke', stroke: stroke(i) }, st, 0);
    ann.render(viewFor(st, 0));
  }
  assert.equal(ann.container.querySelector('#dg-toolbar'), toolbar);
  assert.equal(ann.container.querySelector('canvas'), canvas);
  const before = canvas.ctx.strokes;
  dg.handleMove({ type: 'stage_clear' }, st, 0);
  ann.render(viewFor(st, 0));
  assert.equal(canvas.ctx.strokes, before, 'echoed states never repaint the drawer canvas (it is ahead of them)');
});

test('drawguess stage: a cleared board (e.g. restart) is rebuilt instead of patched', () => {
  const st = newGame();
  const ui = setup();
  ui.render(viewFor(st, 1));
  const input = ui.container.querySelector('input');
  ui.container.innerHTML = ''; // room-client clears #boardArea on restart
  ui.render(viewFor(st, 1));
  const rebuilt = ui.container.querySelector('input');
  assert.ok(rebuilt && rebuilt !== input);
});

// ---- Live strokes: the server sends deltas (moveDelta -> game_delta) instead of full states ----

test('drawguess stage: guessers paint incoming stroke deltas incrementally and keep their input', () => {
  const st = newGame();
  const ui = setup({ coarsePointer: true });
  ui.render(viewFor(st, 1));
  const input = ui.container.querySelector('input');
  input.value = '猫';
  const canvas = ui.canvas();
  const before = canvas.ctx.strokes;
  for (let i = 0; i < 50; i++) {
    const move = { type: 'stage_stroke', stroke: stroke(i) };
    assert.equal(dg.handleMove(move, st, 0), null);
    ui.delta(dg.moveDelta(move, st, 0));
  }
  assert.equal(canvas.ctx.strokes - before, 50, 'one paint per new stroke, no full repaint per delta');
  assert.equal(ui.container.querySelector('input'), input);
  assert.equal(input.value, '猫');

  // undo/clear arrive as a trim to the server's stroke count
  const undo = { type: 'stage_undo' };
  dg.handleMove(undo, st, 0);
  const mid = canvas.ctx.strokes;
  ui.delta(dg.moveDelta(undo, st, 0));
  assert.equal(canvas.ctx.strokes - mid, 49, 'trim repaints the remaining strokes');
  // a later full state agrees with the delta-built picture
  const v = viewFor(st, 1);
  assert.equal(v.myTask.strokes.length, 49);
});

test('drawguess stage: the drawer streams a long stroke in segments and server echoes never wipe it', () => {
  const st = newGame();
  const ann = setup();
  ann.render(viewFor(st, 0));
  // one long stroke, flushed mid-way by the 50ms timer
  ann.pointer('mousedown', 10, 10);
  for (let x = 12; x < 60; x += 2) ann.pointer('mousemove', x, 10);
  ann.flushTimers();
  for (let x = 60; x < 120; x += 2) ann.pointer('mousemove', x, 20);
  ann.pointer('mouseup');
  const sent = ann.moves.filter((m) => m.type === 'stage_stroke');
  assert.equal(sent.length, 2, 'two segments');
  assert.equal(sent[0].stroke.g, sent[1].stroke.g, 'same stroke id');
  assert.deepEqual(sent[1].stroke.pts[0], sent[0].stroke.pts[sent[0].stroke.pts.length - 1], 'segments join up');
  assert.ok(sent[0].stroke.pts.every((p) => p.x >= 0 && p.x <= 280), 'logical coordinates');

  // a second stroke, then a full state that only knows the first segment (it trails behind): nothing is lost
  ann.pointer('mousedown', 100, 100); ann.pointer('mousemove', 150, 150); ann.pointer('mouseup');
  dg.handleMove(sent[0], st, 0);
  dg.handleMove({ type: 'stage_guess', text: 'dog' }, st, 1);
  const canvas = ann.canvas();
  const before = canvas.ctx.strokes;
  ann.render(viewFor(st, 0));
  assert.equal(canvas.ctx.strokes, before, 'the drawer canvas is not repainted from a stale echo');

  // undo removes the whole second stroke; the server does the same with the g grouping
  ann.moves.length = 0;
  ann.container.querySelectorAll('button').find((b) => b.textContent === 'dg_undo').onclick();
  assert.deepEqual(ann.moves, [{ type: 'stage_undo' }]);
  assert.equal(canvas.ctx.strokes - before, 2, 'repainted with the 2 segments of the first stroke');
});

test('drawguess stage: a tap draws a dot', () => {
  const st = newGame();
  const ann = setup();
  ann.render(viewFor(st, 0));
  ann.pointer('mousedown', 30, 30);
  ann.pointer('mouseup');
  const sent = ann.moves.filter((m) => m.type === 'stage_stroke');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].stroke.pts.length, 2);
  assert.equal(dg.handleMove(sent[0], st, 0), null, 'server accepts it');
});
