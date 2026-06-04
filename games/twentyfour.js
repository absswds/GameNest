// games/twentyfour.js
// 24 Game — all players race simultaneously, multiple rounds, final ranking

exports.name = 'twentyfour';
exports.maxPlayers = 99;

function generateNumbers() {
  for (let attempts = 0; attempts < 100; attempts++) {
    const nums = [
      Math.floor(Math.random() * 13) + 1,
      Math.floor(Math.random() * 13) + 1,
      Math.floor(Math.random() * 13) + 1,
      Math.floor(Math.random() * 13) + 1,
    ];
    if (hasSolution(nums)) return nums;
  }
  return [8, 3, 8, 3];
}

function genResults(nums) {
  if (nums.length === 1) return [nums[0]];
  const results = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i], b = nums[j];
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const pairs = [a + b, a - b, b - a, a * b];
      if (b !== 0) pairs.push(a / b);
      if (a !== 0) pairs.push(b / a);
      for (const val of pairs) {
        results.push(...genResults([val, ...rest]));
      }
    }
  }
  return results;
}

function hasSolution(nums) {
  return genResults(nums).some(v => Math.abs(v - 24) < 0.0001);
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
  if (state.phase === 'round_end') return '本轮已结束，等待下一轮';
  if (state.phase === 'over') return '游戏已结束';
  if (state.phase !== 'playing') return '游戏未开始';

  const timed = state.roundTime > 0;
  if (!state.playerSubmissions) state.playerSubmissions = {};
  // In timed mode, a player who already answered correctly just waits
  if (timed && state.playerSubmissions[playerIndex] && state.playerSubmissions[playerIndex].correct) {
    return '你已答对，等待倒计时结束';
  }

  const { expression } = data || {};
  if (typeof expression !== 'string' || !expression.trim()) return '请输入表达式';

  // Extract numbers used
  const numPattern = /\b(\d+)\b/g;
  const usedNums = [];
  let m;
  while ((m = numPattern.exec(expression)) !== null) {
    usedNums.push(parseInt(m[1]));
  }

  // Must use exactly the 4 numbers, each exactly once
  const expected = [...state.numbers].sort((a, b) => a - b);
  const used = [...usedNums].sort((a, b) => a - b);
  if (used.length !== 4) return '必须使用全部4个数字';
  if (JSON.stringify(expected) !== JSON.stringify(used)) {
    return '必须使用给定数字各一次: ' + expected.join(', ');
  }

  if (!/^[\d\+\-\*\/\(\)\s\.]+$/.test(expression)) return '表达式含有非法字符';

  let result;
  try {
    result = Function('"use strict"; return (' + expression + ')')();
  } catch (e) {
    return '表达式无效: ' + e.message;
  }

  if (typeof result !== 'number' || !isFinite(result)) return '计算结果无效';
  // Round the result for a clean message (e.g. 23.999999 -> 24)
  const shown = Math.round(result * 100) / 100;
  if (Math.abs(result - 24) > 0.0001) return '结果不等于24，你的算式 = ' + shown;

  if (timed) {
    // Timed mode: record the correct submission and keep waiting. The fastest
    // correct answer wins when the countdown ends (decided in server.js).
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
