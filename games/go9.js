// games/go9.js — 围棋 9×9 简化版 (2 players)
// 9×9 board, capture rules, ko, Chinese area scoring (数子法)

const SIZE = 9;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// Player indices
const P_BLACK = 0;
const P_WHITE = 1;

exports.name = 'go9';
exports.maxPlayers = 2;

function stoneForSide(side) { return side === P_BLACK ? BLACK : WHITE; }
function enemyStone(side) { return side === P_BLACK ? WHITE : BLACK; }
function sideForStone(s) { return s === BLACK ? P_BLACK : P_WHITE; }

exports.createState = () => ({
  currentPlayer: P_BLACK,
  winner: null,
  board: Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY)),
  captures: [0, 0],            // captures[P_BLACK], captures[P_WHITE]
  koPoint: null,
  consecutivePasses: 0,
  moveHistory: [],
  _playerCount: 2,
});

// ---- Core Go Logic ----

function getGroup(board, row, col) {
  const color = board[row][col];
  if (color === EMPTY) return [];
  const visited = new Set();
  const group = [];
  const queue = [{ row, col }];
  visited.add(`${row},${col}`);

  while (queue.length > 0) {
    const { row: r, col: c } = queue.shift();
    group.push({ row: r, col: c });
    for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE &&
          !visited.has(key) && board[nr][nc] === color) {
        visited.add(key);
        queue.push({ row: nr, col: nc });
      }
    }
  }
  return group;
}

function countLiberties(board, group) {
  const gs = new Set(group.map(p => `${p.row},${p.col}`));
  const libs = new Set();
  for (const p of group) {
    for (const [nr, nc] of [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]]) {
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === EMPTY && !gs.has(key))
        libs.add(key);
    }
  }
  return libs.size;
}

function removeGroup(board, group) {
  for (const p of group) board[p.row][p.col] = EMPTY;
  return group.length;
}

function validateMove(board, side, row, col, koPoint) {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return { valid: false, reason: '超出棋盘' };
  if (board[row][col] !== EMPTY) return { valid: false, reason: '该位置已有棋子' };
  if (koPoint && koPoint.row === row && koPoint.col === col) return { valid: false, reason: '打劫规则：不能立刻提回' };

  const myStone = stoneForSide(side);
  const enemy = enemyStone(side);
  board[row][col] = myStone;

  const capturedGroups = [];
  const checkedEnemy = new Set();

  for (const [nr, nc] of [[row-1,col],[row+1,col],[row,col-1],[row,col+1]]) {
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
    if (board[nr][nc] !== enemy) continue;
    const key = `${nr},${nc}`;
    if (checkedEnemy.has(key)) continue;
    const grp = getGroup(board, nr, nc);
    for (const p of grp) checkedEnemy.add(`${p.row},${p.col}`);
    if (countLiberties(board, grp) === 0) capturedGroups.push(grp);
  }

  const ownGroup = getGroup(board, row, col);
  const ownLibs = countLiberties(board, ownGroup);
  board[row][col] = EMPTY;

  if (capturedGroups.length === 0 && ownLibs === 0)
    return { valid: false, reason: '禁着点：此处落子会自杀' };

  return { valid: true, capturedGroups, ownGroup };
}

// Chinese area scoring (数子法) — 黑贴 3.75 子 (equivalent to 7.5 目)
function scoreGame(board) {
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  let blackArea = 0, whiteArea = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (visited[r][c]) continue;
      if (board[r][c] === BLACK) { blackArea++; visited[r][c] = true; continue; }
      if (board[r][c] === WHITE) { whiteArea++; visited[r][c] = true; continue; }
      // Flood fill empty region
      const region = [];
      const queue = [{ row: r, col: c }];
      visited[r][c] = true;
      let touchesBlack = false, touchesWhite = false;
      while (queue.length > 0) {
        const p = queue.shift();
        region.push(p);
        for (const [nr, nc] of [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]]) {
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
          if (board[nr][nc] === BLACK) touchesBlack = true;
          else if (board[nr][nc] === WHITE) touchesWhite = true;
          else if (!visited[nr][nc]) { visited[nr][nc] = true; queue.push({ row: nr, col: nc }); }
        }
      }
      if (touchesBlack && !touchesWhite) blackArea += region.length;
      else if (touchesWhite && !touchesBlack) whiteArea += region.length;
    }
  }

  // 中国规则：黑贴 3.75 子
  return { black: blackArea - 3.75, white: whiteArea };
}

// ---- Handle Move ----

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '不是你的回合';

  const { row, col, pass } = data || {};

  if (pass === true) {
    state.consecutivePasses++;
    if (state.consecutivePasses >= 2) {
      const scores = scoreGame(state.board);
      if (Math.abs(scores.black - scores.white) < 0.01) state.winner = -1;
      else state.winner = scores.black > scores.white ? P_BLACK : P_WHITE;
      state.finalScores = scores;
    } else {
      state.currentPlayer = playerIndex === P_BLACK ? P_WHITE : P_BLACK;
      state.koPoint = null;
      state.moveHistory.push({ pass: true, side: playerIndex });
    }
    return null;
  }

  if (typeof row !== 'number' || typeof col !== 'number') return '无效的操作';

  const result = validateMove(state.board, playerIndex, row, col, state.koPoint);
  if (!result.valid) return result.reason;

  const myStone = stoneForSide(playerIndex);
  state.board[row][col] = myStone;
  state.consecutivePasses = 0;

  let totalCaptured = 0;
  let koCandidate = null;
  for (const grp of result.capturedGroups) {
    totalCaptured += removeGroup(state.board, grp);
    if (grp.length === 1) koCandidate = grp[0];
  }
  state.captures[playerIndex] += totalCaptured;

  // Ko: exactly 1 stone captured, and the placed stone's group now has exactly 1 liberty
  if (result.capturedGroups.length === 1 && result.capturedGroups[0].length === 1 && koCandidate) {
    const placedGroup = getGroup(state.board, row, col);
    if (placedGroup.length === 1 && countLiberties(state.board, placedGroup) === 1)
      state.koPoint = koCandidate;
    else
      state.koPoint = null;
  } else {
    state.koPoint = null;
  }

  state.moveHistory.push({ row, col, side: playerIndex, captured: totalCaptured });
  state.currentPlayer = playerIndex === P_BLACK ? P_WHITE : P_BLACK;
  return null;
};

exports.initGame = (state, playerCount) => {
  state._playerCount = playerCount;
};
