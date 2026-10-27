// bots/tictactoe.js — TicTacToe AI with easy, normal, and minimax hard difficulties
const { botName } = require('./lib/bot-name');
const { pickFor } = require('./lib/difficulty');

exports.name = 'tictactoe';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
// From `bot-tier-eval.js tictactoe --calibrate` (2026-10-28): hard vs normal 70.6%, normal vs easy 83.1%, hard vs easy 90.6%
const PICK = { temp: { easy: 32, normal: 5.05 }, maxLoss: { easy: 30, normal: 30 } };

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function countEmpty(board) {
  let n = 0;
  for (let i = 0; i < 9; i++) if (board[i] === null) n++;
  return n;
}

function minimax(board, isMax, me, opp) {
  const winner = checkWinner(board);
  if (winner === me) return 10 + countEmpty(board);
  if (winner === opp) return -10 - countEmpty(board);

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

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = state.board.slice();
    const me = playerIndex;
    const opp = 1 - me;
    const empty = board.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return { pass: true };

    const cands = empty.map(cell => {
      board[cell] = me;
      const score = minimax(board, false, me, opp);
      board[cell] = null;
      return { move: { cell }, score };
    });
    return pickFor(state, cands, PICK);
  },
});
