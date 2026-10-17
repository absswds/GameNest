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

// Minimax value of every empty cell for `me` (win sooner / lose later is better).
function scoreMoves(board, me, opp, empty) {
  return empty.map(cell => {
    board[cell] = me;
    const v = minimax(board, false, me, opp);
    board[cell] = null;
    return { cell, v };
  });
}

// Human-like slip: with probability `mistakeP` take a move that is worse than the best one,
// chosen by softmax over the minimax values (near-misses are likelier than blunders).
function pickByQuality(scored, mistakeP, temp) {
  const best = Math.max(...scored.map(s => s.v));
  const optimal = scored.filter(s => s.v === best);
  const worse = scored.filter(s => s.v < best);
  if (worse.length && Math.random() < mistakeP) {
    const w = worse.map(s => Math.exp((s.v - best) / temp));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < worse.length; i++) { r -= w[i]; if (r <= 0) return { cell: worse[i].cell }; }
    return { cell: worse[worse.length - 1].cell };
  }
  return { cell: (mistakeP > 0 ? optimal[Math.floor(Math.random() * optimal.length)] : optimal[0]).cell };
}

const MISTAKE_P = { easy: 0.7, normal: 0.3, hard: 0 };

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
    const scored = scoreMoves(board, me, opp, empty);
    return pickByQuality(scored, MISTAKE_P[diff] ?? MISTAKE_P.normal, diff === 'easy' ? 8 : 4);
  },
});
