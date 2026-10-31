// Quick Quiz (快问快答) — Simultaneous 4-choice trivia race (1-8 players)

const QUESTIONS = require('./quizrace-questions');

const CATEGORIES = ['all', 'general', 'geography', 'science', 'history', 'nature', 'sports', 'culture'];
const QUESTION_COUNTS = [10, 15, 20];
const QUESTION_TIMES = [10, 15, 20];
const REVEAL_SECONDS = 3;

const QUESTION_BY_ID = new Map();
for (let i = 0; i < QUESTIONS.length; i++) {
  QUESTION_BY_ID.set(QUESTIONS[i].id, QUESTIONS[i]);
}

exports.name = 'quizrace';
exports.minPlayers = 1;
exports.maxPlayers = 8;
exports.CATEGORIES = CATEGORIES;
exports.QUESTION_COUNTS = QUESTION_COUNTS;
exports.QUESTION_TIMES = QUESTION_TIMES;
exports.REVEAL_SECONDS = REVEAL_SECONDS;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function computeRanking(state) {
  const n = state.playerCount || 0;
  const list = [];
  for (let p = 0; p < n; p++) {
    const answeredCount = (state.answeredCounts && state.answeredCounts[p]) || 0;
    const totalMs = (state.totalAnswerTimeMs && state.totalAnswerTimeMs[p]) || 0;
    const avgTimeMs = answeredCount > 0 ? Math.round(totalMs / answeredCount) : 0;
    list.push({
      player: p,
      score: (state.scores && state.scores[p]) || 0,
      correctCount: (state.correctCounts && state.correctCounts[p]) || 0,
      answeredCount,
      avgTimeMs,
      avgTimeSec: Math.round((avgTimeMs / 1000) * 10) / 10,
      streak: (state.streaks && state.streaks[p]) || 0,
    });
  }
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (a.avgTimeMs !== b.avgTimeMs) {
      if (a.answeredCount === 0) return 1;
      if (b.answeredCount === 0) return -1;
      return a.avgTimeMs - b.avgTimeMs;
    }
    return a.player - b.player;
  });
  return list;
}

function startQuestion(state, index) {
  const deck = state._deck || [];
  const item = deck[index];
  if (!item) {
    finishGame(state);
    return;
  }
  const n = state.playerCount || 1;
  const now = Date.now();
  const totalQ = state.totalQuestions || deck.length || 10;
  const timeSec = state.timePerQuestion || 15;

  state.phase = 'question';
  state.questionIndex = index;
  state.currentQuestion = index + 1;
  state.questionId = item.id;
  state.questionCat = item.cat;
  state.question = {
    id: item.id,
    cat: item.cat,
    zh: { q: item.zh.q, opts: item.zh.opts.slice() },
    en: { q: item.en.q, opts: item.en.opts.slice() },
  };
  state.answer = item.answer;
  state.isDouble = index >= totalQ - 3;
  state.questionStartedAt = now;
  state.deadline = now + timeSec * 1000;
  state.choices = Array(n).fill(null);
  state.answered = Array(n).fill(false);
  state.answerTimesMs = Array(n).fill(null);
  state.roundPoints = Array(n).fill(0);
  state.streakBonuses = Array(n).fill(0);
}

function enterRevealPhase(state) {
  const prevDeadline = state.deadline || 0;
  let nextDeadline = Date.now() + REVEAL_SECONDS * 1000;
  if (nextDeadline === prevDeadline) nextDeadline += 1;
  state.phase = 'reveal';
  state.deadline = nextDeadline;
  state.ranking = computeRanking(state);
}

function finishGame(state) {
  state.phase = 'over';
  state.deadline = 0;
  state.ranking = computeRanking(state);
  const scores = state.scores || [];
  if (!scores.length) {
    state.winner = -1;
    return;
  }
  let maxScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > maxScore) maxScore = scores[i];
  }
  const leaders = [];
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] === maxScore) leaders.push(i);
  }
  state.winner = leaders.length === 1 ? leaders[0] : -1;
}

