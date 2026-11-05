const test = require('node:test');
const assert = require('node:assert/strict');
const undercover = require('../games/undercover');
const wordsMod = require('../games/undercover-words');
const botMod = require('../bots/undercover');

test('undercover exports createState so the server registers it', () => {
  assert.equal(typeof undercover.createState, 'function');
  assert.equal(undercover.createState().phase, 'waiting');
});

function newGame(n = 6, opts = {}, lang = 'zh') {
  const s = { _options: opts, _lang: lang };
  undercover.initGame(s, n);
  return s;
}

test('undercover word bank has >=80 ZH and >=80 EN pairs with valid hints', () => {
  assert.ok(wordsMod.PAIRS_ZH.length >= 80, `Expected >=80 ZH pairs, got ${wordsMod.PAIRS_ZH.length}`);
  assert.ok(wordsMod.PAIRS_EN.length >= 80, `Expected >=80 EN pairs, got ${wordsMod.PAIRS_EN.length}`);

  for (const p of wordsMod.PAIRS_ZH) {
    assert.ok(p.a && p.b && p.a !== p.b);
    assert.ok(Array.isArray(p.hintsA) && p.hintsA.length >= 3);
    assert.ok(Array.isArray(p.hintsB) && p.hintsB.length >= 3);
    for (const h of p.hintsA) {
      assert.ok(h.length > 0 && h.length <= 30);
      assert.ok(!h.includes(p.a), `ZH hint "${h}" should not contain word "${p.a}"`);
    }
    for (const h of p.hintsB) {
      assert.ok(h.length > 0 && h.length <= 30);
      assert.ok(!h.includes(p.b), `ZH hint "${h}" should not contain word "${p.b}"`);
    }
  }

  for (const p of wordsMod.PAIRS_EN) {
    assert.ok(p.a && p.b && p.a.toLowerCase() !== p.b.toLowerCase());
    assert.ok(Array.isArray(p.hintsA) && p.hintsA.length >= 3);
    assert.ok(Array.isArray(p.hintsB) && p.hintsB.length >= 3);
    for (const h of p.hintsA) {
      assert.ok(h.length > 0 && h.length <= 60);
      assert.ok(!h.toLowerCase().includes(p.a.toLowerCase()), `EN hint "${h}" should not contain word "${p.a}"`);
    }
    for (const h of p.hintsB) {
      assert.ok(h.length > 0 && h.length <= 60);
      assert.ok(!h.toLowerCase().includes(p.b.toLowerCase()), `EN hint "${h}" should not contain word "${p.b}"`);
    }
  }
});

test('undercover initGame sets up roles and words for 4-10 players and options', () => {
  // 5 players auto -> 1 undercover, 4 civilians
  const s5 = newGame(5);
  assert.equal(s5.numPlayers, 5);
  assert.equal(s5.roles.filter((r) => r === 'undercover').length, 1);
  assert.equal(s5.roles.filter((r) => r === 'civilian').length, 4);
  assert.equal(s5.roles.filter((r) => r === 'blank').length, 0);
  assert.ok(s5.civWord && s5.ucWord && s5.civWord !== s5.ucWord);

  // 8 players auto + blank -> 2 undercovers, 1 blank, 5 civilians
  const s8 = newGame(8, { blank: true });
  assert.equal(s8.numPlayers, 8);
  assert.equal(s8.roles.filter((r) => r === 'undercover').length, 2);
  assert.equal(s8.roles.filter((r) => r === 'blank').length, 1);
  assert.equal(s8.roles.filter((r) => r === 'civilian').length, 5);
  const blankIdx = s8.roles.indexOf('blank');
  assert.equal(s8.words[blankIdx], '');

  // Explicit ucCount = 1 on 8 players
  const s8One = newGame(8, { ucCount: 1 });
  assert.equal(s8One.roles.filter((r) => r === 'undercover').length, 1);

  // Explicit ucCount = 2 on 6 players
  const s6Two = newGame(6, { ucCount: 2 });
  assert.equal(s6Two.roles.filter((r) => r === 'undercover').length, 2);
});

