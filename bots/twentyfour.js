// bots/twentyfour.js
exports.name = 'twentyfour';

function genResults(nums) {
  if (nums.length === 1) return [{ val: nums[0], expr: String(nums[0]) }];
  const results = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i], b = nums[j];
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const pairs = [
        { val: a + b, expr: '(' + a + '+' + b + ')' },
        { val: a - b, expr: '(' + a + '-' + b + ')' },
        { val: b - a, expr: '(' + b + '-' + a + ')' },
        { val: a * b, expr: '(' + a + '*' + b + ')' },
      ];
      if (b !== 0) pairs.push({ val: a / b, expr: '(' + a + '/' + b + ')' });
      if (a !== 0) pairs.push({ val: b / a, expr: '(' + b + '/' + a + ')' });
      for (const p of pairs) {
        const sub = genResults([{ val: p.val, expr: p.expr }, ...rest]);
        for (const s of sub) results.push(s);
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
    name: '电脑' + (playerIndex + 1),
    getMove: function(state) {
      if (state.phase !== 'playing') return {};
      const numbers = state.numbers;
      const solution = findSolution(numbers);
      return solution ? { expression: solution } : {};
    }
  };
};
