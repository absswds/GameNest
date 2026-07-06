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
  let friends=0, enemies=0;
  const eStone = side===0 ? WHITE : BLACK;
  for (const [nr,nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
    if (nr<0||nr>=SIZE||nc<0||nc>=SIZE) continue;
    if (board[nr][nc]===myStone) friends++;
    if (board[nr][nc]===eStone) enemies++;
  }
  if (friends===0 && enemies>0) s-=20;
  if (friends>=2) s+=8;
  if (r===0||r===SIZE-1||c===0||c===SIZE-1) s-=5;
  return s;
}

exports.createBot = pi => ({
  name: botName(pi, 'zh'),
  playerIndex: pi,
  getMove(state) {
    const board = state.board;
    const side = pi;
    const copy = board.map(r => [...r]);
    const cands = [];
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
        if (libs>0 || captures) cands.push({ row:r, col:c, score: scoreMove(copy, side, r, c) });
        copy[r][c] = EMPTY;
      }
    }
    if (cands.length===0) return { pass: true };
    var diff = getDifficulty(state);
    var topN = diff === 'easy' ? 8 : diff === 'hard' ? 1 : 3;
    cands.sort((a,b) => b.score-a.score);
    const top = Math.min(topN, cands.length);
    return cands[Math.floor(Math.random() * top)];
  }
});
