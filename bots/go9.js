// bots/go9.js — AI for 围棋 9×9 (matches games/go9.js constants: EMPTY=0, BLACK=1, WHITE=2)
const SIZE = 9;
const EMPTY = 0, BLACK = 1, WHITE = 2;

const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'go9';

function getGroup(board, row, col) {
  const color = board[row][col];
  if (color === EMPTY) return [];
  const visited = new Set(); const group = []; const queue = [{ row, col }];
  visited.add(`${row},${col}`);
  while (queue.length) {
    const { row: r, col: c } = queue.shift(); group.push({ row: r, col: c });
    for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
      const k = `${nr},${nc}`;
      if (nr>=0 && nr<SIZE && nc>=0 && nc<SIZE && !visited.has(k) && board[nr][nc]===color)
        { visited.add(k); queue.push({ row:nr, col:nc }); }
    }
  }
  return group;
}

function countLiberties(board, group) {
  const gs = new Set(group.map(p => `${p.row},${p.col}`));
  const libs = new Set();
  for (const p of group) {
    for (const [nr, nc] of [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]]) {
      const k = `${nr},${nc}`;
      if (nr>=0 && nr<SIZE && nc>=0 && nc<SIZE && board[nr][nc]===EMPTY && !gs.has(k)) libs.add(k);
    }
  }
  return libs.size;
}

// Scoring phase: a group counts as alive when it borders an empty region surrounded only by its
// own colour (an eye or its own territory). Seki and other fine points are not judged.
function ownsRegion(board, group) {
  const color = board[group[0].row][group[0].col];
  const seen = new Set();
  for (const p of group) {
    for (const [sr, sc] of [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]]) {
      if (sr<0 || sr>=SIZE || sc<0 || sc>=SIZE || board[sr][sc]!==EMPTY || seen.has(`${sr},${sc}`)) continue;
      let onlyOwn = true;
      const queue = [[sr, sc]]; seen.add(`${sr},${sc}`);
      while (queue.length) {
        const [r, c] = queue.shift();
        for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
          if (nr<0 || nr>=SIZE || nc<0 || nc>=SIZE) continue;
          const v = board[nr][nc];
          if (v === EMPTY) {
            if (!seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); queue.push([nr, nc]); }
          } else if (v !== color) onlyOwn = false;
        }
      }
      if (onlyOwn) return true;
    }
  }
  return false;
}

// Scoring phase: unmark one of our own living groups the opponent marked dead, else accept.
function scoringMove(state, side) {
  const myStone = side===0 ? BLACK : WHITE;
  const checked = new Set();
  for (const m of state.deadMarks || []) {
    const k = `${m.row},${m.col}`;
    if (checked.has(k) || state.board[m.row][m.col] !== myStone) continue;
    const grp = getGroup(state.board, m.row, m.col);
    for (const p of grp) checked.add(`${p.row},${p.col}`);
    if (ownsRegion(state.board, grp)) return { type: 'mark', row: m.row, col: m.col };
  }
  return { type: 'accept' };
}

