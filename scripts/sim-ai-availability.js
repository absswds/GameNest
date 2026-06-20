const fs = require('fs');

const client = fs.readFileSync('public/js/room-client.js', 'utf8');
const registry = fs.readdirSync('bots').filter(file => file.endsWith('.js'));
if (registry.includes('suikabattle.js')) {
  console.error('FAIL: 西瓜大战仍注册了不可用 AI');
  process.exit(1);
}
if (!client.includes("NO_AI_GAMES = new Set(['drawguess', 'minesweeper', 'suikabattle'])")) {
  console.error('FAIL: 等待房未声明无 AI 游戏');
  process.exit(1);
}
console.log('sim-ai-availability: 无 AI 游戏不会显示添加 AI ✓');
