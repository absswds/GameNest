// games/drawguess.js — 你画我猜 (Gartic Phone 风格传话链)
// 玩法: 首位画家从候选词中选词→画→猜→画→猜... 依次传递，最后揭示全链，投票最好笑的一步
// 房间设置: categories(词库分类) / drawTime / guessTime / wordChoices(候选词数) / customWords(自定义词)
//           rounds(每人当几次画家，0 = 自动：人少时多轮，保证一局至少 MIN_TURNS 回合)
const WORD_LIBRARY = require('./drawguess-words');
const { pick } = require('./lib/i18n');
const { toSimplified } = require('./lib/zh-variants');

exports.name = 'drawguess';
exports.maxPlayers = 8;
exports.minPlayers = 1;

const DEFAULTS = { drawTime: 90, guessTime: 45, wordChoices: 3 };
const MIN_TURNS = 6;           // 自动轮数下一局至少画这么多回合（2 人 = 每人 3 次）
const MAX_STROKE_PTS = 600;    // 单条 stage_stroke 的点数上限（客户端每 ~50ms 发一段，远小于此）
const MAX_STAGE_STROKES = 6000; // 一回合画布上的笔段上限，防止恶意客户端撑爆内存/广播

// 每人当画家的次数 → 总回合数
function totalRoundsFor(options, playerCount) {
  const n = Math.max(1, playerCount);
  let cycles = parseInt(options.rounds, 10);
  if (isNaN(cycles) || cycles <= 0) cycles = Math.ceil(MIN_TURNS / n);
  return n * Math.min(cycles, 10);
}

function buildWordPool(options, lang) {
  const cats = Array.isArray(options.categories) && options.categories.length > 0
    ? options.categories
    : Object.keys(WORD_LIBRARY);
  const pool = [];
  const useEn = lang === 'en';
  for (const key of cats) {
    const cat = WORD_LIBRARY[key];
    if (!cat) continue;
    const words = (useEn && cat.wordsEn && cat.wordsEn.length > 0) ? cat.wordsEn : cat.words;
    pool.push(...words);
  }
  // 自定义词：逗号/换行/空格分隔，去重并入
  if (typeof options.customWords === 'string' && options.customWords.trim()) {
    options.customWords.split(/[,，\n\s]+/).forEach(w => {
      const t = w.trim();
      if (t && t.length <= 12 && !pool.includes(t)) pool.push(t);
    });
  }
  if (pool.length === 0) {
    const fallback = WORD_LIBRARY.animal;
    pool.push(...((useEn && fallback.wordsEn) ? fallback.wordsEn : fallback.words));
  }
  return pool;
}

// 同一局内不重复出词：优先从没出过的词里抽，用完了才重新放回
function pickWords(pool, n, used) {
  let copy = used ? pool.filter(w => !used.includes(w)) : [...pool];
  if (copy.length < n) copy = [...pool];
  const out = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  if (used) used.push(...out);
  return out;
}

// 画笔数据来自客户端：只保留需要的字段，坐标取一位小数，限制点数和取值范围
function sanitizeStroke(s) {
  if (!s || !Array.isArray(s.pts) || s.pts.length < 2) return null;
  const pts = [];
  for (const p of s.pts.slice(0, MAX_STROKE_PTS)) {
    const x = Number(p && p.x), y = Number(p && p.y);
    if (!isFinite(x) || !isFinite(y)) return null;
    pts.push({ x: Math.round(Math.max(-50, Math.min(330, x)) * 10) / 10, y: Math.round(Math.max(-50, Math.min(330, y)) * 10) / 10 });
  }
  const color = typeof s.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(s.color) ? s.color : '#1a1a1a';
  const width = Math.max(1, Math.min(40, Number(s.width) || 4));
  const out = { color, width, pts };
  // g: 同一笔被切成多段实时发送时的笔画编号，撤销按整笔撤
  if (Number.isInteger(s.g)) out.g = s.g;
  return out;
}

