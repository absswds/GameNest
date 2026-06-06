// games/sheeptile.js — 羊了个羊 (堆叠三消对战)
// 规则: 点击牌放入槽位，集齐3张同图案消除，槽位满7张失败，先清空牌堆胜利
exports.name = 'sheeptile';
exports.maxPlayers = 6;

const PATTERN_COUNT = 18;
const ROWS = 8, COLS = 8, LAYERS = 3;
const SLOT_SIZE = 7;

function randInt(n) { return Math.floor(Math.random() * n); }

function generateBoard(seed) {
  // Generate tiles: place pairs of 3 (triplets) across layers
  // Each tile is {id, pattern, row, col, layer, removed:false}
  const tiles = [];
  let id = 0;
  // Total cells: approximately rows*cols*layers with some offset per layer
  // We use a grid of 8x8 per layer, with each higher layer offset by 0.5
  const allPositions = [];
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        allPositions.push({ row, col, layer });
      }
    }
  }

  // Shuffle positions and assign patterns in groups of 3
  const shuffled = [...allPositions].sort(() => Math.random() - 0.5);
  // Trim to multiple of 3
  const usable = shuffled.slice(0, Math.floor(shuffled.length / 3) * 3);

  const patterns = [];
  for (let i = 0; i < usable.length; i += 3) {
    const p = randInt(PATTERN_COUNT);
    patterns.push(p, p, p);
  }
  // Shuffle patterns into positions
  const pShuffled = patterns.sort(() => Math.random() - 0.5);

  for (let i = 0; i < usable.length; i++) {
    tiles.push({
      id: id++,
      pattern: pShuffled[i],
      row: usable[i].row,
      col: usable[i].col,
      layer: usable[i].layer,
      removed: false,
    });
  }
  return tiles;
}

function isBlocked(tile, allTiles) {
  // A tile is blocked if any non-removed tile of higher layer overlaps it
  for (const t of allTiles) {
    if (t.removed || t.layer <= tile.layer) continue;
    // Check overlap: tiles on layer+1 have half-cell offset, so check proximity
    const dr = Math.abs(t.row - tile.row + 0.5 * (t.layer - tile.layer));
    const dc = Math.abs(t.col - tile.col + 0.5 * (t.layer - tile.layer));
    if (dr < 1 && dc < 1) return true;
  }
  return false;
}

exports.createState = () => ({
  phase: 'playing',
  boards: [],       // one board per player
  slots: [],        // one slot array per player (max SLOT_SIZE)
  scores: [],       // tiles cleared per player
  eliminated: [],   // boolean per player
  currentPlayer: 0,
  winner: null,
  _playerCount: 0,
});

exports.initGame = (state, playerCount) => {
  state._playerCount = playerCount;
  state.boards = [];
  state.slots = [];
  state.scores = [];
  state.eliminated = [];
  for (let i = 0; i < playerCount; i++) {
    state.boards.push(generateBoard(i));
    state.slots.push([]);
    state.scores.push(0);
    state.eliminated.push(false);
  }
  state.phase = 'playing';
  state.currentPlayer = 0;
  state.winner = null;
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase !== 'playing') return '游戏已结束';
  if (state.eliminated[playerIndex]) return '你已出局';

  const board = state.boards[playerIndex];
  const slot = state.slots[playerIndex];

  if (data.type === 'pick') {
    const tile = board.find(t => t.id === data.tileId);
    if (!tile) return '找不到此牌';
    if (tile.removed) return '已移除';
    if (isBlocked(tile, board)) return '被遮挡，无法点击';

    // Move to slot
    tile.removed = true;
    slot.push({ pattern: tile.pattern, fromId: tile.id });

    // Check for 3 same pattern in slot
    const counts = {};
    slot.forEach((s, i) => { counts[s.pattern] = (counts[s.pattern] || []).concat(i); });
    for (const [pat, idxs] of Object.entries(counts)) {
      if (idxs.length >= 3) {
        // Remove first 3 occurrences
        for (let k = 2; k >= 0; k--) slot.splice(idxs[k], 1);
        state.scores[playerIndex] += 3;
        break;
      }
    }

    // Check slot overflow
    if (slot.length >= SLOT_SIZE) {
      state.eliminated[playerIndex] = true;
    }

    // Check board clear (win)
    const remaining = board.filter(t => !t.removed);
    if (remaining.length === 0) {
      state.winner = playerIndex;
      state.phase = 'gameover';
      return null;
    }

    // Check if all alive players are eliminated → last one standing wins
    const alive = state.eliminated.map((e, i) => !e && i < state._playerCount);
    const aliveCount = alive.filter(Boolean).length;
    if (aliveCount === 0) {
      // Everyone eliminated, highest score wins
      let best = -1, bestScore = -1;
      for (let i = 0; i < state._playerCount; i++) {
        if (state.scores[i] > bestScore) { bestScore = state.scores[i]; best = i; }
      }
      state.winner = best;
      state.phase = 'gameover';
    } else if (aliveCount === 1 && state._playerCount > 1) {
      state.winner = alive.indexOf(true);
      state.phase = 'gameover';
    }

    return null;
  }

  if (data.type === 'power_undo') {
    // Undo last slot entry (restore to board)
    if (slot.length === 0) return '槽位为空';
    const last = slot.pop();
    const tile = board.find(t => t.id === last.fromId);
    if (tile) tile.removed = false;
    if (state.eliminated[playerIndex]) state.eliminated[playerIndex] = false;
    return null;
  }

  if (data.type === 'power_shuffle') {
    // Shuffle remaining tile patterns
    const remaining = board.filter(t => !t.removed);
    const pats = remaining.map(t => t.pattern).sort(() => Math.random() - 0.5);
    remaining.forEach((t, i) => { t.pattern = pats[i]; });
    return null;
  }

  return '未知操作';
};
