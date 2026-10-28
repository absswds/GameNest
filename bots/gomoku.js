// bots/gomoku.js — Gomoku AI with pattern scoring and VCF threat search
const { botName } = require('./lib/bot-name');
const { getDepth, pickFor } = require('./lib/difficulty');

exports.name = 'gomoku';

const SIZE = 15;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const DEPTHS = { easy: 1, normal: 2, hard: 3 };
const PICK = { temp: { easy: 20000, normal: 300 }, maxLoss: { easy: 90000, normal: 15000 } };
const MAX_VCF_DEPTH = 12;
const MAX_VCF_NODES = 20000;

// Fixed-size Zobrist transposition table for VCF search (zero per-call allocation)
const TT_SIZE = 16384;
const TT_MASK = TT_SIZE - 1;
const ttKey1 = new Int32Array(TT_SIZE);
const ttKey2 = new Int32Array(TT_SIZE);
const ttRem = new Int16Array(TT_SIZE);
const ttStamp = new Int32Array(TT_SIZE);
let currentStamp = 0;

const Z1 = [new Int32Array(225), new Int32Array(225)];
const Z2 = [new Int32Array(225), new Int32Array(225)];
{
  let seed = 0x13579bdf;
  const nextInt = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return t ^ (t >>> 14);
  };
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < 225; i++) {
      Z1[p][i] = nextInt();
      Z2[p][i] = nextInt();
    }
  }
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  playerIndex,
  getMove(state) {
    const board = state.board.map((row) => row.slice());
    const me = playerIndex;
    const opp = 1 - me;

    const cands = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== null) continue;
        // Only consider positions near existing stones
        if (!hasNeighbor(board, r, c)) continue;

        const atk = evaluate(board, r, c, me);
        const def = evaluate(board, r, c, opp);

        let score;
        if (atk >= 100000) {
          score = atk * 3; // Immediate win takes absolute priority
        } else if (def >= 100000) {
          score = def * 2.5; // Must block immediate opponent win
        } else {
          score = Math.max(atk * 1.15, def * 1.35) + Math.min(atk, def) * 0.2;
        }
        cands.push({ row: r, col: c, score, atk, def });
      }
    }

    if (cands.length > 0) {
      cands.sort((x, y) => y.score - x.score);
      if (cands[0].atk >= 100000 || cands[0].def >= 100000) {
        const win = cands.find((c) => c.atk >= 100000);
        return win ? { row: win.row, col: win.col } : { row: cands[0].row, col: cands[0].col };
      }

      const depth = getDepth(state, DEPTHS);
      if (depth >= 3) {
        // 1. VCF search for itself before anything else
        const vcfMove = findVCF(board, me);
        if (vcfMove) return vcfMove;

        // 2. Depth-2 refine + check whether opponent has a VCF after the chosen move
        const scored = refine(board, cands, me, opp);
        scored.sort((a, b) => b.score - a.score);

        const bestMove = scored[0].move;
        board[bestMove.row][bestMove.col] = me;
        const oppVcfAfter = findVCFInternal(board, opp, MAX_VCF_DEPTH, MAX_VCF_NODES);
        board[bestMove.row][bestMove.col] = null;

        if (oppVcfAfter) {
          const oppVcfNow = findVCFInternal(board, opp, MAX_VCF_DEPTH, MAX_VCF_NODES);
          const defMove = pickVCFDefense(board, cands, scored, me, opp, oppVcfNow, oppVcfAfter);
          if (defMove) return defMove;
        } else {
          enhanceHardCandidates(board, scored, me, opp);
        }
        return pickFor(state, scored, PICK);
      }

      // depth 2 subtracts the opponent's best reply (normal); depth 1 judges each stone on its own (easy)
      const scored = depth >= 2 ? refine(board, cands, me, opp)
        : cands.slice(0, 10).map((cd) => ({ move: { row: cd.row, col: cd.col }, score: cd.score }));
      return pickFor(state, scored, PICK);
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

// 2-ply refinement: for the top candidates, place the stone and subtract the opponent's best reply.
function refine(board, cands, me, opp) {
  const out = [];
  for (const cd of cands.slice(0, 10)) {
    board[cd.row][cd.col] = me;
    let reply = 0;
    let replyR = -1, replyC = -1;
    let bestOppMove = -1;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== null || !hasNeighbor(board, r, c)) continue;
        const v = evaluate(board, r, c, opp);
        if (v > reply) reply = v;
        const d = evaluate(board, r, c, me);
        const mScore = v >= 100000 ? v * 3 : d >= 100000 ? d * 2.5 : Math.max(v * 1.15, d * 1.35);
        if (mScore > bestOppMove) {
          bestOppMove = mScore;
          replyR = r;
          replyC = c;
        }
      }
    }
    board[cd.row][cd.col] = null;
    out.push({
      move: { row: cd.row, col: cd.col },
      score: cd.score - 0.5 * reply,
      reply,
      replyR,
      replyC,
    });
  }
  return out;
}

