// bots/oldmaid.js — Old Maid AI (pure luck: random draw at every difficulty)
const { botName } = require('./lib/bot-name');

exports.name = 'oldmaid';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const hands = state.hands || [];
    let targetIndex = -1;
    for (let i = 1; i < hands.length; i++) {
      const t = (playerIndex + i) % hands.length;
      if ((hands[t] || []).length > 0) { targetIndex = t; break; }
    }
    if (targetIndex < 0) return {};
    const targetHand = hands[targetIndex];
    const pickIndex = Math.floor(Math.random() * targetHand.length);

    return { drawFrom: targetIndex, cardIndex: pickIndex };
  },
});
