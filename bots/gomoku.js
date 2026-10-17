// bots/gomoku.js — Gomoku AI with pattern scoring
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'gomoku';

const SIZE = 15;
const DIRS = [[1,0],[0,1],[1,1],[1,-1]];

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = state.board.map(row => row.slice());
    const me = playerIndex;
    const opp = 1 - me;

    const diff = getDifficulty(state);
    const hard = diff === 'hard';
    const cands = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== null) continue;
        // Only consider positions near existing stones
        if (!hasNeighbor(board, r, c)) continue;

        const atk = evaluate(board, r, c, me, hard);
        const def = evaluate(board, r, c, opp, hard);

        let score;
        if (atk >= 100000) {
          score = atk * 3; // Immediate win takes absolute priority
        } else if (def >= 100000) {
          score = def * 2.5; // Must block immediate opponent win
        } else if (hard) {
          score = Math.max(atk * 1.15, def * 1.35);
        } else {
          score = Math.max(atk, def * 1.1); // Win first, else slightly prefer defense
        }
        cands.push({ row: r, col: c, score, atk, def });
      }
    }

    if (cands.length > 0) {
      cands.sort((x, y) => y.score - x.score);
      if (hard) return pick(refine(board, cands, me, opp));
      return pick(softPick(cands, diff));
    }

    // Fallback when no neighboured cell exists (e.g. empty board, or stones only at edges):
    // take the center if free, otherwise the first empty cell anywhere on the board.
    {
      const mid = (SIZE - 1) / 2 | 0;
      if (board[mid][mid] === null) return { row: mid, col: mid };
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] === null) return { row: r, col: c };
        }
      }
      return { pass: true }; // board full — game should already be a draw
    }

  },
});


function pick(m) { return { row: m.row, col: m.col }; }

// Quality-based slips for normal/easy: softmax over log-score among candidates within `cap` of the best.
// Forced wins/blocks score orders of magnitude higher, so they are normally still taken; easy sometimes
// overlooks a forced block, like a distracted human.
const TIER = { normal: { T: 0.55, cap: 0.08, oversee: 0.1 }, easy: { T: 0.9, cap: 0.01, oversee: 0.3 } };
function softPick(cands, diff) {
  const { T, cap, oversee } = TIER[diff] || TIER.normal;
  let list = cands;
  if (oversee && list[0].atk < 100000 && list[0].def >= 100000 && list.length > 1 && Math.random() < oversee) {
    list = list.slice(1);
  }
  const best = list[0].score;
  const pool = list.filter(x => x.score >= best * cap).slice(0, 12);
  const w = pool.map(x => Math.pow(x.score / best, 1 / T));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}

// Hard: 2-ply refinement. For the top candidates, place the stone and subtract the opponent's best reply.
function refine(board, cands, me, opp) {
  if (cands[0].atk >= 100000) return cands[0];
  if (cands[0].def >= 100000) return cands[0];
  let best = null, bestVal = -Infinity;
  for (const cd of cands.slice(0, 10)) {
    board[cd.row][cd.col] = me;
    let reply = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== null || !hasNeighbor(board, r, c)) continue;
        const v = evaluate(board, r, c, opp, true);
        if (v > reply) reply = v;
      }
    }
    board[cd.row][cd.col] = null;
    const val = cd.score - 0.5 * reply;
    if (val > bestVal) { bestVal = val; best = cd; }
  }
  return best;
}

function hasNeighbor(board, r, c) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] !== null) return true;
    }
  }
  return false;
}

function evaluate(board, r, c, player, isHard) {
  board[r][c] = player;
  let score = 0;
  let threats = 0;

  for (const [dr, dc] of DIRS) {
    let count = 1, open = 0;
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) count++;
      else { if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) open++; break; }
    }
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) count++;
      else { if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) open++; break; }
    }
    if (count >= 5) {
      score += 100000;
    } else if (count === 4 && open >= 2) {
      score += 20000;
      threats++;
    } else if (count === 4 && open >= 1) {
      score += 10000;
      threats++;
    } else if (count === 3 && open >= 2) {
      score += 2000;
      threats++;
    } else if (count === 3 && open >= 1) {
      score += 200;
    } else if (count === 2 && open >= 2) {
      score += 15;
    } else if (count === 2 && open >= 1) {
      score += 4;
    } else {
      score += 1;
    }
  }

  // Double threat combo (e.g. 4-3, 3-3, 4-4) is virtually unstoppable
  if (isHard && threats >= 2) {
    score += 35000;
  }

  board[r][c] = null;
  return score;
}

