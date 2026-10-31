const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const qr = require('../games/quizrace');
const QUESTIONS = require('../games/quizrace-questions');
const botMod = require('../bots/quizrace');

function startGame(n = 3, opts = {}) {
  const s = qr.createState();
  s._options = opts;
  qr.initGame(s, n);
  return s;
}

describe('quizrace question bank', () => {
  it('contains at least 200 valid bilingual questions across all categories', () => {
    assert.ok(Array.isArray(QUESTIONS));
    assert.ok(QUESTIONS.length >= 200, `expected >=200 questions, got ${QUESTIONS.length}`);

    const seenIds = new Set();
    const validCats = new Set(['general', 'geography', 'science', 'history', 'nature', 'sports', 'culture']);

    for (const q of QUESTIONS) {
      assert.ok(q.id && !seenIds.has(q.id), `duplicate or missing id: ${q.id}`);
      seenIds.add(q.id);
      assert.ok(validCats.has(q.cat), `invalid category: ${q.cat}`);
      assert.ok(q.zh && typeof q.zh.q === 'string' && q.zh.q.length > 0);
      assert.ok(Array.isArray(q.zh.opts) && q.zh.opts.length === 4);
      assert.ok(q.en && typeof q.en.q === 'string' && q.en.q.length > 0);
      assert.ok(Array.isArray(q.en.opts) && q.en.opts.length === 4);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);
    }
  });
});

describe('quizrace start and room options', () => {
  it('starts in question phase with configured count, time, and category without repeating questions', () => {
    const s = startGame(4, { questionCount: 15, timePerQuestion: 20, category: 'science' });
    assert.equal(s.phase, 'question');
    assert.equal(s.playerCount, 4);
    assert.equal(s.totalQuestions, 15);
    assert.equal(s.timePerQuestion, 20);
    assert.equal(s.category, 'science');
    assert.equal(s.currentQuestion, 1);
    assert.equal(s.questionCat, 'science');
    assert.equal(s._deck.length, 15);

    const ids = new Set(s._deck.map((d) => d.id));
    assert.equal(ids.size, 15, 'questions in a game must not repeat');
    for (const item of s._deck) {
      assert.equal(item.cat, 'science');
      assert.equal(qr.getCorrectAnswer({ questionId: item.id, question: item }), item.answer);
    }
  });

  it('playerView does not throw before initGame', () => {
    const raw = qr.createState();
    const view = qr.playerView(raw, 0);
    assert.equal(view.phase, 'waiting');
  });
});

describe('quizrace answer once only and phase transitions', () => {
  it('allows each player to answer only once per question and enters reveal when all answered', () => {
    const s = startGame(2, { questionCount: 10, timePerQuestion: 15 });
    assert.equal(qr.handleMove({ answer: -1 }, s, 0), 'qr_invalid_option');
    assert.equal(qr.handleMove({ answer: 4 }, s, 0), 'qr_invalid_option');

    assert.equal(qr.handleMove({ answer: s.answer }, s, 0), null);
    assert.equal(s.phase, 'question');
    assert.equal(qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 0), 'qr_already_answered');

    // Second player answers -> immediately transitions to reveal
    assert.equal(qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 1), null);
    assert.equal(s.phase, 'reveal');
    assert.equal(qr.handleMove({ answer: 0 }, s, 0), 'qr_reveal_wait');
  });
});

