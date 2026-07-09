// games/rummikub.js
// 拉密 / 魔力桥 (Rummikub) — Tile-based combination game with table manipulation

exports.name = 'rummikub';
exports.maxPlayers = 4;
const { pick } = require('./lib/i18n');

const COLORS = ['black', 'blue', 'red', 'orange'];
const COLOR_NAMES = { black: '黑', blue: '蓝', red: '红', orange: '橙' };

function createTiles() {
  const tiles = [];
  for (const color of COLORS) {
    for (let num = 1; num <= 13; num++) {
      tiles.push({ color, num, id: color + '-' + num + '-a' });
      tiles.push({ color, num, id: color + '-' + num + '-b' });
    }
  }
  // 2 jokers
  tiles.push({ color: 'joker', num: 0, id: 'joker-0', wild: true });
  tiles.push({ color: 'joker', num: 0, id: 'joker-1', wild: true });
  return tiles;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sortHand(hand) {
  hand.sort((a, b) => {
    if (a.wild && !b.wild) return 1;
    if (!a.wild && b.wild) return -1;
    if (a.wild && b.wild) return 0;
    const ci = COLORS.indexOf(a.color) - COLORS.indexOf(b.color);
    if (ci !== 0) return ci;
    return a.num - b.num;
  });
}

exports.createState = () => ({
  pool: [],           // draw pile
  hands: [],          // per-player: tiles in hand
  table: [],          // public table: array of groups/runs
  currentPlayer: 0,
  winner: null,
  hasBroken: [],      // per-player: has broken the 30-point threshold
  requireBreak: true, // copied from _options at init
  playedThisTurn: [], // per-player: has already played tiles this turn
  phase: 'play',      // 'play' | 'manipulate' | 'over'
  workspace: [],      // during manipulate: all tiles (table + player hand)
  savedTable: null,   // snapshot for cancel
  savedHand: null,    // snapshot for cancel
  savedHandIds: null, // IDs of original hand tiles to verify at least one used
  passesSinceLastPlay: 0, // consecutive passes while pool empty — draw detection
});

function initGame(state, playerCount) {
  const tiles = createTiles();
  shuffle(tiles);
  state.hands = [];
  for (let i = 0; i < playerCount; i++) {
    state.hands[i] = tiles.splice(0, 14);
    sortHand(state.hands[i]);
  }
  state.pool = tiles;
  state.table = [];
  state.currentPlayer = 0;
  state.winner = null;
  state.hasBroken = Array(playerCount).fill(false);
  state.requireBreak = (state._options && state._options.requireBreak !== undefined) ? state._options.requireBreak : true;
  state.playedThisTurn = Array(playerCount).fill(false);
  state.phase = 'play';
  state.workspace = [];
  state.savedTable = null;
  state.savedHand = null;
  state.savedHandIds = null;
  state.passesSinceLastPlay = 0;
}
exports.initGame = initGame;

// Check if an array of tiles forms a valid run (same color, consecutive numbers)
function isValidRun(tiles) {
  if (tiles.length < 3 || tiles.length > 13) return false;
  const nonWild = tiles.filter(t => !t.wild);
  if (nonWild.length === 0) return false;
  const color = nonWild[0].color;
  for (const t of nonWild) {
    if (t.color !== color) return false;
  }
  const nums = nonWild.map(t => t.num).sort((a, b) => a - b);
  const wilds = tiles.filter(t => t.wild).length;
  // Check for duplicate numbers
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1]) return false;
  }
  // Check gaps can be filled by wilds
  let gaps = 0;
  for (let i = 1; i < nums.length; i++) {
    gaps += nums[i] - nums[i - 1] - 1;
  }
  if (gaps > wilds) return false;
  // Check run stays within 1-13
  const minNum = Math.max(1, nums[0] - wilds + gaps); // rough lower bound
  // More precise: after placing wilds, does the full run fit in 1-13?
  const span = nums[nums.length - 1] - nums[0] + 1 + wilds; // worst case span
  // Actually: lowest possible start = nums[0] - wildsBeforeFirst
  // Let's keep it simple: if the natural range exceeds 1-13, reject
  const low = nums[0];
  const high = nums[nums.length - 1];
  // With wilds, the run extends by at most 'gaps' filled + edges
  if (low - wilds < 1 && high + wilds > 13) return false;
  return true;
}