exports.createState = () => ({
  phase: 'waiting',
  playerCount: 0,
  category: 'all',
  totalQuestions: 10,
  questionCount: 10,
  timePerQuestion: 15,
  questionTime: 15,
  questionIndex: 0,
  currentQuestion: 0,
  questionId: null,
  questionCat: null,
  question: null,
  answer: null,
  isDouble: false,
  questionStartedAt: 0,
  deadline: 0,
  choices: [],
  answered: [],
  answerTimesMs: [],
  roundPoints: [],
  streakBonuses: [],
  scores: [],
  streaks: [],
  correctCounts: [],
  answeredCounts: [],
  totalAnswerTimeMs: [],
  avgTimeMs: [],
  ranking: [],
  winner: null,
});

exports.initGame = (state, playerCount) => {
  const n = Math.max(1, Math.min(8, Number(playerCount) || 1));
  const opts = state._options || {};

  const rawCount = Number(opts.questionCount ?? opts.totalQuestions ?? opts.questions ?? opts.maxRounds);
  const totalQuestions = QUESTION_COUNTS.includes(rawCount) ? rawCount : 10;

  const rawTime = Number(opts.timePerQuestion ?? opts.questionTime ?? opts.roundTime ?? opts.timeLimit);
  const timePerQuestion = QUESTION_TIMES.includes(rawTime) ? rawTime : 15;

  const rawCat = typeof opts.category === 'string' ? opts.category.trim().toLowerCase() : 'all';
  const category = CATEGORIES.includes(rawCat) ? rawCat : 'all';

  let pool = category === 'all' ? QUESTIONS : QUESTIONS.filter((q) => q.cat === category);
  if (pool.length < totalQuestions) pool = QUESTIONS;

  const picked = shuffle(pool).slice(0, totalQuestions);
  const deck = picked.map((q) => {
    const perm = shuffle([0, 1, 2, 3]);
    return {
      id: q.id,
      cat: q.cat,
      zh: {
        q: q.zh.q,
        opts: perm.map((idx) => q.zh.opts[idx]),
      },
      en: {
        q: q.en.q,
        opts: perm.map((idx) => q.en.opts[idx]),
      },
      answer: perm.indexOf(q.answer),
    };
  });

  state.playerCount = n;
  state.category = category;
  state.totalQuestions = totalQuestions;
  state.questionCount = totalQuestions;
  state.timePerQuestion = timePerQuestion;
  state.questionTime = timePerQuestion;
  state.scores = Array(n).fill(0);
  state.streaks = Array(n).fill(0);
  state.correctCounts = Array(n).fill(0);
  state.answeredCounts = Array(n).fill(0);
  state.totalAnswerTimeMs = Array(n).fill(0);
  state.avgTimeMs = Array(n).fill(0);
  state.winner = null;
  state._deck = deck;

  startQuestion(state, 0);
  state.ranking = computeRanking(state);
};

