exports.name = 'texas';

function rankVal(rank) {
  return ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(rank);
}

function handStrength(holeCards, communityCards) {
  const cards = [...holeCards, ...communityCards];
  const rvals = cards.map((card) => rankVal(card.rank)).sort((a, b) => b - a);

  const countMap = new Map();
  for (const rank of rvals) countMap.set(rank, (countMap.get(rank) || 0) + 1);

  let pairs = 0;
  let threes = 0;
  let fours = 0;
  for (const count of countMap.values()) {
    if (count === 4) fours++;
    if (count === 3) threes++;
    if (count === 2) pairs++;
  }

  let score = fours * 1000 + threes * 300 + pairs * 100;
  for (let i = 0; i < Math.min(3, rvals.length); i++) {
    score += rvals[i] * (5 - i);
  }
  if (holeCards.length >= 2 && holeCards[0].suit === holeCards[1].suit) score += 20;
  if (holeCards.length >= 2 && Math.abs(rankVal(holeCards[0].rank) - rankVal(holeCards[1].rank)) <= 2) score += 15;

  return score;
}

exports.createBot = function(playerIndex) {
  return {
    name: '电脑' + (playerIndex + 1),
    playerIndex: playerIndex,
    getMove: function(state) {
      const chips = state.chips[playerIndex];
      const currentBet = state.currentBet || 0;
      const invested = (state.bets[playerIndex] || 0);
      const toCall = currentBet - invested;
      const pot = state.pot || 0;
      const strength = handStrength(state.hands[playerIndex] || [], state.communityCards || []);
      const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

      if (toCall <= 0) {
        if (strength >= 220 && chips > 120) {
          const raiseTo = currentBet + Math.max(20, Math.floor(Math.max(pot, 40) * 0.6));
          return { action: 'raise', amount: Math.min(chips, raiseTo) };
        }
        if (strength >= 170 && chips > 90) {
          const raiseTo = currentBet + Math.max(12, Math.floor(Math.max(pot, 30) * 0.35));
          return { action: 'raise', amount: Math.min(chips, raiseTo) };
        }
        return { action: 'check' };
      }

      if (toCall >= chips) {
        return strength >= 240 ? { action: 'all_in' } : { action: 'fold' };
      }

      // 10% bluff chance on weak hands — keeps the bot unpredictable
      if (strength < 50 && Math.random() < 0.1 && chips > toCall + 40) {
        const raiseTo = currentBet + Math.max(20, Math.floor(Math.max(pot, 35) * 0.55));
        return { action: 'raise', amount: Math.min(chips, raiseTo) };
      }

      if (toCall > chips * 0.45 && strength < 180) {
        return { action: 'fold' };
      }

      if (strength < 70 && potOdds > 0.28) {
        return { action: 'fold' };
      }

      if (strength < 120 && potOdds > 0.42) {
        return { action: 'fold' };
      }

      if (strength >= 260 && chips > toCall + 40) {
        const raiseTo = currentBet + Math.max(24, Math.floor(Math.max(pot, 50) * 0.7));
        return { action: 'raise', amount: Math.min(chips, raiseTo) };
      }

      if (strength >= 200 && toCall <= Math.max(30, Math.floor(chips * 0.2))) {
        const raiseTo = currentBet + Math.max(18, Math.floor(Math.max(pot, 40) * 0.45));
        return { action: 'raise', amount: Math.min(chips, raiseTo) };
      }

      return { action: 'call' };
    }
  };
};
