// games/numberbomb.js
// 数字炸弹 — Turn-based number guessing with shrinking range
const { pick } = require('./lib/i18n');

exports.name = 'numberbomb';
exports.maxPlayers = 10;

exports.createState = () => ({
  bomb: 0,
  low: 1,
  high: 100,
  lives: [],
  currentPlayer: 0,
  winner: null,
  round: 0,
  startPlayer: 0,
  lastGuess: null,    // { player, guess, hit } for animation trigger
  messages: [],       // log of recent events: [{text, time}]
});

exports.initGame = function (state, playerCount) {
  state.lives = Array(playerCount).fill(3);
  state.bomb = Math.floor(Math.random() * 100) + 1;
  state.low = 1;
  state.high = 100;
  state.currentPlayer = 0;
  state.round = 1;
  state.winner = null;
  state.startPlayer = 0;
  state.lastGuess = null;
  state.messages = [];
};

exports.handleMove = function (data, state, playerIndex) {
  if (state.winner !== null) return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';
  if (state.lives[playerIndex] <= 0) return 'nb_you_are_out';

  const { guess } = data || {};
  if (typeof guess !== 'number' || !Number.isInteger(guess) || guess < state.low || guess > state.high) {
    return 'nb_invalid_guess';
  }

  if (guess === state.bomb) {
    state.lives[playerIndex]--;
    // Log hit with context
    var hitMsg = pick(state, 'P' + (playerIndex + 1) + ' 猜了 ' + guess + ' 💥 踩雷！扣 1 条命（剩余 ' + state.lives[playerIndex] + ' ❤️）', 'P' + (playerIndex + 1) + ' guessed ' + guess + ' 💥 Bomb! -1 life (' + state.lives[playerIndex] + ' ❤️ left)');
    state.messages.push({ text: hitMsg, time: Date.now(), bombHit: true, player: playerIndex });
    if (state.messages.length > 10) state.messages.shift();
    state.lastGuess = { player: playerIndex, guess: guess, hit: true };

    // Check game over
    const alivePlayers = [];
    for (let i = 0; i < state.lives.length; i++) {
      if (state.lives[i] > 0) alivePlayers.push(i);
    }
    if (alivePlayers.length <= 1) {
      state.winner = alivePlayers.length === 1 ? alivePlayers[0] : -1;
      return null;
    }

    // New round — the player who hit the bomb starts
    state.bomb = Math.floor(Math.random() * 100) + 1;
    state.low = 1;
    state.high = 100;
    state.round++;
    state.currentPlayer = playerIndex;
    state.startPlayer = playerIndex;
    return null;
  }

  // Narrow range
  var narrowed = '';
  if (guess > state.bomb) {
    state.high = guess - 1;
    narrowed = pick(state, '↑ 大了', '↑ too high');
  } else {
    state.low = guess + 1;
    narrowed = pick(state, '↓ 小了', '↓ too low');
  }

  // Final forced guess — only 1 number left in range
  if (state.low === state.high) {
    state.messages.push({ text: pick(state, 'P' + (playerIndex + 1) + ' 猜了 ' + guess + ' ' + narrowed + ' → 只剩 ' + state.low + ' 一个数字，下家必中弹！', 'P' + (playerIndex + 1) + ' guessed ' + guess + ' ' + narrowed + ' → only ' + state.low + ' left, next player will hit!'), time: Date.now(), bombHit: false, player: playerIndex });
  } else {
    state.messages.push({ text: pick(state, 'P' + (playerIndex + 1) + ' 猜了 ' + guess + ' ' + narrowed + ' → 范围 ' + state.low + '~' + state.high, 'P' + (playerIndex + 1) + ' guessed ' + guess + ' ' + narrowed + ' → range ' + state.low + '~' + state.high), time: Date.now(), bombHit: false, player: playerIndex });
  }
  if (state.messages.length > 10) state.messages.shift();
  state.lastGuess = { player: playerIndex, guess: guess, hit: false };

  // Next alive player
  for (let i = 0; i < state.lives.length; i++) {
    state.currentPlayer = (state.currentPlayer + 1) % state.lives.length;
    if (state.lives[state.currentPlayer] > 0) break;
  }

  return null;
};
