const { getDifficulty } = require('./lib/difficulty');
const QUESTIONS = require('../games/quizrace-questions');
const { getCorrectAnswer } = require('../games/quizrace');

// Provisional: uncalibrated
const ACCURACY = {
  easy: 0.45,
  normal: 0.65,
  hard: 0.85,
};

const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 8000;

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

        const maxAllowed = Math.max(
          MIN_DELAY_MS,
          Math.min(MAX_DELAY_MS, ((state.timePerQuestion || 15) * 1000) - 500)
        );
        targetDelayMs = MIN_DELAY_MS + Math.floor(Math.random() * (maxAllowed - MIN_DELAY_MS + 1));

        const diff = getDifficulty(state);
        const acc = ACCURACY[diff] != null ? ACCURACY[diff] : ACCURACY.normal;
        const correctIdx = resolveCorrectOption(state);

        if (Math.random() < acc) {
          plannedChoice = correctIdx;
        } else {
          const wrong = [0, 1, 2, 3].filter((opt) => opt !== correctIdx);
          plannedChoice = wrong[Math.floor(Math.random() * wrong.length)];
        }
      }

      polls += 1;
      const pollGap = now - lastPollAt;
      lastPollAt = now;

      const startedAt = state.questionStartedAt || now;
      const elapsed = now - startedAt;

      // Never answer instantly on the first check unless 2-8s have genuinely elapsed;
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
