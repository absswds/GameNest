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
  meldPending: null,  // initial meld in progress this turn: { score, table, hand } snapshot to revert to
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
  state.meldPending = null;
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
  // The whole run (tiles.length consecutive numbers) must fit inside 1-13 for some start,
  // and that start must not be above the lowest or below the highest real tile.
  const len = tiles.length;
  const high = nums[nums.length - 1];
  return Math.max(1, high - len + 1) <= Math.min(nums[0], 14 - len);
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
  if (nums.size === 1 && colors.size === nonWild.length && isValidGroup(tiles)) return true;
  if (colors.size === 1) {
    return isValidRun(tiles);
  }
  return false;
}

// Calculate total score (used for the end-game rack penalty, where a joker costs 30)
function tileScore(tiles) {
  if (!tiles || !Array.isArray(tiles)) return 0;
  return tiles.reduce((sum, t) => sum + (t.wild ? 30 : t.num), 0);
}

// Is this valid set a group (same number) rather than a run?
function isGroupSet(tiles) {
  const nonWild = tiles.filter(t => !t.wild);
  return nonWild.length >= 2 && new Set(nonWild.map(t => t.num)).size === 1;
}

// Lay out a valid run: returns { tiles, values } with jokers in the slot they stand for.
// The submitted order is kept when it is already a consistent run; otherwise the tiles
// are sorted and jokers fill the gaps, then extend upward (to 13) and finally downward.
function arrangeRun(tiles) {
  const len = tiles.length;
  const k = tiles.findIndex(t => !t.wild);
  if (k >= 0) {
    const start = tiles[k].num - k;
    if (start >= 1 && start + len - 1 <= 13 &&
        tiles.every((t, i) => t.wild || t.num === start + i)) {
      return { tiles: tiles.slice(), values: tiles.map((t, i) => start + i) };
    }
  }
  const real = tiles.filter(t => !t.wild).sort((a, b) => a.num - b.num);
  const wilds = tiles.filter(t => t.wild);
  const out = [];
  const values = [];
  for (let i = 0; i < real.length; i++) {
    if (i > 0) {
      for (let v = real[i - 1].num + 1; v < real[i].num; v++) {
        out.push(wilds.shift()); values.push(v);
      }
    }
    out.push(real[i]); values.push(real[i].num);
  }
  let top = real[real.length - 1].num;
  while (wilds.length && top < 13) { out.push(wilds.shift()); values.push(++top); }
  let low = real[0].num;
  while (wilds.length) { out.unshift(wilds.shift()); values.unshift(--low); }
  return { tiles: out, values };
}

// Per-tile point values of a valid set, jokers counting as the tile they replace
// (official initial-meld rule). Returns { tiles, values } with tiles in display order.
function setLayout(tiles) {
  if (isGroupSet(tiles)) {
    const num = tiles.find(t => !t.wild).num;
    return { tiles: tiles.slice(), values: tiles.map(() => num) };
  }
  return arrangeRun(tiles);
}

// Initial-meld points of a valid set (jokers count as the tile they replace)
function meldPoints(tiles) {
  return setLayout(tiles).values.reduce((a, b) => a + b, 0);
}

