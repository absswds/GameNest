const { botName } = require('./lib/bot-name');

exports.name = 'numberbomb';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const guess = Math.floor((state.low + state.high) / 2);
    return { guess: guess };
  },
});
