// games/connect4.js — Connect Four (2 players)
// 7 columns × 6 rows, gravity drop, 4-in-a-row detection

const ROWS = 6, COLS = 7;

exports.name = 'connect4';
exports.maxPlayers = 2;

exports.createState = () => ({
  currentPlayer: 0,        // 0=yellow, 1=red; yellow goes first
  winner: null,            // null|0|1|-1(draw)
  board: null,             // 6×7 array, cells: 0|1|null
  lastMove: null,          // {row, col}
  moveHistory: [],
  _playerCount: 2,
});

exports.initGame = (state) => {
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
};

function checkWin(board, row, col, side) {
  const dirs = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
  ];
  for (const [dr, dc] of dirs) {
    let count = 1;
    // Check in positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === side) {
        count++;
      } else break;
    }
    // Check in negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === side) {
        count++;
      } else break;
    }
    if (count >= 4) return true;
  }
  return false;
}

function isBoardFull(board) {
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === null) return false;
  }
  return true;
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '不是你的回合';

  const col = data && data.col;
  if (typeof col !== 'number' || col < 0 || col >= COLS || col !== Math.floor(col)) return '无效的列';
  if (state.board[0][col] !== null) return '该列已满';

  // Find lowest empty row in this column
  let targetRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r][col] === null) {
      targetRow = r;
      break;
    }
  }
  if (targetRow === -1) return '该列已满';

  state.board[targetRow][col] = playerIndex;
  state.lastMove = { row: targetRow, col: col };
  state.moveHistory.push({ row: targetRow, col: col, player: playerIndex });

  // Check for win
  if (checkWin(state.board, targetRow, col, playerIndex)) {
    state.winner = playerIndex;
    return null;
  }

  // Check for draw
  if (isBoardFull(state.board)) {
    state.winner = -1;
    return null;
  }

  // Switch turn
  state.currentPlayer = 1 - state.currentPlayer;
  return null;
};

// Per-player view: inject legalMoves for the current player only
exports.playerView = function(state, playerIndex) {
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    board: state.board,
    lastMove: state.lastMove,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount,
  };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = [];
    for (var c = 0; c < COLS; c++) {
      if (state.board[0][c] === null) view.legalMoves.push(c);
    }
  } else {
    view.legalMoves = [];
  }
  return view;
};