exports.handleMove = (data, state, playerIndex) => {
  if (!state || state.winner !== null || state.phase === 'over') return 'g_game_over';
  if (state.phase === 'reveal') return 'qr_reveal_wait';
  if (state.phase !== 'question') return 'qr_not_now';
  if (typeof playerIndex !== 'number' || playerIndex < 0 || playerIndex >= state.playerCount) {
    return 'qr_invalid_player';
  }
  if (!data || typeof data !== 'object') return 'qr_invalid_option';

  // Allow bots to defer answering until their 2-8s thinking delay has elapsed
  if (
    data.wait === true ||
    data.pass === true ||
    (Object.keys(data).length === 0 && !state.answered[playerIndex])
  ) {
    return null;
  }

  if (state.answered[playerIndex]) return 'qr_already_answered';

  const rawChoice = data.answer ?? data.choice ?? data.option ?? data.index;
  if (typeof rawChoice !== 'number' || !Number.isInteger(rawChoice) || rawChoice < 0 || rawChoice > 3) {
    return 'qr_invalid_option';
  }

  const now = Date.now();
  const totalMs = Math.max(1, (state.timePerQuestion || 15) * 1000);
  const startedAt = state.questionStartedAt || now;
  const elapsed = Math.max(0, now - startedAt);
  const remainingFraction = Math.max(0, Math.min(1, (totalMs - elapsed) / totalMs));

  state.choices[playerIndex] = rawChoice;
  state.answered[playerIndex] = true;
  state.answerTimesMs[playerIndex] = Math.min(totalMs, elapsed);
  state.answeredCounts[playerIndex] = (state.answeredCounts[playerIndex] || 0) + 1;
  state.totalAnswerTimeMs[playerIndex] =
    (state.totalAnswerTimeMs[playerIndex] || 0) + state.answerTimesMs[playerIndex];
  state.avgTimeMs[playerIndex] = Math.round(
    state.totalAnswerTimeMs[playerIndex] / state.answeredCounts[playerIndex]
  );

  if (rawChoice === state.answer) {
    state.correctCounts[playerIndex] = (state.correctCounts[playerIndex] || 0) + 1;
    state.streaks[playerIndex] = (state.streaks[playerIndex] || 0) + 1;
    let pts = 500 + Math.round(500 * remainingFraction);
    if (state.isDouble) pts *= 2;
    const streakBonus = state.streaks[playerIndex] >= 3 ? 100 : 0;
    pts += streakBonus;
    state.streakBonuses[playerIndex] = streakBonus;
    state.roundPoints[playerIndex] = pts;
    state.scores[playerIndex] = (state.scores[playerIndex] || 0) + pts;
  } else {
    state.streaks[playerIndex] = 0;
    state.streakBonuses[playerIndex] = 0;
    state.roundPoints[playerIndex] = 0;
  }

  state.ranking = computeRanking(state);

  if (state.answered.every(Boolean)) {
    enterRevealPhase(state);
  }

  return null;
};

exports.getPhaseDeadline = (state) => {
  if (!state || state.winner !== null || state.phase === 'over' || state.phase === 'waiting') {
    return 0;
  }
  return state.deadline || 0;
};

exports.onTimeout = (state) => {
  if (!state || state.winner !== null || state.phase === 'over') return;
  if (state.phase === 'question') {
    const n = state.playerCount || 0;
    for (let p = 0; p < n; p++) {
      if (!state.answered || !state.answered[p]) {
        if (state.streaks) state.streaks[p] = 0;
        if (state.roundPoints) state.roundPoints[p] = 0;
        if (state.streakBonuses) state.streakBonuses[p] = 0;
      }
    }
    enterRevealPhase(state);
  } else if (state.phase === 'reveal') {
    const nextIdx = (state.questionIndex || 0) + 1;
    const totalQ = state.totalQuestions || (state._deck ? state._deck.length : 0);
    if (nextIdx < totalQ) {
      startQuestion(state, nextIdx);
      state.ranking = computeRanking(state);
    } else {
      finishGame(state);
    }
  }
};

exports.getPendingActors = (state) => {
  if (!state || state.winner !== null || state.phase !== 'question') return [];
  const pending = [];
  const n = state.playerCount || 0;
  for (let p = 0; p < n; p++) {
    if (!state.answered || !state.answered[p]) pending.push(p);
  }
  return pending;
};

exports.getCurrentActor = () => -1;
exports.setCurrentActor = () => {};

