// bots/monopoly.js — 大富翁 AI (简单贪心)
exports.name = 'monopoly';
exports.createBot = (playerIndex) => ({
  name: '电脑' + (playerIndex + 1),
  getMove(state) {
    if (!state || state.currentPlayer !== playerIndex) return { pass: true };
    if (state.eliminated && state.eliminated[playerIndex]) return { pass: true };

    if (state.phase === 'waiting') return { type: 'roll' };
    if (state.phase === 'landed' && state.pendingAction === 'can_buy') {
      const cash = state.cash[playerIndex];
      if (cash > 400) return { type: 'buy' };
      return { type: 'skip_buy' };
    }
    if (state.phase === 'end_turn') return { type: 'end_turn' };
    return { pass: true };
  },
});
