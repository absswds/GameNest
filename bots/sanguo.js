// bots/sanguo.js — priority bot that only uses what its seat may see (own hand/role, the lord, dead players' roles, the log).
//  easy   — scatters attacks over anyone, skips plays, answers attacks/dying friends only some of the time
//  normal — heal, equip, draw, then attack the side it is against by role; saves the lord
//  hard   — reads the public log for who hit / saved the lord, hits the weakest real enemy, keeps tao/shan,
//           saves allies, skips AoE tricks that would hurt friends, discards by card value
const { botName } = require('./lib/bot-name');
const core = require('../games/lib/sanguo-core');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'sanguo';

function enemiesOf(s, me) {
  const role = s.players[me].role;
  const others = core.aliveFrom(s, me + 1).filter((i) => i !== me);
  if (role === 'rebel') return others.filter((i) => i === s.lord).concat(others.filter((i) => i !== s.lord));
  if (role === 'spy') return others.length > 1 ? others.filter((i) => i !== s.lord) : others;
  return others.filter((i) => i !== s.lord); // lord and loyalists
}
const friendOf = (s, me, who) => who === me || (who === s.lord && s.players[me].role !== 'rebel');

// Who hit the lord (probably rebels / a spy that has turned), who saved or defended him, who killed whom and who hit us,
// all from the public log. Dead players' roles are public, so a kill is the strongest evidence there is.
function leanings(s, me) {
  const anti = {}, pro = {}, mine = {};
  const add = (m, i, n) => { if (i >= 0 && i !== s.lord) m[i] = (m[i] || 0) + n; };
  const deadRole = {};
  for (const e of s.log || []) if (e.t === 'death') deadRole[e.p] = e.role;
  for (const e of s.log || []) {
    if (e.t === 'use' && core.HARMFUL.indexOf(e.name) >= 0) {
      const ts = e.targets || [];
      if (ts.indexOf(s.lord) >= 0) add(anti, e.p, 2);
      if (ts.indexOf(me) >= 0 && e.p !== me) mine[e.p] = (mine[e.p] || 0) + 1;
    } else if (e.t === 'damage' && e.from >= 0) {
      if (e.p === s.lord && e.from !== s.lord) add(anti, e.from, 2);
      if (e.p === me && e.from !== me) mine[e.from] = (mine[e.from] || 0) + 1;
    } else if (e.t === 'save' && e.who === s.lord) add(pro, e.p, 2);
    else if (e.t === 'death' && e.killer >= 0 && e.killer !== e.p) {
      if (e.role === 'rebel') add(pro, e.killer, 3);
      else if (e.role === 'loyal') add(anti, e.killer, 3);
    }
  }
  // hitting someone who attacked the lord is a loyalist's move; saving one is a rebel's
  for (const e of s.log || []) {
    if (e.t === 'damage' && e.p !== s.lord && e.from >= 0 && (anti[e.p] || 0) >= 2 && !(anti[e.from] >= 2)) add(pro, e.from, 1);
    else if (e.t === 'save' && e.who !== s.lord && e.p !== e.who && (anti[e.who] || 0) >= 2) add(anti, e.p, 1);
  }
  return { anti, pro, mine, deadRole };
}

