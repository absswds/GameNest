// bots/uno.js — Simple UNO AI
exports.name = 'uno';

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  getMove(state) {
    const hand = state.hands[playerIndex];
    if (!hand || hand.length === 0) return {};

    // If down to 1 card, call UNO
    if (hand.length === 1 && (!state.unoCalled || !state.unoCalled[playerIndex])) {
      return { uno: true };
    }

    // If there's a draw penalty, always draw
    if (state.drawStack > 0) {
      const canStack = hand.some(c => c.value === '+2' || c.value === '+4');
      if (canStack) {
        const stackCard = hand.find(c => c.value === '+2' || c.value === '+4');
        return { cardId: stackCard.id, chosenColor: 'red' };
      }
      return {}; // draw
    }

    // Find playable cards
    const playable = hand.filter(c => {
      if (c.color === 'wild') return true;
      const top = state.discard[0];
      if (c.value === top.value) return true;
      if (c.color === state.currentColor) return true;
      return false;
    });

    if (playable.length === 0) return {}; // draw

    // Play first playable card (non-wild preferred)
    const nonWild = playable.find(c => c.color !== 'wild');
    const card = nonWild || playable[0];
    const chosenColor = card.color === 'wild' ? (hand.find(c => c.color !== 'wild') || { color: 'red' }).color : undefined;
    return { cardId: card.id, chosenColor };
  },
});
