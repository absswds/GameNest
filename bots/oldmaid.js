const { botName } = require('./lib/bot-name');

exports.name = 'oldmaid';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const hands = state.hands || [];
    // The game only lets you draw from the next player (clockwise) who still has cards.
    let targetIndex = -1;
    for (let i = 1; i < hands.length; i++) {
      const t = (playerIndex + i) % hands.length;
      if ((hands[t] || []).length > 0) { targetIndex = t; break; }
    }
    if (targetIndex < 0) return {};
    const targetHand = hands[targetIndex];
    // The target's cards are face down, so any pick is a blind one.
    const bestIndex = Math.floor(Math.random() * targetHand.length);
    return { drawFrom: targetIndex, cardIndex: bestIndex };
  },
});