// value of keeping a card when discarding (higher = keep)
const KEEP = { tao: 9, shan: 7, wuxie: 6, sha: 5, juedou: 4, wuzhong: 4, guohe: 3, shunshou: 3, nanman: 3, wanjian: 3, taoyuan: 2, wugu: 2, lebu: 1, shandian: 0 };

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(s, idx) {
    const me = Number.isInteger(idx) ? idx : playerIndex;
    const ask = s.ask;
    const P = s.players[me];
    if (!ask) return { type: 'end' };
    const diff = getDifficulty(s);
    const easy = diff === 'easy', hard = diff === 'hard';
    const hand = P.hand;
    const find = (name) => hand.find((c) => c.name === name) || hand.find((c) => c.name !== 'tao' && core.asCard(s, me, c, name));
    const g = P.general;
    const alive = core.aliveFrom(s, me + 1).filter((i) => i !== me);
    // hand sizes are public (other hands are blanked in the player view, handCount carries the size)
    const hc = (i) => (s.players[i].handCount !== undefined ? s.players[i].handCount : s.players[i].hand.length);
    const lean = hard ? leanings(s, me) : { anti: {}, pro: {}, mine: {} };
    // >0 reads as a friend, <0 as an enemy; only hard bothers to read the log
    const stance = (i) => {
      if (i === me) return 9;
      const grudge = lean.mine[i] || 0;
      if (P.role === 'rebel') return i === s.lord ? -9 : (lean.anti[i] || 0) - (lean.pro[i] || 0) - grudge;
      if (i === s.lord) return 9;
      return (lean.pro[i] || 0) - (lean.anti[i] || 0) - grudge;
    };
    const friends = hard ? alive.filter((i) => stance(i) >= 2) : alive.filter((i) => friendOf(s, me, i));
    const isFriend = (i) => (hard ? stance(i) >= 2 : friendOf(s, me, i));

    if (ask.type === 'play') {
      if (easy && Math.random() < 0.25) return { type: 'end' };
      let enemies = enemiesOf(s, me);
      if (hard) {
        // everyone who is not a known friend, the lord first for a rebel, then the weakest / the most suspect
        const cand = alive.filter((i) => (P.role === 'rebel' ? i === s.lord || stance(i) < 2 : i !== s.lord && stance(i) < 2));
        const score = (i) => (i === s.lord && P.role === 'rebel' ? 20 : 0) - stance(i) * 3 + (6 - s.players[i].hp) * 2 - hc(i) * 0.7 + (hc(i) ? 0 : 4);
        enemies = cand.sort((a, b) => score(b) - score(a) || a - b);
        if (!enemies.length) enemies = enemiesOf(s, me);
      } else if ((easy && Math.random() < 0.6) || (!hard && !easy && Math.random() < 0.35)) {
        enemies = alive.slice().sort(() => Math.random() - 0.5);
      }
      // skills first: heal, then draw/give, then convert cards
      const skill = (name, cardIds, targets) => ({ type: 'skill', skill: name, cardIds, targets });
      const wounded = [me].concat(friends).filter((i) => s.players[i].hp < s.players[i].maxHp);
      if (g === 'huatuo' && !(P.used && P.used.qingnang) && hand.length && wounded.length) {
        const worst = hard ? wounded.slice().sort((a, b) => s.players[a].hp - s.players[b].hp)[0] : wounded[0];
        const spare = hard ? hand.slice().sort((a, b) => (KEEP[a.name] || 0) - (KEEP[b.name] || 0))[0] : hand[0];
        if (!hard || spare.name !== 'tao') return skill('qingnang', [spare.id], [worst]);
      }
      if (g === 'diaochan' && !(P.used && P.used.lijian) && hand.length > 1) {
        const males = enemies.filter((i) => s.players[i].gender === 'm');
        if (males.length >= 2) return skill('lijian', [hand[hand.length - 1].id], [males[0], males[1]]);
      }
      if (g === 'sunquan' && !(P.used && P.used.zhiheng) && hand.length) {
        const junk = hand.filter((c) => c.name === 'lebu' || (c.name === 'shan' && hand.filter((x) => x.name === 'shan').length > 2));
        const spare = hard ? hand.slice().sort((a, b) => (KEEP[a.name] || 0) - (KEEP[b.name] || 0)).slice(0, hand.length > 4 ? 2 : 1) : [];
        const pk = junk.length ? junk : hand.length > 4 ? hand.slice(0, 2) : spare.filter((c) => (KEEP[c.name] || 0) <= 2);
        if (pk.length) return skill('zhiheng', pk.map((c) => c.id), []);
      }
      if (g === 'liubei' && friends.length && hand.length > 2) {
        const give = hand.filter((c) => c.name !== 'tao' && c.name !== 'sha').slice(0, 2);
        if (give.length) return skill('rende', give.map((c) => c.id), [hard ? friends.slice().sort((a, b) => s.players[a].hp - s.players[b].hp)[0] : friends[0]]);
      }
      const shaCount = hand.filter((c) => c.name === 'sha').length;
      const wounds = P.hp < P.maxHp;
      const tries = [];
      if (g === 'guanyu') for (const c of hand) if (core.isRed(c) && c.name !== 'sha' && c.name !== 'tao') for (const e of enemies) tries.push({ cardId: c.id, as: 'sha', targets: [e] });
      if (g === 'ganning') for (const c of hand) if (core.isBlack(c) && c.name !== 'sha') for (const e of enemies) tries.push({ cardId: c.id, as: 'guohe', targets: [e] });
      // hard works through the hand by usefulness (heal when hurt, set up, draw, tricks, sha last), the others in hand order
      const ordered = hard
        ? hand.slice().sort((a, b) => {
          const w = (c) => (c.name === 'tao' ? (wounds ? 0 : 9) : core.cardType(c.name) === 'equip' ? 1 : c.name === 'wuzhong' ? 2 : c.name === 'sha' ? 6 : 4);
          return w(a) - w(b);
        })
        : hand;
      for (const c of ordered) {
        const n = c.name;
        if (n === 'tao') tries.push({ cardId: c.id });
        else if (core.cardType(n) === 'equip') tries.push({ cardId: c.id });
        else if (n === 'wuzhong' || n === 'wugu' || n === 'taoyuan') tries.push({ cardId: c.id });
        else if (n === 'nanman' || n === 'wanjian') {
          if (hard) {
            // worth it only when it hurts more of them than us
            const foes = alive.filter((i) => stance(i) < 0 && !isFriend(i)).length;
            if (foes > friends.length && (P.hp > 2 || find('shan') || find('sha'))) tries.push({ cardId: c.id });
          } else if (P.role === 'rebel' || P.role === 'spy' && s.players[s.lord].hp > 1) tries.push({ cardId: c.id });
        } else if (n === 'juedou' && hard && shaCount < 2) {
          // a duel is a coin flip on who has more sha: only against someone with an empty hand
          for (const e of enemies) if (!hc(e)) tries.push({ cardId: c.id, targets: [e] });
        } else if (n === 'sha' || n === 'juedou' || n === 'guohe' || n === 'shunshou' || n === 'lebu') {
          for (const e of enemies) tries.push({ cardId: c.id, targets: [e] });
        } else if (n === 'shandian' && Math.random() < 0.3) tries.push({ cardId: c.id });
      }
      for (const t of tries) {
        const data = Object.assign({ type: 'use' }, t);
        if (!core.planUse(s, me, data).err) return data;
      }
      return { type: 'end' };
    }
    if (ask.type === 'respond') {
      if (ask.need === 'wuxie') {
        if (easy) return { type: 'pass' };
        const harmful = core.HARMFUL.indexOf(ask.trick) >= 0;
        const mine = ask.target === me || (hard ? isFriend(ask.target) : friendOf(s, me, ask.target));
        const c = find('wuxie');
        return c && harmful && mine && !ask.cancelled ? { type: 'respond', cardId: c.id } : { type: 'pass' };
      }
      if (ask.need === 'tao') {
        const c = find('tao');
        if (!c) return { type: 'pass' };
        if (easy) return Math.random() < 0.4 ? { type: 'respond', cardId: c.id } : { type: 'pass' };
        // hard also saves anyone it believes to be on its side, not just itself and the lord
        return (hard ? isFriend(ask.dying) : friendOf(s, me, ask.dying)) ? { type: 'respond', cardId: c.id } : { type: 'pass' };
      }
      if (ask.need === 'any') return { type: 'pass' };
      if (ask.reason === 'jiedao' && (hard ? isFriend(ask.from) : friendOf(s, me, ask.from))) return { type: 'pass' };
      const c = find(ask.need);
      if (c && Math.random() < (easy ? 0.35 : hard ? 0 : 0.1)) return { type: 'pass' };
      return c ? { type: 'respond', cardId: c.id } : { type: 'pass' };
    }
    if (ask.type === 'discard') {
      const val = hard ? (c) => KEEP[c.name] === undefined ? (core.cardType(c.name) === 'equip' ? 2 : 3) : KEEP[c.name] : (c) => (c.name === 'tao') * 2 + (c.name === 'shan');
      const order = hand.slice().sort((a, b) => val(a) - val(b));
      if (ask.optional) return ask.reason === 'ganglie' && hand.length >= 3 ? { type: 'discard', cardIds: order.slice(0, 2).map((c) => c.id) } : { type: 'pass' };
      return { type: 'discard', cardIds: (easy ? hand.slice().sort(() => Math.random() - 0.5) : order).slice(0, ask.count).map((c) => c.id) };
    }
    if (ask.type === 'pick') {
      const T = s.players[ask.target];
      const eq = Object.values(T.equip)[0] || (ask.noJudge ? undefined : T.judge[0]);
      if ((hard ? isFriend(ask.target) : friendOf(s, me, ask.target)) && T.judge.length && !ask.noJudge) return { type: 'pick', zone: 'table', cardId: T.judge[0].id };
      return T.hand.length || T.handCount ? { type: 'pick', zone: 'hand' } : { type: 'pick', zone: 'table', cardId: eq.id };
    }
    // hanbing: discard instead of damaging only a friend or a target the hit would not kill
    if (ask.type === 'confirm') return { type: 'confirm', yes: (hard ? isFriend(ask.target) : friendOf(s, me, ask.target)) || s.players[ask.target].hp > 1 };
    if (ask.type === 'wugu') return { type: 'wugu', cardId: ask.cards[0].id };
    return { type: 'end' };
  },
});
