exports.name = 'numberbomb';

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    const mid = Math.floor((state.low + state.high) / 2);
    const fuzz = Math.random() < 0.5 ? -1 : 1;
    const range = state.high - state.low;
    const guess = Math.max(state.low + 1, Math.min(state.high - 1, mid + fuzz * (range > 2 ? 1 : 0)));
    return { guess: guess };
  },
});
