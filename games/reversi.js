// games/reversi.js — 黑白棋 (2 players)
// 8×8 board, flip mechanics, pass/end detection

exports.name = 'reversi';
exports.maxPlayers = 2;

const ROWS = 8, COLS = 8;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

exports.createState = () => ({
  currentPlayer: 0,    // 0=black 1=white, black first
  winner: null,        // null|0|1|-1(draw)
  board: null,
  passCount: 0,
  lastMove: null,
  scores: { 0: 2, 1: 2 },
  moveHistory: [],
  _playerCount: 2,
});

exports.initGame = (state) => {
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.board[3][3] = 1; state.board[4][4] = 1; // white
  state.board[3][4] = 0; state.board[4][3] = 0; // black
  state.scores = { 0: 2, 1: 2 };
  state.passCount = 0;
  state.lastMove = null;
  state.moveHistory = [];
};

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function getFlips(board, row, col, side) {
  if (board[row][col] !== null) return [];
  const enemy = 1 - side;
  const allFlips = [];
  for (const [dr, dc] of DIRS) {
    const dirFlips = [];
    let r = row + dr, c = col + dc;
    while (inBounds(r, c) && board[r][c] === enemy) {
      dirFlips.push({ row: r, col: c });
      r += dr; c += dc;
    }
    if (dirFlips.length > 0 && inBounds(r, c) && board[r][c] === side) {
      allFlips.push(...dirFlips);
    }
  }
  return allFlips;
}

function getLegalMoves(board, side) {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== null) continue;
      const flips = getFlips(board, r, c, side);
      if (flips.length > 0) {
        moves.push({ row: r, col: c, flips });
      }
    }
  }
  return moves;
}

function countPieces(board) {
  let c0 = 0, c1 = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) c0++;
      else if (board[r][c] === 1) c1++;
    }
  }
  return { 0: c0, 1: c1 };
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '不是你的回合';

  if (data && data.pass) {
    state.passCount++;
    if (state.passCount >= 2) {
      const scores = countPieces(state.board);
      state.scores = scores;
      state.winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
      return null;
    }
    state.currentPlayer = 1 - playerIndex;
    return null;
  }

  const { row, col } = data || {};
  if (row === undefined || col === undefined) return '无效的操作';
  if (!inBounds(row, col)) return '超出棋盘范围';
  if (state.board[row][col] !== null) return '该位置已有棋子';

  const legalMoves = getLegalMoves(state.board, playerIndex);
  const matched = legalMoves.find(m => m.row === row && m.col === col);
  if (!matched) return '不合法的走法';

  // Place piece and flip
  state.board[row][col] = playerIndex;
  for (const f of matched.flips) {
    state.board[f.row][f.col] = playerIndex;
  }
  state.lastMove = { row, col };
  state.scores = countPieces(state.board);
  state.passCount = 0;
  state.moveHistory.push({ row, col, flips: matched.flips, player: playerIndex });

  // Check if opponent has legal moves
  const opponent = 1 - playerIndex;
  const opponentMoves = getLegalMoves(state.board, opponent);
  if (opponentMoves.length > 0) {
    state.currentPlayer = opponent;
  } else {
    // Opponent must pass; check if current player also has no moves
    const myMoves = getLegalMoves(state.board, playerIndex);
    if (myMoves.length === 0) {
      // Both sides have no moves → game over
      const scores = countPieces(state.board);
      state.scores = scores;
      state.winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
    }
    // Otherwise keep currentPlayer same (opponent will pass next)
    state.currentPlayer = playerIndex;
  }

  return null;
};

exports.playerView = function(state, playerIndex) {
  var view = {
    currentPlayer: state.currentPlayer,
    winner: state.winner,
    board: state.board,
    passCount: state.passCount,
    scores: state.scores,
    lastMove: state.lastMove,
    moveHistory: state.moveHistory,
    _playerCount: state._playerCount,
  };
  if (state.winner === null && state.currentPlayer === playerIndex) {
    view.legalMoves = getLegalMoves(state.board, playerIndex);
  } else {
    view.legalMoves = [];
  }
  return view;
};
