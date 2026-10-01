const test = require('node:test');
const assert = require('node:assert/strict');
const sg = require('../games/sanguo');
const core = require('../games/lib/sanguo-core');
const { createBot } = require('../bots/sanguo');

let nextId = 1000;
const card = (name, suit = 'S', rank = 7) => ({ id: nextId++, name, suit, rank });

// A game frozen at the start of `p`'s play phase with chosen hands, roles and hp.
function table(n, opts = {}) {
  const s = sg.createState();
  sg.initGame(s, n);
  const roles = opts.roles || core.ROLES[n];
  s.players.forEach((P, i) => {
    Object.assign(P, { role: roles[i], hand: [], equip: {}, judge: [], general: 'none', hp: 4, maxHp: 4, gender: 'm', alive: true, shaUsed: 0, skipPlay: false });
  });
  s.lord = roles.indexOf('lord');
  s.deck = opts.deck || Array.from({ length: 40 }, () => card('sha', 'C', 3));
  s.discard = [];
  s.log = [];
  s.current = opts.p || 0;
  s.stack = [{ op: 'turn', p: s.current, step: 'play' }];
  s.ask = null;
  core.run(s);
  return s;
}
const give = (s, p, ...cards) => { s.players[p].hand.push(...cards); return cards; };
const ok = (s, p, data) => {
  const err = sg.handleMove(data, s, p);
  assert.equal(err, null, JSON.stringify(data) + ' by ' + p + ': ' + err);
};
const pass = (s) => ok(s, s.ask.to, { type: 'pass' });

test('sanguo: setup deals 4 cards, lord gets +1 hp and moves first', () => {
  for (let n = 4; n <= 8; n++) {
    const s = sg.createState();
    sg.initGame(s, n);
    const roles = s.players.map((P) => P.role).sort();
    assert.deepEqual(roles, core.ROLES[n].slice().sort());
    const lord = s.players[s.lord];
    assert.equal(lord.maxHp, sg.GENERALS.find((g) => g.id === lord.general).hp + 1);
    assert.equal(s.ask.type, 'play');
    assert.equal(s.ask.to, s.lord);
    assert.equal(lord.hand.length, 6); // 4 dealt + 2 drawn
  }
  assert.equal(core.buildDeck().length, 106);
});

test('sanguo: distance, horses and attack range', () => {
  const s = table(6);
  assert.equal(core.distance(s, 0, 1), 1);
  assert.equal(core.distance(s, 0, 3), 3);
  s.players[3].equip.plus = card('jueying');
  assert.equal(core.distance(s, 0, 3), 4);
  s.players[0].equip.minus = card('chitu');
  assert.equal(core.distance(s, 0, 3), 3);
  s.players[1].alive = false;
  assert.equal(core.distance(s, 0, 2), 1);
  const [sha] = give(s, 0, card('sha'));
  assert.equal(sg.handleMove({ type: 'use', cardId: sha.id, targets: [3] }, s, 0), 'sg_out_of_range');
  s.players[0].equip.weapon = card('fangtian');
  ok(s, 0, { type: 'use', cardId: sha.id, targets: [3] });
});

test('sanguo: sha is dodged by shan, otherwise deals 1 damage; one sha per turn', () => {
  const s = table(4);
  const [a, b] = give(s, 0, card('sha'), card('sha'));
  const [shan] = give(s, 1, card('shan', 'D'));
  ok(s, 0, { type: 'use', cardId: a.id, targets: [1] });
  assert.equal(s.ask.need, 'shan');
  ok(s, 1, { type: 'respond', cardId: shan.id });
  assert.equal(s.players[1].hp, 4);
  assert.equal(sg.handleMove({ type: 'use', cardId: b.id, targets: [1] }, s, 0), 'sg_sha_limit');
  s.players[0].equip.weapon = card('zhuge');
  ok(s, 0, { type: 'use', cardId: b.id, targets: [1] });
  assert.equal(s.players[1].hp, 3, 'no shan left → hit without asking');
});

test('sanguo: renwang blocks black sha, qinggang ignores it, bagua can dodge', () => {
  const s = table(4);
  s.players[1].equip.armor = card('renwang');
  const [black, red] = give(s, 0, card('sha', 'S'), card('sha', 'H'));
  s.players[0].equip.weapon = card('zhuge');
  ok(s, 0, { type: 'use', cardId: black.id, targets: [1] });
  assert.equal(s.players[1].hp, 4);
  ok(s, 0, { type: 'use', cardId: red.id, targets: [1] });
  assert.equal(s.players[1].hp, 3);

  const b = table(4, { deck: [card('shan', 'H', 2)] }); // judge card is red
  b.players[1].equip.armor = card('bagua');
  const [sha] = give(b, 0, card('sha'));
  ok(b, 0, { type: 'use', cardId: sha.id, targets: [1] });
  assert.equal(b.players[1].hp, 4);
});

