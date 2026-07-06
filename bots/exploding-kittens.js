// bots/exploding-kittens.js — Exploding Kittens AI with varied strategy
const { botName } = require('./lib/bot-name');

exports.name = 'exploding-kittens';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return {};

    if (state.phase === 'draw') return {};

    if (state.phase === 'play') {
      // Under attack: prioritize skip to avoid double turn, else 甩锅 to someone
      if (state.extraTurns[playerIndex] > 0) {
        const skip = hand.find(c => c.type === 'skip');
        if (skip) return { cardId: skip.id };
        const attack = hand.find(c => c.type === 'attack');
        if (attack) {
          const targets = state.hands
            .map((h, i) => i)
            .filter(i => i !== playerIndex && state.alive[i]);
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            return { cardId: attack.id, targetPlayer: target };
          }
        }
      }

      // 30% chance: just draw (human-like "pass" behavior)
      if (Math.random() < 0.3) return {};

      // Use future if deck is large and we haven't recently peeked
      const future = hand.find(c => c.type === 'future');
      if (future && state.deck.length >= 5 && !state.peekedCards) {
        return { cardId: future.id };
      }

      // Steal only if target has significantly more cards (3+)
      const stealCard = hand.find(c => c.type === 'favor' || c.type === 'steal');
      if (stealCard) {
        let bestTarget = -1, mostCards = hand.length + 3;
        state.hands.forEach((h, i) => {
          if (i !== playerIndex && state.alive[i] && h.length > mostCards) {
            mostCards = h.length; bestTarget = i;
          }
        });
        if (bestTarget >= 0) return { cardId: stealCard.id, targetPlayer: bestTarget };
      }

      return {};
    }

    return {};
  },
});
