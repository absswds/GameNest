const { botName } = require('./lib/bot-name');

exports.name = 'oldmaid';

function scoreKnownDraw(myRanks, targetHand, card, cardIndex) {
  let score = 0;
  if (card.id === 'J1') score -= 200;
  if (myRanks.has(card.rank)) score += 120;
  score += Math.max(0, 18 - targetHand.length * 4);
  if (cardIndex === Math.floor(targetHand.length / 2)) score += 2;
  return score;
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const hands = state.hands || [];
    const myHand = hands[playerIndex] || [];
    const myRanks = new Set(
      myHand
        .filter((card) => card && card.id !== 'J1')
        .map((card) => card.rank)
    );

    // The game only lets you draw from the next player (clockwise) who still has cards.
    let targetIndex = -1;
    for (let i = 1; i < hands.length; i++) {
      const t = (playerIndex + i) % hands.length;
      if ((hands[t] || []).length > 0) { targetIndex = t; break; }
    }
    if (targetIndex < 0) return {};
    const targetHand = hands[targetIndex];
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let cardIndex = 0; cardIndex < targetHand.length; cardIndex++) {
      const score = scoreKnownDraw(myRanks, targetHand, targetHand[cardIndex], cardIndex);
      if (score > bestScore) { bestScore = score; bestIndex = cardIndex; }
    }
    return { drawFrom: targetIndex, cardIndex: bestIndex };
  },
});
