// bots/texas.js
exports.name = 'texas';

function rankVal(rank) {
  return ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(rank);
}

// Simple hand strength estimation
function handStrength(holeCards, communityCards) {
  const cards = [...holeCards, ...communityCards];
  const rvals = cards.map(c => rankVal(c.rank)).sort((a,b) => b-a);

  // Count pairs
  const countMap = new Map();
  for (const r of rvals) countMap.set(r, (countMap.get(r) || 0) + 1);
  let pairs = 0, threes = 0, fours = 0;
  for (const [r, c] of countMap) {
    if (c === 4) fours++;
    if (c === 3) threes++;
    if (c === 2) pairs++;
  }

  // Score: higher is better
  let score = fours * 1000 + threes * 300 + pairs * 100;
  // High cards
  for (let i = 0; i < Math.min(3, rvals.length); i++) {
    score += rvals[i] * (5 - i);
  }
  // Suited bonus
  if (holeCards.length >= 2 && holeCards[0].suit === holeCards[1].suit) score += 20;
  // Connected bonus
  if (holeCards.length >= 2 && Math.abs(rankVal(holeCards[0].rank) - rankVal(holeCards[1].rank)) <= 2) score += 15;

  return score;
}

exports.createBot = function(playerIndex) {
  return {
    name: '电脑' + (playerIndex + 1),
    playerIndex: playerIndex,
    getMove: function(state) {
      const chips = state.chips[playerIndex];
      const toCall = state.currentBet - (state.bets[playerIndex] || 0);
      const pot = state.pot;

      if (toCall <= 0) {
        // Can check — always check unless we have a strong hand
        const strength = handStrength(state.hands[playerIndex] || [], state.communityCards || []);
        if (strength > 200 && chips > 100) {
          const raise = Math.min(chips, Math.floor(pot * 0.5));
          return { action: 'raise', amount: state.currentBet + Math.max(10, raise) };
        }
        return { action: 'check' };
      }

      // Need to call
      const strength = handStrength(state.hands[playerIndex] || [], state.communityCards || []);
      const potOdds = toCall / (pot + toCall);

      // Fold weak hands with bad pot odds
      if (strength < 50 && potOdds > 0.3) {
        // Small chance to bluff
        if (Math.random() < 0.1) {
          const raise = Math.min(chips, Math.floor(pot * 0.75));
          if (raise > toCall) return { action: 'raise', amount: state.currentBet + Math.max(10, raise) };
        }
        return { action: 'fold' };
      }

      if (strength < 100 && potOdds > 0.5) {
        return { action: 'fold' };
      }

      if (toCall > chips * 0.5 && strength < 150) {
        return { action: 'fold' };
      }

      // Call or raise
      if (strength > 250 && chips > toCall * 2 && Math.random() < 0.3) {
        const raise = Math.min(chips, Math.floor(pot * 0.75));
        return { action: 'raise', amount: state.currentBet + Math.max(20, raise) };
      }

      if (toCall >= chips) {
        return { action: 'all_in' };
      }

      return { action: 'call' };
    }
  };
};