test('sanguo: wuxie cancels a trick and a second wuxie restores it', () => {
  const s = table(4);
  const [wz] = give(s, 0, card('wuzhong'));
  const [w1] = give(s, 2, card('wuxie'));
  const [w2] = give(s, 3, card('wuxie'));
  ok(s, 0, { type: 'use', cardId: wz.id });
  assert.equal(s.ask.to, 2);
  ok(s, 2, { type: 'respond', cardId: w1.id });
  assert.equal(s.ask.to, 3);
  ok(s, 3, { type: 'respond', cardId: w2.id });
  assert.equal(s.players[0].hand.length, 2, 'draws 2 because the negation was negated');
});

test('sanguo: juedou alternates sha until one side runs out', () => {
  const s = table(4);
  const [jd, s1] = give(s, 0, card('juedou'), card('sha'));
  const [t1] = give(s, 1, card('sha'));
  ok(s, 0, { type: 'use', cardId: jd.id, targets: [1] });
  ok(s, 1, { type: 'respond', cardId: t1.id });
  ok(s, 0, { type: 'respond', cardId: s1.id });
  assert.equal(s.players[1].hp, 3);
  assert.equal(s.players[0].hp, 4);
});

test('sanguo: nanman hits everyone without sha', () => {
  const s = table(4);
  const [nm] = give(s, 0, card('nanman'));
  const [x] = give(s, 2, card('sha'));
  ok(s, 0, { type: 'use', cardId: nm.id });
  ok(s, 2, { type: 'respond', cardId: x.id });
  assert.deepEqual(s.players.map((P) => P.hp), [4, 3, 4, 3]);
});

test('sanguo: dying players can be saved with tao, otherwise they die', () => {
  const s = table(4);
  s.players[1].hp = 1;
  const [a] = give(s, 0, card('sha'));
  const [tao] = give(s, 2, card('tao', 'H'));
  ok(s, 0, { type: 'use', cardId: a.id, targets: [1] });
  assert.equal(s.ask.need, 'tao');
  assert.equal(s.ask.to, 2);
  ok(s, 2, { type: 'respond', cardId: tao.id });
  assert.equal(s.players[1].hp, 1);
  assert.equal(s.players[1].alive, true);
});

test('sanguo: killing a rebel draws 3; lord killing a loyalist loses all cards', () => {
  const s = table(5);
  s.players[0].equip.weapon = card('zhuge');
  s.players[0].equip.minus = card('chitu'); // reach seat 2
  s.players[2].hp = 1; // rebel
  const [a, b] = give(s, 0, card('sha'), card('sha'));
  ok(s, 0, { type: 'use', cardId: a.id, targets: [2] }); // no shan, no tao → dies
  assert.equal(s.players[2].alive, false);
  assert.equal(s.players[0].hand.length, 1 + 3);
  s.players[1].hp = 1; // loyal
  ok(s, 0, { type: 'use', cardId: b.id, targets: [1] });
  assert.equal(s.players[1].alive, false);
  assert.equal(s.players[0].hand.length, 0);
  assert.deepEqual(s.players[0].equip, {});
});

test('sanguo: win conditions for lord, rebels and spy', () => {
  const a = table(4);
  a.players[2].alive = false;
  a.players[3].alive = false;
  assert.equal(core.checkWin(a), true);
  assert.equal(a.winner, -2);
  assert.deepEqual(a.winners, [0, 1]);

  const b = table(4);
  b.players[0].hp = 1;
  b.current = 2;
  b.ask = null;
  b.stack = [{ op: 'damage', from: 2, to: 0, n: 1 }];
  core.run(b);
  assert.equal(b.winner, -3);
  assert.deepEqual(b.winners, [2]);

  const c = table(4);
  c.players[1].alive = false;
  c.players[2].alive = false;
  c.players[0].hp = 1;
  c.ask = null;
  c.stack = [{ op: 'damage', from: 3, to: 0, n: 1 }];
  core.run(c);
  assert.equal(c.winner, -4);
});

