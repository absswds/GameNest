// games/lib/sanguo-core.js
// Rules engine for the standard identity mode (主公/忠臣/反贼/内奸, 4–8 players).
// Card and skill names live only in the lang packs; code uses English ids.
//
// The engine is a data-only stack machine so the whole state stays JSON:
// every pending effect is a frame on s.stack, and a frame that needs a
// player's decision sets s.ask and waits. handleMove stores the answer on the
// top frame and runs the stack again.

const EQUIP = {
  zhuge: { slot: 'weapon', range: 1 }, qinggang: { slot: 'weapon', range: 2 }, cixiong: { slot: 'weapon', range: 2 },
  hanbing: { slot: 'weapon', range: 2 }, guanshi: { slot: 'weapon', range: 3 }, qinglong: { slot: 'weapon', range: 3 },
  zhangba: { slot: 'weapon', range: 3 }, fangtian: { slot: 'weapon', range: 4 }, qilin: { slot: 'weapon', range: 5 },
  bagua: { slot: 'armor' }, renwang: { slot: 'armor' },
  jueying: { slot: 'plus' }, dilu: { slot: 'plus' }, zhuahuang: { slot: 'plus' },
  chitu: { slot: 'minus' }, dawan: { slot: 'minus' }, zixing: { slot: 'minus' },
};
const TRICKS = ['wuxie', 'guohe', 'shunshou', 'wuzhong', 'juedou', 'jiedao', 'nanman', 'wanjian', 'taoyuan', 'wugu'];
const DELAYED = ['lebu', 'shandian'];
const HARMFUL = ['guohe', 'shunshou', 'juedou', 'jiedao', 'nanman', 'wanjian', 'lebu', 'shandian'];

// [name, suit, ranks...]; suits S♠ H♥ C♣ D♦, ranks 1–13
const DECK = [
  ['sha', 'S', 7, 8, 8, 9, 9, 10, 10], ['sha', 'C', 2, 3, 4, 5, 6, 7, 8, 8, 9, 9, 10, 10, 11, 11],
  ['sha', 'H', 10, 10, 11], ['sha', 'D', 6, 7, 8, 9, 10, 13],
  ['shan', 'H', 2, 2, 13], ['shan', 'D', 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11],
  ['tao', 'H', 3, 4, 6, 7, 8, 9, 12], ['tao', 'D', 12],
  ['wuxie', 'S', 11], ['wuxie', 'C', 12, 13], ['guohe', 'S', 3, 4, 12], ['guohe', 'C', 3, 4], ['guohe', 'H', 12],
  ['shunshou', 'S', 3, 4, 11], ['shunshou', 'D', 3, 4], ['wuzhong', 'H', 7, 8, 9, 11],
  ['juedou', 'S', 1], ['juedou', 'C', 1], ['juedou', 'D', 1], ['jiedao', 'C', 12, 13],
  ['nanman', 'S', 7, 13], ['nanman', 'C', 7], ['wanjian', 'H', 1], ['taoyuan', 'H', 1], ['wugu', 'H', 3, 4],
  ['lebu', 'S', 6], ['lebu', 'C', 6], ['lebu', 'H', 6], ['shandian', 'S', 1],
  ['zhuge', 'C', 1], ['zhuge', 'D', 1], ['qinggang', 'S', 6], ['cixiong', 'S', 2], ['hanbing', 'S', 2],
  ['guanshi', 'D', 5], ['qinglong', 'S', 5], ['zhangba', 'S', 12], ['fangtian', 'D', 12], ['qilin', 'H', 5],
  ['bagua', 'S', 2], ['bagua', 'C', 2], ['renwang', 'C', 2],
  ['jueying', 'S', 5], ['dilu', 'C', 5], ['zhuahuang', 'H', 13], ['chitu', 'H', 5], ['dawan', 'S', 13], ['zixing', 'D', 13],
];

// Seats by player count; lord always first in the list
const ROLES = {
  4: ['lord', 'loyal', 'rebel', 'spy'],
  5: ['lord', 'loyal', 'rebel', 'rebel', 'spy'],
  6: ['lord', 'loyal', 'rebel', 'rebel', 'rebel', 'spy'],
  7: ['lord', 'loyal', 'loyal', 'rebel', 'rebel', 'rebel', 'spy'],
  8: ['lord', 'loyal', 'loyal', 'rebel', 'rebel', 'rebel', 'rebel', 'spy'],
};

const SEC = { play: 40, respond: 15, wuxie: 10, discard: 25, pick: 15, confirm: 12, wugu: 15 };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const cards = [];
  let id = 1;
  for (const [name, suit, ...ranks] of DECK) for (const rank of ranks) cards.push({ id: id++, name, suit, rank });
  return cards;
}

const cardType = (name) => (EQUIP[name] ? 'equip' : TRICKS.indexOf(name) >= 0 ? 'trick' : DELAYED.indexOf(name) >= 0 ? 'delayed' : 'basic');
const isRed = (c) => c && (c.suit === 'H' || c.suit === 'D');
const isBlack = (c) => c && (c.suit === 'S' || c.suit === 'C');

