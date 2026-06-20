const fs = require('fs');

const source = fs.readFileSync('public/js/renderers/rummikub.js', 'utf8');
const androidAsset = 'android/app/src/main/assets/nodejs-project/public/js/renderers/rummikub.js';
const required = [
  '.rk-table-area{background:var(--bg);border-radius:16px;padding:12px;min-height:60px;display:flex;flex-direction:column;',
  '.rk-table-set{display:flex;gap:3px;padding:6px;background:var(--surface);width:100%;box-sizing:border-box;',
  '.rk-tile{width:38px;height:54px;',
  '@media(max-width:400px){.rk-table-area{padding:8px;gap:8px;}.rk-table-set{padding:5px;}.rk-tile{width:34px;height:48px;}',
  '.rk-hand-wrap{overflow:visible;',
  '.rk-hand{display:flex;flex-wrap:wrap;gap:5px;min-height:70px;padding:4px;}'
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    console.error('FAIL: 牌桌尚未使用纵向分行布局:', fragment);
    process.exit(1);
  }
}

if (source.includes('左右滑动查看全部牌')) {
  console.error('FAIL: 手牌仍提示横向滑动');
  process.exit(1);
}

if (!fs.existsSync(androidAsset) || fs.readFileSync(androidAsset, 'utf8') !== source) {
  console.error('FAIL: Android 打包资源不是最新的魔力桥渲染器，请先运行 android/copy-nodejs-project.ps1');
  process.exit(1);
}

console.log('sim-rummikub-layout: 牌组按行向下排列，Android 资源已同步 ✓');
