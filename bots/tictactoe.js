// bots/tictactoe.js — TicTacToe AI with easy, normal, and minimax hard difficulties
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'tictactoe';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function minimax(board, isMax, me, opp) {
  const winner = checkWinner(board);
  if (winner === me) return 10;
  if (winner === opp) return -10;

  const empty = [];
  for (let i = 0; i < 9; i++) if (board[i] === null) empty.push(i);
  if (empty.length === 0) return 0;

  if (isMax) {
    let best = -Infinity;
    for (const cell of empty) {
      board[cell] = me;
      best = Math.max(best, minimax(board, false, me, opp));
      board[cell] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (const cell of empty) {
      board[cell] = opp;
      best = Math.min(best, minimax(board, true, me, opp));
      board[cell] = null;
    }
    return best;
  }
}

function getHardMove(board, me, opp, empty) {
  let bestVal = -Infinity;
  let bestCell = empty[0];
  for (const cell of empty) {
    board[cell] = me;
    const moveVal = minimax(board, false, me, opp);
    board[cell] = null;
    if (moveVal > bestVal) {
      bestVal = moveVal;
      bestCell = cell;
    }
  }
  return { cell: bestCell };
}

function getNormalMove(board, me, opp, empty) {
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
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = state.board.slice();
    const me = playerIndex;
    const opp = 1 - me;
    const empty = board.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return { pass: true };

    const diff = getDifficulty(state);

    if (diff === 'easy') {
      // 50% chance to blunder / pick random cell
      if (Math.random() < 0.5) {
        return { cell: empty[Math.floor(Math.random() * empty.length)] };
      }
      return getNormalMove(board, me, opp, empty);
    }

    if (diff === 'hard') {
      return getHardMove(board, me, opp, empty);
    }

    return getNormalMove(board, me, opp, empty);
  },
});
