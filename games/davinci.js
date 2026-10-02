// games/davinci.js
// 达芬奇密码 - 2-4 player logic deduction game. Guess opponent hidden numbered tiles.

exports.name = 'davinci';
exports.maxPlayers = 4;

function createTilePool() {
  const pool = [];
  // Number tiles: black 0-11, white 0-11
  for (let i = 0; i <= 11; i++) {
    pool.push({ color: 'black', num: i, id: 'b' + i });
    pool.push({ color: 'white', num: i, id: 'w' + i });
  }
  // Joker/wild tiles (万能牌): colored black/white so opponents cannot tell them
  // apart from normal tiles — only the hidden "wild" flag distinguishes them.
  pool.push({ color: 'black', num: -1, id: 'joker-0', wild: true });
  pool.push({ color: 'white', num: -1, id: 'joker-1', wild: true });
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function sortTiles(tiles) {
  tiles.sort((a, b) => {
    // Jokers go to the end
    if (a.wild && !b.wild) return 1;
    if (!a.wild && b.wild) return -1;
    if (a.wild && b.wild) return 0;
    // Sort by number first, same number: black left, white right
    if (a.num !== b.num) return a.num - b.num;
    if (a.color === 'black' && b.color === 'white') return -1;
    if (a.color === 'white' && b.color === 'black') return 1;
    return 0;
  });
}

// Sort tiles/revealed in lockstep while keeping `locked` tiles (placed jokers)
// fixed at their current positions. Only the movable tiles are re-sorted.
function sortTilesLocked(tiles, revealed) {
  const lockedSlots = {};   // index -> { tile, rev }
  const movable = [];       // { tile, rev }
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].locked) {
      lockedSlots[i] = { tile: tiles[i], rev: revealed[i] };
    } else {
      movable.push({ tile: tiles[i], rev: revealed[i] });
    }
  }
  movable.sort((a, b) => {
    if (a.tile.wild && !b.tile.wild) return 1;
    if (!a.tile.wild && b.tile.wild) return -1;
    if (a.tile.wild && b.tile.wild) return 0;
    if (a.tile.num !== b.tile.num) return a.tile.num - b.tile.num;
    if (a.tile.color === 'black' && b.tile.color === 'white') return -1;
    if (a.tile.color === 'white' && b.tile.color === 'black') return 1;
    return 0;
  });
  let mi = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (lockedSlots[i]) {
      tiles[i] = lockedSlots[i].tile;
      revealed[i] = lockedSlots[i].rev;
    } else {
      tiles[i] = movable[mi].tile;
      revealed[i] = movable[mi].rev;
      mi++;
    }
  }
}

exports.createState = () => ({
  tiles: [],           // per-player: [{color, num, id, wild?, locked?}, ...]
  numRevealed: [],     // per-player: [bool, ...] — number revealed (color always public)
  pool: [],            // remaining draw tiles
  currentPlayer: 0,
  phase: 'draw',       // 'draw' | 'guess' | 'penalty' | 'over' | 'place' | 'init_place'
  drawnTile: null,     // tile just drawn (player can see it)
  penaltyPlayer: null, // player who must reveal a tile
  winner: null,
  playerCount: 0,
  eliminated: [],      // per-player: bool
  guessCount: [],      // per-player: how many of their tiles have been guessed correctly
  lastGuessResult: null, // { correct, guesser, targetPlayer, tileIndex, numRevealedCnt, guessNum, guessJoker, tile }
  initJokerQueue: [],    // [{playerIdx, jokerTileId}] — players who need to place initial jokers
});

