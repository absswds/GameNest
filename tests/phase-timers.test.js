const test = require('node:test');
const assert = require('node:assert/strict');

const ddz = require('../games/doudizhu');
const tf = require('../games/twentyfour');
const dg = require('../games/drawguess');

function ddzPlaying(limit) {
  const st = ddz.createState();
  st._options = { playTimeLimit: limit, bidMode: 'score' };
  ddz.initGame(st, 3);
  return st;
}

// Drive a fresh doudizhu state into the playing phase (the first bidder bids 3).
function ddzToPlaying(limit) {
  const st = ddzPlaying(limit);
  assert.equal(ddz.handleMove({ score: 3 }, st, st.currentBidder), null);
  assert.equal(st.phase, 'playing');
  return st;
}

test('doudizhu getPhaseDeadline is 0 unless playing with a time limit', () => {
  const st = ddzPlaying(0);
  assert.equal(ddz.getPhaseDeadline(st), 0);
  st.phase = 'playing';
  assert.equal(ddz.getPhaseDeadline(st), 0, 'no limit -> no deadline');
  st.playTimeLimit = 30;
  st.currentTurnDeadline = 12345;
  assert.equal(ddz.getPhaseDeadline(st), 12345);
  st.phase = 'bidding';
  assert.equal(ddz.getPhaseDeadline(st), 0, 'only while playing');
  st.phase = 'playing';
  st.winner = 1;
  assert.equal(ddz.getPhaseDeadline(st), 0, 'no deadline after match over');
});

test('doudizhu onTimeout plays the timeout move and advances the turn', () => {
  const st = ddzToPlaying(30);
  const before = st.currentPlayer;
  const dl = ddz.getPhaseDeadline(st);
  assert.ok(dl > 0);
  const handsBefore = st.hands[before].length;
  assert.equal(ddz.onTimeout(st), null);
  assert.notEqual(st.currentPlayer, before);
  assert.equal(st.hands[before].length, handsBefore - 1, 'leader played their lowest card');
  assert.ok(ddz.getPhaseDeadline(st) >= dl);
});

test('twentyfour deadline is fixed at round start and ignores moves', () => {
  const st = tf.createState();
  st._options = { roundTime: 20, maxRounds: 3 };
  tf.initGame(st, 2);
  const dl = tf.getPhaseDeadline(st);
  assert.equal(dl, st.roundEndsAt);
  assert.ok(dl > Date.now());
  // a wrong move and a stray state change must not move the deadline
  tf.handleMove({ expression: '1+1' }, st, 0);
  assert.equal(tf.getPhaseDeadline(st), dl);
  st.phase = 'round_end';
  assert.equal(tf.getPhaseDeadline(st), 0);
});

test('twentyfour untimed games have no deadline', () => {
  const st = tf.createState();
  tf.initGame(st, 2);
  assert.equal(tf.getPhaseDeadline(st), 0);
});

test('twentyfour onTimeout: fastest correct submission wins, -1 when nobody solved', () => {
  const st = tf.createState();
  st._options = { roundTime: 20 };
  tf.initGame(st, 3);
  st.playerSubmissions = {
    1: { expression: 'x', correct: true, submittedAt: 2000 },
    2: { expression: 'y', correct: true, submittedAt: 1000 },
    0: { expression: 'z', correct: false, submittedAt: 500 },
  };
  tf.onTimeout(st);
  assert.equal(st.roundWinner, 2);
  assert.equal(st.roundsWon[2], 1);
  assert.equal(st.phase, 'round_end');

  const st2 = tf.createState();
  st2._options = { roundTime: 20 };
  tf.initGame(st2, 2);
  tf.onTimeout(st2);
  assert.equal(st2.roundWinner, -1);
  assert.deepEqual(st2.roundsWon, [0, 0]);
  assert.equal(st2.phase, 'round_end');
  tf.onTimeout(st2); // not playing any more: no-op
  assert.deepEqual(st2.roundsWon, [0, 0]);
});

function dgState(mode, opts) {
  const st = dg.createState();
  st._options = Object.assign({ mode, wordChoices: 1 }, opts);
  dg.initGame(st, 3);
  return st;
}

test('drawguess stage: stepDeadline follows every phase change, with 2s buffer', () => {
  const st = dgState('stage', { drawTime: 60, wordChoices: 3 });
  assert.equal(st.phase, 'choosing');
  const now = Date.now();
  assert.ok(st.stepDeadline >= now + 17000 - 50 && st.stepDeadline <= now + 17000 + 500, 'choosing = 15s + 2s');
  assert.equal(dg.getPhaseDeadline(st), st.stepDeadline);

  assert.equal(dg.handleMove({ type: 'choose_word', index: 0 }, st, st.drawerIndex), null);
  assert.equal(st.phase, 'playing');
  assert.ok(Math.abs(st.stepDeadline - (Date.now() + 62000)) < 500);

  // live actions do not move the deadline
  const dl = st.stepDeadline;
  dg.handleMove({ type: 'stage_guess', text: 'definitely-wrong' }, st, 1);
  assert.equal(st.stepDeadline, dl);

  // everyone guesses right -> round_result, 5s + 2s
  const word = st.word;
  dg.handleMove({ type: 'stage_guess', text: word }, st, 1);
  dg.handleMove({ type: 'stage_guess', text: word }, st, 2);
  assert.equal(st.phase, 'round_result');
  assert.ok(Math.abs(st.stepDeadline - (Date.now() + 7000)) < 500);

  // timeout from round_result starts the next round and re-arms
  dg.onTimeout(st);
  assert.equal(st.round, 2);
  assert.equal(st.phase, 'choosing');
  assert.ok(Math.abs(st.stepDeadline - (Date.now() + 17000)) < 500);
});

test('drawguess stage: 0 means unlimited, and gameover clears the deadline', () => {
  const st = dgState('stage', { drawTime: 0 });
  assert.equal(st.phase, 'playing');
  assert.equal(st.stepDeadline, 0);
  assert.equal(dg.getPhaseDeadline(st), 0);
  dg.onTimeout(st); // playing -> round_result (5s)
  assert.equal(st.phase, 'round_result');
  assert.ok(st.stepDeadline > 0);
  st.round = st._playerCount;
  dg.onTimeout(st);
  assert.equal(st.phase, 'gameover');
  assert.equal(st.stepDeadline, 0);
});

test('drawguess whisper: draw/guess steps use their own limits and reveal has none', () => {
  const st = dgState('whisper', { drawTime: 40, guessTime: 20 });
  assert.equal(st.phase, 'playing');
  assert.ok(Math.abs(st.stepDeadline - (Date.now() + 42000)) < 500, 'step 0 draws');
  dg.handleMove({ type: 'submit', content: [] }, st, st.chain[0].playerIndex);
  assert.ok(Math.abs(st.stepDeadline - (Date.now() + 22000)) < 500, 'step 1 guesses');
  dg.onTimeout(st); // guess step times out
  dg.onTimeout(st); // last draw step times out
  assert.equal(st.phase, 'reveal');
  assert.equal(st.stepDeadline, 0);
  for (let i = 0; i < 3; i++) dg.handleMove({ type: 'vote_match', value: 'match' }, st, i);
  assert.equal(st.phase, 'round_result');
  assert.ok(st.stepDeadline > 0);
  const unlimited = dgState('whisper', { drawTime: 0, guessTime: 0 });
  assert.equal(unlimited.stepDeadline, 0);
});
