// games/2048.js
// 2048 — Multiplayer race: shared seed board, independent 4x4 per player.
// First to make a 2048 tile wins; if everyone locks up, highest score wins.

const { copy, move, spawn, hasMove, maxTile } = require('./lib/game2048');

exports.name = '2048';
exports.minPlayers = 1;
exports.maxPlayers = 4;
exports.realtime = true; // racing, non-turn (like minesweeper / sudoku)
exports.tickMs = 600;
// Bot moves every 1.5-3s — fast enough to feel alive, slow enough to beat
exports.botInterval = { min: 1500, max: 3000 };

exports.createState = () => ({
  seedBoard: [],   // 4x4 shared starting board (2 random tiles)
  boards: [],      // per-player 4x4 current board
  scores: [],      // per-player cumulative score
  alive: [],       // per-player bool: can still move
  startTime: 0,    // epoch ms when the round started (for timer display)
  winner: null,
  currentPlayer: -1,
});

exports.initGame = (state, playerCount) => {
  const seed = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  spawn(seed);
  spawn(seed);
  state.seedBoard = seed;

  state.boards = [];
  state.scores = [];
  state.alive = [];
  for (let p = 0; p < playerCount; p++) {
    state.boards.push(copy(seed));
    state.scores.push(0);
    state.alive.push(true);
  }
  state.startTime = Date.now();
  state.winner = null;
  state.currentPlayer = -1;
};

// Per-player view: only this player's own board, never anyone else's.
// highScore (the race leaderboard max) is public, so it's included.
exports.playerView = (state, playerIndex) => ({
  board: state.boards[playerIndex],
  score: state.scores[playerIndex],
  alive: state.alive[playerIndex],
  winner: state.winner,
  currentPlayer: state.currentPlayer,
  maxTile: maxTile(state.boards[playerIndex]),
  highScore: state.scores.reduce((m, v) => (v > m ? v : m), 0),
  startTime: state.startTime,
});

const DIRS = ['up', 'down', 'left', 'right'];

exports.handleMove = (data, state, playerIndex) => {
  if (state.winner !== null) return 'g_game_over';
  if (!state.alive[playerIndex]) return 'g2048_dead';

  const dir = data && data.dir;
  if (DIRS.indexOf(dir) === -1) return 'g2048_bad_dir';

  // Compute on a copy so an illegal (no-change) move mutates nothing.
  const board = state.boards[playerIndex];
  const res = move(copy(board), dir);
  if (!res.changed) return 'g2048_no_move';

  // Commit the move.
  state.boards[playerIndex] = res.grid;
  state.scores[playerIndex] += res.score;

  // Win check: reaching 2048 ends the game immediately in this player's favor.
  if (maxTile(res.grid) >= 2048) {
    state.winner = playerIndex;
    state.alive[playerIndex] = false;
    return null;
  }

  // Spawn a new tile, then check whether the player is now locked.
  spawn(res.grid);
  if (!hasMove(res.grid)) {
    state.alive[playerIndex] = false;
    resolveAllDead(state);
  }
  return null;
};

// When every player is dead, pick the highest score (tie -> -1).
function resolveAllDead(state) {
  if (!state.alive.every((a) => !a)) return;
  let best = -1;
  let winner = -1;
  let tie = false;
  for (let i = 0; i < state.scores.length; i++) {
    if (state.scores[i] > best) {
      best = state.scores[i];
      winner = i;
      tie = false;
    } else if (state.scores[i] === best) {
      tie = true;
    }
  }
  // Playing alone and getting stuck without a 2048 tile is a loss, not a win by default (-2 = nobody won)
  state.winner = state.scores.length === 1 ? -2 : tie ? -1 : winner;
}

// No-op tick: the realtime loop in server.js already drives bots every tickMs.
exports.tick = (state) => {};