// ---------- setup ----------
function setup(s, n, generals) {
  n = Math.max(4, Math.min(8, n));
  const roles = ROLES[n].slice(1);
  shuffle(roles);
  const lordSeat = Math.floor(Math.random() * n);
  const seatRoles = [];
  for (let i = 0, k = 0; i < n; i++) seatRoles.push(i === lordSeat ? 'lord' : roles[k++]);
  const pool = shuffle(generals.slice());
  Object.assign(s, {
    n,
    winner: null,
    winners: [],
    deck: shuffle(buildDeck()),
    discard: [],
    processing: [],
    stack: [],
    ask: null,
    askSeq: 0,
    round: 1,
    current: lordSeat,
    lord: lordSeat,
    log: [],
    players: seatRoles.map((role, i) => {
      const g = pool[i % pool.length];
      const maxHp = g.hp + (role === 'lord' ? 1 : 0);
      return { role, general: g.id, gender: g.gender, kingdom: g.kingdom, hp: maxHp, maxHp, alive: true,
        hand: [], equip: {}, judge: [], shaUsed: 0, skipPlay: false };
    }),
  });
  for (let i = 0; i < n; i++) draw(s, i, 4);
  s.stack.push({ op: 'turn', p: lordSeat });
  run(s);
}

// ---------- helpers ----------
function log(s, e) {
  s.log.push(e);
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

function takeTop(s) {
  if (!s.deck.length) {
    if (!s.discard.length) return null;
    s.deck = shuffle(s.discard);
    s.discard = [];
  }
  return s.deck.pop();
}

function draw(s, p, n) {
  for (let k = 0; k < n; k++) {
    const c = takeTop(s);
    if (!c) break;
    s.players[p].hand.push(c);
  }
}

function toDiscard(s, cards) {
  for (const c of [].concat(cards)) if (c) s.discard.push(c);
}

function handIndex(s, p, id) { return s.players[p].hand.findIndex((c) => c.id === id); }
function takeFromHand(s, p, id) {
  const i = handIndex(s, p, id);
  return i < 0 ? null : s.players[p].hand.splice(i, 1)[0];
}
const hasCard = (s, p, name) => s.players[p].hand.some((c) => c.name === name);
const gen = (s, p) => s.players[p].general;
// Does this hand card count as `name` for player p? (guanyu: red as sha; huatuo: red as tao off-turn)
const asCard = (s, p, c, name) => c.name === name
  || (name === 'sha' && gen(s, p) === 'guanyu' && isRed(c))
  || (name === 'tao' && gen(s, p) === 'huatuo' && isRed(c) && s.current !== p);
const canPlay = (s, p, name) => s.players[p].hand.some((c) => asCard(s, p, c, name));
const noShaLimit = (s, p) => weapon(s, p) === 'zhuge' || gen(s, p) === 'zhangfei';
const weapon = (s, p) => s.players[p].equip.weapon && s.players[p].equip.weapon.name;
const armor = (s, p) => s.players[p].equip.armor && s.players[p].equip.armor.name;

function aliveFrom(s, start) {
  const out = [];
  for (let k = 0; k < s.n; k++) {
    const i = (start + k) % s.n;
    if (s.players[i].alive) out.push(i);
  }
  return out;
}
const nextAlive = (s, p) => aliveFrom(s, p + 1)[0];

function distance(s, a, b) {
  if (a === b) return 0;
  const ring = aliveFrom(s, a);
  const k = ring.indexOf(b);
  if (k < 0) return Infinity;
  let d = Math.min(k, ring.length - k);
  if (s.players[b].equip.plus) d++;
  if (s.players[a].equip.minus) d--;
  return Math.max(1, d);
}
const attackRange = (s, p) => (weapon(s, p) ? EQUIP[weapon(s, p)].range : 1);
const inRange = (s, a, b) => distance(s, a, b) <= attackRange(s, a);

function allCards(P) {
  return P.hand.concat(Object.values(P.equip), P.judge);
}
const hasAnyCard = (P) => allCards(P).length > 0;
const handAndEquip = (P) => P.hand.concat(Object.values(P.equip));

function setAsk(s, ask, sec) {
  s.ask = Object.assign({ seq: ++s.askSeq, deadline: Date.now() + sec * 1000 }, ask);
}

function judge(s, p, reason) {
  const c = takeTop(s);
  if (!c) return null;
  log(s, { t: 'judge', p, reason, card: c });
  toDiscard(s, c);
  return c;
}

function removeEquipOrJudge(s, t, id) {
  const P = s.players[t];
  for (const slot of Object.keys(P.equip)) {
    if (P.equip[slot].id === id) { const c = P.equip[slot]; delete P.equip[slot]; return c; }
  }
  const j = P.judge.findIndex((c) => c.id === id);
  return j >= 0 ? P.judge.splice(j, 1)[0] : null;
}

// ---------- main loop ----------
function run(s) {
  let guard = 0;
  while (!s.ask && s.winner === null && s.stack.length && guard++ < 20000) {
    const f = s.stack[s.stack.length - 1];
    OPS[f.op](s, f);
  }
}
const pop = (s) => s.stack.pop();

// A frame asks, then comes back with f.answer set.
function answer(f) { const a = f.answer; f.answer = undefined; return a; }

const OPS = {
  turn(s, f) {
    const p = f.p, P = s.players[p];
    if (!P.alive && f.step !== 'next') f.step = 'end';
    switch (f.step) {
      case undefined:
        s.current = p;
        P.shaUsed = 0;
        P.shaPlayed = false; // 克己 also counts a sha played (打出) in answer, e.g. inside a duel
        P.used = {};
        P.given = 0;
        log(s, { t: 'turn', p });
        f.step = 'judge';
        return;
      case 'judge':
        if (P.judge.length) { s.stack.push({ op: 'delayed', p, card: P.judge.pop() }); return; }
        f.step = 'draw';
        return;
      case 'draw':
        draw(s, p, 2);
        f.step = 'play';
        return;
      case 'play': {
        if (P.skipPlay) { P.skipPlay = false; log(s, { t: 'skip_play', p }); f.step = 'discard'; return; }
        if (f.answer === undefined) return setAsk(s, { type: 'play', to: p }, SEC.play);
        const a = answer(f);
        if (a.end) { f.step = 'discard'; return; }
        if (a.frame) s.stack.push(a.frame); // skills without a frame just re-ask
        return;
      }
      case 'discard': {
        const over = gen(s, p) === 'lvmeng' && P.shaUsed === 0 && !P.shaPlayed ? 0 : P.hand.length - Math.max(0, P.hp);
        if (over > 0) {
          if (f.answer === undefined) return setAsk(s, { type: 'discard', to: p, count: over, reason: 'limit' }, SEC.discard);
          const ids = answer(f).cardIds;
          const cards = ids.map((id) => takeFromHand(s, p, id));
          toDiscard(s, cards);
          log(s, { t: 'discard', p, cards });
        }
        f.step = 'end';
        return;
      }
      case 'end':
        pop(s);
        if (s.winner !== null) return;
        if (P.alive && gen(s, p) === 'diaochan') draw(s, p, 1);
        {
          const next = nextAlive(s, p);
          if (next <= p) s.round++;
          s.stack.push({ op: 'turn', p: next });
        }
        return;
    }
  },

  delayed(s, f) {
    if (!f.step) {
      f.step = 1;
      s.stack.push({ op: 'wuxie', trick: f.card.name, target: f.p });
      return;
    }
    pop(s);
    const next = nextAlive(s, f.p);
    if (s.lastWuxie) {
      if (f.card.name === 'shandian') s.players[next].judge.push(f.card);
      else toDiscard(s, f.card);
      return;
    }
    const j = judge(s, f.p, f.card.name);
    if (f.card.name === 'lebu') {
      if (!j || j.suit !== 'H') s.players[f.p].skipPlay = true;
      toDiscard(s, f.card);
    } else if (j && j.suit === 'S' && j.rank >= 2 && j.rank <= 9) {
      toDiscard(s, f.card);
      s.stack.push({ op: 'damage', from: -1, to: f.p, n: 3, nature: 'thunder' });
    } else {
      s.players[next].judge.push(f.card);
    }
  },

  // Anyone holding the negation card may cancel a trick; a later one cancels the previous.
  wuxie(s, f) {
    if (f.order === undefined) { f.order = aliveFrom(s, s.current); f.i = 0; f.cancelled = false; }
    while (f.i < f.order.length) {
      const q = f.order[f.i];
      if (f.answer !== undefined || (s.players[q].alive && hasCard(s, q, 'wuxie'))) {
        if (f.answer === undefined) {
          return setAsk(s, { type: 'respond', need: 'wuxie', to: q, trick: f.trick, target: f.target, cancelled: f.cancelled }, SEC.wuxie);
        }
        const a = answer(f);
        if (a.cards) {
          toDiscard(s, a.cards);
          f.cancelled = !f.cancelled;
          log(s, { t: 'wuxie', p: q, trick: f.trick, target: f.target, cancelled: f.cancelled });
          f.i = 0;
          continue;
        }
      }
      f.i++;
    }
    s.lastWuxie = f.cancelled;
    pop(s);
  },

  use(s, f) {
    const P = s.players[f.from];
    if (!f.step) {
      f.step = 1;
      f.i = 0;
      s.processing = f.cards.slice();
      log(s, { t: 'use', p: f.from, name: f.name, cards: f.cards, targets: f.targets });
      const type = cardType(f.name);
      if (type === 'equip') {
        const slot = EQUIP[f.name].slot;
        if (P.equip[slot]) toDiscard(s, P.equip[slot]);
        P.equip[slot] = f.cards[0];
        s.processing = [];
        return pop(s);
      }
      if (type === 'delayed') {
        s.players[f.targets[0]].judge.push(f.cards[0]);
        s.processing = [];
        return pop(s);
      }
      if (f.name === 'sha') P.shaUsed++;
      if (f.name === 'tao') {
        P.hp = Math.min(P.maxHp, P.hp + 1);
        toDiscard(s, f.cards);
        s.processing = [];
        return pop(s);
      }
      if (f.name === 'wugu') s.wugu = { cards: Array.from({ length: f.targets.length }, () => takeTop(s)).filter(Boolean), from: f.from };
    }
    while (f.i < f.targets.length) {
      const t = f.targets[f.i++];
      if (!s.players[t].alive) continue;
      if (f.name === 'sha') s.stack.push({ op: 'sha', from: f.from, to: t, card: f.cards });
      else s.stack.push({ op: 'trick', name: f.name, from: f.from, to: t, victim: f.victim });
      return;
    }
    toDiscard(s, f.cards.filter((c) => s.processing.some((x) => x.id === c.id)));
    if (f.name === 'wugu' && s.wugu) { toDiscard(s, s.wugu.cards); s.wugu = null; }
    s.processing = [];
    pop(s);
  },

  sha(s, f) {
    const A = f.from, T = f.to;
    const cards = [].concat(f.card);
    const ignoreArmor = weapon(s, A) === 'qinggang';
    switch (f.step) {
      case undefined:
        if (!s.players[T].alive) return pop(s);
        if (armor(s, T) === 'renwang' && !ignoreArmor && cards.length === 1 && isBlack(cards[0])) {
          log(s, { t: 'blocked', p: T, by: 'renwang' });
          return pop(s);
        }
        f.step = weapon(s, A) === 'cixiong' && s.players[A].gender !== s.players[T].gender ? 'cixiong' : 'need';
        return;
      case 'cixiong': {
        if (!s.players[T].hand.length) { draw(s, A, 1); f.step = 'need'; return; }
        if (f.answer === undefined) return setAsk(s, { type: 'respond', need: 'any', to: T, from: A, reason: 'cixiong' }, SEC.confirm);
        const a = answer(f);
        if (a.cards) toDiscard(s, a.cards);
        else draw(s, A, 1);
        f.step = 'need';
        return;
      }
      case 'need':
        f.step = 'afterNeed';
        s.stack.push({ op: 'need', to: T, name: 'shan', from: A, armorOk: !ignoreArmor, count: gen(s, A) === 'lvbu' ? 2 : 1 });
        return;
      case 'afterNeed':
        if (!s.lastNeed) { f.step = 'hit'; return; }
        log(s, { t: 'dodged', p: T, by: A });
        if (weapon(s, A) === 'guanshi' && s.players[A].hand.length + Object.keys(s.players[A].equip).length - 1 >= 2) { f.step = 'guanshi'; return; }
        f.step = 'qinglong';
        return;
      case 'guanshi': {
        if (f.answer === undefined) return setAsk(s, { type: 'discard', to: A, count: 2, reason: 'guanshi', optional: true, allowEquip: true }, SEC.confirm);
        const ids = answer(f).cardIds;
        if (ids && ids.length === 2) {
          toDiscard(s, ids.map((id) => takeFromHand(s, A, id) || removeEquipOrJudge(s, A, id)));
          log(s, { t: 'weapon', p: A, name: 'guanshi' });
          f.step = 'hit';
          return;
        }
        f.step = 'qinglong';
        return;
      }
      case 'qinglong':
        if (weapon(s, A) !== 'qinglong' || !s.players[T].alive) return pop(s);
        f.step = 'qinglong2';
        s.stack.push({ op: 'need', to: A, name: 'sha', from: T, reason: 'qinglong', optional: true, count: 1 });
        return;
      case 'qinglong2':
        pop(s);
        if (s.lastNeed) s.stack.push({ op: 'sha', from: A, to: T, card: s.lastNeedCards || [] });
        return;
      case 'hit':
        if (weapon(s, A) === 'hanbing' && handAndEquip(s.players[T]).length) {
          if (f.answer === undefined) return setAsk(s, { type: 'confirm', to: A, reason: 'hanbing', target: T }, SEC.confirm);
          if (answer(f).yes) {
            log(s, { t: 'weapon', p: A, name: 'hanbing' });
            pop(s);
            s.stack.push({ op: 'pick', from: A, to: T, mode: 'discard', left: 2, noJudge: true });
            return;
          }
        }
        f.step = 'qilin';
        s.stack.push({ op: 'damage', from: A, to: T, n: 1, card: cards });
        return;
      case 'qilin': {
        pop(s);
        const TP = s.players[T];
        if (weapon(s, A) === 'qilin' && TP.alive && (TP.equip.plus || TP.equip.minus)) {
          const slot = TP.equip.plus ? 'plus' : 'minus';
          toDiscard(s, TP.equip[slot]);
          delete TP.equip[slot];
          log(s, { t: 'weapon', p: A, name: 'qilin' });
        }
        return;
      }
    }
  },

  // Ask `to` for `count` cards named `name` (shan or sha). Sets s.lastNeed.
  need(s, f) {
    if (f.got === undefined) f.got = 0;
    if (f.name === 'shan' && f.armorOk !== false && armor(s, f.to) === 'bagua' && !f.baguaDone) {
      f.baguaDone = true;
      const j = judge(s, f.to, 'bagua');
      if (isRed(j)) { f.got++; log(s, { t: 'bagua', p: f.to }); }
    }
    while (f.got < (f.count || 1)) {
      const P = s.players[f.to];
      const canAnswer = canPlay(s, f.to, f.name) || (f.name === 'sha' && weapon(s, f.to) === 'zhangba' && P.hand.length >= 2);
      if (!canAnswer && f.answer === undefined) { s.lastNeed = false; s.lastNeedCards = null; return pop(s); }
      if (f.answer === undefined) {
        return setAsk(s, { type: 'respond', need: f.name, to: f.to, from: f.from, reason: f.reason || null }, SEC.respond);
      }
      const a = answer(f);
      if (!a.cards) { s.lastNeed = false; s.lastNeedCards = null; return pop(s); }
      toDiscard(s, a.cards);
      s.lastNeedCards = a.cards;
      log(s, { t: 'respond', p: f.to, name: f.name, cards: a.cards });
      if (f.name === 'sha' && f.to === s.current) s.players[f.to].shaPlayed = true;
      f.got++;
    }
    s.lastNeed = true;
    pop(s);
  },

  damage(s, f) {
    const T = s.players[f.to];
    if (!f.step) {
      f.step = 1;
      if (!T.alive) return pop(s);
      T.hp -= f.n;
      log(s, { t: 'damage', p: f.to, from: f.from, n: f.n, nature: f.nature || null });
      if (T.hp <= 0) s.stack.push({ op: 'dying', who: f.to, from: f.from });
      return;
    }
    pop(s);
    if (T.alive && f.from !== f.to) s.stack.push({ op: 'onDamage', to: f.to, from: f.from });
  },

  // Skills that trigger after damage: caocao, simayi, xiahoudun
  onDamage(s, f) {
    const T = s.players[f.to], g = T.general;
    if (g === 'caocao' && s.processing.length) {
      const got = s.processing.splice(0);
      T.hand.push(...got);
      log(s, { t: 'skill', p: f.to, skill: 'jianxiong' });
    }
    const src = f.from >= 0 ? s.players[f.from] : null;
    if (g === 'simayi' && src && src.alive && (src.hand.length || Object.keys(src.equip).length)) {
      const c = src.hand.length ? src.hand.splice(Math.floor(Math.random() * src.hand.length), 1)[0] : removeEquipOrJudge(s, f.from, Object.values(src.equip)[0].id);
      T.hand.push(c);
      log(s, { t: 'skill', p: f.to, skill: 'fankui', target: f.from });
    }
    if (g === 'xiahoudun' && src && src.alive) {
      if (!f.step) {
        f.step = 1;
        log(s, { t: 'skill', p: f.to, skill: 'ganglie', target: f.from });
        const j = judge(s, f.to, 'ganglie');
        if (j && j.suit !== 'H') {
          if (src.hand.length >= 2) return setAsk(s, { type: 'discard', to: f.from, count: 2, reason: 'ganglie', optional: true }, SEC.confirm);
          s.stack.pop();
          s.stack.push({ op: 'damage', from: f.to, to: f.from, n: 1 });
          return;
        }
      } else {
        const a = answer(f);
        if (a && a.cardIds && a.cardIds.length === 2) toDiscard(s, a.cardIds.map((id) => takeFromHand(s, f.from, id)));
        else { s.stack.pop(); s.stack.push({ op: 'damage', from: f.to, to: f.from, n: 1 }); return; }
      }
    }
    pop(s);
  },

  dying(s, f) {
    const P = s.players[f.who];
    if (!f.order) { f.order = aliveFrom(s, s.current); f.i = 0; log(s, { t: 'dying', p: f.who }); }
    while (P.hp <= 0 && f.i < f.order.length) {
      const q = f.order[f.i];
      if (f.answer !== undefined || (s.players[q].alive && canPlay(s, q, 'tao'))) {
        if (f.answer === undefined) return setAsk(s, { type: 'respond', need: 'tao', to: q, dying: f.who }, SEC.respond);
        const a = answer(f);
        if (a.cards) {
          toDiscard(s, a.cards);
          P.hp += 1;
          log(s, { t: 'save', p: q, who: f.who });
          continue;
        }
      }
      f.i++;
    }
    pop(s);
    if (P.hp <= 0) s.stack.push({ op: 'death', who: f.who, killer: f.from });
  },

  death(s, f) {
    pop(s);
    const P = s.players[f.who];
    P.alive = false;
    log(s, { t: 'death', p: f.who, role: P.role, killer: f.killer });
    toDiscard(s, allCards(P));
    P.hand = []; P.equip = {}; P.judge = [];
    if (checkWin(s)) return;
    const K = f.killer >= 0 ? s.players[f.killer] : null;
    if (K && K.alive && P.role === 'rebel') draw(s, f.killer, 3);
    if (K && K.alive && P.role === 'loyal' && K.role === 'lord') {
      toDiscard(s, K.hand.concat(Object.values(K.equip)));
      K.hand = []; K.equip = {};
      log(s, { t: 'lord_penalty', p: f.killer });
    }
  },

  trick(s, f) {
    const A = f.from, T = f.to;
    if (!f.step) {
      f.step = 'go';
      s.stack.push({ op: 'wuxie', trick: f.name, target: T });
      return;
    }
    if (f.step === 'go') {
      if (s.lastWuxie || !s.players[T].alive) return pop(s);
      f.step = f.name;
    }
    switch (f.step) {
      case 'wuzhong': pop(s); draw(s, T, 2); return;
      case 'taoyuan': pop(s); s.players[T].hp = Math.min(s.players[T].maxHp, s.players[T].hp + 1); return;
      case 'guohe': case 'shunshou':
        pop(s);
        if (hasAnyCard(s.players[T])) s.stack.push({ op: 'pick', from: A, to: T, mode: f.name === 'guohe' ? 'discard' : 'take', left: 1 });
        return;
      case 'nanman': case 'wanjian':
        f.step = 'aoe2';
        s.stack.push({ op: 'need', to: T, name: f.name === 'nanman' ? 'sha' : 'shan', from: A, count: 1 });
        return;
      case 'aoe2':
        pop(s);
        if (!s.lastNeed) s.stack.push({ op: 'damage', from: A, to: T, n: 1 });
        return;
      case 'juedou':
        f.turn = T;
        f.step = 'jd';
        s.stack.push({ op: 'need', to: T, name: 'sha', from: A, count: gen(s, A) === 'lvbu' ? 2 : 1, reason: 'juedou' });
        return;
      case 'jd':
        if (s.lastNeed) {
          f.turn = f.turn === T ? A : T;
          { const o = f.turn === T ? A : T; s.stack.push({ op: 'need', to: f.turn, name: 'sha', from: o, count: gen(s, o) === 'lvbu' ? 2 : 1, reason: 'juedou' }); }
          return;
        }
        pop(s);
        s.stack.push({ op: 'damage', from: f.turn === T ? A : T, to: f.turn, n: 1 });
        return;
      case 'wugu': {
        const w = s.wugu;
        if (!w || !w.cards.length) return pop(s);
        if (f.answer === undefined) return setAsk(s, { type: 'wugu', to: T, cards: w.cards }, SEC.wugu);
        const id = answer(f).cardId;
        const k = Math.max(0, w.cards.findIndex((c) => c.id === id));
        s.players[T].hand.push(w.cards.splice(k, 1)[0]);
        return pop(s);
      }
      case 'jiedao': {
        const V = f.victim;
        if (!weapon(s, T) || !s.players[V].alive || !inRange(s, T, V)) return pop(s);
        f.step = 'jiedao2';
        s.stack.push({ op: 'need', to: T, name: 'sha', from: V, count: 1, reason: 'jiedao', optional: true });
        return;
      }
      case 'jiedao2':
        pop(s);
        if (s.lastNeed) s.stack.push({ op: 'sha', from: T, to: f.victim, card: s.lastNeedCards || [] });
        else {
          s.players[A].hand.push(s.players[T].equip.weapon);
          delete s.players[T].equip.weapon;
          log(s, { t: 'give_weapon', p: T, to: A });
        }
        return;
    }
  },

  // `from` picks `left` cards of `to` to discard or take (hand cards are picked blind).
  pick(s, f) {
    const TP = s.players[f.to];
    // 寒冰剑 (noJudge) may only hit hand and equipment; 过河拆桥/顺手牵羊 can reach the judge zone too.
    const pool = f.noJudge ? handAndEquip(TP) : allCards(TP);
    if (f.left <= 0 || !pool.length) return pop(s);
    if (f.answer === undefined) return setAsk(s, { type: 'pick', to: f.from, target: f.to, mode: f.mode, noJudge: !!f.noJudge }, SEC.pick);
    const a = answer(f);
    let c;
    if (a.zone === 'hand' && TP.hand.length) c = TP.hand.splice(Math.floor(Math.random() * TP.hand.length), 1)[0];
    else if (!(f.noJudge && TP.judge.some((j) => j.id === a.cardId))) c = removeEquipOrJudge(s, f.to, a.cardId);
    if (!c) c = TP.hand.length ? TP.hand.splice(0, 1)[0] : removeEquipOrJudge(s, f.to, pool[0].id);
    if (f.mode === 'take') s.players[f.from].hand.push(c);
    else toDiscard(s, c);
    log(s, { t: f.mode === 'take' ? 'took' : 'dismantled', p: f.from, target: f.to, card: a.zone === 'hand' && f.mode === 'take' ? null : c });
    f.left--;
  },
};

// ---------- winning ----------
function checkWin(s) {
  const alive = s.players.map((P, i) => (P.alive ? i : -1)).filter((i) => i >= 0);
  const roleOf = (i) => s.players[i].role;
  const seats = (fn) => s.players.map((P, i) => (fn(P.role) ? i : -1)).filter((i) => i >= 0);
  if (!s.players[s.lord].alive) {
    if (alive.length === 1 && roleOf(alive[0]) === 'spy') return finish(s, -4, alive);
    return finish(s, -3, seats((r) => r === 'rebel'));
  }
  if (!alive.some((i) => roleOf(i) === 'rebel' || roleOf(i) === 'spy')) return finish(s, -2, seats((r) => r === 'lord' || r === 'loyal'));
  return false;
}
function finish(s, code, winners) {
  s.winner = code; // -2 lord & loyalists, -3 rebels, -4 spy
  s.winners = winners;
  s.ask = null;
  s.stack = [];
  log(s, { t: 'over', winner: code });
  return true;
}

// ---------- moves ----------
// Validate a play-phase card use and turn it into a `use` frame (cards not yet removed).
function planUse(s, p, data) {
  const P = s.players[p];
  const ids = Array.isArray(data.cardIds) ? data.cardIds : [data.cardId];
  const cards = ids.map((id) => P.hand.find((c) => c.id === id));
  if (!cards.length || cards.some((c) => !c) || new Set(ids).size !== ids.length) return { err: 'sg_bad_card' };
  let name = cards[0].name;
  if (cards.length === 2) {
    if (weapon(s, p) !== 'zhangba' || data.as !== 'sha') return { err: 'sg_bad_card' };
    name = 'sha';
  } else if (cards.length !== 1) return { err: 'sg_bad_card' };
  else if (data.as && data.as !== name) {
    // wusheng: red card as sha; qixi: black card as guohe
    if (data.as === 'sha' && gen(s, p) === 'guanyu' && isRed(cards[0])) name = 'sha';
    else if (data.as === 'guohe' && gen(s, p) === 'ganning' && isBlack(cards[0])) name = 'guohe';
    else return { err: 'sg_bad_card' };
  }
  const targets = (Array.isArray(data.targets) ? data.targets : []).filter((t) => Number.isInteger(t));
  const alive = (t) => t >= 0 && t < s.n && s.players[t].alive;
  const others = aliveFrom(s, p + 1).filter((t) => t !== p);
  const one = () => targets.length === 1 && alive(targets[0]) && targets[0] !== p;
  const type = cardType(name);
  let use = { targets: [p] };

  if (name === 'sha') {
    if (P.shaUsed >= 1 && !noShaLimit(s, p)) return { err: 'sg_sha_limit' };
    const max = weapon(s, p) === 'fangtian' && P.hand.length === cards.length ? 3 : 1;
    if (!targets.length || targets.length > max || new Set(targets).size !== targets.length) return { err: 'sg_bad_target' };
    if (targets.some((t) => !alive(t) || t === p || !inRange(s, p, t))) return { err: 'sg_out_of_range' };
    use = { targets };
  } else if (name === 'shan' || name === 'wuxie') {
    return { err: 'sg_cannot_use' };
  } else if (name === 'tao') {
    if (P.hp >= P.maxHp) return { err: 'sg_full_hp' };
  } else if (type === 'equip' || name === 'wuzhong') {
    // self
  } else if (name === 'guohe' || name === 'shunshou' || name === 'juedou' || name === 'lebu') {
    if (!one()) return { err: 'sg_bad_target' };
    const T = s.players[targets[0]];
    if ((name === 'guohe' || name === 'shunshou') && !hasAnyCard(T)) return { err: 'sg_no_cards' };
    if (name === 'shunshou' && distance(s, p, targets[0]) > 1) return { err: 'sg_out_of_range' };
    if (name === 'lebu' && T.judge.some((c) => c.name === 'lebu')) return { err: 'sg_bad_target' };
    use = { targets: [targets[0]] };
  } else if (name === 'jiedao') {
    const [h, v] = targets;
    if (targets.length !== 2 || !alive(h) || !alive(v) || h === p || h === v || !weapon(s, h)) return { err: 'sg_bad_target' };
    if (!inRange(s, h, v)) return { err: 'sg_out_of_range' };
    use = { targets: [h], victim: v };
  } else if (name === 'nanman' || name === 'wanjian') {
    use = { targets: others };
  } else if (name === 'taoyuan' || name === 'wugu') {
    use = { targets: aliveFrom(s, p) };
  } else if (name === 'shandian') {
    if (P.judge.some((c) => c.name === 'shandian')) return { err: 'sg_bad_target' };
  }
  return { frame: Object.assign({ op: 'use', from: p, name, cardIds: ids }, use) };
}

// Active skills of the play phase. Returns an error key or null; a skill that
// starts a trick leaves its frame in s.pendingSkillFrame.
function useSkill(s, p, data) {
  const P = s.players[p];
  const used = P.used || (P.used = {});
  const ids = Array.isArray(data.cardIds) ? data.cardIds : [];
  const cards = ids.map((id) => P.hand.find((c) => c.id === id));
  if (!ids.length || cards.some((c) => !c) || new Set(ids).size !== ids.length) return 'sg_bad_card';
  const alive = (t) => Number.isInteger(t) && t >= 0 && t < s.n && s.players[t].alive;
  const g = gen(s, p);
  const target = data.targets && data.targets[0];
  if (data.skill === 'rende' && g === 'liubei') {
    if (!alive(target) || target === p) return 'sg_bad_target';
    ids.forEach((id) => s.players[target].hand.push(takeFromHand(s, p, id)));
    const before = P.given || 0;
    P.given = before + ids.length;
    if (before < 2 && P.given >= 2) P.hp = Math.min(P.maxHp, P.hp + 1);
  } else if (data.skill === 'zhiheng' && g === 'sunquan') {
    if (used.zhiheng) return 'sg_skill_used';
    used.zhiheng = true;
    toDiscard(s, ids.map((id) => takeFromHand(s, p, id)));
    draw(s, p, ids.length);
  } else if (data.skill === 'qingnang' && g === 'huatuo') {
    if (used.qingnang) return 'sg_skill_used';
    if (ids.length !== 1 || !alive(target) || s.players[target].hp >= s.players[target].maxHp) return 'sg_bad_target';
    used.qingnang = true;
    toDiscard(s, takeFromHand(s, p, ids[0]));
    s.players[target].hp += 1;
  } else if (data.skill === 'lijian' && g === 'diaochan') {
    if (used.lijian) return 'sg_skill_used';
    const [a, b] = data.targets || [];
    if (ids.length !== 1 || !alive(a) || !alive(b) || a === b || s.players[a].gender !== 'm' || s.players[b].gender !== 'm') return 'sg_bad_target';
    used.lijian = true;
    toDiscard(s, takeFromHand(s, p, ids[0]));
    s.pendingSkillFrame = { op: 'trick', name: 'juedou', from: a, to: b };
  } else return 'sg_bad_skill';
  log(s, { t: 'skill', p, skill: data.skill, target: target === undefined ? null : target });
  return null;
}

function handleMove(data, s, p) {
  if (!data || s.winner !== null) return 'sg_not_now';
  const ask = s.ask;
  if (!ask || ask.to !== p) return 'sg_not_your_turn';
  const f = s.stack[s.stack.length - 1];
  const P = s.players[p];

  if (ask.type === 'play') {
    if (data.type === 'end') { f.answer = { end: true }; s.ask = null; run(s); return null; }
    if (data.type === 'skill') {
      const err = useSkill(s, p, data);
      if (err) return err;
      f.answer = { frame: s.pendingSkillFrame || null };
      s.pendingSkillFrame = null;
      s.ask = null;
      run(s);
      return null;
    }
    if (data.type !== 'use') return 'sg_not_now';
    const plan = planUse(s, p, data);
    if (plan.err) return plan.err;
    plan.frame.cards = plan.frame.cardIds.map((id) => takeFromHand(s, p, id));
    delete plan.frame.cardIds;
    f.answer = { frame: plan.frame };
  } else if (ask.type === 'respond') {
    if (data.type === 'pass') f.answer = {};
    else {
      const ids = Array.isArray(data.cardIds) ? data.cardIds : [data.cardId];
      const cards = ids.map((id) => P.hand.find((c) => c.id === id));
      if (!cards.length || cards.some((c) => !c) || new Set(ids).size !== ids.length) return 'sg_bad_card';
      const need = ask.need;
      const ok = need === 'any' ? cards.length === 1
        : cards.length === 1 ? asCard(s, p, cards[0], need)
        : need === 'sha' && cards.length === 2 && weapon(s, p) === 'zhangba';
      if (!ok) return 'sg_bad_card';
      f.answer = { cards: ids.map((id) => takeFromHand(s, p, id)) };
    }
  } else if (ask.type === 'discard') {
    const ids = Array.isArray(data.cardIds) ? data.cardIds : [];
    if (ask.optional && data.type === 'pass') f.answer = { cardIds: null };
    else {
      if (ids.length !== ask.count || new Set(ids).size !== ids.length) return 'sg_discard_count';
      const own = (id) => handIndex(s, p, id) >= 0 || (ask.allowEquip && Object.values(P.equip).some((c) => c.id === id && c.name !== 'guanshi'));
      if (!ids.every(own)) return 'sg_bad_card';
      f.answer = { cardIds: ids };
    }
  } else if (ask.type === 'pick') {
    const TP = s.players[ask.target];
    if (data.zone === 'hand' ? !TP.hand.length : !Object.values(TP.equip).concat(TP.judge).some((c) => c.id === data.cardId)) return 'sg_bad_card';
    f.answer = { zone: data.zone === 'hand' ? 'hand' : 'table', cardId: data.cardId };
  } else if (ask.type === 'confirm') {
    f.answer = { yes: !!data.yes };
  } else if (ask.type === 'wugu') {
    if (!ask.cards.some((c) => c.id === data.cardId)) return 'sg_bad_card';
    f.answer = { cardId: data.cardId };
  } else return 'sg_not_now';
  s.ask = null;
  run(s);
  return null;
}

// Default answer when the timer runs out
function onTimeout(s) {
  const ask = s.ask;
  if (!ask || s.winner !== null) return;
  const f = s.stack[s.stack.length - 1];
  const P = s.players[ask.to];
  if (ask.type === 'play') f.answer = { end: true };
  else if (ask.type === 'respond') f.answer = {};
  else if (ask.type === 'discard') f.answer = { cardIds: ask.optional ? null : P.hand.slice(-ask.count).map((c) => c.id) };
  else if (ask.type === 'pick') {
    const TP = s.players[ask.target];
    f.answer = TP.hand.length ? { zone: 'hand' } : { zone: 'table', cardId: allCards(TP)[0].id };
  } else if (ask.type === 'confirm') f.answer = { yes: false };
  else if (ask.type === 'wugu') f.answer = { cardId: ask.cards[0].id };
  s.ask = null;
  run(s);
}

module.exports = {
  EQUIP, TRICKS, DELAYED, HARMFUL, ROLES, SEC,
  buildDeck, cardType, isRed, isBlack, setup, run, handleMove, onTimeout, planUse, asCard, canPlay,
  distance, attackRange, inRange, aliveFrom, weapon, armor, hasCard, checkWin,
};
