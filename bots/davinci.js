// bots/davinci.js — Da Vinci Code AI with deduction
const { botName } = require('./lib/bot-name');

exports.name = 'davinci';

const { getDifficulty } = require('./lib/difficulty');

function deduceGuess(state, playerIndex, targetPlayer, tileIndex) {
  // Each number exists once per color, so track known tiles as color+number.
  const known = new Set();
  for (let p = 0; p < state.playerCount; p++) {
    const tiles = state.tiles[p], rev = state.numRevealed[p];
    for (let t = 0; t < tiles.length; t++) {
      if ((p === playerIndex || rev[t]) && !tiles[t].wild) {
        known.add(tiles[t].color + tiles[t].num);
      }
    }
  }
  // Sort key matches the game: by number, black before white on equal numbers.
  const key = (num, color) => num * 2 + (color === 'white' ? 1 : 0);
  const tgtTiles = state.tiles[targetPlayer];
  const tgtRev = state.numRevealed[targetPlayer];
  const color = tgtTiles[tileIndex].color;
  let lo = -Infinity, hi = Infinity;
  for (let t = 0; t < tgtTiles.length; t++) {
    if (tgtRev[t] && !tgtTiles[t].wild) {
      const k = key(tgtTiles[t].num, tgtTiles[t].color);
      if (t < tileIndex) lo = Math.max(lo, k);
      if (t > tileIndex) hi = Math.min(hi, k);
    }
  }
  // Build candidate numbers (color is public, so guess number only)
  const candidates = [];
  for (let n = 0; n < 12; n++) {
    const k = key(n, color);
    if (k > lo && k < hi && !known.has(color + n)) candidates.push(n);
  }
  const diff = getDifficulty(state);
  const mistakeProb = diff === 'easy' ? 0.45 : diff === 'hard' ? 0 : 0.2;
  if (Math.random() < mistakeProb || candidates.length === 0) {
    return { guessNum: Math.floor(Math.random() * 12) };
  }
  return { guessNum: candidates[Math.floor(Math.random() * candidates.length)] };
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

    // PENALTY PHASE: must reveal one of own hidden tiles
    if (state.phase === 'penalty' && state.penaltyPlayer === playerIndex) {
      const own = state.tiles[playerIndex];
      const rev = state.numRevealed[playerIndex];
      const hidden = [];
      for (let i = 0; i < own.length; i++) {
        if (!rev[i]) hidden.push(i);
      }
      if (hidden.length > 0) {
        return { revealIndex: hidden[Math.floor(Math.random() * hidden.length)] };
      }
      return { revealIndex: 0 };
    }

    if (state.phase === 'guess') {
      // After a correct guess this turn: 40% chance to stop instead of continuing
      if (state.guessedThisTurn && Math.random() < 0.4) return { pass: true };

      const opponents = [];
      for (let i = 0; i < state.playerCount; i++) {
        if (i === playerIndex || state.eliminated[i]) continue;
        for (let j = 0; j < state.tiles[i].length; j++) {
          if (!state.numRevealed[i][j]) opponents.push({ player: i, tileIndex: j });
        }
      }
      if (opponents.length === 0) return { pass: true };

      const target = opponents[Math.floor(Math.random() * opponents.length)];
      // Color is public: if target tile is a joker, guess joker directly
      const tgtTile = state.tiles[target.player][target.tileIndex];
      if (tgtTile.wild) {
        return { targetPlayer: target.player, tileIndex: target.tileIndex, guessJoker: true, continueGuess: true };
      }
      const guess = deduceGuess(state, playerIndex, target.player, target.tileIndex);
      return { targetPlayer: target.player, tileIndex: target.tileIndex, ...guess, continueGuess: true };
    }

    return {};
  },
});
