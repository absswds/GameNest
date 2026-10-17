// bots/exploding-kittens.js — Exploding Kittens AI with varied strategy
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

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

      const diff = getDifficulty(state);

      // In easy mode: 50% chance to just draw; in hard: 10% (plays aggressively)
      const passProb = diff === 'easy' ? 0.5 : diff === 'hard' ? 0.1 : 0.3;
      if (Math.random() < passProb) return {};

      // In hard mode: if deck is dangerously small (<= 5 cards), play skip/attack to pass the turn
      if (diff === 'hard' && state.deck && state.deck.length <= 5) {
        const skip = hand.find(c => c.type === 'skip');
        if (skip) return { cardId: skip.id };
        const attack = hand.find(c => c.type === 'attack');
        if (attack) {
          const targets = state.hands.map((h, i) => i).filter(i => i !== playerIndex && state.alive[i]);
          if (targets.length > 0) return { cardId: attack.id, targetPlayer: targets[0] };
        }
      }

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
