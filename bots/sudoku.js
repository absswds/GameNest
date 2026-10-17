const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'sudoku';

// Pace = minimum ms between fills (bots know the solution, so difficulty is speed). Hard fills on
// every poll; the server polls a bot every few seconds, so normal/easy skip polls via {pass:true}.
const FILL_GAP_MS = { hard: 0, normal: 9000, easy: 16000 };

exports.createBot = (playerIndex) => {
  let lastState = null;
  let nextFillAt = 0;
  return {
  name: botName(playerIndex, 'zh'),
  getMove(state) {
    if (state.eliminated && state.eliminated[playerIndex]) return {};
    const filled = state.filled[playerIndex];
    if (state.puzzle !== lastState) { lastState = state.puzzle; nextFillAt = 0; }
    // Only a live game (has counts) is paced; partial states passed in by unit tests always get a move
    const gap = Array.isArray(state.counts) ? FILL_GAP_MS[getDifficulty(state)] || 0 : 0;
    const now = Date.now();
    if (now < nextFillAt) return idleMove(state, filled);
    nextFillAt = now + gap * (0.75 + Math.random() * 0.5);
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

    // Easy mode: occasional blunder, but never with the last life (the bot should stay weak, not suicidal)
    const lives = state.lives && state.lives[playerIndex];
    if (diff === 'easy' && (lives === undefined || lives > 1) && Math.random() < 0.05) {
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
        const candidates = getCandidateCount(state.puzzle, filled, state.solution, b.r, b.c);
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
  };
};

// "Still thinking": re-fill a cell that is already correct, which the game accepts as a silent no-op
// (a bare pass would be an invalid move). Falls back to pass before the first cell is filled.
function idleMove(state, filled) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (state.puzzle[r][c] === 0 && filled[r][c]) return { type: 'fill', row: r, col: c, val: state.solution[r][c] };
    }
  }
  return { pass: true };
}

// `filled` is a per-player boolean grid; the digit of a filled cell comes from `solution`.
function getCandidateCount(puzzle, filled, solution, row, col) {
  const digit = (r, c) => puzzle[r][c] || (filled[r] && filled[r][c] ? solution[r][c] : 0);
  const used = new Set();
  for (let c = 0; c < 9; c++) {
    const v = digit(row, c);
    if (v) used.add(v);
  }
  for (let r = 0; r < 9; r++) {
    const v = digit(r, col);
    if (v) used.add(v);
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      const v = digit(r, c);
      if (v) used.add(v);
    }
  }
  return 9 - used.size;
}

