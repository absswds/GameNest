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
  it('contains at least 550 valid bilingual questions across all categories', () => {
    assert.ok(Array.isArray(QUESTIONS));
    assert.ok(QUESTIONS.length >= 550, `expected >=550 questions, got ${QUESTIONS.length}`);

    const seenIds = new Set();
    const validCats = new Set(['general', 'geography', 'science', 'history', 'nature', 'sports', 'culture', 'food', 'idiom', 'life', 'cncult', 'anime', 'mental']);

    for (const q of QUESTIONS) {
      assert.ok(q.id && !seenIds.has(q.id), `duplicate or missing id: ${q.id}`);
      seenIds.add(q.id);
      assert.ok(validCats.has(q.cat), `invalid category: ${q.cat}`);
      assert.ok(q.zh && typeof q.zh.q === 'string' && q.zh.q.length > 0);
      assert.ok(Array.isArray(q.zh.opts) && q.zh.opts.length === 4);
      assert.ok(q.en && typeof q.en.q === 'string' && q.en.q.length > 0);
      assert.ok(Array.isArray(q.en.opts) && q.en.opts.length === 4);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3);
      assert.ok([1, 2, 3].includes(q.diff), `question ${q.id} needs diff 1|2|3`);
      assert.equal(new Set(q.zh.opts).size, 4, `duplicate zh options in ${q.id}`);
      assert.ok(!/'/.test(q.en.q + q.en.opts.join('')), `apostrophe in English text of ${q.id}`);
    }
  });

  it('has roughly 4:4:2 easy/normal/hard questions', () => {
    const n = [0, 0, 0, 0];
    for (const q of QUESTIONS) n[q.diff]++;
    const total = QUESTIONS.length;
    assert.ok(n[1] / total > 0.3 && n[2] / total > 0.3 && n[3] / total > 0.12 && n[3] / total < 0.3, JSON.stringify(n));
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

  it('questionDiff picks questions of that level first and passes diff to the state', () => {
    for (const [name, level] of [['easy', 1], ['normal', 2], ['hard', 3]]) {
      const s = startGame(2, { questionCount: 20, questionDiff: name });
      assert.equal(s.questionDiff, name);
      for (const item of s._deck) assert.equal(item.diff, level, `${name} deck should only hold diff ${level}`);
      assert.equal(s.question.diff, level);
    }
    const mixed = startGame(2, { questionCount: 40 });
    assert.equal(mixed.questionDiff, 'mixed');
    assert.ok(new Set(mixed._deck.map((d) => d.diff)).size > 1, 'mixed deck should hold several levels');
  });

  it('new categories can be chosen', () => {
    for (const cat of ['food', 'idiom', 'life', 'cncult', 'anime', 'mental']) {
      const s = startGame(2, { questionCount: 10, category: cat });
      for (const item of s._deck) assert.equal(item.cat, cat);
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

  // Streak, score, correct count and ranking change the moment someone answers; sending
  // them before the reveal showed "streak" early and told everyone who got it right.
  it('keeps streaks, scores and ranking at question-start values until the reveal', () => {
    const s = startGame(3);
    s.streaks = [2, 2, 0];
    qr.onTimeout(s); qr.onTimeout(s);           // reveal -> next question, snapshot taken here
    s.streaks[0] = 2; s.streaks[1] = 2;
    const before = qr.playerView(s, 0);
    qr.handleMove({ answer: s.answer }, s, 0);              // right
    qr.handleMove({ answer: (s.answer + 1) % 4 }, s, 1);    // wrong
    assert.equal(s.phase, 'question');
    for (const p of [0, 1, 2]) {
      const v = qr.playerView(s, p);
      assert.deepEqual(v.streaks, before.streaks, 'streaks seat ' + p);
      assert.deepEqual(v.scores, before.scores, 'scores seat ' + p);
      assert.deepEqual(v.correctCounts, before.correctCounts, 'correctCounts seat ' + p);
      assert.deepEqual(v.ranking, before.ranking, 'ranking seat ' + p);
    }
    qr.onTimeout(s);
    const after = qr.playerView(s, 2);
    assert.equal(after.streaks[0], 3);
    assert.equal(after.streaks[1], 0);
    assert.ok(after.scores[0] > before.scores[0]);
  });
});

describe('quizrace bots', () => {
  it('works on playerView without mutating state, waits before answering, and finishes a full game', () => {
    const s = startGame(3, { questionCount: 10, timePerQuestion: 15, difficulty: 'hard' });
    const bots = [0, 1, 2].map((i) => botMod.createBot(i));

    // At t=0 right after question start, bot must not answer instantly
    const view0 = qr.playerView(s, 0);
    const snap = JSON.stringify(view0);
    const firstTry = bots[0].getMove(view0, 0);
    assert.equal(JSON.stringify(view0), snap, 'bot must not mutate playerView');
    assert.equal(firstTry.answer, undefined, 'bot should wait before answering before answering');

    // Play out the full 10-question game with bots
    let steps = 0;
    while (s.winner === null && steps++ < 500) {
      if (s.phase === 'question') {
        // Simulate 9.5s elapsed so all bots' 2-9s delays have passed
        s.questionStartedAt = Date.now() - 9500;
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

describe('quizrace bot tiers', () => {
  function run(tier, diffName, n) {
    let right = 0;
    let delays = 0;
    for (let i = 0; i < n; i++) {
      const s = startGame(2, { questionCount: 10, timePerQuestion: 30, difficulty: tier, questionDiff: diffName });
      const bot = botMod.createBot(0);
      // fake clock: poll every 250ms of game time until the bot answers
      const realNow = Date.now;
      let clock = 1000000;
      Date.now = () => clock;
      s.questionStartedAt = clock;
      let t = 0;
      let move = {};
      try {
        while (t <= 29000) {
          move = bot.getMove(s, 0);
          if (move.answer !== undefined) break;
          t += 250;
          clock += 250;
        }
      } finally {
        Date.now = realNow;
      }
      assert.ok(move.answer !== undefined, 'bot must answer within the time limit');
      delays += t;
      if (move.answer === s.answer) right++;
    }
    return { acc: right / n, delay: delays / n };
  }

  it('higher tiers answer more accurately and faster, and harder questions lower accuracy', () => {
    const easy = run('easy', 'normal', 400);
    const hard = run('hard', 'normal', 400);
    assert.ok(hard.acc > easy.acc + 0.08, `hard ${hard.acc} vs easy ${easy.acc}`);
    assert.ok(hard.delay < easy.delay, `hard ${hard.delay}ms vs easy ${easy.delay}ms`);
    const hardOnEasyQ = run('hard', 'easy', 150);
    const hardOnHardQ = run('hard', 'hard', 150);
    assert.ok(hardOnEasyQ.acc > hardOnHardQ.acc, 'accuracy falls with question difficulty');
  });
});
