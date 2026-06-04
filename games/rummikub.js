// games/rummikub.js
// 拉密 / 魔力桥 (Rummikub) — Tile-based combination game with table manipulation

exports.name = 'rummikub';
exports.maxPlayers = 4;

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
  if (state.winner !== null) return '游戏已结束';

  if (state.hands.length === 0) {
    const count = state._playerCount || 2;
    initGame(state, count);
    return null;
  }

  const requireBreak = state.requireBreak;

  if (playerIndex !== state.currentPlayer) return '还没轮到你';

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
      if (!groups || !Array.isArray(groups) || groups.length === 0) return '请至少提交一个牌组';

      // Flatten all submitted tiles
      const allTiles = [];
      for (const g of groups) {
        if (!Array.isArray(g)) return '牌组格式错误';
        for (const t of g) {
          if (!t || !t.id) return '牌组中有无效牌';
          allTiles.push(t);
        }
      }

      // Validate each group
      for (const g of groups) {
        if (!isValidSet(g)) return '存在不合法的牌组（需同色连续≥3或同数不同色≥3）';
      }

      // Check at least one hand tile was used
      const handIds = new Set(state.savedHandIds);
      let handTileUsed = false;
      for (const t of allTiles) {
        if (handIds.has(t.id)) { handTileUsed = true; break; }
      }
      if (!handTileUsed) return '必须至少使用一张自己的牌';

      // Every tile originally on the table must be re-formed into a group (none lost)
      const groupedIds = new Set(allTiles.map(t => t.id));
      for (const set of state.savedTable) {
        for (const t of set) {
          if (!groupedIds.has(t.id)) return '桌面上原有的牌必须全部重新组成合法牌组';
        }
      }

      // Check break requirement
      if (!state.hasBroken[playerIndex] && requireBreak) {
        let handScore = 0;
        for (const t of allTiles) {
          if (handIds.has(t.id)) handScore += (t.wild ? 0 : t.num);
        }
        if (handScore < 30) return '首次出牌总分需要≥30分，当前手牌贡献' + handScore + '分';
      }

      // Success — update table and hand
      state.table = groups.map(g => g.slice());
      // Remove used hand tiles from player's hand
      const usedIds = new Set(allTiles.map(t => t.id));
      state.hands[playerIndex] = state.hands[playerIndex].filter(t => !usedIds.has(t.id));
      sortHand(state.hands[playerIndex]);

      state.hasBroken[playerIndex] = true;
      state.playedThisTurn[playerIndex] = true;
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

    return '未知操作';
  }

  // ---- PLAY PHASE ----
  if (state.phase === 'play') {
    const hand = state.hands[playerIndex];
    const { tileIds, targetSet, pass, endTurn, action } = data || {};

    // Start manipulate mode
    if (action === 'start_manipulate') {
      if (state.table.length === 0) return '桌面还没有牌组';
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
      // Draw a tile
      if (state.pool.length > 0) {
        hand.push(state.pool.pop());
        sortHand(hand);
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
        if (idx === -1) return '手上没有这张牌: ' + id;
        toPlay.push(...remaining.splice(idx, 1));
      }

      // Check if these tiles form a valid set
      if (toPlay.length >= 3) {
        if (!isValidSet(toPlay)) return '不能组成合法牌组（顺组需同色连续≥3，群组需同数不同色≥3）';

        // Check break requirement
        if (!state.hasBroken[playerIndex] && requireBreak) {
          const score = tileScore(toPlay);
          if (score < 30) return '首次出牌总分需要≥30分，当前' + score + '分';
        }

        // Remove from hand
        for (const id of tileIds) {
          const idx = hand.findIndex(t => t.id === id);
          hand.splice(idx, 1);
        }
        state.table.push(toPlay);
        state.hasBroken[playerIndex] = true;
        state.playedThisTurn[playerIndex] = true;

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
        if (!canAddToSet(tile, set)) return '不能加入该牌组';

        if (!state.hasBroken[playerIndex] && requireBreak) return '需要先破冰（首次出牌总分≥30）';

        const idx = hand.findIndex(t => t.id === tile.id);
        hand.splice(idx, 1);
        set.push(tile);

        // Re-sort if run
        if (new Set(set.filter(t => !t.wild).map(t => t.color)).size === 1) {
          set.sort((a, b) => a.num - b.num);
        }

        state.hasBroken[playerIndex] = true;
        state.playedThisTurn[playerIndex] = true;

        if (hand.length === 0) {
          state.winner = playerIndex;
          state.phase = 'over';
          return null;
        }
        return null;
      }

      return '出牌数量少于3张且未指定加入桌面牌组';
    }

    // Draw if can't play (no action specified)
    if (state.pool.length > 0) {
      hand.push(state.pool.pop());
      sortHand(hand);
    }
    state.playedThisTurn[playerIndex] = false;
    state.currentPlayer = (state.currentPlayer + 1) % state.hands.length;
    return null;
  }

  return '未知阶段';
};
