// bots/sheeptile.js — 羊了个羊 AI（贪心，会用道具自救）
const gameMod = require('../games/sheeptile');
function levelTiles(state, level) { return gameMod._internal.levelTiles(state, level); }
function isBlocked(tile, lvTiles, removed) { return gameMod._internal.isBlockedAt(tile, lvTiles, removed); }
function eff(state, pi, tile) { return gameMod._internal.effPattern(state, pi, tile); }

exports.name = 'sheeptile';
exports.createBot = (playerIndex) => ({
  name: '电脑' + (playerIndex + 1),
  getMove(state) {
    const me = state.players && state.players[playerIndex];
    if (!me || me.eliminated) return { pass: true };

    const lvTiles = levelTiles(state, me.level);
    const clickable = lvTiles.filter(t => !me.removed[t.id] && !isBlocked(t, lvTiles, me.removed));
    if (clickable.length === 0) return { pass: true };

    // 槽位中每种图案的现有数量
    const slotCount = {};
    me.slot.forEach(s => { slotCount[s.pattern] = (slotCount[s.pattern] || 0) + 1; });

    // 给每张可点牌打分：能立即三连消除 > 能凑成对 > 其他
    let bestTile = null, bestScore = -1;
    for (const t of clickable) {
      const pat = eff(state, playerIndex, t);
      const inSlot = slotCount[pat] || 0;
      let score = inSlot === 2 ? 100 : inSlot === 1 ? 50 : 1;
      const sameClickable = clickable.filter(x => eff(state, playerIndex, x) === pat).length;
      score += sameClickable;
      if (score > bestScore) { bestScore = score; bestTile = t; }
    }

    // 槽位接近满且没有能立即消除的牌 → 用道具自救
    if (me.slot.length >= 5 && bestScore < 100) {
      if (me.powers.pop3 > 0) return { type: 'power_pop3' };
      if (me.powers.shuffle > 0) return { type: 'power_shuffle' };
      if (me.powers.undo > 0) return { type: 'power_undo' };
    }

    return { type: 'pick', tileId: bestTile.id };
  },
});