test('sanguo: lebu skips the play phase unless the judge is a heart', () => {
  const s = table(4, { deck: [card('sha'), card('sha'), card('sha', 'S', 5)] });
  const [lb] = give(s, 0, card('lebu', 'S'));
  ok(s, 0, { type: 'use', cardId: lb.id, targets: [1] });
  ok(s, 0, { type: 'end' });
  // seat 1's turn: judge (spade) → skip play → discard/end → seat 2 plays
  assert.equal(s.ask.to, 2);
  assert.equal(s.log.some((e) => e.t === 'skip_play' && e.p === 1), true);
});

test('sanguo: discard down to hp at the end of the turn', () => {
  const s = table(4);
  s.players[0].hp = 2;
  give(s, 0, card('shan'), card('shan'), card('shan'), card('shan'));
  ok(s, 0, { type: 'end' });
  assert.equal(s.ask.type, 'discard');
  assert.equal(s.ask.count, 2);
  const ids = s.players[0].hand.slice(0, 2).map((c) => c.id);
  ok(s, 0, { type: 'discard', cardIds: ids });
  assert.equal(s.players[0].hand.length, 2);
  assert.equal(s.ask.to, 1);
});

test('sanguo: playerView hides other hands, the deck and hidden roles', () => {
  const s = sg.createState();
  sg.initGame(s, 5);
  const me = (s.lord + 1) % 5;
  const before = JSON.stringify(s);
  const v = sg.playerView(s, me);
  assert.equal(JSON.stringify(s), before);
  assert.equal(v.deck.length, 0);
  assert.equal(v.deckCount, s.deck.length);
  v.players.forEach((P, i) => {
    if (i !== me) assert.deepEqual(P.hand, []);
    assert.equal(P.handCount, s.players[i].hand.length);
    if (i !== me && i !== s.lord) assert.equal(P.role, null);
  });
  assert.equal(v.players[s.lord].role, 'lord');
});

test('sanguo: bots finish whole games for 4–8 players', () => {
  for (let n = 4; n <= 8; n++) {
    for (let round = 0; round < 8; round++) {
      const s = sg.createState();
      sg.initGame(s, n);
      const bots = Array.from({ length: n }, (_, i) => createBot(i));
      let steps = 0;
      while (s.winner === null && steps++ < 20000) {
        const p = s.ask.to;
        const err = sg.handleMove(bots[p].getMove(s, p), s, p);
        if (err) sg.onTimeout(s);
      }
      assert.ok([-2, -3, -4].indexOf(s.winner) >= 0, 'n=' + n + ' stuck: ' + JSON.stringify(s.ask));
      const total = s.deck.length + s.discard.length + s.players.reduce((k, P) => k + P.hand.length + Object.keys(P.equip).length + P.judge.length, 0);
      assert.ok(total <= 106);
    }
  }
});

// ---- general skills ----
const as = (s, p, general) => { s.players[p].general = general; if (general === 'lvbu') s.players[p].gender = 'm'; };

test('sanguo skills: rende gives cards and heals once after 2 given; zhiheng and qingnang once per turn', () => {
  const s = table(4);
  as(s, 0, 'liubei');
  s.players[0].hp = 2;
  const [a, b, c] = give(s, 0, card('shan'), card('shan'), card('sha'));
  ok(s, 0, { type: 'skill', skill: 'rende', cardIds: [a.id], targets: [1] });
  assert.equal(s.players[0].hp, 2);
  ok(s, 0, { type: 'skill', skill: 'rende', cardIds: [b.id], targets: [1] });
  assert.equal(s.players[0].hp, 3);
  assert.equal(s.players[1].hand.length, 2);
  assert.equal(sg.handleMove({ type: 'skill', skill: 'zhiheng', cardIds: [c.id] }, s, 0), 'sg_bad_skill');

  const z = table(4);
  as(z, 0, 'sunquan');
  const cs = give(z, 0, card('sha'), card('sha'));
  ok(z, 0, { type: 'skill', skill: 'zhiheng', cardIds: cs.map((x) => x.id) });
  assert.equal(z.players[0].hand.length, 2);
  assert.equal(sg.handleMove({ type: 'skill', skill: 'zhiheng', cardIds: [z.players[0].hand[0].id] }, z, 0), 'sg_skill_used');

  const h = table(4);
  as(h, 0, 'huatuo');
  h.players[1].hp = 2;
  const [x] = give(h, 0, card('sha'));
  ok(h, 0, { type: 'skill', skill: 'qingnang', cardIds: [x.id], targets: [1] });
  assert.equal(h.players[1].hp, 3);
});