describe('quizrace scoring (time bonus, last-3 double, streak)', () => {
  it('computes time bonus, streak bonus from 3rd consecutive correct, and double points on last 3 questions', () => {
    const s = startGame(2, { questionCount: 10, timePerQuestion: 10 });

    // Q1: P0 answers half-way through (5s elapsed of 10s -> remaining fraction = 0.5 -> 500 + 250 = 750)
    s.questionStartedAt = Date.now() - 5000;
    assert.equal(s.isDouble, false);
    assert.equal(qr.handleMove({ answer: s.answer }, s, 0), null);
    assert.ok(s.scores[0] >= 740 && s.scores[0] <= 755, `expected ~750, got ${s.scores[0]}`);
    const q1Score = s.scores[0];

    // P1 answers wrong -> 0 points
    assert.equal(qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 1), null);
    assert.equal(s.scores[1], 0);
    assert.equal(s.phase, 'reveal');

    // Advance to Q2: P0 answers instantly (remaining fraction ~1.0 -> ~1000, streak = 2, no streak bonus yet)
    qr.onTimeout(s);
    assert.equal(s.currentQuestion, 2);
    s.questionStartedAt = Date.now();
    qr.handleMove({ answer: s.answer }, s, 0);
    qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 1);
    assert.equal(s.streaks[0], 2);
    assert.equal(s.streakBonuses[0], 0);
    const afterQ2 = s.scores[0];
    assert.ok(afterQ2 - q1Score >= 990 && afterQ2 - q1Score <= 1000);

    // Advance to Q3: P0 gets 3rd consecutive correct at t=0 -> 1000 + 100 streak bonus = 1100
    qr.onTimeout(s);
    assert.equal(s.currentQuestion, 3);
    s.questionStartedAt = Date.now();
    qr.handleMove({ answer: s.answer }, s, 0);
    qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 1);
    assert.equal(s.streaks[0], 3);
    assert.equal(s.streakBonuses[0], 100);
    assert.ok(s.roundPoints[0] >= 1090 && s.roundPoints[0] <= 1100, `expected ~1100, got ${s.roundPoints[0]}`);

    // Q4: P0 misses -> streak resets to 0
    qr.onTimeout(s);
    assert.equal(s.currentQuestion, 4);
    qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 0);
    qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 1);
    assert.equal(s.streaks[0], 0);
    assert.equal(s.roundPoints[0], 0);

    // Fast-forward through Q5, Q6, Q7 timeouts to reach Q8 (index 7, first of last-3 double questions)
    for (const expectedQ of [5, 6, 7]) {
      qr.onTimeout(s); // reveal -> next question
      assert.equal(s.currentQuestion, expectedQ);
      assert.equal(s.isDouble, false);
      qr.onTimeout(s); // question timeout -> reveal
    }

    // Q8 (8 of 10): isDouble must be true, instant correct answer gives ~2000 points
    qr.onTimeout(s);
    assert.equal(s.currentQuestion, 8);
    assert.equal(s.isDouble, true);
    s.questionStartedAt = Date.now();
    qr.handleMove({ answer: s.answer }, s, 0);
    assert.ok(s.roundPoints[0] >= 1980 && s.roundPoints[0] <= 2000, `expected ~2000 on double question, got ${s.roundPoints[0]}`);
  });
});

describe('quizrace playerView privacy', () => {
  it('hides the correct answer and other players choices during question phase, and reveals them in reveal/over', () => {
    const s = startGame(3);
    const p0Pick = (s.answer + 1) % 4;
    qr.handleMove({ answer: p0Pick }, s, 0);
    assert.equal(s.phase, 'question');

    const snapshot = JSON.stringify(s);
    const v0 = qr.playerView(s, 0);
    const v1 = qr.playerView(s, 1);
    assert.equal(JSON.stringify(s), snapshot, 'playerView must not mutate state');

    // During question phase: answer is hidden for everyone
    assert.equal(v0.answer, null);
    assert.equal(v1.answer, null);
    assert.equal(v1._deck, undefined);

    // Player 1 can see that Player 0 has answered, but CANNOT see Player 0's choice
    assert.deepEqual(v1.answered, [true, false, false]);
    assert.equal(v1.choices[0], null);
    assert.equal(v0.choices[0], p0Pick);

    // Timeout ends question -> reveal phase exposes answer and all choices
    qr.onTimeout(s);
    assert.equal(s.phase, 'reveal');
    const v1Reveal = qr.playerView(s, 1);
    assert.equal(v1Reveal.answer, s.answer);
    assert.equal(v1Reveal.choices[0], p0Pick);
  });
});

describe('quizrace bots', () => {
  it('works on playerView without mutating state, delays 2-8s before answering, and finishes a full game', () => {
    const s = startGame(3, { questionCount: 10, timePerQuestion: 15, difficulty: 'hard' });
    const bots = [0, 1, 2].map((i) => botMod.createBot(i));

    // At t=0 right after question start, bot must not answer instantly
    const view0 = qr.playerView(s, 0);
    const snap = JSON.stringify(view0);
    const firstTry = bots[0].getMove(view0, 0);
    assert.equal(JSON.stringify(view0), snap, 'bot must not mutate playerView');
    assert.equal(firstTry.answer, undefined, 'bot should wait for 2-8s delay before answering');

    // Play out the full 10-question game with bots
    let steps = 0;
    while (s.winner === null && steps++ < 500) {
      if (s.phase === 'question') {
        // Simulate 8.5s elapsed so all bots' 2-8s delays have passed
        s.questionStartedAt = Date.now() - 8500;
        const pending = qr.getPendingActors(s);
        if (!pending.length) {
          qr.onTimeout(s);
          continue;
        }
        for (const p of pending) {
          const pv = qr.playerView(s, p);
          const pvSnap = JSON.stringify(pv);
          const move = bots[p].getMove(pv, p);
          assert.equal(JSON.stringify(pv), pvSnap, 'bot must not mutate playerView');
          assert.ok(Number.isInteger(move.answer) && move.answer >= 0 && move.answer <= 3);
          const err = qr.handleMove(move, s, p);
          assert.equal(err, null);
        }
      } else if (s.phase === 'reveal') {
        qr.onTimeout(s);
      } else {
        break;
      }
    }

    assert.equal(s.phase, 'over');
    assert.ok(s.winner !== null);
    assert.equal(s.ranking.length, 3);
    assert.ok(s.ranking[0].score >= s.ranking[1].score);
    assert.ok(s.ranking[1].score >= s.ranking[2].score);
  });
});
