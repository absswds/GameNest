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
    const find = (name) => hand.find((c) => c.name === name);

    if (ask.type === 'play') {
      const enemies = enemiesOf(s, me);
      const tries = [];
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
      if (ask.optional) return { type: 'pass' };
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
