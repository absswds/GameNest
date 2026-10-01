// bots/sanguo.js — simple priority bot: heal, equip, draw, then attack enemies.
// It only uses public information plus its own role (the lord is public).
const { botName } = require('./lib/bot-name');
const core = require('../games/lib/sanguo-core');

exports.name = 'sanguo';

function enemiesOf(s, me) {
  const role = s.players[me].role;
  const others = core.aliveFrom(s, me + 1).filter((i) => i !== me);
  if (role === 'rebel') return others.filter((i) => i === s.lord).concat(others.filter((i) => i !== s.lord));
  if (role === 'spy') return others.length > 1 ? others.filter((i) => i !== s.lord) : others;
  return others.filter((i) => i !== s.lord); // lord and loyalists
}
const friendOf = (s, me, who) => who === me || (who === s.lord && s.players[me].role !== 'rebel');

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(s, idx) {
    const me = Number.isInteger(idx) ? idx : playerIndex;
    const ask = s.ask;
    const P = s.players[me];
    if (!ask) return { type: 'end' };
    const hand = P.hand;
    const find = (name) => hand.find((c) => c.name === name) || hand.find((c) => core.asCard(s, me, c, name));
    const g = P.general;
    const alive = core.aliveFrom(s, me + 1).filter((i) => i !== me);
    const friends = alive.filter((i) => friendOf(s, me, i));

    if (ask.type === 'play') {
      const enemies = enemiesOf(s, me);
      // skills first: heal, then draw/give, then convert cards
      const skill = (name, cardIds, targets) => ({ type: 'skill', skill: name, cardIds, targets });
      const wounded = [me].concat(friends).filter((i) => s.players[i].hp < s.players[i].maxHp);
      if (g === 'huatuo' && !(P.used && P.used.qingnang) && hand.length && wounded.length) return skill('qingnang', [hand[0].id], [wounded[0]]);
      if (g === 'diaochan' && !(P.used && P.used.lijian) && hand.length > 1) {
        const males = enemies.filter((i) => s.players[i].gender === 'm');
        if (males.length >= 2) return skill('lijian', [hand[hand.length - 1].id], [males[0], males[1]]);
      }
      if (g === 'sunquan' && !(P.used && P.used.zhiheng) && hand.length) {
        const junk = hand.filter((c) => c.name === 'lebu' || (c.name === 'shan' && hand.filter((x) => x.name === 'shan').length > 2));
        const pick = junk.length ? junk : hand.length > 4 ? hand.slice(0, 2) : [];
        if (pick.length) return skill('zhiheng', pick.map((c) => c.id), []);
      }
      if (g === 'liubei' && friends.length && hand.length > 2) {
        const give = hand.filter((c) => c.name !== 'tao' && c.name !== 'sha').slice(0, 2);
        if (give.length) return skill('rende', give.map((c) => c.id), [friends[0]]);
      }
      const tries = [];
      if (g === 'guanyu') for (const c of hand) if (core.isRed(c) && c.name !== 'sha' && c.name !== 'tao') for (const e of enemies) tries.push({ cardId: c.id, as: 'sha', targets: [e] });
      if (g === 'ganning') for (const c of hand) if (core.isBlack(c) && c.name !== 'sha') for (const e of enemies) tries.push({ cardId: c.id, as: 'guohe', targets: [e] });
      for (const c of hand) {
        const n = c.name;
        if (n === 'tao') tries.push({ cardId: c.id });
        else if (core.cardType(n) === 'equip') tries.push({ cardId: c.id });
        else if (n === 'wuzhong' || n === 'wugu' || n === 'taoyuan') tries.push({ cardId: c.id });
        else if (n === 'nanman' || n === 'wanjian') tries.push({ cardId: c.id });
        else if (n === 'sha' || n === 'juedou' || n === 'guohe' || n === 'shunshou' || n === 'lebu') {
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
        const harmful = core.HARMFUL.indexOf(ask.trick) >= 0;
        const mine = ask.target === me || friendOf(s, me, ask.target);
        const c = find('wuxie');
        return c && harmful && mine && !ask.cancelled ? { type: 'respond', cardId: c.id } : { type: 'pass' };
      }
      if (ask.need === 'tao') {
        const c = find('tao');
        return c && friendOf(s, me, ask.dying) ? { type: 'respond', cardId: c.id } : { type: 'pass' };
      }
      if (ask.need === 'any') return { type: 'pass' };
      if (ask.reason === 'jiedao' && friendOf(s, me, ask.from)) return { type: 'pass' };
      const c = find(ask.need);
      return c ? { type: 'respond', cardId: c.id } : { type: 'pass' };
    }
    if (ask.type === 'discard') {
      if (ask.optional) return ask.reason === 'ganglie' && hand.length >= 3 ? { type: 'discard', cardIds: hand.slice(0, 2).map((c) => c.id) } : { type: 'pass' };
      const order = hand.slice().sort((a, b) => (a.name === 'tao') - (b.name === 'tao') || (a.name === 'shan') - (b.name === 'shan'));
      return { type: 'discard', cardIds: order.slice(0, ask.count).map((c) => c.id) };
    }
    if (ask.type === 'pick') {
      const T = s.players[ask.target];
      const eq = Object.values(T.equip)[0] || T.judge[0];
      if (friendOf(s, me, ask.target) && T.judge.length) return { type: 'pick', zone: 'table', cardId: T.judge[0].id };
      return T.hand.length || T.handCount ? { type: 'pick', zone: 'hand' } : { type: 'pick', zone: 'table', cardId: eq.id };
    }
    if (ask.type === 'confirm') return { type: 'confirm', yes: true };
    if (ask.type === 'wugu') return { type: 'wugu', cardId: ask.cards[0].id };
    return { type: 'end' };
  },
});