test('undercover speech legal/illegal moves and rejecting own word in chat', () => {
  const s = newGame(4, { talkMode: 'chat', speechTime: 30 });
  assert.equal(s.phase, 'speech');
  assert.equal(s.speechTime, 30);

  const cur = s.speakers[s.speakerPos];
  const other = (cur + 1) % 4;

  // Wrong speaker rejected
  assert.equal(undercover.handleMove({ type: 'chat', text: '测试描述' }, s, other), 'uc_not_your_speech');

  // Empty chat rejected
  assert.equal(undercover.handleMove({ type: 'chat', text: '   ' }, s, cur), 'uc_empty_chat');

  // Over 30 chars rejected
  assert.equal(undercover.handleMove({ type: 'chat', text: '一'.repeat(61) }, s, cur), 'uc_chat_too_long');

  // Contains own word rejected
  const ownWord = s.words[cur];
  assert.equal(undercover.handleMove({ type: 'chat', text: '这就是' + ownWord + '呀' }, s, cur), 'uc_word_in_chat');

  // Vote during speech phase rejected
  assert.equal(undercover.handleMove({ type: 'vote', target: other }, s, cur), 'uc_invalid_phase');

  // Valid chat advances speaker
  assert.equal(undercover.handleMove({ type: 'chat', text: '日常生活中很常见' }, s, cur), undefined);
  assert.equal(s.speakerPos, 1);
  assert.equal(s.speeches.length, 1);
  assert.equal(s.speeches[0].text, '日常生活中很常见');
});

test('undercover tie -> PK speech -> second tie results in no elimination and rotates first speaker', () => {
  const s = newGame(4, { talkMode: 'face' });
  assert.equal(s.round, 1);
  assert.equal(s.firstSpeaker, 0);

  // All 4 players finish speaking in round 1
  for (let i = 0; i < 4; i++) {
    const sp = s.speakers[s.speakerPos];
    assert.equal(undercover.handleMove({ type: 'done' }, s, sp), undefined);
  }
  assert.equal(s.phase, 'vote');
  assert.equal(s.votePk, false);

  // Illegal votes: self-vote, invalid target
  assert.equal(undercover.handleMove({ type: 'vote', target: 0 }, s, 0), 'uc_cannot_vote_self');
  assert.equal(undercover.handleMove({ type: 'vote', target: 99 }, s, 0), 'uc_invalid_target');

  // Create a tie between seat 0 and seat 1 (each gets 2 votes)
  assert.equal(undercover.handleMove({ type: 'vote', target: 1 }, s, 0), undefined);
  assert.equal(undercover.handleMove({ type: 'vote', target: 1 }, s, 0), 'uc_already_voted');
  assert.equal(undercover.handleMove({ type: 'vote', target: 0 }, s, 1), undefined);
  assert.equal(undercover.handleMove({ type: 'vote', target: 1 }, s, 2), undefined);
  assert.equal(undercover.handleMove({ type: 'vote', target: 0 }, s, 3), undefined);

  // Should now be in PK speech phase for [0, 1]
  assert.equal(s.phase, 'speech');
  assert.equal(s.speechKind, 'pk');
  assert.deepEqual(s.speakers, [0, 1]);

  // Tied players speak once more
  assert.equal(undercover.handleMove({ type: 'done', text: '我是好人' }, s, 0), undefined);
  assert.equal(undercover.handleMove({ type: 'done', text: '我才是平民' }, s, 1), undefined);

  // Now in PK revote among [0, 1]
  assert.equal(s.phase, 'vote');
  assert.equal(s.votePk, true);
  assert.deepEqual(s.voteCandidates, [0, 1]);

  // Voting for seat 2 (not in PK candidates) is rejected
  assert.equal(undercover.handleMove({ type: 'vote', target: 2 }, s, 0), 'uc_invalid_target');

  // Tie again between 0 and 1
  assert.equal(undercover.handleMove({ type: 'vote', target: 1 }, s, 0), undefined);
  assert.equal(undercover.handleMove({ type: 'vote', target: 0 }, s, 1), undefined);
  assert.equal(undercover.handleMove({ type: 'vote', target: 1 }, s, 2), undefined);
  assert.equal(undercover.handleMove({ type: 'vote', target: 0 }, s, 3), undefined);

  // Nobody eliminated; round 2 starts with rotated firstSpeaker = 1
  assert.equal(s.lastExiled, null);
  assert.equal(s.alive.every(Boolean), true);
  assert.equal(s.round, 2);
  assert.equal(s.firstSpeaker, 1);
  assert.deepEqual(s.speakers, [1, 2, 3, 0]);
});