// Check if tiles form a valid group (same number, different colors)
function isValidGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) return false;
  const nonWild = tiles.filter(t => !t.wild);
  if (nonWild.length < 2) return false;
  const num = nonWild[0].num;
  for (const t of nonWild) {
    if (t.num !== num) return false;
  }
  // Check no duplicate colors
  const seen = new Set();
  for (const t of nonWild) {
    if (seen.has(t.color)) return false;
    seen.add(t.color);
  }
  return true;
}

// Check if a set is valid (run or group)
function isValidSet(tiles) {
  if (tiles.length < 3) return false;
  const nonWild = tiles.filter(t => !t.wild);
  if (nonWild.length === 0) return false;
  const colors = new Set(nonWild.map(t => t.color));
  const nums = new Set(nonWild.map(t => t.num));
  if (nums.size === 1 && colors.size === nonWild.length) {
    return isValidGroup(tiles);
  }
  if (colors.size === 1) {
    return isValidRun(tiles);
  }
  return false;
}

// Calculate total score
function tileScore(tiles) {
  if (!tiles || !Array.isArray(tiles)) return 0;
  return tiles.reduce((sum, t) => sum + (t.wild ? 0 : t.num), 0);
}

// Can a tile be added to an existing table set?
function canAddToSet(tile, set) {
  const test = [...set, tile];
  return isValidSet(test);
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';

  if (state.hands.length === 0) {
    const count = state._playerCount || 2;
    initGame(state, count);
    return null;
  }

  const requireBreak = state.requireBreak;

  if (playerIndex !== state.currentPlayer) return 'g_not_your_turn';

  // ---- MANIPULATE PHASE ----
  if (state.phase === 'manipulate') {
    const { action, groups } = data || {};

    if (action === 'cancel') {
      // Restore saved snapshot
      for (let i = 0; i < state.hands.length; i++) {
        if (i === playerIndex) {
          state.hands[i] = state.savedHand.slice();
        }
      }
      state.table = state.savedTable.slice();
      state.savedTable = null;
      state.savedHand = null;
      state.savedHandIds = null;
      state.workspace = [];
      state.phase = 'play';
      return null;
    }

    if (action === 'submit') {
      if (!groups || !Array.isArray(groups) || groups.length === 0) return 'rk_submit_at_least_one_set';

      // Flatten all submitted tiles
      const allTiles = [];
      for (const g of groups) {
        if (!Array.isArray(g)) return 'rk_invalid_set';
        for (const t of g) {
          if (!t || !t.id) return 'rk_invalid_tile';
          allTiles.push(t);
        }
      }

      // Validate each group
      for (const g of groups) {
        if (!isValidSet(g)) return 'rk_illegal_sets';
      }

      // Check at least one hand tile was used
      const handIds = new Set(state.savedHandIds);
      let handTileUsed = false;
      for (const t of allTiles) {
        if (handIds.has(t.id)) { handTileUsed = true; break; }
      }
      if (!handTileUsed) return 'rk_use_at_least_one_own';

      // Every tile originally on the table must be re-formed into a group (none lost)
      const groupedIds = new Set(allTiles.map(t => t.id));
      for (const set of state.savedTable) {
        for (const t of set) {
          if (!groupedIds.has(t.id)) return 'rk_all_table_tiles_must_regroup';
        }
      }

      // Check break requirement
      if (!state.hasBroken[playerIndex] && requireBreak) {
        let handScore = 0;
        for (const t of allTiles) {
          if (handIds.has(t.id)) handScore += (t.wild ? 0 : t.num);
        }
        if (handScore < 30) return 'rk_need_break_ice';
      }

      // Success — update table and hand
      state.table = groups.map(g => g.slice());
      // Remove used hand tiles from player's hand
      const usedIds = new Set(allTiles.map(t => t.id));
      state.hands[playerIndex] = state.hands[playerIndex].filter(t => !usedIds.has(t.id));
      sortHand(state.hands[playerIndex]);

      state.hasBroken[playerIndex] = true;
      state.playedThisTurn[playerIndex] = true;
      state.passesSinceLastPlay = 0;
      state.workspace = [];
      state.savedTable = null;
      state.savedHand = null;
      state.savedHandIds = null;
      state.phase = 'play';

      if (state.hands[playerIndex].length === 0) {
        state.winner = playerIndex;
        state.phase = 'over';
      }
      return null;
    }

    return 'g_unknown_action';
  }

  // ---- PLAY PHASE ----
  if (state.phase === 'play') {
    const hand = state.hands[playerIndex];
    const { tileIds, targetSet, pass, endTurn, action } = data || {};

    // Start manipulate mode
    if (action === 'start_manipulate') {
      if (state.table.length === 0) return 'rk_table_empty';
      // Save snapshot
      state.savedTable = state.table.map(s => s.slice());
      state.savedHand = hand.slice();
      state.savedHandIds = hand.map(t => t.id);
      // Move all table tiles + player's hand into workspace
      state.workspace = [];
      for (const set of state.table) {
        for (const t of set) state.workspace.push(t);
      }
      for (const t of hand) state.workspace.push(t);
      state.phase = 'manipulate';
      return null;
    }

    // End turn without drawing (only if already played)
    if (endTurn && state.playedThisTurn[playerIndex]) {
      state.playedThisTurn[playerIndex] = false;
      state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
      return null;
    }

    if (pass) {
      if (state.playedThisTurn[playerIndex]) return 'rk_already_played';
      if (state.pool.length > 0) {
        hand.push(state.pool.pop());
        sortHand(hand);
        state.passesSinceLastPlay = 0;
      } else {
        // Pool empty — increment stalemate counter
        state.passesSinceLastPlay++;
        if (state.passesSinceLastPlay >= state.hands.length) {
          state.winner = -1; // draw
          state.phase = 'over';
          return null;
        }
      }
      state.playedThisTurn[playerIndex] = false;
      state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
      return null;
    }

    // Play tiles from hand
    if (tileIds && Array.isArray(tileIds) && tileIds.length > 0) {
      // Validate all tiles exist in hand
      const toPlay = [];
      const remaining = [...hand];
      for (const id of tileIds) {
        const idx = remaining.findIndex(t => t.id === id);
        if (idx === -1) return 'rk_card_not_in_hand';
        toPlay.push(...remaining.splice(idx, 1));
      }

      // Check if these tiles form a valid set
      if (toPlay.length >= 3) {
        if (!isValidSet(toPlay)) return 'rk_cannot_form_set';

        // Check break requirement
        if (!state.hasBroken[playerIndex] && requireBreak) {
          const score = tileScore(toPlay);
          if (score < 30) return 'rk_need_break_ice';
        }

        // Remove from hand
        for (const id of tileIds) {
          const idx = hand.findIndex(t => t.id === id);
          hand.splice(idx, 1);
        }
        state.table.push(toPlay);
        state.hasBroken[playerIndex] = true;
        state.playedThisTurn[playerIndex] = true;
        state.passesSinceLastPlay = 0;

        if (hand.length === 0) {
          state.winner = playerIndex;
          state.phase = 'over';
          return null;
        }
        // Player can continue, manipulate, or end turn
        return null;
      }

      // Adding to existing table set
      if (toPlay.length === 1 && targetSet !== undefined && targetSet >= 0 && targetSet < state.table.length) {
        const tile = toPlay[0];
        const set = state.table[targetSet];
        if (!canAddToSet(tile, set)) return 'rk_cannot_join_set';

        if (!state.hasBroken[playerIndex] && requireBreak) return 'rk_need_break_ice';

        const idx = hand.findIndex(t => t.id === tile.id);
        hand.splice(idx, 1);
        set.push(tile);

        // Re-sort if run
        if (new Set(set.filter(t => !t.wild).map(t => t.color)).size === 1) {
          set.sort((a, b) => a.num - b.num);
        }

        state.hasBroken[playerIndex] = true;
        state.playedThisTurn[playerIndex] = true;
        state.passesSinceLastPlay = 0;

        if (hand.length === 0) {
          state.winner = playerIndex;
          state.phase = 'over';
          return null;
        }
        return null;
      }

      return 'rk_invalid_play';
    }

    // Draw if can't play (no action specified)
    if (state.pool.length > 0) {
      hand.push(state.pool.pop());
      sortHand(hand);
      state.passesSinceLastPlay = 0;
    } else {
      state.passesSinceLastPlay++;
      if (state.passesSinceLastPlay >= state.hands.length) {
        state.winner = -1; // draw
        state.phase = 'over';
        return null;
      }
    }
    state.playedThisTurn[playerIndex] = false;
    state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
    return null;
  }

  return 'g_unknown_action';
};