// Helper for bots: resolves the correct option index (0-3) even from a playerView
// where `state.answer` is hidden, by looking up `questionId` in the bank and matching
// the shuffled option text.
exports.getCorrectAnswer = (state) => {
  if (!state) return -1;
  if (typeof state.answer === 'number' && state.answer >= 0 && state.answer <= 3) {
    return state.answer;
  }
  const qId = state.questionId || (state.question && state.question.id);
  const orig = qId ? QUESTION_BY_ID.get(qId) : null;
  if (!orig || !state.question) return -1;

  const targetZh = orig.zh && orig.zh.opts ? orig.zh.opts[orig.answer] : null;
  const optsZh = state.question.zh && state.question.zh.opts;
  if (targetZh !== null && Array.isArray(optsZh)) {
    const idx = optsZh.indexOf(targetZh);
    if (idx !== -1) return idx;
  }

  const targetEn = orig.en && orig.en.opts ? orig.en.opts[orig.answer] : null;
  const optsEn = state.question.en && state.question.en.opts;
  if (targetEn !== null && Array.isArray(optsEn)) {
    const idx = optsEn.indexOf(targetEn);
    if (idx !== -1) return idx;
  }

  return orig.answer;
};

exports.playerView = (state, playerIndex) => {
  if (!state || typeof state !== 'object') return {};
  const isQuestion = state.phase === 'question';
  const n = state.playerCount || 0;

  const choices = Array.isArray(state.choices)
    ? state.choices.map((c, idx) => (isQuestion ? (idx === playerIndex ? c : null) : c))
    : [];

  const answerTimesMs = Array.isArray(state.answerTimesMs)
    ? state.answerTimesMs.map((t, idx) => (isQuestion ? (idx === playerIndex ? t : null) : t))
    : [];

  const roundPoints = Array.isArray(state.roundPoints)
    ? state.roundPoints.map((pts) => (isQuestion ? 0 : pts))
    : [];

  const streakBonuses = Array.isArray(state.streakBonuses)
    ? state.streakBonuses.map((b) => (isQuestion ? 0 : b))
    : [];

  const questionCopy = state.question
    ? {
        id: state.question.id,
        cat: state.question.cat,
        zh: {
          q: state.question.zh ? state.question.zh.q : '',
          opts: state.question.zh && Array.isArray(state.question.zh.opts) ? state.question.zh.opts.slice() : [],
        },
        en: {
          q: state.question.en ? state.question.en.q : '',
          opts: state.question.en && Array.isArray(state.question.en.opts) ? state.question.en.opts.slice() : [],
        },
      }
    : null;

  return {
    phase: state.phase || 'waiting',
    playerCount: n,
    category: state.category || 'all',
    totalQuestions: state.totalQuestions || 10,
    questionCount: state.questionCount || state.totalQuestions || 10,
    timePerQuestion: state.timePerQuestion || 15,
    questionTime: state.questionTime || state.timePerQuestion || 15,
    questionIndex: state.questionIndex || 0,
    currentQuestion: state.currentQuestion || 0,
    questionId: state.questionId || null,
    questionCat: state.questionCat || null,
    question: questionCopy,
    answer: isQuestion ? null : state.answer ?? null,
    isDouble: Boolean(state.isDouble),
    questionStartedAt: state.questionStartedAt || 0,
    deadline: state.deadline || 0,
    choices,
    myChoice:
      typeof playerIndex === 'number' && Array.isArray(state.choices) && playerIndex >= 0 && playerIndex < n
        ? state.choices[playerIndex]
        : null,
    answered: Array.isArray(state.answered) ? state.answered.slice() : [],
    answerTimesMs,
    roundPoints,
    streakBonuses,
    scores: Array.isArray(state.scores) ? state.scores.slice() : [],
    streaks: Array.isArray(state.streaks) ? state.streaks.slice() : [],
    correctCounts: Array.isArray(state.correctCounts) ? state.correctCounts.slice() : [],
    answeredCounts: Array.isArray(state.answeredCounts) ? state.answeredCounts.slice() : [],
    totalAnswerTimeMs: Array.isArray(state.totalAnswerTimeMs) ? state.totalAnswerTimeMs.slice() : [],
    avgTimeMs: Array.isArray(state.avgTimeMs) ? state.avgTimeMs.slice() : [],
    ranking: Array.isArray(state.ranking) ? state.ranking.map((r) => ({ ...r })) : [],
    winner: state.winner ?? null,
    _options: state._options ? { ...state._options } : undefined,
  };
};
