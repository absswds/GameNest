// bots/tictactoe.js — Simple TicTacToe AI
const { botName } = require('./lib/bot-name');

exports.name = 'tictactoe';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = state.board;
    const me = playerIndex;
    const opp = 1 - me;
    const empty = board.map((v, i) => v === null ? i : -1).filter(i => i >= 0);

    // 1. Try to win
    for (const cell of empty) {
      board[cell] = me;
      const won = LINES.some(([a,b,c]) => board[a] === me && board[b] === me && board[c] === me);
      board[cell] = null;
      if (won) return { cell };
    }

    // 2. Block opponent
    for (const cell of empty) {
      board[cell] = opp;
      const lost = LINES.some(([a,b,c]) => board[a] === opp && board[b] === opp && board[c] === opp);
      board[cell] = null;
      if (lost) return { cell };
    }

    // 3. Take center
    if (board[4] === null) return { cell: 4 };

    // 4. Take corners
    const corners = [0,2,6,8].filter(i => board[i] === null);
    if (corners.length) return { cell: corners[Math.floor(Math.random() * corners.length)] };

    // 5. Random
    return { cell: empty[Math.floor(Math.random() * empty.length)] };
  },
});
