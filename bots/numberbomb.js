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
    if (low >= high) {
      return { guess: low };
    }

    const diff = getDifficulty(state);

    if (diff === 'easy') {
      // Easy: guesses randomly in the remaining inclusive range [low, high]
      const offset = Math.floor(Math.random() * (high - low + 1));
      return { guess: low + offset };
    }

    if (diff === 'hard') {
      // Hard: when range is very narrow, pick edge safely
      if (high - low <= 2) {
        return { guess: low };
      }
      const mid = Math.floor((low + high) / 2);
      return { guess: mid };
    }

    // Normal: midpoint
    const mid = Math.floor((low + high) / 2);
    return { guess: mid };
  },
});


