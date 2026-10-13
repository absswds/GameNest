// games/sudoku.js
// Sudoku — Multiplayer speed race: same puzzle, independent progress per player.
// First to correctly fill every blank wins. 3 lives (wrong = -1 life), 3 hints.

const { generateSudoku } = require('./lib/sudoku-gen');

const MAX_LIVES = 3;
const MAX_HINTS = 3;

exports.name = 'sudoku';
exports.minPlayers = 1;
exports.maxPlayers = 4;
exports.realtime = true; // racing, non-turn (like minesweeper)
exports.tickMs = 600;
// Bot moves one cell per 4-7s so a human can keep up (~3-5 min to finish a puzzle)
exports.botInterval = { min: 4000, max: 7000 };

exports.createState = () => ({
  puzzle: [],      // 9x9, 0 = blank
  solution: [],    // 9x9 full solution (server-only, never sent to clients)
  given: [],       // 9x9 bool: pre-filled cells (immutable)
  filled: [],      // per-player 9x9 bool: correctly filled cells
  counts: [],      // per-player count of correctly filled blanks
  lives: [],       // per-player remaining lives
  hints: [],       // per-player remaining hints
  eliminated: [],  // per-player bool
  blanks: 0,       // total blank cells (win target per player)
  startTime: 0,    // epoch ms when the round started (for timer display)
  currentPlayer: -1,
  winner: null,
});

exports.initGame = (state, playerCount) => {
  const { puzzle, solution, given } = generateSudoku();
  state.puzzle = puzzle;
  state.solution = solution;
  state.given = given;

  let blanks = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] === 0) blanks++;
  state.blanks = blanks;

  state.filled = [];
  state.counts = [];
  state.lives = [];
  state.hints = [];
  state.eliminated = [];
  for (let p = 0; p < playerCount; p++) {
    const grid = [];
    for (let r = 0; r < 9; r++) grid.push(Array(9).fill(false));
    state.filled.push(grid);
    state.counts.push(0);
    state.lives.push(MAX_LIVES);
    state.hints.push(MAX_HINTS);
    state.eliminated.push(false);
  }

  state.startTime = Date.now();
  state.currentPlayer = -1;
  state.winner = null;
};

// Per-player view. NEVER includes the solution.
exports.playerView = (state, playerIndex) => {
  // Before initGame (join while waiting) or for a seat that has no board: nothing to show yet.
  if (!state.given || !state.given.length || !state.filled[playerIndex]) {
    return {
      board: [], doneCount: 0, blanks: state.blanks, winner: state.winner,
      currentPlayer: state.currentPlayer, lives: MAX_LIVES, hints: MAX_HINTS,
      eliminated: false, startTime: state.startTime,
    };
  }
  const board = [];
  for (let r = 0; r < 9; r++) {
    board[r] = [];
    for (let c = 0; c < 9; c++) {
      const isGiven = state.given[r][c];
      const mine = state.filled[playerIndex][r][c];
      const value = isGiven ? state.puzzle[r][c] : (mine ? state.solution[r][c] : 0);
      board[r][c] = { value: value, given: isGiven, mineFill: mine };
    }
  }
  return {
    board: board,
    doneCount: state.counts[playerIndex],
    blanks: state.blanks,
    winner: state.winner,
    currentPlayer: state.currentPlayer,
    lives: state.lives[playerIndex],
    hints: state.hints[playerIndex],
    eliminated: state.eliminated[playerIndex],
    startTime: state.startTime,
  };
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (!state.filled[playerIndex]) return 'su_invalid';
  if (state.eliminated[playerIndex]) return 'su_eliminated';

  // ---- HINT ----
  if (data && data.type === 'hint') {
    if (state.hints[playerIndex] <= 0) return 'su_no_hints';
    // Collect this player's remaining blanks
    const blanks = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (state.puzzle[r][c] === 0 && !state.filled[playerIndex][r][c])
          blanks.push({ r, c });
    if (blanks.length === 0) return null; // already solved
    const pick = blanks[Math.floor(Math.random() * blanks.length)];
    state.filled[playerIndex][pick.r][pick.c] = true;
    state.counts[playerIndex]++;
    state.hints[playerIndex]--;
    if (state.counts[playerIndex] >= state.blanks) state.winner = playerIndex;
    return null;
  }

  // ---- FILL ----
  if (!data) return 'su_invalid';
  const row = data.row, col = data.col, val = data.val;

  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 8 || col < 0 || col > 8) return 'su_invalid';
  if (state.given[row][col]) return 'su_illegal_cell';
  if (!Number.isInteger(val) || val < 1 || val > 9) return 'su_invalid';
  if (state.filled[playerIndex][row][col]) return null; // already correct, ignore

  if (state.solution[row][col] !== val) {
    // Wrong guess: lose a life
    state.lives[playerIndex]--;
    let ended = false;
    if (state.lives[playerIndex] <= 0) {
      ended = true;
      state.eliminated[playerIndex] = true;
      // Check if game is over (only one player left)
      const remaining = [];
      for (let p = 0; p < state.lives.length; p++)
        if (!state.eliminated[p]) remaining.push(p);
      if (remaining.length === 1) state.winner = remaining[0];
      else if (remaining.length === 0) state.winner = -1; // all dead: draw
    }
    // A fatal mistake changed the whole game state (elimination / result): report success so the
    // server broadcasts it right away instead of only sending this player an error.
    return ended ? null : 'su_wrong';
  }

  state.filled[playerIndex][row][col] = true;
  state.counts[playerIndex]++;
  if (state.counts[playerIndex] >= state.blanks) state.winner = playerIndex;
  return null;
};

// No-op tick: the realtime loop in server.js already drives bots every tickMs.
exports.tick = (state) => {};
