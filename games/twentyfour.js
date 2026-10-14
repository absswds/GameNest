// games/twentyfour.js
// 24 Game — all players race simultaneously, multiple rounds, final ranking

exports.name = 'twentyfour';
exports.maxPlayers = 99;
exports.minPlayers = 1;

// Pre-shuffled pool of all solvable 4-number combinations (1-13, sorted key, deduplicated).
// Built once on first use, reshuffled each time it's exhausted.
let _numPool = [];
let _numPoolIdx = 0;

function buildPool() {
  const seen = new Set();
  const pool = [];
  // Enumerate all sorted combos (allow repeats, i≤j≤k≤l for dedup)
  for (let a = 1; a <= 13; a++)
    for (let b = a; b <= 13; b++)
      for (let c = b; c <= 13; c++)
        for (let d = c; d <= 13; d++) {
          const nums = [a, b, c, d];
          if (hasSolution(nums)) pool.push(nums);
        }
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function generateNumbers() {
  if (_numPoolIdx >= _numPool.length) {
    _numPool = buildPool();
    _numPoolIdx = 0;
  }
  // Return a copy with random ordering of the 4 numbers
  const base = _numPool[_numPoolIdx++].slice();
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base;
}

// Can these numbers reach 24 with + - * / (any bracketing)? Stops at the first hit.
function hasSolution(nums) {
  if (nums.length === 1) return Math.abs(nums[0] - 24) < 0.0001;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i], b = nums[j];
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const vals = [a + b, a - b, b - a, a * b];
      if (b !== 0) vals.push(a / b);
      if (a !== 0) vals.push(b / a);
      for (const val of vals) {
        if (hasSolution([val, ...rest])) return true;
      }
    }
  }
  return false;
}

exports.createState = () => ({
  numbers: [],
  phase: 'playing',      // 'playing' | 'round_end' | 'over'
  winner: null,          // overall winner (after all rounds)
  roundWinner: null,     // winner of current round
  roundsWon: [],         // per-player: number of rounds won
  currentRound: 1,
  maxRounds: 5,
  roundTime: 0,          // seconds per round, 0 = no limit
  roundEndsAt: 0,        // Date.now() timestamp when current round ends
  roundStartedAt: 0,     // Date.now() when round started (used with roundTime for countdown)
  solutions: [],         // all correct solutions this round
  playerSubmissions: {}, // timed mode: { [playerIdx]: { expression, correct, submittedAt } }
});

exports.initGame = function(state, playerCount) {
  state.numbers = generateNumbers();
  state.phase = 'playing';
  state.winner = null;
  state.roundWinner = null;
  if (!state.roundsWon || state.roundsWon.length === 0) {
    state.roundsWon = Array(playerCount).fill(0);
  }
  if (!state.currentRound) state.currentRound = 1;
  state.solutions = [];
  state.playerSubmissions = {};
  // Apply options
  state.roundTime = (state._options && state._options.roundTime) || 0;
  state.roundEndsAt = state.roundTime > 0 ? Date.now() + state.roundTime * 1000 : 0;
  state.roundStartedAt = state.roundTime > 0 ? Date.now() : 0;
  if (state._options && state._options.maxRounds) state.maxRounds = state._options.maxRounds;
};

exports.handleMove = function(data, state, playerIndex) {
  if (state.phase === 'round_end') return 'tf_round_ended_wait_next';
  if (state.phase === 'over') return 'g_game_over';
  if (state.phase !== 'playing') return 'tf_game_not_started';

  const timed = state.roundTime > 0;
  if (!state.playerSubmissions) state.playerSubmissions = {};
  // In timed mode, a player who already answered correctly just waits
  if (timed && state.playerSubmissions[playerIndex] && state.playerSubmissions[playerIndex].correct) {
    return 'tf_already_correct';
  }

  const { expression } = data || {};
  if (typeof expression !== 'string' || !expression.trim()) return 'tf_enter_expression';

  // Only digits, + - * / and brackets; no ** (power), no comments (// or /*), no decimal points
  if (expression.length > 100 || !/^[\d+\-*/()\s]+$/.test(expression) || /\*\*|\/\/|\/\*/.test(expression)) {
    return 'tf_invalid_chars';
  }

  // Extract numbers used
  const numPattern = /\d+/g;
  const usedNums = [];
  let m;
  while ((m = numPattern.exec(expression)) !== null) {
    usedNums.push(parseInt(m[0], 10));
  }

  // Must use exactly the 4 numbers, each exactly once
  const expected = [...state.numbers].sort((a, b) => a - b);
  const used = [...usedNums].sort((a, b) => a - b);
  if (used.length !== 4) return 'tf_use_all_4_numbers';
  if (JSON.stringify(expected) !== JSON.stringify(used)) {
    return 'tf_wrong_numbers';
  }

  let result;
  try {
    result = Function('"use strict"; return (' + expression + ')')();
  } catch (e) {
    return 'tf_invalid_expression';
  }

  if (typeof result !== 'number' || !isFinite(result)) return 'tf_invalid_result';
  if (Math.abs(result - 24) > 0.0001) return 'tf_not_24';

  if (timed) {
    // Timed mode: record the correct submission and keep waiting. The fastest
    // correct answer wins when the countdown ends (exports.onTimeout below).
    state.playerSubmissions[playerIndex] = { expression, correct: true, submittedAt: Date.now() };
    state.solutions.push({ player: playerIndex, expression });
    return null;
  }

  // Untimed mode: first correct answer wins the round immediately
  state.roundWinner = playerIndex;
  state.roundsWon[playerIndex] = (state.roundsWon[playerIndex] || 0) + 1;
  state.solutions.push({ player: playerIndex, expression });
  state.phase = 'round_end';
  return null;
};

// Generic phase-timer hooks: the round ends at roundEndsAt (fixed in initGame, so moves don't move it).
exports.getPhaseDeadline = function(state) {
  if (!state || state.phase !== 'playing' || !(state.roundTime > 0)) return 0;
  return state.roundEndsAt || 0;
};

// Time's up: the fastest correct submission wins the round (-1 = nobody got it).
exports.onTimeout = function(state) {
  if (state.phase !== 'playing') return;
  const subs = state.playerSubmissions || {};
  let best = null, bestTime = Infinity;
  for (const key of Object.keys(subs)) {
    const sub = subs[key];
    if (sub && sub.correct && sub.submittedAt < bestTime) {
      bestTime = sub.submittedAt;
      best = parseInt(key, 10);
    }
  }
  if (best !== null) {
    state.roundWinner = best;
    state.roundsWon[best] = (state.roundsWon[best] || 0) + 1;
  } else {
    state.roundWinner = -1;
  }
  state.phase = 'round_end';
};

// Timed mode keeps answers secret until the round ends: others only see that someone solved it.
exports.playerView = function (state, playerIndex) {
  if (!state || state.phase !== 'playing') return state;
  const view = Object.assign({}, state, { solutions: [] });
  const subs = {};
  for (const key of Object.keys(state.playerSubmissions || {})) {
    const sub = state.playerSubmissions[key];
    subs[key] = String(key) === String(playerIndex) ? sub : { correct: sub.correct, submittedAt: sub.submittedAt };
  }
  view.playerSubmissions = subs;
  return view;
};