exports.createState = () => ({
  mode: 'stage',
  phase: 'playing',       // 'choosing' | 'playing' | 'reveal'
  word: null,
  wordOptions: [],        // choosing 阶段的候选词（仅首位画家可见）
  chain: [],
  currentStep: 0,
  votes: {},
  transmissionResult: null,
  winner: null,
  stepStartTime: 0,
  stepDeadline: 0,        // 服务端写入的绝对时间戳，0 = 不限时
  drawTime: DEFAULTS.drawTime,
  guessTime: DEFAULTS.guessTime,
  _playerCount: 0,
  drawerIndex: 0,
  round: 1,
  totalRounds: 1,
  scores: [],
  strokes: [],
  correct: {},
  roundResults: null,
  _wordPool: [],
  _usedWords: [],
});

// 猜词比对：全角/半角统一（NFKC）、繁体转简体、忽略大小写空格和常见标点，
// 所以「長頸鹿」「长颈鹿」「Spider Man」「spider-man」都算对
function normalizeWord(value) {
  return toSimplified(String(value || '').normalize('NFKC'))
    .replace(/[\s\-_.,'"`·・!?！？。，、～~]+/g, '')
    .toLowerCase();
}

function scoreForGuess(state) {
  if (!state.stepDeadline) return 10;
  return Math.max(2, Math.ceil((state.stepDeadline - Date.now()) / 10000));
}

function allGuessersCorrect(state) {
  for (let i = 0; i < state._playerCount; i++) {
    if (i !== state.drawerIndex && !state.correct[i]) return false;
  }
  return true;
}

function finishStageRound(state) {
  state.phase = 'round_result';
  state.roundResults = {
    word: state.word,
    drawerIndex: state.drawerIndex,
    correct: Object.assign({}, state.correct),
  };
  state.stepDeadline = 0;
}

function startStageRound(state) {
  state.strokes = [];
  state.correct = {};
  state.roundResults = null;
  const choices = Math.max(1, state.wordChoices || DEFAULTS.wordChoices);
  if (choices <= 1) {
    state.word = pickWords(state._wordPool, 1, state._usedWords)[0];
    state.wordOptions = [];
    state.phase = 'playing';
  } else {
    state.word = null;
    state.wordOptions = pickWords(state._wordPool, choices, state._usedWords);
    state.phase = 'choosing';
  }
  state.stepStartTime = Date.now();
}

function startWhisperRound(state) {
  state.chain = [];
  for (let offset = 0; offset < state._playerCount; offset++) {
    state.chain.push({
      playerIndex: (state.drawerIndex + offset) % state._playerCount,
      type: offset % 2 === 0 ? 'draw' : 'guess',
      content: null,
      done: false,
    });
  }
  state.currentStep = 0;
  state.votes = {};
  state.transmissionResult = null;
  state.roundResults = null;
  if (state.wordChoices <= 1) {
    state.word = pickWords(state._wordPool, 1, state._usedWords)[0];
    state.wordOptions = [];
    state.phase = 'playing';
  } else {
    state.word = null;
    state.wordOptions = pickWords(state._wordPool, state.wordChoices, state._usedWords);
    state.phase = 'choosing';
  }
  state.stepStartTime = Date.now();
  state.stepDeadline = 0;
}

function highestScoreIndex(scores) {
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[best]) best = i;
  }
  return best;
}

