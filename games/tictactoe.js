// games/tictactoe.js
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

exports.name = 'tictactoe';
exports.maxPlayers = 2;

exports.createState = () => ({
  board: Array(9).fill(null),
  currentPlayer: 0,
  winner: null,
});

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return '游戏已结束';
  if (state.currentPlayer !== playerIndex) return '还没轮到你';

  const { cell } = data;
  if (typeof cell !== 'number' || cell < 0 || cell > 8) return '无效的落子位置';
  if (state.board[cell] !== null) return '该位置已被占用';

  state.board[cell] = playerIndex;

  for (const [a, b, c] of LINES) {
    if (state.board[a] !== null && state.board[a] === state.board[b] && state.board[b] === state.board[c]) {
      state.winner = state.board[a];
      return null;
    }
  }

  if (state.board.every(v => v !== null)) { state.winner = -1; return null; }
  state.currentPlayer = 1 - playerIndex;
  return null;
};
