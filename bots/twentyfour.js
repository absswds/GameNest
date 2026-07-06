// bots/twentyfour.js
const { botName } = require('./lib/bot-name');

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

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    getMove: function(state) {
      if (state.phase !== 'playing') return {};
      const numbers = state.numbers;
      const solution = findSolution(numbers);
      return solution ? { expression: solution } : {};
    }
  };
};