test('undercover win conditions: civilians win (-2) and undercover side wins (-3)', () => {
  // 1) Civilians win (-2) when the undercover is voted out
  const sCiv = newGame(4);
  const ucSeat = sCiv.roles.indexOf('undercover');
  for (let i = 0; i < 4; i++) {
    undercover.handleMove({ type: 'done' }, sCiv, sCiv.speakers[sCiv.speakerPos]);
  }
  for (let p = 0; p < 4; p++) {
    const target = p === ucSeat ? (ucSeat + 1) % 4 : ucSeat;
    undercover.handleMove({ type: 'vote', target }, sCiv, p);
  }
  assert.equal(sCiv.alive[ucSeat], false);
  assert.equal(sCiv.revealed[ucSeat], true);
  assert.equal(sCiv.winner, -2);
  assert.equal(sCiv.phase, 'over');

  // 2) Undercover side wins (-3) when alive count <= 3 and undercover is still alive
  const sUc = newGame(4);
  const ucSeat2 = sUc.roles.indexOf('undercover');
  const civTarget = sUc.roles.findIndex((r) => r === 'civilian');
  for (let i = 0; i < 4; i++) {
    undercover.handleMove({ type: 'done' }, sUc, sUc.speakers[sUc.speakerPos]);
  }
  for (let p = 0; p < 4; p++) {
    const target = p === civTarget ? ucSeat2 : civTarget;
    undercover.handleMove({ type: 'vote', target }, sUc, p);
  }
  assert.equal(sUc.alive[civTarget], false);
  assert.equal(sUc.alive[ucSeat2], true);
  assert.equal(sUc.winner, -3);
  assert.equal(sUc.phase, 'over');
});

test('undercover playerView hides roles and words in progress, reveals after game over, and is safe before initGame', () => {
  // Safe before initGame
  assert.doesNotThrow(() => undercover.playerView({}, 0));
  assert.doesNotThrow(() => undercover.playerView(null, 0));

  const s = newGame(6, { blank: true });
  const civIdx = s.roles.indexOf('civilian');
  const ucIdx = s.roles.indexOf('undercover');
  const blankIdx = s.roles.indexOf('blank');

  const vCiv = undercover.playerView(s, civIdx);
  assert.equal(vCiv.civWord, null);
  assert.equal(vCiv.ucWord, null);
  assert.equal(vCiv.myWord, s.civWord);
  assert.equal(vCiv.isBlank, false);
  // Nobody knows their own role or others' roles while alive
  assert.deepEqual(vCiv.roles, [null, null, null, null, null, null]);
  // Only own word is in v.words
  for (let i = 0; i < 6; i++) {
    if (i === civIdx) assert.equal(vCiv.words[i], s.civWord);
    else assert.equal(vCiv.words[i], null);
  }

  const vBlank = undercover.playerView(s, blankIdx);
  assert.equal(vBlank.myWord, '');
  assert.equal(vBlank.isBlank, true);

  // Eliminate one civilian and verify only their role is revealed in playerView
  for (let i = 0; i < 6; i++) {
    undercover.handleMove({ type: 'done' }, s, s.speakers[s.speakerPos]);
  }
  for (let p = 0; p < 6; p++) {
    const target = p === civIdx ? ucIdx : civIdx;
    undercover.handleMove({ type: 'vote', target }, s, p);
  }
  assert.equal(s.alive[civIdx], false);
  const vMid = undercover.playerView(s, ucIdx);
  assert.equal(vMid.roles[civIdx], 'civilian');
  assert.equal(vMid.roles[ucIdx], null);

  // Force game over and verify full reveal
  s.winner = -2;
  s.phase = 'over';
  const vOver = undercover.playerView(s, civIdx);
  assert.equal(vOver.civWord, s.civWord);
  assert.equal(vOver.ucWord, s.ucWord);
  assert.deepEqual(vOver.roles, s.roles);
  assert.deepEqual(vOver.words, s.words);
});

