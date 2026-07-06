// bots/davinci.js — Da Vinci Code AI with deduction
const { botName } = require('./lib/bot-name');

exports.name = 'davinci';

function deduceGuess(state, playerIndex, targetPlayer, tileIndex) {
  // Build known number sets from revealed tiles + own tiles
  const known = { black: new Set(), white: new Set() };
  for (let p = 0; p < state.playerCount; p++) {
    const tiles = state.tiles[p], rev = state.revealed[p];
    for (let t = 0; t < tiles.length; t++) {
      if ((p === playerIndex || rev[t]) && !tiles[t].wild) {
        known[tiles[t].color].add(tiles[t].num);
      }
    }
  }
  // Determine range from revealed neighbors
  const tgtTiles = state.tiles[targetPlayer];
  const tgtRev = state.revealed[targetPlayer];
  let lo = -1, hi = 12;
  for (let t = 0; t < tgtTiles.length; t++) {
    if (tgtRev[t] && !tgtTiles[t].wild) {
      if (t < tileIndex) lo = Math.max(lo, tgtTiles[t].num);
      if (t > tileIndex) hi = Math.min(hi, tgtTiles[t].num);
    }
  }
  // Build candidate set
  const candidates = [];
  for (let n = lo + 1; n < hi; n++) {
    if (!known.black.has(n)) candidates.push({ guessColor: 'black', guessNum: n });
    if (!known.white.has(n)) candidates.push({ guessColor: 'white', guessNum: n });
  }
  // 20% chance of random "mistake" to feel human
  if (Math.random() < 0.2 || candidates.length === 0) {
    return {
      guessColor: Math.random() < 0.5 ? 'white' : 'black',
      guessNum: Math.floor(Math.random() * 12),
    };
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    if (state.phase === 'draw') return {};

    // Initial joker placement before game starts
    if (state.phase === 'init_place' &&
        state.initJokerQueue && state.initJokerQueue.length > 0 &&
        state.initJokerQueue[0].playerIdx === playerIndex) {
      const own = (state.tiles[playerIndex] || []).filter(t => !t.wild || t.locked);
      return { placeIndex: Math.floor(Math.random() * (own.length + 1)) };
    }

    // Drawn joker placement
    if (state.phase === 'place') {
      const own = state.tiles[playerIndex] || [];
      return { placeIndex: Math.floor(Math.random() * (own.length + 1)) };
    }

    if (state.phase === 'guess') {
      // After a correct guess: 40% chance to stop instead of continuing
      if (state.lastGuessResult && state.lastGuessResult.correct &&
          state.currentPlayer === playerIndex) {
        if (Math.random() < 0.4) return { pass: true };
      }

      const opponents = [];
      for (let i = 0; i < state.playerCount; i++) {
        if (i === playerIndex || state.eliminated[i]) continue;
        for (let j = 0; j < state.tiles[i].length; j++) {
          if (!state.revealed[i][j]) opponents.push({ player: i, tileIndex: j });
        }
      }
      if (opponents.length === 0) return { pass: true };

      const target = opponents[Math.floor(Math.random() * opponents.length)];
      const guess = deduceGuess(state, playerIndex, target.player, target.tileIndex);
      return { targetPlayer: target.player, tileIndex: target.tileIndex, ...guess };
    }

    return {};
  },
});
