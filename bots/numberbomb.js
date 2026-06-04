// bots/numberbomb.js — Simple binary search AI
exports.name = 'numberbomb';

exports.createBot = (playerIndex) => ({
  name: `电脑${playerIndex + 1}`,
  playerIndex,
  getMove(state) {
    // Simple binary search — pick midpoint of current range
    const mid = Math.floor((state.low + state.high) / 2);
    const guess = mid + Math.floor(Math.random() * 3) - 1; // slight fuzz
    const clamped = Math.max(state.low, Math.min(state.high, guess));
    return { guess: clamped };
  },
});