test('undercover bots finish a complete game in both face and chat modes using playerView without mutating state', () => {
  for (const talkMode of ['face', 'chat']) {
    const s = newGame(6, { talkMode, blank: true, difficulty: 'hard' }, talkMode === 'chat' ? 'en' : 'zh');
    const bots = Array.from({ length: 6 }, (_, i) => botMod.createBot(i));

    let steps = 0;
    while (s.winner === null && steps < 200) {
      steps += 1;
      const pending = undercover.getPendingActors(s);
      assert.ok(pending.length > 0, 'Should always have pending actors before game over');
      const actor = pending[0];
      const view = undercover.playerView(s, actor);
      const snapshot = JSON.stringify(view);
      const move = bots[actor].getMove(view, actor);
      assert.equal(JSON.stringify(view), snapshot, 'Bot must not mutate playerView state');
      const err = undercover.handleMove(move, s, actor);
      assert.equal(err, undefined, `Bot move ${JSON.stringify(move)} by seat ${actor} failed with ${err}`);
    }

    assert.ok(s.winner === -2 || s.winner === -3, `Expected game to finish with -2 or -3, got ${s.winner}`);
    assert.equal(s.phase, 'over');
  }
});

test('undercover word bank: graded hints, shared lines and diff on every pair', () => {
  assert.ok(wordsMod.PAIRS_ZH.length >= 200, `ZH pairs: ${wordsMod.PAIRS_ZH.length}`);
  assert.ok(wordsMod.PAIRS_EN.length >= 100, `EN pairs: ${wordsMod.PAIRS_EN.length}`);
  for (const [lang, list] of [['zh', wordsMod.PAIRS_ZH], ['en', wordsMod.PAIRS_EN]]) {
    for (const d of [1, 2, 3]) {
      assert.ok(list.filter((p) => p.diff === d).length >= 20, `${lang} diff ${d} too few`);
    }
    for (const p of list) {
      assert.ok([1, 2, 3].includes(p.diff), `${p.a}/${p.b} bad diff`);
      assert.ok(p.shared.length >= 3 && p.shared.length <= 4, `${p.a}/${p.b} shared count`);
      assert.equal(p.hintsA.length, 5);
      assert.equal(p.hintsB.length, 5);
      for (const h of [...p.shared, ...p.hintsA, ...p.hintsB]) {
        assert.ok(h.length > 0 && h.length <= 60, `${p.a}/${p.b} line length: ${h}`);
        assert.ok(!h.toLowerCase().includes(p.a.toLowerCase()), `"${h}" contains ${p.a}`);
        assert.ok(!h.toLowerCase().includes(p.b.toLowerCase()), `"${h}" contains ${p.b}`);
        if (lang === 'en') assert.ok(!h.includes("'"), `apostrophe in "${h}"`);
      }
    }
  }
});

test('undercover wordDiff option picks pairs of that diff, mixed uses all', () => {
  const want = { easy: 1, normal: 2, hard: 3 };
  for (const [opt, d] of Object.entries(want)) {
    for (const lang of ['zh', 'en']) {
      for (let k = 0; k < 15; k++) {
        const s = newGame(5, { wordDiff: opt }, lang);
        assert.equal(s.wordDiff, opt);
        const pair = wordsMod.getPairForWord(s.civWord, s.ucWord);
        assert.equal(pair.diff, d, `${lang} ${opt}: ${s.civWord}/${s.ucWord}`);
      }
    }
  }
  const seen = new Set();
  for (let k = 0; k < 150; k++) seen.add(wordsMod.getPairForWord(newGame(5, {}, 'zh').civWord).diff);
  assert.equal(seen.size, 3);
  assert.equal(newGame(5, { wordDiff: 'bogus' }).wordDiff, 'mixed');
});

