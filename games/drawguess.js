// games/drawguess.js — 你画我猜 (Gartic Phone 风格传话链)
// 玩法: 首位画家从候选词中选词→画→猜→画→猜... 依次传递，最后揭示全链，投票最好笑的一步
// 房间设置: categories(词库分类) / drawTime / guessTime / wordChoices(候选词数) / customWords(自定义词)
const WORD_LIBRARY = require('./drawguess-words');

exports.name = 'drawguess';
exports.maxPlayers = 8;
exports.minPlayers = 1;

const DEFAULTS = { drawTime: 90, guessTime: 45, wordChoices: 3 };

function buildWordPool(options) {
  const cats = Array.isArray(options.categories) && options.categories.length > 0
    ? options.categories
    : Object.keys(WORD_LIBRARY);
  const pool = [];
  for (const key of cats) {
    if (WORD_LIBRARY[key]) pool.push(...WORD_LIBRARY[key].words);
  }
  // 自定义词：逗号/换行/空格分隔，去重并入
  if (typeof options.customWords === 'string' && options.customWords.trim()) {
    options.customWords.split(/[,，\n\s]+/).forEach(w => {
      const t = w.trim();
      if (t && t.length <= 12 && !pool.includes(t)) pool.push(t);
    });
  }
  if (pool.length === 0) pool.push(...WORD_LIBRARY.animal.words);
  return pool;
}

function pickWords(pool, n) {
  const copy = [...pool];
  const out = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

exports.createState = () => ({
  phase: 'playing',       // 'choosing' | 'playing' | 'reveal'
  word: null,
  wordOptions: [],        // choosing 阶段的候选词（仅首位画家可见）
  chain: [],
  currentStep: 0,
  votes: {},
  winner: null,
  stepStartTime: 0,
  stepDeadline: 0,        // 服务端写入的绝对时间戳，0 = 不限时
  drawTime: DEFAULTS.drawTime,
  guessTime: DEFAULTS.guessTime,
  _playerCount: 0,
});

exports.initGame = (state, playerCount) => {
  const options = state._options || {};
  state._playerCount = playerCount;
  state.drawTime = options.drawTime !== undefined ? parseInt(options.drawTime, 10) : DEFAULTS.drawTime;
  state.guessTime = options.guessTime !== undefined ? parseInt(options.guessTime, 10) : DEFAULTS.guessTime;
  if (isNaN(state.drawTime) || state.drawTime < 0) state.drawTime = DEFAULTS.drawTime;
  if (isNaN(state.guessTime) || state.guessTime < 0) state.guessTime = DEFAULTS.guessTime;

  const wordChoices = Math.max(1, parseInt(options.wordChoices, 10) || DEFAULTS.wordChoices);
  const pool = buildWordPool(options);

  state.chain = [];
  for (let i = 0; i < playerCount; i++) {
    state.chain.push({
      playerIndex: i,
      type: i % 2 === 0 ? 'draw' : 'guess',
      content: null,
      done: false,
    });
  }
  state.currentStep = 0;
  state.votes = {};
  state.winner = null;
  state.stepStartTime = Date.now();
  state.stepDeadline = 0;

  if (wordChoices <= 1) {
    state.word = pickWords(pool, 1)[0];
    state.wordOptions = [];
    state.phase = 'playing';
  } else {
    state.word = null;
    state.wordOptions = pickWords(pool, wordChoices);
    state.phase = 'choosing';
  }
};

function advanceStep(state) {
  state.currentStep++;
  if (state.currentStep >= state.chain.length) {
    state.phase = 'reveal';
    state.stepDeadline = 0;
  }
  state.stepStartTime = Date.now();
}

exports.handleMove = (data, state, playerIndex) => {
  if (state.phase === 'choosing') {
    if (data.type !== 'choose_word') return '请先选词';
    if (!state.chain[0] || state.chain[0].playerIndex !== playerIndex) return '不是你选词';
    const idx = parseInt(data.index, 10);
    if (isNaN(idx) || idx < 0 || idx >= state.wordOptions.length) return '无效选择';
    state.word = state.wordOptions[idx];
    state.wordOptions = [];
    state.phase = 'playing';
    state.stepStartTime = Date.now();
    return null;
  }

  if (state.phase === 'playing') {
    if (data.type !== 'submit') return '未知操作';
    const step = state.chain[state.currentStep];
    if (!step) return '链已结束';
    if (step.playerIndex !== playerIndex) return '不是你的回合';
    if (step.done) return '已提交';
    if (data.content === undefined || data.content === null) return '内容为空';
    step.content = data.content;
    step.done = true;
    advanceStep(state);
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

// 服务端计时兜底：超时自动推进，防止一人挂机卡死整局
exports.onTimeout = (state) => {
  if (state.phase === 'choosing') {
    state.word = state.wordOptions[0];
    state.wordOptions = [];
    state.phase = 'playing';
    state.stepStartTime = Date.now();
    return true;
  }
  if (state.phase === 'playing') {
    const step = state.chain[state.currentStep];
    if (!step || step.done) return false;
    step.content = step.type === 'draw' ? [] : '（超时）';
    step.done = true;
    advanceStep(state);
    return true;
  }
  return false;
};

// Per-player view: hide the word and pending contents from everyone who shouldn't see them
exports.playerView = (state, playerIndex) => {
  const view = Object.assign({}, state, { votes: Object.assign({}, state.votes) });
  // _options 含 customWords —— 选中的词可能正是自定义词，进行中阶段必须隐藏
  if (state.phase !== 'reveal') delete view._options;

  if (state.phase === 'choosing') {
    const isChooser = state.chain[0] && state.chain[0].playerIndex === playerIndex;
    view.myTask = isChooser ? { type: 'choose', options: state.wordOptions.slice() } : null;
    view.word = null;
    view.wordOptions = [];
    view.chain = state.chain.map(s => ({ playerIndex: s.playerIndex, type: s.type, done: s.done }));
    return view;
  }

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
    view.wordOptions = [];
    view.chain = state.chain.map(s => ({
      playerIndex: s.playerIndex,
      type: s.type,
      done: s.done,
    }));
  }
  // In 'reveal' phase, full chain is visible to everyone

  return view;
};
