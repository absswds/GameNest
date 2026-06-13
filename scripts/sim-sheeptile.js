// scripts/sim-sheeptile.js — 羊了个羊 可解性 + bot 验证
const game = require('../games/sheeptile');
const botMod = require('../bots/sheeptile');
const I = game._internal;

let failures = 0;
function assert(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg); } }

// --- 1. 布局结构 ---
{
  const layout = I.buildLayout();
  const lv1 = layout.filter(t => t.level === 1).length;
  const lv2 = layout.filter(t => t.level === 2).length;
  assert(lv1 === 24, '第1关应 24 张，实际 ' + lv1);
  assert(lv2 === 102, '第2关应 102 张，实际 ' + lv2);
  assert(layout.every((t, i) => t.id === i), 'tile.id 应为连续索引');
}

// --- 2. 可解性：1000 次生成，生成器给出的解序必须全清（不爆槽） ---
let lv1Solvable = 0, lv2Solvable = 0, lv2HasHidden = 0, lv2Patterns = 0;
const TRIALS = 1000;
for (let t = 0; t < TRIALS; t++) {
  const layout = I.buildLayout();
  for (let lvIdx = 0; lvIdx < 2; lvIdx++) {
    const cfg = I.LEVELS[lvIdx];
    const lvTiles = layout.filter(x => x.level === lvIdx + 1);
    const res = I.generateSolvableLevel(lvTiles, cfg);
    assert(res.peak !== Infinity, `trial${t} 第${lvIdx + 1}关不可解（解序爆槽）`);
    if (lvIdx === 0 && res.peak !== Infinity) lv1Solvable++;
    if (lvIdx === 1 && res.peak !== Infinity) {
      lv2Solvable++;
      if (lvTiles.some(x => x.faceDown)) lv2HasHidden++;
      const used = new Set(Object.values(res.map));
      if (used.size >= 10) lv2Patterns++;
    }
  }
}
assert(lv1Solvable === TRIALS, '第1关应始终可解');
assert(lv2Solvable === TRIALS, '第2关应始终可解');
assert(lv2HasHidden === TRIALS, '第2关应含暗牌队列（faceDown）');
assert(lv2Patterns === TRIALS, '第2关应用到 ≥10 种图案');
console.log(`可解性 1000/1000（两关）；第2关含暗牌+多图案 ✓`);

// --- 3. 独立棋盘模式：每人 pattern 不同 ---
{
  const state = game.createState();
  state._playerCount = 3;
  state._options = { sameBoard: false };
  game.initGame(state, 3);
  assert(state.patterns.length === 3, '独立模式应每人一套 pattern');
}

// --- 4. bot 对战：200 局无异常、无死循环、必出 winner ---
let botGameovers = 0, botMaxSteps = 0;
for (let t = 0; t < 200; t++) {
  const pc = 2 + Math.floor(Math.random() * 5);
  const state = game.createState();
  state._playerCount = pc;
  state._options = {};
  game.initGame(state, pc);
  const bots = [];
  for (let i = 0; i < pc; i++) bots.push(botMod.createBot(i));

  let steps = 0;
  while (state.phase === 'playing' && steps < 20000) {
    steps++;
    const cp = state.currentPlayer;
    const move = bots[cp].getMove(state);
    const err = game.handleMove(move, state, cp);
    // 出局玩家的 pass 会推进 currentPlayer，避免卡死
    if (err && move.pass) { /* advance 已在 handleMove 内处理 */ }
  }
  if (state.phase === 'gameover') {
    botGameovers++;
    assert(state.winner !== null && state.winner !== undefined, `bot trial${t} 应有 winner`);
  } else {
    botMaxSteps++;
  }
}
assert(botMaxSteps === 0, `${botMaxSteps} 局达到步数上限（疑似死循环）`);
console.log(`bot 对战 200 局：分出胜负 ${botGameovers}，达步数上限 ${botMaxSteps}`);

if (failures === 0) {
  console.log('sim-sheeptile: 全部通过 ✓');
} else {
  console.error(`sim-sheeptile: ${failures} 处失败 ✗`);
  process.exit(1);
}
