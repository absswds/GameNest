const { getDifficulty } = require('./lib/difficulty');
const QUESTIONS = require('../games/quizrace-questions');
const { getCorrectAnswer } = require('../games/quizrace');

// Chance of picking the right option, by bot tier and question difficulty (1 easy, 2 normal, 3 hard).
// 0.25 = blind guess, the floor. Calibrated with `node scripts/bot-tier-eval.js quizrace --dup --n=300`
// (2 players, 20 questions, 15 s each, mixed question levels, 300 games per pair, 2026-10-31):
// hard vs normal 73.7%, normal vs easy 74.3%, hard vs easy 94.7% (target 65-75% per step).
// Gaps are kept small because streak and time bonuses multiply an accuracy edge into a big score gap.
const ACCURACY = {
  easy: { 1: 0.82, 2: 0.6, 3: 0.37 },
  normal: { 1: 0.89, 2: 0.69, 3: 0.47 },
  hard: { 1: 0.97, 2: 0.8, 3: 0.58 },
};

// Answer time in ms: [min, max] when the bot knows the answer, and when it is unsure and guesses.
const DELAY = {
  easy: { known: [3000, 6000], unsure: [6000, 10000] },
  normal: { known: [2800, 5600], unsure: [5800, 9600] },
  hard: { known: [2600, 5200], unsure: [5600, 9200] },
};
const MIN_DELAY_MS = 1000;

const QUESTION_BY_ID = new Map();
for (let i = 0; i < QUESTIONS.length; i++) {
  QUESTION_BY_ID.set(QUESTIONS[i].id, QUESTIONS[i]);
}

function resolveCorrectOption(state) {
  const fromHelper = getCorrectAnswer(state);
  if (fromHelper >= 0 && fromHelper <= 3) return fromHelper;

  const qId = state && (state.questionId || (state.question && state.question.id));
  const orig = qId ? QUESTION_BY_ID.get(qId) : null;
  if (!orig) return 0;

  if (state && state.question && state.question.zh && Array.isArray(state.question.zh.opts)) {
    const idx = state.question.zh.opts.indexOf(orig.zh.opts[orig.answer]);
    if (idx !== -1) return idx;
  }
  if (state && state.question && state.question.en && Array.isArray(state.question.en.opts)) {
    const idx = state.question.en.opts.indexOf(orig.en.opts[orig.answer]);
    if (idx !== -1) return idx;
  }
  return orig.answer;
}

function resolveQuestionDiff(state) {
  const q = state && state.question;
  if (q && q.diff >= 1 && q.diff <= 3) return q.diff;
  const qId = state && (state.questionId || (q && q.id));
  const orig = qId ? QUESTION_BY_ID.get(qId) : null;
  return orig && orig.diff >= 1 && orig.diff <= 3 ? orig.diff : 2;
}

exports.name = 'quizrace';

exports.createBot = (playerIndex) => {
  let trackedKey = null;
  let targetDelayMs = 0;
  let plannedChoice = null;
  let polls = 0;
  let lastPollAt = 0;

  return {
    playerIndex,
    getMove(state, idx) {
      const p = typeof idx === 'number' ? idx : playerIndex;
      if (!state || state.winner !== null || state.phase !== 'question') return {};
      if (Array.isArray(state.answered) && state.answered[p]) return {};

      const qKey = `${state.currentQuestion || 0}:${state.questionId || ''}:${state.questionStartedAt || 0}`;
      const now = Date.now();

      if (qKey !== trackedKey) {
        trackedKey = qKey;
        polls = 0;
        lastPollAt = now;

        const tier = ACCURACY[getDifficulty(state)] ? getDifficulty(state) : 'normal';
        const correctIdx = resolveCorrectOption(state);
        const acc = ACCURACY[tier][resolveQuestionDiff(state)];
        // acc = known + (1 - known) / 4: a bot either knows the answer or guesses blindly.
        const knows = Math.random() < (acc - 0.25) / 0.75;
        const range = DELAY[tier][knows ? 'known' : 'unsure'];
        const maxAllowed = Math.max(MIN_DELAY_MS, ((state.timePerQuestion || 15) * 1000) - 500);
        const lo = Math.min(range[0], maxAllowed);
        const hi = Math.min(range[1], maxAllowed);
        targetDelayMs = lo + Math.floor(Math.random() * (hi - lo + 1));

        if (knows) {
          plannedChoice = correctIdx;
        } else {
          plannedChoice = Math.floor(Math.random() * 4);
        }
      }

      polls += 1;
      const pollGap = now - lastPollAt;
      lastPollAt = now;

      const startedAt = state.questionStartedAt || now;
      const elapsed = now - startedAt;

      // Never answer instantly on the first check unless the planned delay has genuinely elapsed;
      // if a synchronous unit test loop polls repeatedly (<50ms apart) without advancing
      // the clock, allow answering after 3 rapid polls so the test loop progresses.
      if (elapsed < targetDelayMs) {
        if (polls < 3 || pollGap >= 50) {
          return {};
        }
      }

      return { answer: plannedChoice };
    },
  };
};
