// games/minesweeper.js
// 扫雷 — Multiplayer speed race: same mine layout, independent boards per player

exports.name = 'minesweeper';
exports.maxPlayers = 6;

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;
const DEFAULT_MINES = 15;

function createMineLayout(rows, cols, mines) {
  const mines_ = [];
  for (let r = 0; r < rows; r++) {
    mines_[r] = Array(cols).fill(false);
  }
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!mines_[r][c]) {
      mines_[r][c] = true;
      placed++;
    }
  }
  return mines_;
}

function countAdjacent(mines_, r, c, rows, cols) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && mines_[nr][nc]) count++;
    }
  }
  return count;
}

function floodReveal(revealed, mines_, r, c, rows, cols) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return 0;
  if (revealed[r][c] || mines_[r][c]) return 0;
  revealed[r][c] = true;
  let count = 1;
  if (countAdjacent(mines_, r, c, rows, cols) === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        count += floodReveal(revealed, mines_, r + dr, c + dc, rows, cols);
      }
    }
  }
  return count;
}

// Build a lightweight board snapshot for client (per-player view)
function playerBoardView(state, playerIndex) {
  const rows = state.rows;
  const cols = state.cols;
  const board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      const revealed = state.revealed[playerIndex][r][c];
      const flagged = state.flagged[playerIndex][r][c];
      const isMine = state.mines[r][c];
      board[r][c] = {
        mine: isMine,
        revealed: revealed,
        flagged: flagged,
        adjacent: revealed && !isMine ? countAdjacent(state.mines, r, c, rows, cols) : 0,
        exploded: revealed && isMine && state.deadByCell[playerIndex] && state.deadByCell[playerIndex].r === r && state.deadByCell[playerIndex].c === c,
      };
    }
  }
  return board;
}

exports.createState = () => ({
  mines: [],          // shared mine layout (rows×cols boolean)
  revealed: [],       // per-player: rows×cols boolean
  flagged: [],        // per-player: rows×cols boolean
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  mineCount: DEFAULT_MINES,
  alive: [],
  cellsRevealed: [],   // per-player: total safe cells they've revealed
  deadByCell: [],      // per-player: which cell they died on {r,c} or null
  currentPlayer: -1,
  winner: null,
  safeCells: 0,
});

exports.initGame = function (state, playerCount) {
  state.rows = DEFAULT_ROWS;
  state.cols = DEFAULT_COLS;
  state.mineCount = DEFAULT_MINES;
  state.mines = createMineLayout(state.rows, state.cols, state.mineCount);
  state.revealed = [];
  state.flagged = [];
  state.deadByCell = [];
  for (let p = 0; p < playerCount; p++) {
    const rGrid = [];
    const fGrid = [];
    for (let r = 0; r < state.rows; r++) {
      rGrid[r] = Array(state.cols).fill(false);
      fGrid[r] = Array(state.cols).fill(false);
    }
    state.revealed.push(rGrid);
    state.flagged.push(fGrid);
    state.deadByCell.push(null);
  }
  state.alive = Array(playerCount).fill(true);
  state.cellsRevealed = Array(playerCount).fill(0);
  state.winner = null;
  state.currentPlayer = -1;
  state.safeCells = state.rows * state.cols - state.mineCount;
};

exports.playerBoardView = playerBoardView;

exports.handleMove = function (data, state, playerIndex) {
  if (state.winner !== null) return '游戏已结束';
  if (!state.alive[playerIndex]) return '你已出局，只能观战';

  const { action, row, col } = data || {};
  if (typeof row !== 'number' || typeof col !== 'number') return '无效操作';
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return '坐标超出范围';

  if (action === 'flag') {
    if (state.revealed[playerIndex][row][col]) return '该格已翻开';
    state.flagged[playerIndex][row][col] = !state.flagged[playerIndex][row][col];
    return null;
  }

  if (action === 'reveal') {
    if (state.revealed[playerIndex][row][col]) return '该格已翻开';
    if (state.flagged[playerIndex][row][col]) return '该格已标旗，请先取消旗子';

    if (state.mines[row][col]) {
      state.revealed[playerIndex][row][col] = true;
      state.deadByCell[playerIndex] = { r: row, c: col };
      state.alive[playerIndex] = false;

      const aliveCount = state.alive.filter(Boolean).length;
      if (aliveCount === 1) {
        state.winner = state.alive.indexOf(true);
      } else if (aliveCount === 0) {
        state.winner = -1;
      }
      return null;
    }

    const revealed = floodReveal(state.revealed[playerIndex], state.mines, row, col, state.rows, state.cols);
    state.cellsRevealed[playerIndex] += revealed;

    if (state.cellsRevealed[playerIndex] >= state.safeCells) {
      state.winner = playerIndex;
    }

    return null;
  }

  return '无效操作类型: ' + (action || '无');
};
