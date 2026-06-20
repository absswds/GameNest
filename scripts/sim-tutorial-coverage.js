const fs = require('fs');
const path = require('path');

const games = [];
for (const file of fs.readdirSync(path.join(__dirname, '..', 'games'))) {
  if (!file.endsWith('.js')) continue;
  const mod = require(path.join(__dirname, '..', 'games', file));
  if (mod.name) games.push(mod.name);
}
const tutorials = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tutorials.js'), 'utf8');
const keys = [...tutorials.matchAll(/^    (?:'([^']+)'|([a-z0-9-]+)): \{/gm)].map(match => match[1] || match[2]);
const missing = games.filter(game => !keys.includes(game));
const orphaned = keys.filter(key => !games.includes(key));
const drawguessStart = tutorials.indexOf('    drawguess: {');
const drawguessEnd = tutorials.indexOf('    monopoly: {', drawguessStart);
const drawguessTutorial = tutorials.slice(drawguessStart, drawguessEnd);
const missingDrawguessModes = ['舞台猜词', '悄悄话传画'].filter(mode => !drawguessTutorial.includes(mode));
if (missing.length || orphaned.length || missingDrawguessModes.length) {
  console.error('FAIL: 教程覆盖不一致', { missing, orphaned, missingDrawguessModes });
  process.exit(1);
}
console.log('sim-tutorial-coverage: 每个游戏都有对应教程 ✓');
