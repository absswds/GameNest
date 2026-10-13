// Regression tests for the mahjong code-review fixes + whole-game bot runs (no deadlock).
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../games/lib/mahjong-core');
const sichuan = require('../games/mahjong-sichuan');
const cantonese = require('../games/mahjong-cantonese');
const sichuanBot = require('../bots/mahjong-sichuan');

let uid = 0;
const t = (k, n) => ({ k, n, id: k + n + '#' + (uid++) });
const mk = (spec) => spec.map(([k, n]) => t(k, n));

// ---- core: huCheck / fan ----

test('huCheck: dasanyuan needs a valid standard hand (three dragon pungs + junk is not a win)', () => {
  const junk = mk([['jian', 1], ['jian', 1], ['jian', 1], ['jian', 2], ['jian', 2], ['jian', 2],
    ['jian', 3], ['jian', 3], ['jian', 3], ['wan', 1], ['wan', 4], ['wan', 7], ['tong', 2], ['tong', 5]]);
  assert.equal(core.huCheck(junk, [], core.CANTONESE).win, false);
  const ok = mk([['jian', 1], ['jian', 1], ['jian', 1], ['jian', 2], ['jian', 2], ['jian', 2],
    ['jian', 3], ['jian', 3], ['jian', 3], ['wan', 1], ['wan', 2], ['wan', 3], ['tong', 5], ['tong', 5]]);
  assert.equal(core.huCheck(ok, [], core.CANTONESE).type, 'dasanyuan');
});

test('huCheck: seven pairs scores qidui fan (Sichuan 4, Cantonese 2)', () => {
  const pairs = mk([['wan', 1], ['wan', 1], ['wan', 3], ['wan', 3], ['tong', 5], ['tong', 5], ['tong', 7],
    ['tong', 7], ['tiao', 2], ['tiao', 2], ['tiao', 9], ['tiao', 9], ['wan', 8], ['wan', 8]]);
  const info = core.huCheck(pairs, [], core.SICHUAN);
  assert.equal(info.type, 'qidui');
  const r = core.countFanDetailed(pairs, [], info, core.SICHUAN, {});
  assert.ok(r.details.some(d => d.fan === 4 && /七对/.test(d.name)), JSON.stringify(r.details));
  const rc = core.countFanDetailed(pairs, [], core.huCheck(pairs, [], core.CANTONESE), core.CANTONESE, {});
  assert.ok(rc.details.some(d => d.fan === 2 && /七对/.test(d.name)), JSON.stringify(rc.details));
});

test('huCheck: wildcard chow gaps (8万 9万 + 红中 = 7-8-9, and 1万 3万 + 红中)', () => {
  const cfg = { ...core.CANTONESE, wildcard: { k: 'jian', n: 1 } };
  const rest = [['tong', 1], ['tong', 2], ['tong', 3], ['tiao', 4], ['tiao', 5], ['tiao', 6], ['tiao', 1], ['tiao', 1], ['tong', 7], ['tong', 8], ['tong', 9]];
  assert.equal(core.huCheck(mk([['wan', 8], ['wan', 9], ['jian', 1]].concat(rest)), [], cfg).win, true);
  assert.equal(core.huCheck(mk([['wan', 1], ['wan', 3], ['jian', 1]].concat(rest)), [], cfg).win, true);
});

test('core: doSelfKong does not eat tiles when fewer than 4', () => {
  const hand = mk([['wan', 1], ['wan', 1], ['wan', 1], ['tong', 2]]);
  const melds = [];
  assert.equal(core.doSelfKong(hand, melds, 'wan', 1, 0), false);
  assert.equal(hand.length, 4);
  assert.equal(melds.length, 0);
});

// ---- Sichuan claims ----

