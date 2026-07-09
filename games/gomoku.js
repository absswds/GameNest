// games/gomoku.js
exports.name = 'gomoku';
exports.maxPlayers = 2;

exports.createState = () => ({
  board: Array.from({ length: 15 }, () => Array(15).fill(null)),
  currentPlayer: 0,
  winner: null,
});

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (state.currentPlayer !== playerIndex) return 'g_not_your_turn';

  const { row, col } = data;
  if (typeof row !== 'number' || typeof col !== 'number') return 'gk_invalid_position';
  if (row < 0 || row >= 15 || col < 0 || col >= 15) return 'gk_out_of_bounds';
  if (state.board[row][col] !== null) return 'gk_position_occupied';

  state.board[row][col] = playerIndex;

  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < 15 && c >= 0 && c < 15 && state.board[r][c] === playerIndex) count++;
      else break;
    }
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < 15 && c >= 0 && c < 15 && state.board[r][c] === playerIndex) count++;
      else break;
    }
    if (count >= 5) { state.winner = playerIndex; return null; }
  }

  state.currentPlayer = 1 - playerIndex;
  return null;
};
