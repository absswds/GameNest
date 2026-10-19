'use strict';
// Server rules for drawguess: rounds per game, word variety, guess matching, live stroke deltas.
const test = require('node:test');
const assert = require('node:assert/strict');
const dg = require('../games/drawguess');
const words = require('../games/drawguess-words');

function newGame(players, options) {
  const st = dg.createState();
  st._options = Object.assign({ mode: 'stage', wordChoices: 1 }, options);
  dg.initGame(st, players);
  return st;
}

// Plays rounds by timeouts only (nobody guesses) until the game ends; returns the number of rounds and the words
function playOut(st) {
  const seen = [];
  for (let guard = 0; guard < 500 && st.phase !== 'gameover'; guard++) {
    if (st.phase === 'playing' && seen[seen.length - 1] !== st.round) seen.push(st.round);
    dg.onTimeout(st);
  }
  return seen;
}

test('two players get several rounds by default (each draws 3 times)', () => {
  const st = newGame(2);
  assert.equal(st.totalRounds, 6);
  assert.equal(playOut(st).length, 6);
  assert.equal(st.phase, 'gameover');
  assert.ok(st.winner === 0 || st.winner === 1);
});

test('default rounds scale with player count; the rounds option overrides it', () => {
  assert.equal(newGame(3).totalRounds, 6);
  assert.equal(newGame(6).totalRounds, 6);
  assert.equal(newGame(8).totalRounds, 8, 'everyone draws at least once');
  assert.equal(newGame(2, { rounds: 1 }).totalRounds, 2);
  assert.equal(newGame(4, { rounds: 3 }).totalRounds, 12);
  assert.equal(playOut(newGame(3, { rounds: 2 })).length, 6);
});

test('whisper mode also plays totalRounds chains', () => {
  const st = newGame(2, { mode: 'whisper' });
  assert.equal(st.totalRounds, 6);
  let chains = 0;
  for (let guard = 0; guard < 500 && st.phase !== 'gameover'; guard++) {
    if (st.phase === 'reveal') { dg.handleMove({ type: 'vote_match', value: 'match' }, st, 0); dg.handleMove({ type: 'vote_match', value: 'match' }, st, 1); chains++; continue; }
    dg.onTimeout(st);
  }
  assert.equal(chains, 6);
});

test('words do not repeat within a game', () => {
  const st = newGame(2, { categories: ['animal'], rounds: 10 });
  const used = [];
  for (let guard = 0; guard < 500 && st.phase !== 'gameover'; guard++) {
    if (st.phase === 'playing' && used[used.length - 1] !== st.word) used.push(st.word);
    dg.onTimeout(st);
  }
  assert.equal(used.length, 20);
  assert.equal(new Set(used).size, 20);
});

test('the used-word list never reaches clients (it holds the current word)', () => {
  const st = newGame(3);
  for (let i = 0; i < 3; i++) assert.equal(dg.playerView(st, i)._usedWords, undefined);
});

test('the word bank is bigger and every category has English words too', () => {
  let zh = 0;
  for (const key of Object.keys(words)) {
    const cat = words[key];
    assert.ok(cat.words.length >= 40, key + ' has at least 40 words');
    assert.equal(new Set(cat.words).size, cat.words.length, key + ' has no duplicate words');
    assert.equal(cat.wordsEn.length, cat.words.length, key + ' has an English word for each Chinese word');
    zh += cat.words.length;
  }
  assert.ok(zh >= 600, 'at least 600 words, got ' + zh);
});

test('guesses match in Traditional or Simplified Chinese, full-width, any case or spacing', () => {
  const st = newGame(3);
  st.word = '长颈鹿';
  assert.equal(dg.handleMove({ type: 'stage_guess', text: '長頸鹿' }, st, 1), null);
  st.word = '珍珠奶茶';
  assert.equal(dg.handleMove({ type: 'stage_guess', text: '珍珠 奶茶' }, st, 2), null);

  const st2 = newGame(3);
  st2.word = '哆啦A梦';
  assert.equal(dg.handleMove({ type: 'stage_guess', text: '哆啦Ａ夢' }, st2, 1), null);
  st2.word = 'Spider-Man';
  assert.equal(dg.handleMove({ type: 'stage_guess', text: 'spider man' }, st2, 2), null);

  const st3 = newGame(3);
  st3.word = '猫';
  assert.equal(dg.handleMove({ type: 'stage_guess', text: '狗' }, st3, 1), 'dg_wrong_try_again');
});

test('strokes are sanitised; a stroke split in segments is undone as a whole', () => {
  const st = newGame(3);
  const seg = (g, x) => ({ type: 'stage_stroke', stroke: { color: '#e74c3c', width: 3, g, pts: [{ x, y: 1 }, { x: x + 1, y: 2 }] } });
  assert.equal(dg.handleMove(seg(1, 0), st, 0), null);
  assert.equal(dg.handleMove(seg(2, 5), st, 0), null);
  assert.equal(dg.handleMove(seg(2, 6), st, 0), null);
  assert.equal(dg.handleMove(seg(2, 7), st, 0), null);
  assert.equal(dg.handleMove({ type: 'stage_undo' }, st, 0), null);
  assert.equal(st.strokes.length, 1, 'all 3 segments of stroke 2 removed');
  assert.deepEqual(dg.moveDelta({ type: 'stage_undo' }, st, 0), { op: 'trim', n: 1 });

  assert.equal(dg.handleMove({ type: 'stage_stroke', stroke: { color: 'url(x)', width: 999, pts: [{ x: 1e9, y: 'a' }, { x: 1, y: 1 }] } }, st, 0), 'dg_cannot_draw_now');
  assert.equal(dg.handleMove({ type: 'stage_stroke', stroke: { color: 'red;', width: 999, extra: 'x', pts: [{ x: 1e9, y: 3.14159 }, { x: 1, y: 1 }] } }, st, 0), null);
  const s = st.strokes[st.strokes.length - 1];
  assert.deepEqual(s, { color: '#1a1a1a', width: 40, pts: [{ x: 330, y: 3.1 }, { x: 1, y: 1 }] });
  assert.deepEqual(dg.moveDelta({ type: 'stage_stroke' }, st, 0), { op: 'stroke', stroke: s, n: 2 });

  assert.equal(dg.handleMove(seg(3, 0), st, 1), 'dg_cannot_draw_now', 'only the drawer draws');
  assert.equal(dg.moveDelta({ type: 'stage_guess', text: 'x' }, st, 1), null, 'guesses broadcast the full state');
});
