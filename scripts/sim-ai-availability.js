const fs = require('fs');

const catalog = fs.readFileSync('public/js/game-catalog.js', 'utf8');
const noAiGames = ['drawguess', 'minesweeper', 'suikabattle', 'truthdare'];
for (const id of noAiGames) {
  const re = new RegExp("id:\\s*'" + id + "'[\\s\\S]*?supportsAI:\\s*false");
  if (!re.test(catalog)) {
    console.error('FAIL: ' + id + ' 未在 catalog 标记 supportsAI:false');
    process.exit(1);
  }
}
console.log('sim-ai-availability: 无 AI 游戏在 catalog 正确声明 supportsAI:false ✓');
