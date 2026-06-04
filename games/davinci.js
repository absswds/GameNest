// games/davinci.js
// 达芬奇密码 - 2-4 player logic deduction game. Guess opponent hidden numbered tiles.

exports.name = 'davinci';
exports.maxPlayers = 6;

function createTilePool() {
  const pool = [];
  // Number tiles: black 0-11, white 0-11
  for (let i = 0; i <= 11; i++) {
    pool.push({ color: 'black', num: i, id: 'b' + i });
    pool.push({ color: 'white', num: i, id: 'w' + i });
  }
  // Joker/wild tiles (万能牌)
  pool.push({ color: 'joker', num: -1, id: 'joker-0', wild: true });
  pool.push({ color: 'joker', num: -1, id: 'joker-1', wild: true });
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
  tiles: [],           // per-player: [{color, num}, ...]
  revealed: [],        // per-player: [bool, ...]
  pool: [],            // remaining draw tiles
  currentPlayer: 0,
  phase: 'draw',       // 'draw' | 'guess' | 'penalty' | 'over'
  drawnTile: null,     // tile just drawn (player can see it)
  penaltyPlayer: null, // player who must reveal a tile
  winner: null,
  playerCount: 0,
  eliminated: [],      // per-player: bool
  lastGuessResult: null, // { correct, targetPlayer, tileIndex, guessColor, guessNum }
  initJokerQueue: [],    // [{playerIdx, jokerTileId}] — players who need to place initial jokers
});

function initGame(state, playerCount) {
  state.playerCount = playerCount;
  state.pool = createTilePool();
  state.tiles = [];
  state.revealed = [];
  state.eliminated = Array(playerCount).fill(false);
  const count = playerCount <= 2 ? 5 : 4;
  for (let i = 0; i < playerCount; i++) {
    const tiles = state.pool.splice(0, count);
    sortTiles(tiles);
    state.tiles[i] = tiles;
    state.revealed[i] = Array(count).fill(false);
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
  if (state.phase === 'over' || state.winner !== null) return '游戏已结束';

  // Initialize on first move (for backward compat with lazy init)
  if (state.tiles.length === 0) {
    const count = state._playerCount || 2;
    initGame(state, count);
    return null;
  }

  // ---- INIT_PLACE PHASE: initial jokers in hand need player to choose position ----
  if (state.phase === 'init_place') {
    const { playerIdx, jokerTileId } = (state.initJokerQueue && state.initJokerQueue[0]) || {};
    if (playerIndex !== playerIdx) return '还没轮到你';
    const { placeIndex } = data || {};
    if (typeof placeIndex !== 'number') return '请选择万能牌插入位置';

    const tiles = state.tiles[playerIdx];
    const rev = state.revealed[playerIdx];

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
    if (playerIndex !== state.penaltyPlayer) return '还没轮到你';
    const { revealIndex } = data || {};

    const tiles = state.tiles[playerIndex];
    const rev = state.revealed[playerIndex];

    // Handle drawn tile that hasn't been inserted yet
    if (state.drawnTile) {
      // If player chose a specific tile to reveal, reveal it first (index is
      // still valid against the current arrays before we add the drawn tile).
      if (typeof revealIndex === 'number' && revealIndex >= 0 && revealIndex < tiles.length) {
        rev[revealIndex] = true;
      }
      // Add the drawn tile face-up, then re-sort keeping locked jokers fixed.
      tiles.push(state.drawnTile);
      rev.push(true);
      sortTilesLocked(tiles, rev);
      state.drawnTile = null;
    } else {
      // No drawn tile: just reveal chosen tile
      if (typeof revealIndex === 'number' && revealIndex >= 0 && revealIndex < tiles.length) {
        rev[revealIndex] = true;
      }
    }

    state.phase = 'draw';
    state.penaltyPlayer = null;
    state.lastGuessResult = null;
    state.currentPlayer = nextActive(state, playerIndex);
    if (activeCount(state) <= 1) endGame(state);
    return null;
  }

  // ---- DRAW PHASE ----
  if (state.phase === 'draw') {
    if (playerIndex !== state.currentPlayer) return '还没轮到你';
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
    if (playerIndex !== state.currentPlayer) return '还没轮到你';
    const { placeIndex } = data || {};
    if (typeof placeIndex !== 'number') return '请选择万能牌插入位置';

    const tiles = state.tiles[playerIndex];
    const rev = state.revealed[playerIndex];

    // Insert at chosen position. The joker stays hidden (opponents must still
    // guess it) and is marked `locked` so later re-sorts never move it again.
    if (placeIndex < 0 || placeIndex > tiles.length) return '无效位置';
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
  if (state.phase === 'guess') {
    if (playerIndex !== state.currentPlayer) return '还没轮到你';

    const { targetPlayer, tileIndex, guessColor, guessNum, pass } = data || {};

    if (pass) {
      // Pass — place drawn tile face-down in own sequence (keep locked jokers fixed)
      if (state.drawnTile) {
        const tiles = state.tiles[playerIndex];
        const rev = state.revealed[playerIndex];
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

    if (typeof targetPlayer !== 'number' || targetPlayer === playerIndex) return '不能猜自己的牌';
    if (targetPlayer < 0 || targetPlayer >= state.playerCount) return '无效的目标玩家';
    if (state.eliminated[targetPlayer]) return '该玩家已经出局';
    if (tileIndex < 0 || tileIndex >= state.tiles[targetPlayer].length) return '无效位置';
    if (state.revealed[targetPlayer][tileIndex]) return '这张牌已经揭示了';

    const tile = state.tiles[targetPlayer][tileIndex];
    if (!tile) return '该位置没有牌';

    // Check guess: for jokers, only need to match color='joker'; for numbers, match color+num
    const correct = tile.wild
      ? (guessColor === 'joker')
      : (tile.color === guessColor && tile.num === guessNum);

    state.lastGuessResult = { correct, targetPlayer, tileIndex, guessColor, guessNum, tile };

    if (correct) {
      // Correct guess! Reveal the tile. If all tiles revealed, player is eliminated.
      state.revealed[targetPlayer][tileIndex] = true;
      if (state.revealed[targetPlayer].every(r => r)) {
        state.eliminated[targetPlayer] = true;
      }
      // Continue guessing (continueGuess sent by frontend means they can guess again)
      if (data.continueGuess) return null;
      // No continueGuess — end turn
    } else {
      // Wrong guess — drawn tile goes face-up, turn ends (no extra tile reveal)
      const pTiles = state.tiles[playerIndex];
      const pRev = state.revealed[playerIndex];
      if (state.drawnTile) {
        pTiles.push(state.drawnTile);
        pRev.push(true);
        sortTilesLocked(pTiles, pRev);
        state.drawnTile = null;
      }
      state.lastGuessResult = null;
      state.currentPlayer = nextActive(state, playerIndex);
      state.phase = 'draw';
      if (activeCount(state) <= 1) endGame(state);
      return null;
    }

    state.currentPlayer = nextActive(state, playerIndex);
    state.phase = 'draw';
    state.lastGuessResult = null;
    if (activeCount(state) <= 1) endGame(state);
    return null;
  }

  return '未知阶段';
};