// When the opponent has a VCF after our top refined move, prefer a move that breaks the VCF.
function pickVCFDefense(board, cands, scored, me, opp, oppVcfNow, oppVcfAfter) {
  const seen = new Uint8Array(225);
  const pool = [];

  const scoreMap = new Float64Array(225);
  scoreMap.fill(-1e9);
  for (const cd of cands) {
    scoreMap[cd.row * SIZE + cd.col] = cd.score;
  }
  for (const s of scored) {
    scoreMap[s.move.row * SIZE + s.move.col] = s.score;
  }

  const addCell = (r, c, bonus) => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r][c] !== null) return;
    const idx = r * SIZE + c;
    if (seen[idx]) return;
    seen[idx] = 1;
    let base = scoreMap[idx];
    if (base <= -1e8) {
      const atk = evaluate(board, r, c, me);
      const def = evaluate(board, r, c, opp);
      base = Math.max(atk * 1.15, def * 1.35);
    }
    pool.push({ row: r, col: c, score: base + bonus });
  };

  if (oppVcfNow && oppVcfNow.line) {
    for (let i = 0; i < oppVcfNow.line.length; i++) {
      addCell(oppVcfNow.line[i].row, oppVcfNow.line[i].col, i < 2 ? 5000 : 2000);
    }
  }
  if (oppVcfAfter && oppVcfAfter.line) {
    for (let i = 0; i < oppVcfAfter.line.length; i++) {
      addCell(oppVcfAfter.line[i].row, oppVcfAfter.line[i].col, i < 2 ? 4000 : 1500);
    }
  }
  for (let i = 1; i < scored.length; i++) {
    addCell(scored[i].move.row, scored[i].move.col, 0);
  }

  pool.sort((a, b) => b.score - a.score);

  for (const dm of pool) {
    board[dm.row][dm.col] = me;
    const stillVcf = findVCFInternal(board, opp, MAX_VCF_DEPTH, MAX_VCF_NODES);
    board[dm.row][dm.col] = null;
    if (!stillVcf) {
      return { row: dm.row, col: dm.col };
    }
  }

  // Fallback if opponent has multiple independent VCFs: play on the opponent's first VCF cell
  if (oppVcfNow && oppVcfNow.move && board[oppVcfNow.move.row][oppVcfNow.move.col] === null) {
    return oppVcfNow.move;
  }
  if (oppVcfAfter && oppVcfAfter.move && board[oppVcfAfter.move.row][oppVcfAfter.move.col] === null) {
    return oppVcfAfter.move;
  }
  return pool.length > 0 ? { row: pool[0].row, col: pool[0].col } : null;
}

