const fs = require('fs');
const source = fs.readFileSync('public/index.html', 'utf8');
if (!source.includes('quickCreate') || !source.includes('wasSelected')) {
  console.error('FAIL: 大厅应有随选择更新的快捷创建按钮与重复点击创建逻辑');
  process.exit(1);
}
console.log('sim-lobby-create: 快捷建房入口通过 ✓');
