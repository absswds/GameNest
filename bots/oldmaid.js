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
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    const hands = state.hands || [];
    const myHand = hands[playerIndex] || [];
    const myRanks = new Set(
      myHand
        .filter((card) => card && card.id !== 'J1')
        .map((card) => card.rank)
    );

    let bestMove = null;
    let bestScore = -Infinity;

    for (let i = 1; i < hands.length; i++) {
      const targetIndex = (playerIndex + i) % hands.length;
      const targetHand = hands[targetIndex] || [];
      if (targetHand.length === 0) continue;

      for (let cardIndex = 0; cardIndex < targetHand.length; cardIndex++) {
        const card = targetHand[cardIndex];
        const score = scoreKnownDraw(myRanks, targetHand, card, cardIndex);
        if (score > bestScore) {
          bestScore = score;
          bestMove = { drawFrom: targetIndex, cardIndex: cardIndex };
        }
      }
    }

    if (bestMove) return bestMove;

    for (let i = 1; i < hands.length; i++) {
      const targetIndex = (playerIndex + i) % hands.length;
      const targetHand = hands[targetIndex] || [];
      if (targetHand.length > 0) {
        return { drawFrom: targetIndex, cardIndex: Math.floor(targetHand.length / 2) };
      }
    }

    return {};
  },
});
