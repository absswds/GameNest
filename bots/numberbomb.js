exports.name = 'numberbomb';

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    const guess = Math.floor((state.low + state.high) / 2);
    return { guess: guess };
  },
});