// Enhance top candidate moves for hard tier using VCF threat lookahead and 3-in-5 window counts.
function enhanceHardCandidates(board, scored, me, opp) {
  const limit = Math.min(scored.length, 6);
  for (let i = 0; i < limit; i++) {
    const item = scored[i];
    const { row, col } = item.move;
    const myTw = countThreeWindows(board, row, col, me);
    const oppTw = countThreeWindows(board, row, col, opp);
    item.score += myTw * 600 + oppTw * 450;

    board[row][col] = me;
    if (i > 0 && findVCFInternal(board, opp, 8, 2500)) {
      item.score -= 80000;
      board[row][col] = null;
      continue;
    }

    if (item.reply < 35000) {
      const myNextVcf = findVCFInternal(board, me, 8, 2500);
      if (myNextVcf) {
        board[myNextVcf.move.row][myNextVcf.move.col] = opp;
        const unstoppable = findVCFInternal(board, me, 6, 1500);
        board[myNextVcf.move.row][myNextVcf.move.col] = null;
        item.score += unstoppable ? 50000 : 12000;
      }
    }

    if (item.replyR !== -1 && board[item.replyR][item.replyC] === null) {
      board[item.replyR][item.replyC] = opp;
      if (findVCFInternal(board, opp, 6, 1500)) {
        item.score -= 30000;
      }
      board[item.replyR][item.replyC] = null;
    }

    board[row][col] = null;
  }
}

// Count 5-cell windows through (r, c) that contain 3 stones of `player` and 2 empty cells.
function countThreeWindows(board, r, c, player) {
  board[r][c] = player;
  let count = 0;
  for (let d = 0; d < 4; d++) {
    const dr = DIRS[d][0], dc = DIRS[d][1];
    for (let s = -4; s <= 0; s++) {
      const r1 = r + dr * s, c1 = c + dc * s;
      const r2 = r + dr * (s + 4), c2 = c + dc * (s + 4);
      if (r1 < 0 || r1 >= SIZE || c1 < 0 || c1 >= SIZE || r2 < 0 || r2 >= SIZE || c2 < 0 || c2 >= SIZE) continue;
      let p = 0, empty = 0;
      for (let k = 0; k < 5; k++) {
        const v = board[r + dr * (s + k)][c + dc * (s + k)];
        if (v === player) p++;
        else if (v === null) empty++;
        else break;
      }
      if (p === 3 && empty === 2) count++;
    }
  }
  board[r][c] = null;
  return count;
}

// Inspects placing `player` at empty cell (r, c) without mutating `board`.
// Returns:
//   null — makes neither a five nor a four
//   { win: true, five: true } — makes 5+ contiguous stones immediately
//   { win: true, five: false, b1r, b1c, b2r, b2c } — makes a four requiring >= 2 blocks (open four / double four)
//   { win: false, br, bc } — makes a four with a single forced blocking cell (br, bc)
function classifyAttackMove(board, r, c, player) {
  if (board[r][c] !== null) return null;
  let b1r = -1, b1c = -1, b2r = -1, b2c = -1;
  let multi = false;

  for (let d = 0; d < 4; d++) {
    const dr = DIRS[d][0], dc = DIRS[d][1];
    let a1 = 0;
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) a1++;
      else break;
    }
    let a2 = 0;
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) a2++;
      else break;
    }
    if (1 + a1 + a2 >= 5) {
      return { win: true, five: true };
    }
    if (multi) continue;

    const er1 = r + dr * (a1 + 1), ec1 = c + dc * (a1 + 1);
    if (er1 >= 0 && er1 < SIZE && ec1 >= 0 && ec1 < SIZE && board[er1][ec1] === null) {
      let b1 = 0;
      const maxB1 = 3 - a1;
      for (let i = 1; i <= maxB1; i++) {
        const nr = er1 + dr * i, nc = ec1 + dc * i;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) b1++;
        else break;
      }
      if (a1 + a2 + b1 >= 3) {
        if (b1r === -1) {
          b1r = er1; b1c = ec1;
        } else {
          b2r = er1; b2c = ec1;
          multi = true;
        }
      }
    }

    if (multi) continue;

    const er2 = r - dr * (a2 + 1), ec2 = c - dc * (a2 + 1);
    if (er2 >= 0 && er2 < SIZE && ec2 >= 0 && ec2 < SIZE && board[er2][ec2] === null) {
      let b2 = 0;
      const maxB2 = 3 - a2;
      for (let i = 1; i <= maxB2; i++) {
        const nr = er2 - dr * i, nc = ec2 - dc * i;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) b2++;
        else break;
      }
      if (a1 + a2 + b2 >= 3) {
        if (b1r === -1) {
          b1r = er2; b1c = ec2;
        } else {
          b2r = er2; b2c = ec2;
          multi = true;
        }
      }
    }
  }

  if (multi) return { win: true, five: false, b1r, b1c, b2r, b2c };
  if (b1r !== -1) return { win: false, br: b1r, bc: b1c };
  return null;
}