function scoreMove(board, side, r, c) {
  let s = 0;
  const distToCorner = Math.min(r+c, r+(SIZE-1-c), (SIZE-1-r)+c, (SIZE-1-r)+(SIZE-1-c));
  s += (4 - distToCorner) * 3;
  // star points
  for (const [sr,sc] of [[2,2],[2,6],[6,2],[6,6]]) if (r===sr && c===sc) { s+=10; break; }
  // closeness to own stones
  const myStone = side===0 ? BLACK : WHITE;
  let minDist=9;
  for (let rr=0; rr<SIZE; rr++) for (let cc=0; cc<SIZE; cc++)
    if (board[rr][cc]===myStone) minDist=Math.min(minDist, Math.abs(rr-r)+Math.abs(cc-c));
  if (minDist===1) s+=5; else if (minDist===2) s+=3;
  // neighbors
  let friends=0, enemies=0, nbrs=0;
  const eStone = side===0 ? WHITE : BLACK;
  for (const [nr,nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
    if (nr<0||nr>=SIZE||nc<0||nc>=SIZE) continue;
    nbrs++;
    if (board[nr][nc]===myStone) friends++;
    if (board[nr][nc]===eStone) enemies++;
  }
  if (friends===0 && enemies>0) s-=20;
  if (friends === nbrs) s-=50; // own eye: filling it kills the group
  else if (friends>=2) s+=8;
  if (r===0||r===SIZE-1||c===0||c===SIZE-1) s-=5;
  return s;
}


// Normal/hard tactics (stone already placed on `b`): capture, escape atari, avoid self-atari.
function tacticalBonus(b, r, c, side, libs) {
  const me = side===0 ? BLACK : WHITE, en = side===0 ? WHITE : BLACK;
  let bonus = 0;
  for (const [nr,nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
    if (nr<0||nr>=SIZE||nc<0||nc>=SIZE) continue;
    const v = b[nr][nc];
    if (v === en) {
      const g = getGroup(b, nr, nc), l = countLiberties(b, g);
      if (l === 0) bonus += 25 + 8 * g.length;      // captured it
      else if (l === 1) bonus += 12 + 3 * g.length; // atari
    } else if (v === me) {
      const g = getGroup(b, nr, nc);
      if (countLiberties(b, g) >= 3) bonus += 0;
    }
  }
  if (libs === 1) bonus -= 30; // self-atari
  return bonus;
}

// ---- Hard: flat Monte Carlo over the best heuristic candidates, on a flat 81-cell board ----
const N2 = SIZE * SIZE;
const NB = Array.from({ length: N2 }, (_, i) => {
  const r = (i / SIZE) | 0, c = i % SIZE, o = [];
  if (r > 0) o.push(i - SIZE); if (r < SIZE-1) o.push(i + SIZE);
  if (c > 0) o.push(i - 1); if (c < SIZE-1) o.push(i + 1);
  return o;
});
const KOMI = 7.5;
const mark = new Int32Array(N2); let stamp = 0;
const stack = new Int32Array(N2);

// Flood the group at i; returns liberty count (and fills `grp` with members when given).
function flood(b, i, grp) {
  const color = b[i]; stamp++;
  let sp = 0, libs = 0, n = 0;
  stack[sp++] = i; mark[i] = stamp;
  while (sp) {
    const p = stack[--sp]; if (grp) grp[n] = p; n++;
    for (const q of NB[p]) {
      if (mark[q] === stamp) continue;
      if (b[q] === 0) { mark[q] = stamp; libs++; }
      else if (b[q] === color) { mark[q] = stamp; stack[sp++] = q; }
    }
  }
  if (grp) grp.length = n;
  return libs;
}

// Place `color` at i. Returns captured count, -1 if illegal (suicide / ko). Sets st.ko.
function place(b, i, color, st) {
  if (i === st.ko) return -1;
  b[i] = color;
  const en = 3 - color;
  let cap = 0, lastCap = -1;
  const grp = [];
  for (const q of NB[i]) {
    if (b[q] === en && flood(b, q, grp) === 0) {
      for (const p of grp) b[p] = 0;
      cap += grp.length; lastCap = grp[0];
    }
  }
  if (cap === 0 && flood(b, i, null) === 0) { b[i] = 0; return -1; }
  st.ko = -1;
  if (cap === 1 && flood(b, i, null) === 1) st.ko = lastCap;
  return cap;
}

function areaDiff(b) { // black score minus white score (komi applied)
  let bl = 0, wh = 0;
  const seen = new Uint8Array(N2);
  for (let i = 0; i < N2; i++) {
    if (b[i] === BLACK) bl++;
    else if (b[i] === WHITE) wh++;
    else if (!seen[i]) {
      let sp = 0, n = 0, tb = false, tw = false;
      stack[sp++] = i; seen[i] = 1;
      while (sp) {
        const p = stack[--sp]; n++;
        for (const q of NB[p]) {
          if (b[q] === BLACK) tb = true; else if (b[q] === WHITE) tw = true;
          else if (!seen[q]) { seen[q] = 1; stack[sp++] = q; }
        }
      }
      if (tb && !tw) bl += n; else if (tw && !tb) wh += n;
    }
  }
  return bl - KOMI - wh;
}

function playout(b0, toMove, st0) {
  const b = Int8Array.from(b0), st = { ko: st0.ko };
  let color = toMove, passes = 0;
  for (let ply = 0; ply < 120 && passes < 2; ply++) {
    let moved = false;
    const start = (Math.random() * N2) | 0;
    for (let k = 0; k < N2 && !moved; k++) {
      const i = (start + k) % N2;
      if (b[i] !== 0) continue;
      let eye = true;
      for (const q of NB[i]) if (b[q] !== color) { eye = false; break; }
      if (eye) continue;
      if (place(b, i, color, st) >= 0) moved = true;
    }
    passes = moved ? 0 : passes + 1;
    if (!moved) st.ko = -1;
    color = 3 - color;
  }
  return areaDiff(b);
}

function monteCarloMove(board, side, cands, state, budgetMs, width) {
  const me = side===0 ? BLACK : WHITE;
  const flat = new Int8Array(N2);
  let stones = 0;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) { flat[r*SIZE+c] = board[r][c]; if (board[r][c]) stones++; }
  if (stones < 3) return cands[0]; // opening: heuristic star points
  const ko = state.koPoint ? state.koPoint.row*SIZE + state.koPoint.col : -1;
  const pool = cands.slice(0, width).map(c => ({ c, sum: 0, n: 0 }));
  const prior = (p) => p.c.score / 60;
  const deadline = performance.now() + budgetMs; // keep each move well under a second (also runs on phones)
  let round = 0;
  do {
    for (const p of pool) {
      const b = Int8Array.from(flat), st = { ko };
      if (place(b, p.c.row*SIZE + p.c.col, me, st) < 0) { p.n = 1e9; continue; }
      const d = playout(b, 3 - me, st);
      p.sum += (me === BLACK ? d : -d) > 0 ? 1 : 0;
      p.n++;
    }
    round++;
  } while (performance.now() < deadline && round < 400);
  let best = pool[0], bv = -Infinity;
  for (const p of pool) {
    if (p.n >= 1e9) continue;
    const v = p.sum / p.n + prior(p) * 0.05;
    if (v > bv) { bv = v; best = p; }
  }
  return best.c;
}

exports.createBot = pi => ({
  name: botName(pi, 'zh'),
  playerIndex: pi,
  getMove(state) {
    if (state.phase === 'scoring') return scoringMove(state, pi);
    const board = state.board;
    const side = pi;
    const copy = board.map(r => [...r]);
    const cands = [];
    const diff = getDifficulty(state);
    for (let r=0; r<SIZE; r++) {
      for (let c=0; c<SIZE; c++) {
        if (copy[r][c] !== EMPTY) continue;
        if (state.koPoint && state.koPoint.row===r && state.koPoint.col===c) continue;
        copy[r][c] = side===0 ? BLACK : WHITE;
        // quick suicide check
        const g = getGroup(copy, r, c);
        const libs = countLiberties(copy, g);
        let captures = false;
        const eStone = side===0 ? WHITE : BLACK;
        if (libs===0) {
          for (const [nr,nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
            if (nr<0||nr>=SIZE||nc<0||nc>=SIZE) continue;
            if (copy[nr][nc]===eStone) {
              const eg = getGroup(copy, nr, nc);
              if (countLiberties(copy, eg)===0) { captures=true; break; }
            }
          }
        }
        let tactic = 0;
        if (diff !== 'easy') tactic = tacticalBonus(copy, r, c, side, libs);
        copy[r][c] = EMPTY;
        if (libs>0 || captures) cands.push({ row:r, col:c, score: scoreMove(copy, side, r, c) + tactic });
      }
    }
    if (cands.length===0) return { pass: true };
    // Opponent just passed: end the game if we are not behind on stones, instead of filling our own territory
    const hist = state.moveHistory || [];
    const last = hist[hist.length - 1];
    if (last && last.pass) {
      let mine = 0, theirs = 0;
      for (const row of board) for (const v of row) { if (v === (side===0 ? BLACK : WHITE)) mine++; else if (v !== EMPTY) theirs++; }
      if (mine >= theirs) return { pass: true };
    }
    cands.sort((a,b) => b.score-a.score);
    if (diff === 'hard') return monteCarloMove(board, side, cands, state, 120, 12);
    if (diff === 'normal') return monteCarloMove(board, side, cands, state, 12, 6);
    // Easy: no tactics, wide top-N, and now and then an off-the-cuff move anywhere legal
    if (diff === 'easy' && Math.random() < 0.5) return cands[Math.floor(Math.random() * cands.length)];
    const top = Math.min(diff === 'easy' ? 16 : 2, cands.length);
    return cands[Math.floor(Math.random() * top)];
  }
});
