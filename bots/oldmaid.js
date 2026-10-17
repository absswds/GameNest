// bots/oldmaid.js — Old Maid AI with difficulty levels
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

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
    const diff = getDifficulty(state);

    let pickIndex = 0;
    if (diff === 'hard' && targetHand.length > 2) {
      // Hard: avoids the very last card (often the recently drawn card)
      pickIndex = Math.floor(Math.random() * (targetHand.length - 1));
    } else {
      pickIndex = Math.floor(Math.random() * targetHand.length);
    }

    return { drawFrom: targetIndex, cardIndex: pickIndex };
  },
});