exports.initGame = (state, playerCount) => {
  const options = state._options || {};
  state.mode = options.mode === 'whisper' ? 'whisper' : 'stage';
  state._playerCount = playerCount;
  state.drawTime = options.drawTime !== undefined ? parseInt(options.drawTime, 10) : DEFAULTS.drawTime;
  state.guessTime = options.guessTime !== undefined ? parseInt(options.guessTime, 10) : DEFAULTS.guessTime;
  if (isNaN(state.drawTime) || state.drawTime < 0) state.drawTime = DEFAULTS.drawTime;
  if (isNaN(state.guessTime) || state.guessTime < 0) state.guessTime = DEFAULTS.guessTime;

  const wordChoices = Math.max(1, parseInt(options.wordChoices, 10) || DEFAULTS.wordChoices);
  const pool = buildWordPool(options, state._lang);
  state.wordChoices = wordChoices;
  state.totalRounds = totalRoundsFor(options, playerCount);
  state._usedWords = [];

  if (state.mode === 'stage') {
    state.drawerIndex = 0;
    state.round = 1;
    state.scores = Array(playerCount).fill(0);
    state.strokes = [];
    state.correct = {};
    state.roundResults = null;
    state._wordPool = pool;
    state.chain = [];
    state.votes = {};
    state.winner = null;
    state.stepDeadline = 0;
    startStageRound(state);
    return;
  }

  state.drawerIndex = 0;
  state.round = 1;
  state.scores = Array(playerCount).fill(0);
  state._wordPool = pool;
  state.winner = null;
  startWhisperRound(state);
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
  if (state.mode === 'stage') {
    if (state.phase === 'choosing') {
      if (playerIndex !== state.drawerIndex || data.type !== 'choose_word') return 'dg_cannot_pick_word_now';
      const idx = parseInt(data.index, 10);
      if (isNaN(idx) || idx < 0 || idx >= state.wordOptions.length) return 'g_invalid_action';
      state.word = state.wordOptions[idx];
      state.wordOptions = [];
      state.phase = 'playing';
      state.stepStartTime = Date.now();
      return null;
    }
    if (state.phase === 'playing') {
      if (data.type === 'stage_stroke') {
        const stroke = playerIndex === state.drawerIndex ? sanitizeStroke(data.stroke) : null;
        if (!stroke) return 'dg_cannot_draw_now';
        if (state.strokes.length >= MAX_STAGE_STROKES) return 'dg_canvas_full';
        state.strokes.push(stroke);
        return null;
      }
      if (data.type === 'stage_clear' || data.type === 'stage_undo') {
        if (playerIndex !== state.drawerIndex) return 'dg_cannot_draw_now';
        if (data.type === 'stage_clear') state.strokes = [];
        else if (data.count !== undefined) state.strokes.splice(Math.max(0, state.strokes.length - Math.min(60, Math.max(1, parseInt(data.count, 10) || 1))));
        else {
          // 不带 count：撤掉最后一整笔（实时发送时一笔会被切成多段，同一 g 的段一起撤）
          const last = state.strokes.pop();
          if (last && last.g !== undefined) {
            while (state.strokes.length && state.strokes[state.strokes.length - 1].g === last.g) state.strokes.pop();
          }
        }
        return null;
      }
      if (data.type === 'stage_guess') {
        if (playerIndex === state.drawerIndex || state.correct[playerIndex]) return 'dg_cannot_repeat_guess';
        if (normalizeWord(data.text) !== normalizeWord(state.word)) return 'dg_wrong_try_again';
        state.correct[playerIndex] = true;
        state.scores[playerIndex] += scoreForGuess(state);
        state.scores[state.drawerIndex] += 1;
        if (allGuessersCorrect(state)) finishStageRound(state);
        return null;
      }
      return 'g_unknown_action';
    }
    if (state.phase === 'round_result') return 'dg_round_ended';
    return 'g_game_over';
  }

  if (state.phase === 'choosing') {
    if (data.type !== 'choose_word') return 'dg_pick_word_first';
    if (!state.chain[0] || state.chain[0].playerIndex !== playerIndex) return 'dg_not_your_word';
    const idx = parseInt(data.index, 10);
    if (isNaN(idx) || idx < 0 || idx >= state.wordOptions.length) return 'g_invalid_action';
    state.word = state.wordOptions[idx];
    state.wordOptions = [];
    state.phase = 'playing';
    state.stepStartTime = Date.now();
    return null;
  }

  if (state.phase === 'playing') {
    if (data.type !== 'submit') return 'g_unknown_action';
    const step = state.chain[state.currentStep];
    if (!step) return 'dg_stage_ended';
    if (step.playerIndex !== playerIndex) return 'g_not_your_turn';
    if (step.done) return 'dg_already_submitted';
    if (data.content === undefined || data.content === null) return 'dg_content_empty';
    step.content = data.content;
    step.done = true;
    advanceStep(state);
    return null;
  }

  if (state.phase === 'reveal') {
    if (data.type === 'vote_match') {
      if (data.value !== 'match' && data.value !== 'drift') return 'dg_invalid_vote';
      state.votes[playerIndex] = data.value;
      if (Object.keys(state.votes).length >= state._playerCount) {
        const matchCount = Object.values(state.votes).filter(v => v === 'match').length;
        state.transmissionResult = matchCount * 2 >= state._playerCount ? 'match' : 'drift';
        const scoreAwarded = state.transmissionResult === 'match' ? 3 : 0;
        state.scores[state.drawerIndex] += scoreAwarded;
        state.roundResults = {
          drawerIndex: state.drawerIndex,
          scoreAwarded,
          word: state.word,
        };
        state.phase = 'round_result';
        state.stepDeadline = 0;
      }
      return null;
    }
    if (data.type === 'vote') {
      const si = parseInt(data.stepIndex);
      if (isNaN(si) || si < 0 || si >= state.chain.length) return 'dg_invalid_vote';
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

  return 'dg_game_not_running';
};

// 服务端计时兜底：超时自动推进，防止一人挂机卡死整局
exports.onTimeout = (state) => {
  if (state.mode === 'stage') {
    if (state.phase === 'choosing') {
      state.word = state.wordOptions[0];
      state.wordOptions = [];
      state.phase = 'playing';
      state.stepStartTime = Date.now();
      return true;
    }
    if (state.phase === 'playing') {
      finishStageRound(state);
      return true;
    }
    if (state.phase === 'round_result') {
      if (state.round >= (state.totalRounds || state._playerCount)) {
        state.winner = highestScoreIndex(state.scores);
        state.phase = 'gameover';
        return true;
      }
      state.drawerIndex = (state.drawerIndex + 1) % state._playerCount;
      state.round++;
      startStageRound(state);
      return true;
    }
    return false;
  }
  if (state.phase === 'round_result') {
    if (state.round >= (state.totalRounds || state._playerCount)) {
      state.winner = highestScoreIndex(state.scores);
      state.phase = 'gameover';
      state.stepDeadline = 0;
      return true;
    }
    state.drawerIndex = (state.drawerIndex + 1) % state._playerCount;
    state.round++;
    startWhisperRound(state);
    return true;
  }
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
    step.content = step.type === 'draw' ? [] : pick(state, '（超时）', '(timeout)');
    step.done = true;
    advanceStep(state);
    return true;
  }
  return false;
};

// 舞台模式的画笔/撤销/清空每秒可达几十次。整份 game_state 带着全部笔画，每次都广播会随画面变复杂越来越卡，
// 所以服务端对这几种动作只广播一个增量（server.js 的 game_delta），客户端在本地笔画数组上应用。
//   { op: 'stroke', stroke, n }  追加一段；n = 追加后的总段数
//   { op: 'trim', n }            撤销/清空后只保留前 n 段
// 笔画对所有人可见，增量不含隐藏信息。返回 null 表示照常广播完整状态。
exports.moveDelta = (data, state) => {
  if (state.mode !== 'stage' || state.phase !== 'playing' || !data) return null;
  if (data.type === 'stage_stroke') return { op: 'stroke', stroke: state.strokes[state.strokes.length - 1], n: state.strokes.length };
  if (data.type === 'stage_undo' || data.type === 'stage_clear') return { op: 'trim', n: state.strokes.length };
  return null;
};

// Per-player view: hide the word and pending contents from everyone who shouldn't see them
exports.playerView = (state, playerIndex) => {
  const view = Object.assign({}, state, { votes: Object.assign({}, state.votes) });
  view.stepRemainingMs = state.stepDeadline ? Math.max(0, state.stepDeadline - Date.now()) : 0;
  delete view._wordPool;
  delete view._usedWords; // 含本回合的词
  if (state.mode === 'stage') {
    delete view._options;
    view.word = null;
    view.wordOptions = [];
    if (state.phase === 'choosing') {
      view.myTask = playerIndex === state.drawerIndex ? { type: 'choose', options: state.wordOptions.slice(), mode: 'stage' } : null;
      return view;
    }
    if (state.phase === 'playing') {
      const isDrawer = playerIndex === state.drawerIndex;
      view.myTask = {
        type: 'stage',
        canDraw: isDrawer,
        word: isDrawer ? state.word : null,
        wordMask: isDrawer ? null : Array.from(String(state.word || '')).map(() => '＿').join(' '),
        strokes: state.strokes.slice(),
        correct: !!state.correct[playerIndex],
      };
      return view;
    }
    if (state.phase === 'round_result' || state.phase === 'gameover') {
      view.word = state.word;
      view.roundResults = state.roundResults && Object.assign({}, state.roundResults);
    }
    view.myTask = null;
    return view;
  }
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