test('sanguo skills: wusheng, qixi, paoxiao and jijiu conversions', () => {
  const s = table(4);
  as(s, 0, 'guanyu');
  const [red] = give(s, 0, card('shan', 'H'));
  ok(s, 0, { type: 'use', cardId: red.id, as: 'sha', targets: [1] });
  assert.equal(s.players[1].hp, 3);
  const [bad] = give(s, 0, card('shan', 'S'));
  assert.equal(sg.handleMove({ type: 'use', cardId: bad.id, as: 'sha', targets: [1] }, s, 0), 'sg_bad_card');

  const q = table(4);
  as(q, 0, 'ganning');
  q.players[1].hand.push(card('sha'));
  const [blk] = give(q, 0, card('shan', 'C'));
  ok(q, 0, { type: 'use', cardId: blk.id, as: 'guohe', targets: [1] });
  assert.equal(q.ask.type, 'pick');

  const p = table(4);
  as(p, 0, 'zhangfei');
  const [s1, s2] = give(p, 0, card('sha'), card('sha'));
  ok(p, 0, { type: 'use', cardId: s1.id, targets: [1] });
  ok(p, 0, { type: 'use', cardId: s2.id, targets: [1] });
  assert.equal(p.players[1].hp, 2);

  const j = table(4);
  as(j, 2, 'huatuo');
  j.players[1].hp = 1;
  const [sha] = give(j, 0, card('sha'));
  const [rc] = give(j, 2, card('shan', 'D'));
  ok(j, 0, { type: 'use', cardId: sha.id, targets: [1] });
  assert.equal(j.ask.need, 'tao');
  ok(j, 2, { type: 'respond', cardId: rc.id });
  assert.equal(j.players[1].alive, true);
});

test('sanguo skills: jianxiong, fankui, ganglie, wushuang, biyue, keji, lijian', () => {
  const c = table(4);
  as(c, 1, 'caocao');
  const [sha] = give(c, 0, card('sha'));
  ok(c, 0, { type: 'use', cardId: sha.id, targets: [1] });
  assert.equal(c.players[1].hand.some((x) => x.id === sha.id), true, 'caocao keeps the sha that hit him');
  assert.equal(c.discard.some((x) => x.id === sha.id), false);

  const f = table(4);
  as(f, 1, 'simayi');
  const [s2] = give(f, 0, card('sha'), card('tao'));
  const before = f.players[0].hand.length;
  ok(f, 0, { type: 'use', cardId: s2.id, targets: [1] });
  assert.equal(f.players[0].hand.length, before - 2, 'sha spent and one card taken');
  assert.equal(f.players[1].hand.length, 1);

  const g = table(4, { deck: [card('shan', 'S', 5)] }); // black judge → ganglie works
  as(g, 1, 'xiahoudun');
  const [s3] = give(g, 0, card('sha'));
  ok(g, 0, { type: 'use', cardId: s3.id, targets: [1] });
  assert.equal(g.players[0].hp, 3, 'attacker has no 2 cards to discard → takes 1');

  const w = table(4);
  as(w, 0, 'lvbu');
  const [s4] = give(w, 0, card('sha'));
  const [sh1] = give(w, 1, card('shan'), card('shan'));
  ok(w, 0, { type: 'use', cardId: s4.id, targets: [1] });
  ok(w, 1, { type: 'respond', cardId: sh1.id });
  assert.equal(w.ask.type, 'respond', 'second shan is required against wushuang');
  ok(w, 1, { type: 'pass' });
  assert.equal(w.players[1].hp, 3);

  const d = table(4);
  as(d, 0, 'diaochan');
  const n0 = d.players[0].hand.length;
  ok(d, 0, { type: 'end' });
  assert.equal(d.players[0].hand.length, n0 + 1, 'biyue draws at end of turn');

  const k = table(4);
  as(k, 0, 'lvmeng');
  k.players[0].hp = 1;
  give(k, 0, card('shan'), card('shan'), card('shan'));
  ok(k, 0, { type: 'end' });
  assert.equal(k.players[0].hand.length, 3, 'keji skips the discard phase');

  const l = table(4);
  as(l, 0, 'diaochan');
  const [lc] = give(l, 0, card('sha'));
  l.players[2].gender = 'm';
  give(l, 1, card('sha')); // the duel victim (seat 2) is asked first
  give(l, 2, card('sha'));
  ok(l, 0, { type: 'skill', skill: 'lijian', cardIds: [lc.id], targets: [1, 2] });
  assert.equal(l.ask.type, 'respond');
  assert.equal(l.ask.reason, 'juedou');
});
