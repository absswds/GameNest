const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'renderers', 'rummikub.js'), 'utf8');
if (!source.includes("Object.keys(_sel).length > 0 && !_sel[id]") ||
    !source.includes("moveSelectedTo(target)")) {
  console.error('FAIL: 已选牌点击填满的目标牌组时应执行放入，而不是只切换目标牌选中状态');
  process.exit(1);
}
if (!source.includes('ensureActionButtons')) {
  console.error('FAIL: 取消重组后必须重建普通操作按钮');
  process.exit(1);
}
console.log('sim-rummikub-ui: 目标牌组放入路由通过 ✓');
