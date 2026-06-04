// bots/oldmaid.js — Simple AI: pick opponent with cards, then random card
exports.name = 'oldmaid';

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    // Pick next player with cards (clockwise is standard but any works)
    var nextPlayer = -1;
    for (var i = 1; i < state.hands.length; i++) {
      var idx = (playerIndex + i) % state.hands.length;
      if (state.hands[idx] && state.hands[idx].length > 0) {
        nextPlayer = idx;
        break;
      }
    }
    if (nextPlayer === -1) return {};
    var hand = state.hands[nextPlayer];
    var cardIndex = Math.floor(Math.random() * hand.length);
    return { drawFrom: nextPlayer, cardIndex: cardIndex };
  },
});
