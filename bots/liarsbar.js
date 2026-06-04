// bots/liarsbar.js
exports.name = 'liarsbar';

exports.createBot = function(playerIndex) {
  return {
    name: '电脑' + (playerIndex + 1),
    playerIndex: playerIndex,
    getMove: function(state) {
      const hand = state.hands[playerIndex] || [];

      // Shooting phase — just pull trigger (no chamber selection)
      if (state.phase === 'shooting' && state.currentShooter === playerIndex) {
        return { action: 'shoot' };
      }

      if (hand.length === 0) return { action: 'play', cardId: '' };

      const themeRank = state.themeRank;
      const themeCards = hand.filter(c => c.rank === themeRank || c.suit === 'wild');
      const wildCards = hand.filter(c => c.suit === 'wild');
      const ghostCard = hand.find(c => c.suit === 'ghost');

      // Challenge decision
      if (state.lastClaimant >= 0 && state.lastClaimant !== playerIndex && state.phase === 'playing') {
        const totalAlive = (state.alive || []).filter(Boolean).length;
        const pileSize = (state.pileCards || []).length;
        const myThemeCount = themeCards.length - wildCards.length;

        let challengeChance = 0.08;
        if (pileSize >= 3) challengeChance += 0.12;
        if (pileSize >= 5) challengeChance += 0.15;
        if (myThemeCount >= 2) challengeChance += 0.15;
        if (totalAlive <= 2) challengeChance += 0.2;

        if (Math.random() < challengeChance) {
          return { action: 'suspect' };
        }
      }

      // Play
      if (themeCards.length > 0) {
        return { action: 'play', cardId: themeCards[Math.floor(Math.random() * themeCards.length)].id };
      }

      if (ghostCard) {
        const nonGhostCount = hand.filter(c => c.suit !== 'ghost').length;
        if (nonGhostCount <= 1) {
          return { action: 'play', cardId: ghostCard.id };
        }
      }

      const lieCards = hand.filter(c => c.suit !== 'wild' && c.suit !== 'ghost');
      if (lieCards.length > 0) {
        return { action: 'play', cardId: lieCards[Math.floor(Math.random() * lieCards.length)].id };
      }

      return { action: 'play', cardId: hand[Math.floor(Math.random() * hand.length)].id };
    }
  };
};
