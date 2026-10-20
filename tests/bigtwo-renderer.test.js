// The renderer keeps its own copy of detectType / canBeat for the play hint. Load the real
// renderer in a vm sandbox and check it agrees with the server rules on random hands.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const bt = require('../games/bigtwo');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'renderers', 'bigtwo.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const client = sandbox.window._btRules;

const deck = [];
for (const r of ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']) {
  for (const s of ['s', 'h', 'c', 'd']) deck.push({ rank: r, suit: s, id: r + s });
}
function draw(n, rnd) {
  const pool = deck.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
// Small seeded PRNG so failures reproduce.
function rng(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
}
const strip = (p) => p && { type: p.type, kind: p.kind, rank: p.rank, suit: p.suit };

test('renderer detectType matches the server on random hands', () => {
  const rnd = rng(7);
  const samples = [
    ['3h', '4h', '5h', '6h', '7h'], ['Ad', '2c', '3c', '4c', '5c'], ['10d', 'Jc', 'Qc', 'Kc', 'Ac'],
    ['Jd', 'Qc', 'Kc', 'Ac', '2c'], ['4s', '4h', '4c', '5s', '5h'], ['6s', '6h', '6c', '6d', '8s'],
  ].map((ids) => ids.map((id) => deck.find((c) => c.id === id)));
  for (let i = 0; i < 4000; i++) samples.push(draw([1, 2, 3, 4, 5][i % 5], rnd));
  for (const cards of samples) {
    assert.deepEqual(strip(client.detectType(cards)), strip(bt.detectType(cards)), cards.map((c) => c.id).join(' '));
  }
});

// Random hands are rarely a valid five-card play, so build valid ones directly.
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['s', 'h', 'c', 'd'];
const card = (r, s) => deck.find((c) => c.id === r + s);
function randomPlay(rnd) {
  const pickSuit = () => SUITS[Math.floor(rnd() * 4)];
  const ranks = (n) => RANKS.slice().sort(() => rnd() - 0.5).slice(0, n);
  const seq = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  switch (Math.floor(rnd() * 7)) {
    case 0: return [card(RANKS[Math.floor(rnd() * 13)], pickSuit())];
    case 1: { const r = ranks(1)[0]; const s = SUITS.slice().sort(() => rnd() - 0.5); return [card(r, s[0]), card(r, s[1])]; }
    case 2: { const st = Math.floor(rnd() * 10); const one = rnd() < 0.3 ? pickSuit() : null; return seq.slice(st, st + 5).map((r) => card(r, one || pickSuit())); }
    case 3: { const s = pickSuit(); return ranks(5).map((r) => card(r, s)); }
    case 4: { const [a, b] = ranks(2); return [card(a, 's'), card(a, 'h'), card(a, 'c'), card(b, 's'), card(b, 'd')]; }
    default: { const [a, b] = ranks(2); return [card(a, 's'), card(a, 'h'), card(a, 'c'), card(a, 'd'), card(b, pickSuit())]; }
  }
}

test('renderer canBeat matches the server on random plays', () => {
  const rnd = rng(11);
  let compared = 0;
  for (let i = 0; i < 6000; i++) {
    const a = bt.detectType(randomPlay(rnd));
    const b = bt.detectType(randomPlay(rnd));
    if (!a || !b) continue;
    compared++;
    assert.equal(client.canBeat(a, b), bt.canBeat(a, b), JSON.stringify([a, b]));
  }
  assert.ok(compared > 3000);
});