// Draw one tile (or count a stalemate pass) and hand the turn over. Returns true if the game ended.
function drawAndEnd(state, hand) {
  if (state.pool.length > 0) {
    hand.push(state.pool.pop());
    sortHand(hand);
    state.passesSinceLastPlay = 0;
  } else {
    state.passesSinceLastPlay++;
    if (state.passesSinceLastPlay >= state.hands.length) {
      state.winner = lowestRackWinner(state);
      state.phase = 'over';
      return true;
    }
  }
  return false;
}
// Stalemate (pool empty, nobody can play): lowest total in hand wins, equal totals draw.
function lowestRackWinner(state) {
  const totals = state.hands.map(tileScore);
  const best = Math.min(...totals);
  const leaders = totals.reduce((a, t, i) => (t === best ? a.concat(i) : a), []);
  return leaders.length === 1 ? leaders[0] : -1;
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
      state.hands[playerIndex] = state.savedHand.slice();
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

      // Only tile ids are trusted: map each one to the real tile in the workspace
      // (table + this player's hand); a tile may appear only once.
      const real = new Map(state.workspace.map(t => [t.id, t]));
      const seen = new Set();
      const allTiles = [];
      const realGroups = [];
      for (const g of groups) {
        if (!Array.isArray(g)) return 'rk_invalid_set';
        const rg = [];
        for (const t of g) {
          const id = typeof t === 'string' ? t : (t && t.id);
          const tile = typeof id === 'string' ? real.get(id) : undefined;
          if (!tile || seen.has(id)) return 'rk_invalid_tile';
          seen.add(id);
          rg.push(tile);
          allTiles.push(tile);
        }
        realGroups.push(rg);
      }

      // Validate each group
      for (const g of realGroups) {
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
      for (const set of state.savedTable) {
        for (const t of set) {
          if (!seen.has(t.id)) return 'rk_all_table_tiles_must_regroup';
        }
      }

      // Lay each set out in display order (jokers in the slot they stand for)
      const layouts = realGroups.map(setLayout);

      // Check break requirement: the hand tiles played total >= 30. A joker counts as
      // the tile it stands for (official rule; 30 is only the end-of-game penalty).
      if (!state.hasBroken[playerIndex] && requireBreak) {
        let handScore = 0;
        for (const lay of layouts) {
          lay.tiles.forEach((t, i) => { if (handIds.has(t.id)) handScore += lay.values[i]; });
        }
        if (handScore < 30) return 'rk_need_break_ice';
      }

      // Success — update table and hand
      state.table = layouts.map(l => l.tiles);
      // Remove used hand tiles from player's hand
      const usedIds = seen;
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
      // Initial meld must be laid down before touching the table
      if (state.meldPending) return 'rk_need_break_ice';
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

    // Initial meld not completed (< 30 points) when the turn ends: take the tiles back, draw instead.
    const endWithoutBreak = () => {
      const p = state.meldPending;
      state.meldPending = null;
      state.table = p.table;
      state.hands[playerIndex] = p.hand;
      state.playedThisTurn[playerIndex] = false;
      if (!drawAndEnd(state, state.hands[playerIndex])) {
        state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
      }
      return null;
    };

    // End turn without drawing (only if already played)
    if (endTurn && state.playedThisTurn[playerIndex]) {
      if (state.meldPending) return endWithoutBreak();
      state.playedThisTurn[playerIndex] = false;
      state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
      return null;
    }

    if (pass) {
      if (state.meldPending) return endWithoutBreak();
      if (state.playedThisTurn[playerIndex]) return 'rk_already_played';
      if (drawAndEnd(state, hand)) return null;
      state.playedThisTurn[playerIndex] = false;
      state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
      return null;
    }

    // Play tiles from hand
    if (Array.isArray(tileIds) && tileIds.length > 0) {
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

        // Initial meld: the sets played this turn together must reach 30 points
        // (jokers count as the tile they stand for); earlier sets stay pending until then.
        const needBreak = !state.hasBroken[playerIndex] && requireBreak;
        const pts = meldPoints(toPlay);
        if (needBreak && !state.meldPending) {
          state.meldPending = { score: 0, table: state.table.map(s => s.slice()), hand: hand.slice() };
        }

        // Remove from hand
        state.hands[playerIndex] = remaining;
        state.table.push(setLayout(toPlay).tiles);
        if (state.meldPending) {
          state.meldPending.score += pts;
          if (state.meldPending.score >= 30) {
            state.meldPending = null;
            state.hasBroken[playerIndex] = true;
          }
        } else {
          state.hasBroken[playerIndex] = true;
        }
        state.playedThisTurn[playerIndex] = true;
        state.passesSinceLastPlay = 0;

        if (remaining.length === 0 && state.hasBroken[playerIndex]) {
          state.winner = playerIndex;
          state.phase = 'over';
        }
        // Player can continue, manipulate, or end turn
        return null;
      }

      // Adding to existing table set
      if (toPlay.length === 1 && Number.isInteger(targetSet) && targetSet >= 0 && targetSet < state.table.length) {
        const tile = toPlay[0];
        const set = state.table[targetSet];
        if (!canAddToSet(tile, set)) return 'rk_cannot_join_set';

        if (!state.hasBroken[playerIndex] && requireBreak) return 'rk_need_break_ice';

        state.hands[playerIndex] = remaining;
        set.push(tile);

        // Keep a run in order, with jokers in the slot they stand for
        if (!isGroupSet(set)) {
          set.splice(0, set.length, ...arrangeRun(set).tiles);
        }

        state.hasBroken[playerIndex] = true;
        state.playedThisTurn[playerIndex] = true;
        state.passesSinceLastPlay = 0;

        if (remaining.length === 0) {
          state.winner = playerIndex;
          state.phase = 'over';
        }
        return null;
      }

      return 'rk_invalid_play';
    }

    // Draw if can't play (no action specified)
    if (state.meldPending) return endWithoutBreak();
    if (state.playedThisTurn[playerIndex]) return 'rk_already_played';
    if (drawAndEnd(state, hand)) return null;
    state.playedThisTurn[playerIndex] = false;
    state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
    return null;
  }

  return 'g_unknown_action';
};

// Hide other players' cards (and draw piles) from each client. The current player's
// working copies of the hand (workspace / saved snapshots / pending meld) are hidden too.
const { maskView, blank } = require('./lib/hidden');
exports.playerView = function (state, playerIndex) {
  const view = maskView(state, playerIndex, { piles: ['pool'] });
  if (view === state || playerIndex === state.currentPlayer) return view;
  view.workspace = blank(state.workspace);
  view.savedHand = blank(state.savedHand);
  view.savedHandIds = blank(state.savedHandIds);
  view.meldPending = state.meldPending ? { score: state.meldPending.score } : null;
  return view;
};
