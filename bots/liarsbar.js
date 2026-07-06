const { botName } = require('./lib/bot-name');

exports.name = 'liarsbar';

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      const hand = state.hands[playerIndex] || [];

      if (state.phase === 'shooting' && state.currentShooter === playerIndex) {
        return { action: 'shoot' };
      }

      if (hand.length === 0) return { action: 'play', cardId: '' };

      const themeRank = state.themeRank;
      const exactThemeCards = hand.filter((card) => card.rank === themeRank);
      const wildCards = hand.filter((card) => card.suit === 'wild');
      const themeCards = exactThemeCards.concat(wildCards);
      const ghostCard = hand.find((card) => card.suit === 'ghost');

      if (shouldSuspect(state, playerIndex, exactThemeCards.length, wildCards.length)) {
        return { action: 'suspect' };
      }

      if (exactThemeCards.length > 0) {
        return { action: 'play', cardId: chooseLeastCriticalCard(exactThemeCards, hand).id };
      }

      if (wildCards.length > 0) {
        const shouldSpendWild = hand.length <= 2 || countLiveNonThemeMatches(state, playerIndex, themeRank) === 0;
        if (shouldSpendWild) {
          return { action: 'play', cardId: wildCards[0].id };
        }
      }

      if (ghostCard) {
        const nonGhostCount = hand.filter((card) => card.suit !== 'ghost').length;
        if (nonGhostCount <= 1) {
          return { action: 'play', cardId: ghostCard.id };
        }
      }

      const lieCards = hand.filter((card) => card.suit !== 'wild' && card.suit !== 'ghost');
      if (lieCards.length > 0) {
        return { action: 'play', cardId: chooseLeastCriticalCard(lieCards, hand).id };
      }

      if (themeCards.length > 0) {
        return { action: 'play', cardId: themeCards[0].id };
      }

      return { action: 'play', cardId: hand[0].id };
    }
  };
};

function shouldSuspect(state, playerIndex, exactThemeCount, wildCount) {
  if (state.lastClaimant < 0 || state.lastClaimant === playerIndex || state.phase !== 'playing') return false;

  const totalAlive = (state.alive || []).filter(Boolean).length;
  const pileSize = (state.pileCards || []).length;
  const claimantHand = ((state.hands || [])[state.lastClaimant] || []).length;

  let suspicion = 0;
  if (pileSize >= 3) suspicion += 1;
  if (pileSize >= 5) suspicion += 1;
  if (exactThemeCount >= 2) suspicion += 2;
  else if (exactThemeCount === 1 && wildCount >= 1) suspicion += 1;
  if (totalAlive <= 2) suspicion += 1;
  if (claimantHand <= 1) suspicion += 1;

  return suspicion >= 4;
}

function chooseLeastCriticalCard(candidates, fullHand) {
  let best = candidates[0];
  let bestScore = Infinity;

  for (const card of candidates) {
    const score = futureValue(card, fullHand);
    if (score < bestScore) {
      bestScore = score;
      best = card;
    }
  }

  return best;
}

function futureValue(card, hand) {
  let value = 0;
  for (const other of hand) {
    if (other.id === card.id) continue;
    if (other.suit === card.suit && other.rank === card.rank) value += 2;
    if (other.rank === card.rank) value += 3;
    if (other.suit === 'wild') value += 1;
  }
  return value;
}

function countLiveNonThemeMatches(state, playerIndex, themeRank) {
  const hand = (state.hands && state.hands[playerIndex]) || [];
  return hand.filter((card) => card.suit !== 'wild' && card.suit !== 'ghost' && card.rank === themeRank).length;
}
