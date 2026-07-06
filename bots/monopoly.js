// bots/monopoly.js — 大富翁 AI (贪心 + 会建房)
const { botName } = require('./lib/bot-name');

exports.name = 'monopoly';
exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    if (!state || state.currentPlayer !== playerIndex) return { pass: true };
    if (state.eliminated && state.eliminated[playerIndex]) return { pass: true };
    const board = state.board || [];

    if (state.phase === 'waiting') return { type: 'roll' };

    if (state.phase === 'landed' && state.pendingAction === 'can_buy') {
      const pos = state.positions[playerIndex];
      const space = board[pos];
      const cash = state.cash[playerIndex];
      const price = space && space.price ? space.price : 0;
      if (!price) return { type: 'skip_buy' };
      // 能凑成垄断的地买得起就买；否则留 200 安全垫
      if (space.type === 'property' && wouldComplete(state, board, pos, space.group, playerIndex)) {
        if (cash >= price) return { type: 'buy' };
      }
      if (cash - price > 200) return { type: 'buy' };
      return { type: 'skip_buy' };
    }

    if (state.phase === 'end_turn') {
      // 找垄断色组中最便宜、还能建且现金安全的地产盖房
      const buildTarget = pickBuild(state, board, playerIndex);
      if (buildTarget !== -1) return { type: 'build', spaceIndex: buildTarget };
      return { type: 'end_turn' };
    }
    return { pass: true };
  },
});

function groupSpaces(board, group) {
  const out = [];
  board.forEach((s, i) => { if (s && s.group === group) out.push(i); });
  return out;
}

// 买下 pos 后是否就垄断该色组
function wouldComplete(state, board, pos, group, pi) {
  if (group === undefined) return false;
  const spaces = groupSpaces(board, group);
  return spaces.every(i => i === pos || (state.properties[i] && state.properties[i].owner === pi));
}

function pickBuild(state, board, pi) {
  let best = -1, bestPrice = Infinity;
  for (let i = 0; i < board.length; i++) {
    const s = board[i];
    if (!s || s.type !== 'property') continue;
    const prop = state.properties[i];
    if (!prop || prop.owner !== pi || prop.houses >= 5) continue;
    // 必须垄断整个色组
    const spaces = groupSpaces(board, s.group);
    if (!spaces.every(j => state.properties[j] && state.properties[j].owner === pi)) continue;
    const cost = s.price / 2;
    // 现金安全垫：建完后仍留 300
    if (state.cash[pi] - cost < 300) continue;
    if (s.price < bestPrice) { bestPrice = s.price; best = i; }
  }
  return best;
}
