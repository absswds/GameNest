// games/drawguess.js — 你画我猜 (Gartic Phone 风格)
// 玩法: 词→画→猜→画→猜... 依次传递，最后揭示全链，投票最好笑的一步
exports.name = 'drawguess';
exports.maxPlayers = 8;
exports.minPlayers = 1;

const WORDS = [
  // 动物
  '猫','狗','兔子','大象','长颈鹿','企鹅','猫头鹰','章鱼','螃蟹','蝴蝶',
  '火烈鸟','熊猫','北极熊','海豚','鳄鱼',
  // 食物
  '西瓜','汉堡','披萨','寿司','火锅','冰淇淋','螺蛳粉','烤串','糖葫芦','豆腐',
  // 日常物品
  '雨伞','自行车','摩天轮','直升机','潜水艇','望远镜','吹风机','电风扇','沙漏','指南针',
  // 动作
  '跳绳','冲浪','打太极','骑马','爬山','打喷嚏','挠痒痒','拔河','捉迷藏','做梦',
  // 场景
  '海底世界','太空站','古代城堡','沙漠绿洲','雨后彩虹','樱花大道','极光','火山爆发',
  // 成语/词组
  '亡羊补牢','守株待兔','画蛇添足','塞翁失马','对牛弹琴','杯水车薪','纸老虎','变色龙',
];

exports.createState = () => ({
  phase: 'playing',
  word: null,
  chain: [],
  currentStep: 0,
  votes: {},
  winner: null,
  stepStartTime: 0,
  _playerCount: 0,
});

exports.initGame = (state, playerCount) => {
  state._playerCount = playerCount;
  state.word = WORDS[Math.floor(Math.random() * WORDS.length)];
  state.chain = [];
  for (let i = 0; i < playerCount; i++) {
    state.chain.push({
      playerIndex: i,
      type: i % 2 === 0 ? 'draw' : 'guess',
      content: null,
      done: false,
    });
  }
  state.phase = 'playing';
  state.currentStep = 0;
  state.votes = {};
  state.winner = null;
  state.stepStartTime = Date.now();
};

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase === 'playing') {
    if (data.type !== 'submit') return '未知操作';
    const step = state.chain[state.currentStep];
    if (!step) return '链已结束';
    if (step.playerIndex !== playerIndex) return '不是你的回合';
    if (step.done) return '已提交';
    if (data.content === undefined || data.content === null) return '内容为空';
    step.content = data.content;
    step.done = true;
    state.currentStep++;
    if (state.currentStep >= state.chain.length) {
      state.phase = 'reveal';
    }
    state.stepStartTime = Date.now();
    return null;
  }

  if (state.phase === 'reveal') {
    if (data.type === 'vote') {
      const si = parseInt(data.stepIndex);
      if (isNaN(si) || si < 0 || si >= state.chain.length) return '无效投票';
      state.votes[playerIndex] = si;
      const voteCount = Object.keys(state.votes).length;
      if (voteCount >= state._playerCount) {
        const counts = {};
        Object.values(state.votes).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        let best = -1, bestC = 0;
        Object.entries(counts).forEach(([idx, c]) => {
          if (c > bestC || (c === bestC && parseInt(idx) > best)) { bestC = c; best = parseInt(idx); }
        });
        state.winner = best >= 0 ? state.chain[best].playerIndex : 0;
      }
      return null;
    }
    return null;
  }

  return '游戏未进行';
};

// Per-player view: during 'playing', each player only sees what they need for their step
exports.playerView = (state, playerIndex) => {
  const view = Object.assign({}, state, { votes: Object.assign({}, state.votes) });

  if (state.phase === 'playing') {
    const step = state.chain[state.currentStep];
    const isMyTurn = step && step.playerIndex === playerIndex;

    if (isMyTurn) {
      if (state.currentStep === 0) {
        view.myTask = { type: 'draw', word: state.word };
      } else {
        const prev = state.chain[state.currentStep - 1];
        view.myTask = { type: step.type, prevContent: prev.content };
      }
    } else {
      view.myTask = null;
    }
    // Hide sensitive info from all
    view.word = null;
    view.chain = state.chain.map(s => ({
      playerIndex: s.playerIndex,
      type: s.type,
      done: s.done,
    }));
  }
  // In 'reveal' phase, full chain is visible to everyone

  return view;
};
