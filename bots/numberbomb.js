// bots/numberbomb.js — Number Bomb AI with easy, normal, and hard difficulties
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'numberbomb';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const low = state.low;
    const high = state.high;
    const range = high - low;
    if (range <= 2) {
      // Only one number left: it is the bomb
      return { guess: low + 1 };
    }

    const diff = getDifficulty(state);

    if (diff === 'easy') {
      // Easy: guesses randomly in the remaining range, prone to hitting the bomb early
      const offset = 1 + Math.floor(Math.random() * (range - 1));
      return { guess: low + offset };
    }

    if (diff === 'hard') {
      // Hard: game-theoretic play.
      // Narrowing strategy: force opponent into an odd/unfavorable window
      // When range is small (<= 5), pick a number right next to the boundary (safe) to pass the trap
      if (range <= 5) {
        return { guess: low + 1 };
      }
      // Otherwise split ~45-55% safely
      const mid = Math.floor((low + high) / 2);
      return { guess: mid };
    }

    // Normal: midpoint with occasional slight jitter
    const mid = Math.floor((low + high) / 2);
    const jitter = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const guess = Math.max(low + 1, Math.min(high - 1, mid + jitter));
    return { guess };
  },
});
