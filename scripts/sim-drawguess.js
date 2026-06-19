// scripts/sim-drawguess.js — 你画我猜逻辑验证
// 验证：选词流程、传话链推进、投票结算、onTimeout 各阶段、playerView 不泄漏词语
const game = require('../games/drawguess');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

function newGame(playerCount, options) {
  const state = game.createState();
  state._options = Object.assign({ mode: 'whisper' }, options || {});
  game.initGame(state, playerCount);
  return state;
}

// --- 1. 正常全流程（4 人，3 候选词） ---
for (let trial = 0; trial < 200; trial++) {
  const state = newGame(4, { wordChoices: 3, categories: ['animal', 'internet'], customWords: '测试词A, 测试词B' });
  assert(state.phase === 'choosing', '应进入选词阶段');
  assert(state.wordOptions.length === 3, '候选词应为 3 个');

  // 非选词人不能选
  assert(game.handleMove({ type: 'choose_word', index: 0 }, state, 1) !== null, '玩家1不应能选词');
  assert(game.handleMove({ type: 'choose_word', index: 1 }, state, 0) === null, '玩家0选词应成功');
  assert(state.phase === 'playing' && state.word, '选词后进入 playing');

  // playerView 防泄漏：非当前画家不应看到词
  for (let p = 0; p < 4; p++) {
    const v = game.playerView(state, p);
    const json = JSON.stringify(v);
    if (p !== 0) assert(!json.includes(state.word), `玩家${p}的视图泄漏了词语`);
    assert(v.wordOptions.length === 0, '视图不应含候选词');
  }
  const v0 = game.playerView(state, 0);
  assert(v0.myTask && v0.myTask.word === state.word, '画家应看到词');

  // 走完链
  for (let i = 0; i < 4; i++) {
    const step = state.chain[state.currentStep];
    const content = step.type === 'draw' ? [{ color: '#000', width: 4, pts: [{x:0,y:0},{x:1,y:1}] }] : '某个猜测';
    assert(game.handleMove({ type: 'submit', content }, state, step.playerIndex) === null, '提交应成功');
  }
  assert(state.phase === 'reveal', '链完成后进入 reveal');

  // 投票
  for (let p = 0; p < 4; p++) {
    assert(game.handleMove({ type: 'vote', stepIndex: p % 2 }, state, p) === null, '投票应成功');
  }
  assert(state.winner !== null && state.winner !== undefined, '投票完应有 winner');
}

// --- 2. wordChoices=1 直接进 playing ---
{
  const state = newGame(3, { wordChoices: 1 });
  assert(state.phase === 'playing' && state.word, 'wordChoices=1 应跳过选词');
}

// --- 3. onTimeout 各阶段 ---
{
  // choosing 超时
  const s1 = newGame(4, { wordChoices: 3 });
  const opts = s1.wordOptions.slice();
  assert(game.onTimeout(s1) === true, 'choosing 超时应处理');
  assert(s1.phase === 'playing' && s1.word === opts[0], '超时应自动选第一个词');

  // playing draw 超时
  assert(game.onTimeout(s1) === true, 'draw 超时应处理');
  assert(s1.currentStep === 1 && Array.isArray(s1.chain[0].content), 'draw 超时应提交空笔画并推进');

  // playing guess 超时
  assert(game.onTimeout(s1) === true, 'guess 超时应处理');
  assert(s1.chain[1].content === '（超时）', 'guess 超时应提交占位文本');

  // 链耗尽进 reveal 后 onTimeout 返回 false
  game.onTimeout(s1); game.onTimeout(s1);
  assert(s1.phase === 'reveal', '全超时后应进 reveal');
  assert(game.onTimeout(s1) === false, 'reveal 阶段 onTimeout 应返回 false');
}

// --- 4. 自定义词与分类过滤 ---
{
  let found = false;
  for (let i = 0; i < 300 && !found; i++) {
    const s = newGame(2, { wordChoices: 3, categories: ['animal'], customWords: '独特自定义词' });
    if (s.wordOptions.includes('独特自定义词')) found = true;
  }
  assert(found, '自定义词应出现在候选中（300 次抽样）');
}

// --- 5. 时限选项透传 ---
{
  const s = newGame(2, { drawTime: 60, guessTime: 30 });
  assert(s.drawTime === 60 && s.guessTime === 30, '时限选项应生效');
  const s2 = newGame(2, { drawTime: 0 });
  assert(s2.drawTime === 0, '0=不限时应保留');
}

// --- 6. 舞台猜词：一人实时画，其他人同时反复猜 ---
{
  const stage = newGame(3, { mode: 'stage', wordChoices: 1, categories: ['animal'], drawTime: 60 });
  assert(stage.mode === 'stage', '舞台模式应保留 mode=stage');
  assert(stage.drawerIndex === 0, '第一轮应由玩家 0 作画');
  assert(Array.isArray(stage.scores) && stage.scores.length === 3, '舞台模式应初始化三人的积分');

  const word = stage.word;
  const stroke = { color: '#000', width: 4, pts: [{ x: 10, y: 10 }, { x: 20, y: 20 }] };
  assert(game.handleMove({ type: 'stage_stroke', stroke }, stage, 0) === null, '画手笔画应被接受');
  assert(stage.strokes && stage.strokes.length === 1, '笔画应同步到舞台状态');

  const guesserView = game.playerView(stage, 1);
  assert(!JSON.stringify(guesserView).includes(word), '猜词玩家视图不能泄露答案');
  assert(guesserView.myTask && guesserView.myTask.strokes.length === 1, '猜词玩家应看到实时笔画');

  assert(game.handleMove({ type: 'stage_guess', text: '错误答案' }, stage, 1) !== null, '错误答案应允许继续猜而不结束回合');
  assert(game.handleMove({ type: 'stage_guess', text: word }, stage, 1) === null, '正确答案应被接受');
  assert(stage.correct && stage.scores && stage.correct[1] === true && stage.scores[1] > 0, '猜中者应锁定并获得积分');
  assert(game.handleMove({ type: 'stage_guess', text: word }, stage, 2) === null, '第二名猜中应被接受');
  assert(stage.phase === 'round_result', '所有猜词玩家猜中后应进入本轮结算');
  assert(game.onTimeout(stage) === true, '结算超时应安全进入下一轮');
  assert(stage.drawerIndex === 1 && stage.round === 2, '下一轮应轮换画手');
}

if (failures === 0) {
  console.log('sim-drawguess: 全部通过 ✓');
} else {
  console.error(`sim-drawguess: ${failures} 处失败 ✗`);
  process.exit(1);
}