// A 6-player chat game where seat `me` holds the civilian word and every other seat has spoken once.
function botScene(tier, speakAs) {
  let s;
  do { // skip words that sit in several pairs: a bot can't tell which pair it holds
    s = newGame(6, { talkMode: 'chat', difficulty: tier, wordDiff: 'normal' }, 'zh');
  } while (wordsMod.getPairsForWord(s.civWord).length > 1);
  const me = s.roles.indexOf('civilian');
  const pair = wordsMod.getPairForWord(s.civWord, s.ucWord);
  const mine = s.civWord === pair.a ? pair.hintsA : pair.hintsB;
  const other = s.civWord === pair.a ? pair.hintsB : pair.hintsA;
  return { s, me, pair, mine, other, speakAs: speakAs({ mine, other, shared: pair.shared }) };
}

test('undercover bot tiers: easy states a specific hint, hard opens vague and grows specific', () => {
  for (let k = 0; k < 20; k++) {
    const { s, me, mine } = botScene('easy', () => null);
    s.speakers = [me]; s.speakerPos = 0; s.phase = 'speech'; s.round = 1;
    const v = undercover.playerView(s, me);
    v._options = { difficulty: 'easy' }; v._lang = 'zh';
    const text = botMod.createBot(me).getMove(v, me).text;
    assert.ok(mine.indexOf(text) >= 2, `easy bot said a vague line: ${text}`);
  }
  for (let k = 0; k < 20; k++) {
    const { s, me, mine, pair } = botScene('hard', () => null);
    s.speakers = [me]; s.speakerPos = 0; s.phase = 'speech'; s.round = 1;
    const v = undercover.playerView(s, me);
    v._options = { difficulty: 'hard' }; v._lang = 'zh';
    const text = botMod.createBot(me).getMove(v, me).text;
    assert.ok(pair.shared.includes(text) || mine.indexOf(text) === 0, `hard round 1 not vague: ${text}`);
    v.round = 3;
    const t3 = botMod.createBot(me).getMove(v, me).text;
    assert.ok(mine.indexOf(t3) >= 1, `hard round 3 should be more specific: ${t3}`);
  }
});

test('undercover hard bot blends in when everyone else sounds like the other word, and votes the odd seat out', () => {
  for (let k = 0; k < 20; k++) {
    // I hold word X, the other five speak lines of word Y -> I am probably the undercover
    const { s, me, mine, other, pair } = botScene('hard', () => null);
    const seats = [0, 1, 2, 3, 4, 5].filter((i) => i !== me);
    s.speeches = seats.map((seat, i) => ({ round: 1, pk: false, seat, text: other[i % 4 + 1] }));
    s.speakers = [me]; s.speakerPos = 0; s.phase = 'speech'; s.round = 2;
    let v = undercover.playerView(s, me);
    v._options = { difficulty: 'hard' }; v._lang = 'zh';
    const text = botMod.createBot(me).getMove(v, me).text;
    assert.ok(pair.shared.includes(text) || other.slice(0, 2).includes(text), `should blend, said: ${text}`);

    // normal case: four seats speak my word, seat odd speaks the other word -> vote odd
    const { s: s2, me: me2, mine: mine2, other: other2 } = botScene('hard', () => null);
    const odd = [0, 1, 2, 3, 4, 5].filter((i) => i !== me2)[2];
    s2.speeches = [0, 1, 2, 3, 4, 5].filter((i) => i !== me2).map((seat, i) => ({
      round: 1, pk: false, seat, text: seat === odd ? other2[1] : mine2[i % 3 + 1],
    }));
    s2.phase = 'vote'; s2.votes = {}; s2.voteCandidates = [0, 1, 2, 3, 4, 5];
    v = undercover.playerView(s2, me2);
    v._options = { difficulty: 'hard' }; v._lang = 'zh';
    const mv = botMod.createBot(me2).getMove(v, me2);
    assert.deepEqual(mv, { type: 'vote', target: odd });
  }
});