function sichuanState(opts) {
  const s = sichuan.createState();
  s._options = Object.assign({ mahjongMode: 'sichuan' }, opts || {});
  sichuan.initGame(s, 4);
  for (let i = 0; i < 4; i++) sichuan.handleMove({ type: 'void', suit: 'tong' }, s, i);
  return s;
}
const PUNG_HAND = [['wan', 5], ['wan', 5], ['tiao', 1], ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tiao', 5], ['tiao', 6], ['tiao', 7], ['tiao', 8], ['tiao', 9], ['wan', 1], ['wan', 2]];

test('sichuan claim: ordered responses, win outranks pung, others cannot jump the queue', () => {
  const s = sichuanState();
  const d = t('wan', 5);
  s.hands[0].push(d);
  s.hands[1] = mk(PUNG_HAND);
  s.hands[2] = mk([['wan', 1], ['wan', 2], ['wan', 3], ['wan', 4], ['wan', 5], ['wan', 6], ['wan', 7], ['wan', 8], ['wan', 9], ['tiao', 1], ['tiao', 1], ['wan', 5], ['wan', 5]]);
  s.hands[3] = mk([['tiao', 2], ['tiao', 4], ['tiao', 6]]);
  assert.equal(sichuan.handleMove({ type: 'discard', tileId: d.id }, s, 0), null);
  assert.deepEqual(s.claim.order, [2, 1], 'win-capable seat first, then pung seat');
  assert.equal(sichuan.handleMove({ type: 'pung' }, s, 1), 'g_not_your_turn');
  assert.equal(sichuan.handleMove({ type: 'win' }, s, 2), null);
  assert.ok(s.winners.includes(2));
  assert.equal(s.melds[1].length, 0, 'pung lost to the win');
});

test('sichuan: after a pung there is no draw, so win/selfkong are refused', () => {
  const s = sichuanState();
  const d = t('wan', 5);
  s.hands[0].push(d);
  s.hands[1] = mk(PUNG_HAND);
  s.hands[2] = mk([['tiao', 1], ['tiao', 3], ['tiao', 5]]);
  s.hands[3] = mk([['tiao', 2], ['tiao', 4], ['tiao', 6]]);
  assert.equal(sichuan.handleMove({ type: 'discard', tileId: d.id }, s, 0), null);
  assert.deepEqual(s.claim.order, [1]);
  assert.equal(sichuan.handleMove({ type: 'pung' }, s, 1), null);
  assert.equal(s.phase, 'play');
  assert.equal(s.currentPlayer, 1);
  assert.equal(sichuan.handleMove({ type: 'win' }, s, 1), 'mj_not_winning');
  assert.equal(sichuan.handleMove({ type: 'selfkong', suit: 'wan', num: 5 }, s, 1), 'mj_cannot_kong');
});

test('sichuan swap: duplicate tile ids rejected; 3 players rotate', () => {
  const s = sichuan.createState();
  s._options = { mahjongMode: 'sichuan', mj_swapThree: true };
  sichuan.initGame(s, 3);
  const best = (h) => ['wan', 'tong', 'tiao'].sort((a, b) => h.filter(x => x.k === b).length - h.filter(x => x.k === a).length)[0];
  const one = s.hands[0].find(x => x.k === best(s.hands[0]));
  assert.equal(sichuan.handleMove({ type: 'swap', tileIds: [one.id, one.id, one.id] }, s, 0), 'mj_bad_swap');
  const picked = [];
  for (let i = 0; i < 3; i++) {
    const h = s.hands[i];
    const su = best(h);
    const ids = h.filter(x => x.k === su).slice(0, 3).map(x => x.id);
    picked.push(ids);
    assert.equal(sichuan.handleMove({ type: 'swap', tileIds: ids }, s, i), null);
  }
  assert.equal(s.phase, 'void');
  for (let i = 0; i < 3; i++) {
    const to = (i + 1) % 3;
    for (const id of picked[i]) assert.ok(s.hands[to].some(x => x.id === id), 'seat ' + to + ' got a tile from ' + i);
    assert.equal(s.hands[i].length, i === 0 ? 14 : 13);
  }
});

test('sichuan penalties: only on wall exhaustion, zero-sum', () => {
  const s = sichuanState({ mj_checkFlowerPig: true, mj_checkBigCall: true });
  s.voidSuit = ['wan', 'tong', 'tiao', 'wan'];
  s.hands[0] = mk([['wan', 1], ['wan', 2], ['wan', 3], ['tong', 1], ['tong', 2], ['tong', 3], ['tiao', 1], ['tiao', 2], ['tiao', 3], ['tiao', 4], ['tiao', 5], ['tiao', 6], ['tiao', 7]]);
  const clean = (suit1, suit2) => mk([[suit1, 1], [suit1, 2], [suit1, 3], [suit1, 4], [suit1, 5], [suit1, 6], [suit1, 7], [suit2, 1], [suit2, 2], [suit2, 3], [suit2, 4], [suit2, 5], [suit2, 6]]);
  s.hands[1] = clean('wan', 'tiao'); // void tong: clean
  s.hands[2] = clean('wan', 'tong'); // void tiao: clean
  s.hands[3] = clean('tong', 'tiao'); // void wan: clean
  assert.deepEqual(sichuan.calculatePenalties(s).penalties, [0, 0, 0, 0], 'not exhausted');
  s._exhausted = true;
  const r = sichuan.calculatePenalties(s);
  assert.equal(r.penalties.reduce((a, b) => a + b, 0), 0, 'zero-sum');
  assert.ok(r.penalties[0] < 0);
});

// ---- Cantonese: no win/kong right after chow/pung ----

test('cantonese: after a claim the holder cannot declare self-draw win or kong', () => {
  const s = cantonese.createState();
  cantonese.initGame(s, 4);
  s.phase = 'play'; s.currentPlayer = 1; s.hasDrawn = true; s._afterClaim = true;
  assert.equal(cantonese.handleMove({ type: 'win' }, s, 1), 'mj_not_winning');
  assert.equal(cantonese.handleMove({ type: 'selfkong', suit: 'wan', num: 1 }, s, 1), 'mj_cannot_kong');
});

// ---- whole games: 4 bots, driven by getCurrentActor, no deadlock ----

function runGame(bots, s, limit) {
  for (let step = 0; step < limit; step++) {
    if (s.phase === 'over' || (s.winner !== null && s.winner !== undefined)) return step;
    const p = sichuan.getCurrentActor(s);
    const mv = bots[p].getMove(s, p);
    const err = sichuan.handleMove(mv, s, p);
    assert.equal(err, null, 'move ' + JSON.stringify(mv) + ' by ' + p + ' rejected: ' + err + ' phase=' + s.phase);
  }
  assert.fail('deadlock / no result after ' + limit + ' steps, phase=' + s.phase);
}

for (const [label, opts] of [
  ['default blood battle', {}],
  ['all rules on', { mj_rain: true, mj_multiWinner: true, mj_checkFlowerPig: true, mj_checkBigCall: true, mj_lastFourAutoWin: true, mj_swapThree: true }],
  ['no blood battle + multi winner', { mj_bloodBattle: false, mj_multiWinner: true }],
]) {
  test('sichuan: 4 bots finish whole games (' + label + ')', () => {
    for (let g = 0; g < 8; g++) {
      const s = sichuan.createState();
      s._options = Object.assign({ mahjongMode: 'sichuan' }, opts);
      s.dealerIndex = g % 4;
      sichuan.initGame(s, 4);
      const bots = [0, 1, 2, 3].map(i => sichuanBot.createBot(i));
      runGame(bots, s, 5000);
      assert.equal(s.phase, 'over');
      const pen = sichuan.calculatePenalties(s);
      assert.equal(pen.penalties.reduce((a, b) => a + b, 0), 0);
      for (const w of s.winners) assert.ok(sichuan.calculateScore(s, w).fan >= 1);
    }
  });
}

for (const [label, opts] of [
  ['default', {}],
  ['wildcard + minFan 2', { mj_wildcard: true, mj_minFan: 2 }],
]) {
  test('cantonese: 4 bots finish whole games (' + label + ')', () => {
    for (let g = 0; g < 8; g++) {
      const s = sichuan.createState();
      s._options = Object.assign({ mahjongMode: 'cantonese' }, opts);
      s.dealerIndex = g % 4;
      sichuan.initGame(s, 4);
      const bots = [0, 1, 2, 3].map(i => sichuanBot.createBot(i));
      runGame(bots, s, 5000);
      assert.ok(s.phase === 'over' && s.winner !== null);
    }
  });
}