function initGame(state, playerCount) {
  state.playerCount = playerCount;
  state.pool = createTilePool();
  state.tiles = [];
  state.numRevealed = [];
  state.eliminated = Array(playerCount).fill(false);
  state.guessCount = Array(playerCount).fill(0);
  // Real rules: 2-3 players → 4 tiles each; 4 players → 3 tiles each
  const count = playerCount <= 3 ? 4 : 3;
  for (let i = 0; i < playerCount; i++) {
    const tiles = state.pool.splice(0, count);
    sortTiles(tiles);
    state.tiles[i] = tiles;
    state.numRevealed[i] = Array(count).fill(false);
  }
  state.currentPlayer = 0;
  state.phase = 'draw';
  state.penaltyPlayer = null;
  state.winner = null;

  // If any player's initial hand contains a joker, queue them for placement before game starts
  state.initJokerQueue = [];
  for (let i = 0; i < playerCount; i++) {
    for (const tile of state.tiles[i]) {
      if (tile.wild) state.initJokerQueue.push({ playerIdx: i, jokerTileId: tile.id });
    }
  }

  if (state.initJokerQueue.length > 0) {
    state.phase = 'init_place';
    state.currentPlayer = state.initJokerQueue[0].playerIdx;
    state.drawnTile = null;
  } else {
    state.drawnTile = state.pool.length > 0 ? state.pool.pop() : null;
    if (state.drawnTile) state.phase = state.drawnTile.wild ? 'place' : 'guess';
    else endGame(state);
  }
}
exports.initGame = initGame;

function nextActive(state, fromIdx) {
  for (let i = 1; i <= state.playerCount; i++) {
    const idx = (fromIdx + i) % state.playerCount;
    if (!state.eliminated[idx]) return idx;
  }
  return fromIdx;
}

function activeCount(state) {
  return state.eliminated.filter(e => !e).length;
}

