const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'sudoku';

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    if (state.eliminated && state.eliminated[playerIndex]) return {};
    const filled = state.filled[playerIndex];
    const diff = getDifficulty(state);

    const blanks = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.puzzle[r][c] !== 0) continue;
        if (filled[r][c]) continue;
        blanks.push({ r, c, val: state.solution[r][c] });
      }
    }

    if (blanks.length === 0) return { pass: true };

    // Easy mode: 25% chance to make a blunder/wrong fill
    if (diff === 'easy' && Math.random() < 0.25) {
      const pick = blanks[Math.floor(Math.random() * blanks.length)];
      // Choose an incorrect number (1-9 but != solution val)
      const wrongVal = ((pick.val % 9) + 1);
      return { type: 'fill', row: pick.r, col: pick.c, val: wrongVal };
    }

    // Hard mode: find naked singles (blank cells that have fewest candidates in current filled grid)
    if (diff === 'hard') {
      let bestTarget = blanks[0];
      let minCandidates = 10;
      for (const b of blanks) {
        const candidates = getCandidateCount(state.puzzle, filled, b.r, b.c);
        if (candidates < minCandidates) {
          minCandidates = candidates;
          bestTarget = b;
          if (candidates <= 1) break;
        }
      }
      return { type: 'fill', row: bestTarget.r, col: bestTarget.c, val: bestTarget.val };
    }

    // Normal mode: first blank cell
    const target = blanks[0];
    return { type: 'fill', row: target.r, col: target.c, val: target.val };
  },
});

function getCandidateCount(puzzle, filled, row, col) {
  const used = new Set();
  for (let c = 0; c < 9; c++) {
    const v = puzzle[row][c] || (filled[row] && filled[row][c]);
    if (v) used.add(v);
  }
  for (let r = 0; r < 9; r++) {
    const v = puzzle[r][col] || (filled[r] && filled[r][col]);
    if (v) used.add(v);
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      const v = puzzle[r][c] || (filled[r] && filled[r][c]);
      if (v) used.add(v);
    }
  }
  return 9 - used.size;
}

