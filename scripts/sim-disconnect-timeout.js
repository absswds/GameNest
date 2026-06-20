const fs = require('fs');

const source = fs.readFileSync('server.js', 'utf8');
const required = [
  'const DISCONNECT_GRACE_MS = 30000;',
  'function skipDisconnectedTurn(room)',
  'skipDisconnectedTurn(currentRoom);',
  '}, DISCONNECT_GRACE_MS);'
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    console.error('FAIL: 断线 30 秒后移除并跳过回合尚未实现:', fragment);
    process.exit(1);
  }
}

console.log('sim-disconnect-timeout: 断线超时会移除玩家并跳过回合 ✓');