// Depth-limited VCF (Victory by Continuous Fours) search.
function findVCFInternal(srcBoard, attacker, maxDepth = MAX_VCF_DEPTH, maxNodes = MAX_VCF_NODES) {
  const board = srcBoard.map((row) => row.slice());
  const defender = 1 - attacker;
  const rootCands = [];
  let winFourMove = null;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== null) continue;
      const res = classifyAttackMove(board, r, c, attacker);
      if (!res) continue;
      if (res.five) {
        return { move: { row: r, col: c }, line: [{ row: r, col: c }] };
      }
      if (res.win) {
        if (!winFourMove) {
          winFourMove = {
            move: { row: r, col: c },
            line: [
              { row: r, col: c },
              { row: res.b1r, col: res.b1c },
              { row: res.b2r, col: res.b2c },
            ],
          };
        }
      } else {
        rootCands.push(r * SIZE + c);
      }
    }
  }

  if (winFourMove) return winFourMove;
  if (maxDepth <= 1 || rootCands.length === 0) return null;

  const stamp = ++currentStamp;
  let nodes = 0;

  function dfs(depth, candIdxs, forcedIdx, h1, h2) {
    if (++nodes > maxNodes || depth >= maxDepth) return null;

    const remDepth = maxDepth - depth;
    const kh1 = (h1 ^ Math.imul(forcedIdx + 2, 0x9e3779b1)) | 0;
    const kh2 = (h2 ^ Math.imul(forcedIdx + 2, 0x85ebca6b)) | 0;
    const slot = kh1 & TT_MASK;
    if (ttStamp[slot] === stamp && ttKey1[slot] === kh1 && ttKey2[slot] === kh2 && ttRem[slot] >= remDepth) {
      return null;
    }

    const singles = [];
    if (forcedIdx !== -1) {
      const r = (forcedIdx / SIZE) | 0, c = forcedIdx % SIZE;
      if (board[r][c] !== null) return null;
      const res = classifyAttackMove(board, r, c, attacker);
      if (!res) return null;
      if (res.win) {
        const line = [{ row: r, col: c }];
        if (!res.five) {
          line.push({ row: res.b1r, col: res.b1c }, { row: res.b2r, col: res.b2c });
        }
        return { move: { row: r, col: c }, line };
      }
      singles.push({ r, c, br: res.br, bc: res.bc, idx: forcedIdx });
    } else {
      for (let i = 0; i < candIdxs.length; i++) {
        const idx = candIdxs[i];
        const r = (idx / SIZE) | 0, c = idx % SIZE;
        if (board[r][c] !== null) continue;
        const res = classifyAttackMove(board, r, c, attacker);
        if (!res) continue;
        if (res.win) {
          const line = [{ row: r, col: c }];
          if (!res.five) {
            line.push({ row: res.b1r, col: res.b1c }, { row: res.b2r, col: res.b2c });
          }
          return { move: { row: r, col: c }, line };
        }
        singles.push({ r, c, br: res.br, bc: res.bc, idx });
      }
    }

    if (depth + 1 >= maxDepth || singles.length === 0) {
      ttStamp[slot] = stamp; ttKey1[slot] = kh1; ttKey2[slot] = kh2; ttRem[slot] = remDepth;
      return null;
    }

    for (let i = 0; i < singles.length; i++) {
      const { r, c, br, bc, idx } = singles[i];
      board[r][c] = attacker;

      // Check what defender's forced reply at (br, bc) does for defender
      const defRes = classifyAttackMove(board, br, bc, defender);
      if (defRes && defRes.win) {
        board[r][c] = null;
        continue;
      }

      const nextForcedIdx = defRes ? (defRes.br * SIZE + defRes.bc) : -1;
      board[br][bc] = defender;

      const nextCands = [];
      if (nextForcedIdx === -1) {
        const seen = new Uint8Array(225);
        for (let d = 0; d < 4; d++) {
          const dr = DIRS[d][0], dc = DIRS[d][1];
          for (let s = -4; s <= 4; s++) {
            if (s === 0) continue;
            const nr = r + dr * s, nc = c + dc * s;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) {
              const nIdx = nr * SIZE + nc;
              if (!seen[nIdx]) {
                seen[nIdx] = 1;
                nextCands.push(nIdx);
              }
            }
          }
        }
        if (forcedIdx === -1) {
          for (let j = 0; j < singles.length; j++) {
            const sIdx = singles[j].idx;
            if (!seen[sIdx] && board[singles[j].r][singles[j].c] === null) {
              seen[sIdx] = 1;
              nextCands.push(sIdx);
            }
          }
        } else {
          for (let j = 0; j < candIdxs.length; j++) {
            const cIdx = candIdxs[j];
            const cr = (cIdx / SIZE) | 0, cc = cIdx % SIZE;
            if (!seen[cIdx] && board[cr][cc] === null) {
              seen[cIdx] = 1;
              nextCands.push(cIdx);
            }
          }
        }
      } else {
        for (let j = 0; j < candIdxs.length; j++) nextCands.push(candIdxs[j]);
        for (let d = 0; d < 4; d++) {
          const dr = DIRS[d][0], dc = DIRS[d][1];
          for (let s = -4; s <= 4; s++) {
            if (s === 0) continue;
            const nr = r + dr * s, nc = c + dc * s;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) {
              nextCands.push(nr * SIZE + nc);
            }
          }
        }
      }

      const bIdx = br * SIZE + bc;
      const nh1 = h1 ^ Z1[attacker][idx] ^ Z1[defender][bIdx];
      const nh2 = h2 ^ Z2[attacker][idx] ^ Z2[defender][bIdx];

      const sub = dfs(depth + 1, nextCands, nextForcedIdx, nh1, nh2);
      board[br][bc] = null;
      board[r][c] = null;

      if (sub) {
        return {
          move: { row: r, col: c },
          line: [{ row: r, col: c }, { row: br, col: bc }, ...sub.line],
        };
      }
      if (nodes > maxNodes) return null;
    }

    if (nodes <= maxNodes) {
      ttStamp[slot] = stamp; ttKey1[slot] = kh1; ttKey2[slot] = kh2; ttRem[slot] = remDepth;
    }
    return null;
  }

  return dfs(0, rootCands, -1, 0, 0);
}

function findVCF(boardOrState, attacker, maxDepth = MAX_VCF_DEPTH, maxNodes = MAX_VCF_NODES) {
  const srcBoard = Array.isArray(boardOrState) ? boardOrState : (boardOrState && boardOrState.board);
  if (!srcBoard) return null;
  if (attacker === undefined || attacker === null) {
    attacker = (!Array.isArray(boardOrState) && boardOrState && Number.isInteger(boardOrState.currentPlayer))
      ? boardOrState.currentPlayer : 0;
  }
  const res = findVCFInternal(srcBoard, attacker, maxDepth, maxNodes);
  return res ? res.move : null;
}

exports._findVCF = findVCF;

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

function evaluate(board, r, c, player) {
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
      threats += 2;
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

  // Double threat combo (e.g. 4-3, 3-3, 4-4, open-4) is virtually unstoppable
  if (threats >= 2) {
    score += 35000;
  }

  board[r][c] = null;
  return score;
}
