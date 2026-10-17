// bots/twentyfour.js — 24 Points AI with easy, normal, hard difficulties
const { botName } = require('./lib/bot-name');
const { getDifficulty } = require('./lib/difficulty');

exports.name = 'twentyfour';

function genResults(nums) {
  // nums: array of {val, expr}
  if (nums.length === 1) return [nums[0]];
  const results = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i], b = nums[j];
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const pairs = [
        { val: a.val + b.val, expr: '(' + a.expr + '+' + b.expr + ')' },
        { val: a.val - b.val, expr: '(' + a.expr + '-' + b.expr + ')' },
        { val: b.val - a.val, expr: '(' + b.expr + '-' + a.expr + ')' },
        { val: a.val * b.val, expr: '(' + a.expr + '*' + b.expr + ')' },
      ];
      if (b.val !== 0) pairs.push({ val: a.val / b.val, expr: '(' + a.expr + '/' + b.expr + ')' });
      if (a.val !== 0) pairs.push({ val: b.val / a.val, expr: '(' + b.expr + '/' + a.expr + ')' });
      for (const p of pairs) {
        for (const s of genResults([p, ...rest])) results.push(s);
      }
    }
  }
  return results;
}

function findSolution(numbers) {
  const nums = numbers.map(n => ({ val: n, expr: String(n) }));
  const results = genResults(nums);
  const match = results.find(r => Math.abs(r.val - 24) < 0.0001);
  return match ? match.expr : null;
}

// Answer speed. The server polls a bot ~30s into the round and again every 10-15s while getMove
// returns {}, so "answer on the Nth poll" is the think time: hard first poll, normal usually the
// second, easy the third or fourth. [[poll number, cumulative probability], ...]
const ANSWER_POLL = {
  hard: [[1, 1]],
  normal: [[1, 0.15], [2, 0.8], [3, 1]],
  easy: [[2, 0.15], [3, 0.6], [4, 1]],
};

function pickPoll(diff) {
  const r = Math.random();
  const table = ANSWER_POLL[diff] || ANSWER_POLL.normal;
  return (table.find(([, p]) => r < p) || table[table.length - 1])[0];
}

exports.createBot = function(playerIndex) {
  let seenState = null, seenRound = 0, polls = 0, answerAt = 1;
  return {
    name: botName(playerIndex, 'zh'),
    getMove: function(state) {
      if (state.phase !== 'playing') return {};
      const diff = getDifficulty(state);
      if (state.numbers !== seenState || state.currentRound !== seenRound) {
        seenState = state.numbers; seenRound = state.currentRound; polls = 0; answerAt = pickPoll(diff);
      }
      if (++polls < answerAt) return {};
      polls = 0; answerAt = pickPoll(diff); // answered: a repeat call starts a fresh think cycle
      const solution = findSolution(state.numbers);
      return solution ? { expression: solution } : {};
    }
  };
};