function endGame(state) {
  state.phase = 'over';
  const remaining = [];
  for (let i = 0; i < state.playerCount; i++) {
    if (!state.eliminated[i]) remaining.push(i);
  }
  state.winner = remaining.length === 1 ? remaining[0] : -1;
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase === 'over' || state.winner !== null) return 'g_game_over';

  // Initialize on first move (for backward compat with lazy init)
  if (state.tiles.length === 0) {
    const count = state._playerCount || 2;
    initGame(state, count);
    return null;
  }

  // ---- INIT_PLACE PHASE: initial jokers in hand need player to choose position ----
  if (state.phase === 'init_place') {
    const { playerIdx, jokerTileId } = (state.initJokerQueue && state.initJokerQueue[0]) || {};
    if (playerIndex !== playerIdx) return 'g_not_your_turn';
    const { placeIndex } = data || {};
    if (typeof placeIndex !== 'number') return 'dv_choose_joker_position';

    const tiles = state.tiles[playerIdx];
    const rev = state.numRevealed[playerIdx];

    // Remove the joker from its current position (sorted to end by initGame)
    const jokerIdx = tiles.findIndex(t => t.id === jokerTileId);
    if (jokerIdx >= 0) {
      const joker = tiles.splice(jokerIdx, 1)[0];
      const jokerRev = rev.splice(jokerIdx, 1)[0];
      const insertPos = Math.min(Math.max(0, placeIndex), tiles.length);
      joker.locked = true;
      tiles.splice(insertPos, 0, joker);
      rev.splice(insertPos, 0, jokerRev);
    }

    state.initJokerQueue.shift();
    if (state.initJokerQueue.length > 0) {
      state.currentPlayer = state.initJokerQueue[0].playerIdx;
    } else {
      // All initial jokers placed — begin normal game
      state.currentPlayer = 0;
      state.drawnTile = state.pool.length > 0 ? state.pool.pop() : null;
      if (state.drawnTile) state.phase = state.drawnTile.wild ? 'place' : 'guess';
      else endGame(state);
    }
    return null;
  }

  // ---- PENALTY PHASE: choose tile to reveal after wrong guess ----
  if (state.phase === 'penalty') {
    if (playerIndex !== state.penaltyPlayer) return 'g_not_your_turn';
    const { revealIndex } = data || {};

    const tiles = state.tiles[playerIndex];
    const rev = state.numRevealed[playerIndex];

    // Handle drawn tile that hasn't been inserted yet
    if (state.drawnTile) {
      // If player chose a specific tile to reveal its number, reveal it first
      if (typeof revealIndex === 'number' && revealIndex >= 0 && revealIndex < tiles.length) {
        rev[revealIndex] = true;
      }
      // Add the drawn tile with its number revealed, then re-sort keeping locked jokers fixed.
      tiles.push(state.drawnTile);
      rev.push(true);
      sortTilesLocked(tiles, rev);
      state.drawnTile = null;
    } else {
      // No drawn tile: just reveal chosen tile's number
      if (typeof revealIndex === 'number' && revealIndex >= 0 && revealIndex < tiles.length) {
        rev[revealIndex] = true;
      }
    }

    // Revealing their last hidden tile knocks the guesser out.
    if (rev.every(r => r)) state.eliminated[playerIndex] = true;

    state.phase = 'draw';
    state.penaltyPlayer = null;
    state.lastGuessResult = null;
    state.currentPlayer = nextActive(state, playerIndex);
    if (activeCount(state) <= 1) endGame(state);
    return null;
  }

  // ---- DRAW PHASE ----
  if (state.phase === 'draw') {
    if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
    if (state.pool.length === 0) {
      state.drawnTile = null;
      state.phase = 'guess';
      return null;
    }
    state.drawnTile = state.pool.pop();
    // Joker/wild tiles need manual placement
    state.phase = state.drawnTile.wild ? 'place' : 'guess';
    return null;
  }

  // ---- PLACE PHASE (for wild/joker tile placement) ----
  if (state.phase === 'place') {
    if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';
    const { placeIndex } = data || {};
    if (typeof placeIndex !== 'number') return 'dv_choose_joker_position';

    const tiles = state.tiles[playerIndex];
    const rev = state.numRevealed[playerIndex];

    // Insert at chosen position. The joker's number stays hidden (opponents must still
    // guess it) and is marked `locked` so later re-sorts never move it again.
    if (placeIndex < 0 || placeIndex > tiles.length) return 'dv_invalid_position';
    state.drawnTile.locked = true;
    const paired = tiles.map((t, i) => ({ tile: t, rev: rev[i] }));
    paired.splice(placeIndex, 0, { tile: state.drawnTile, rev: false });
    for (let i = 0; i < paired.length; i++) {
      tiles[i] = paired[i].tile;
      rev[i] = paired[i].rev;
    }
    tiles.length = paired.length;
    rev.length = paired.length;
    state.drawnTile = null;
    state.phase = 'guess';
    return null;
  }

  // ---- GUESS PHASE ----
  // Color is always public; players guess only the NUMBER (or "joker").
  if (state.phase === 'guess') {
    if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';

    const { targetPlayer, tileIndex, guessNum, guessJoker, pass } = data || {};

    if (pass) {
      // Pass — place drawn tile with number hidden in own sequence (keep locked jokers fixed)
      if (state.drawnTile) {
        const tiles = state.tiles[playerIndex];
        const rev = state.numRevealed[playerIndex];
        tiles.push(state.drawnTile);
        rev.push(false);
        sortTilesLocked(tiles, rev);
        state.drawnTile = null;
      }
      state.lastGuessResult = null;
      state.currentPlayer = nextActive(state, playerIndex);
      state.phase = 'draw';
      if (activeCount(state) <= 1) endGame(state);
      return null;
    }

    if (typeof targetPlayer !== 'number' || targetPlayer === playerIndex) return 'dv_cannot_guess_own';
    if (targetPlayer < 0 || targetPlayer >= state.playerCount) return 'dv_invalid_target';
    if (state.eliminated[targetPlayer]) return 'dv_player_out';
    if (tileIndex < 0 || tileIndex >= state.tiles[targetPlayer].length) return 'dv_invalid_position';
    if (state.numRevealed[targetPlayer][tileIndex]) return 'dv_card_already_revealed';

    const tile = state.tiles[targetPlayer][tileIndex];
    if (!tile) return 'dv_no_card_there';

    // Check guess: for jokers, guessJoker must be true; for numbers, match num only (color is public)
    let correct;
    if (tile.wild) {
      correct = !!guessJoker;
    } else {
      correct = (typeof guessNum === 'number') && (tile.num === guessNum);
    }

    if (correct) {
      // Correct guess! Reveal the number and increment guess count.
      state.numRevealed[targetPlayer][tileIndex] = true;
      state.guessCount[targetPlayer] = (state.guessCount[targetPlayer] || 0) + 1;
      const numRevealedCnt = state.numRevealed[targetPlayer].filter(Boolean).length;
      if (state.numRevealed[targetPlayer].every(r => r)) {
        state.eliminated[targetPlayer] = true;
      }
      state.lastGuessResult = { correct: true, guesser: playerIndex, targetPlayer, tileIndex, numRevealedCnt, guessNum: guessNum || null, guessJoker: !!guessJoker, tile };
      // Auto-check for game over after correct guess (no need to press pass)
      if (activeCount(state) <= 1) { endGame(state); return null; }
      // Player may continue guessing (continueGuess) or end turn (pass)
      if (data.continueGuess) return null;
      // No continueGuess — end turn, drawn tile goes into the hand hidden
      if (state.drawnTile) {
        const tiles = state.tiles[playerIndex];
        const rev = state.numRevealed[playerIndex];
        tiles.push(state.drawnTile);
        rev.push(false);
        sortTilesLocked(tiles, rev);
        state.drawnTile = null;
      }
      state.currentPlayer = nextActive(state, playerIndex);
      state.phase = 'draw';
      return null;
    } else {
      // Wrong guess — place drawn tile face-DOWN (hidden), then enter penalty phase.
      // The guesser must reveal one of their own hidden tiles before turn ends.
      const pTiles = state.tiles[playerIndex];
      const pRev = state.numRevealed[playerIndex];
      if (state.drawnTile) {
        pTiles.push(state.drawnTile);
        pRev.push(false);  // drawn tile stays hidden
        sortTilesLocked(pTiles, pRev);
        state.drawnTile = null;
      }
      state.lastGuessResult = { correct: false, guesser: playerIndex, targetPlayer, tileIndex, guessNum: guessNum || null, guessJoker: !!guessJoker, tile };
      // Enter penalty phase: guesser reveals one of their own tiles
      state.phase = 'penalty';
      state.penaltyPlayer = playerIndex;
      return null;
    }
  }

  return 'g_unknown_action';
};

// playerView: color is always public; only the NUMBER is hidden from opponents.
exports.playerView = function playerView(state, playerIndex) {
  return Object.assign({}, state, {
    tiles: state.tiles.map((tiles, i) => {
      if (i === playerIndex) return tiles; // own tiles: full info
      return tiles.map((t, j) => ({
        color: t.color,                                    // color always public
        wild: t.wild,
        num: state.numRevealed[i][j] ? t.num : null,       // number hidden unless revealed
        numRevealed: !!state.numRevealed[i][j],
        id: t.id,
        locked: t.locked,
      }));
    }),
    // drawnTile is private: only the current player may see it
    drawnTile: (state.currentPlayer === playerIndex) ? state.drawnTile : null,
    guessCount: state.guessCount,
    // lastGuessResult.tile contains the full tile; strip it for opponents to avoid leaking
    lastGuessResult: state.lastGuessResult && Object.assign({}, state.lastGuessResult, {
      tile: state.lastGuessResult.tile ? { color: state.lastGuessResult.tile.color, wild: state.lastGuessResult.tile.wild } : null,
    }),
  });
};

// Export sortTiles for testing
exports.sortTiles = sortTiles;
