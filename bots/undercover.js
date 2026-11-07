// Who Is the Undercover (谁是卧底) AI bot.
// Works on both full server state and playerView state without mutating state.
// It only looks at its own word (never civWord/ucWord/roles of others).
//
// Tiers (room option `difficulty`):
//   easy   - says a specific hint straight away, votes at random.
//   normal - medium hint in round 1, then more specific; votes for whoever's speeches
//            overlap least with its own word's hints.
//   hard   - starts vague, compares every speech with both its own word's hints and the
//            neighbouring word's hints (the pair is in the word bank). If most speeches fit
//            the other word it assumes it is the undercover, speaks shared/other-word vague
//            lines to blend in and votes a civilian that looks odd. As a civilian it opens
//            vaguely, gets more specific each round and votes by the speeches of all rounds.
// Calibration (node scripts/sim-undercover-tiers.js --n=1000, 6 players, 1 undercover, zh, mixed words, 2026-10-31):
//   civilians catch the undercover in round 1: easy 13%, normal 69%, hard 96% (vs easy/normal/hard undercover alike)
//   undercover survives (rounds, win%) against normal civilians: easy 1.42 / 2.4%, normal 1.42 / 2.4%, hard 2.60 / 45%
//   undercover survives against hard civilians: easy 1.05 / 0.2%, normal 1.04 / 0%, hard 1.51 / 1.3%
//   (easy civilians vote at random, so every undercover tier survives ~2.8 rounds there.)

exports.name = 'undercover';

const { pickFor, getDifficulty } = require('./lib/difficulty');
const { botName } = require('./lib/bot-name');
const {
  getHintsForWord,
  getPairsForWord,
  BLANK_HINTS_ZH,
  BLANK_HINTS_EN,
} = require('../games/undercover-words');

// Vote noise for the normal tier (hard and easy do not use it).
const PICK = { temp: { normal: 70 }, maxLoss: { normal: 150 } };

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  // Explicit ranges, not \p{L}: the Android build's Node has no full ICU and rejects \p{...} at load time
  const clean = text.toLowerCase()
    .replace(/[^a-z0-9À-ɏͰ-ӿ぀-ヿ㐀-鿿가-힯豈-﫿\s]/g, ' ').trim();
  if (!clean) return [];
  // If spaces exist (English), split by whitespace; otherwise (Chinese) use character bigrams + chars
  if (clean.includes(' ')) {
    const stop = new Set(['the', 'a', 'an', 'in', 'on', 'of', 'to', 'for', 'and', 'or', 'with', 'is', 'are', 'from', 'at', 'by', 'it']);
    return clean.split(/\s+/).filter((w) => w.length > 1 && !stop.has(w));
  }
  const stopZh = new Set(['的', '了', '和', '是', '在', '有', '很', '或', '常', '用', '能', '会', '也', '都', '里', '上', '下', '个', '一', '不']);
  const chars = [...clean].filter((c) => c.trim() && !stopZh.has(c));
  const out = [...chars];
  for (let i = 0; i < chars.length - 1; i++) {
    out.push(chars[i] + chars[i + 1]);
  }
  return out;
}

function textOverlapWithHints(texts, hints) {
  if (!texts || !texts.length || !hints || !hints.length) return 0;
  const hintSet = new Set(hints.map((h) => String(h).trim().toLowerCase()));
  const hintTokens = new Set();
  for (const h of hints) {
    for (const tk of tokenize(h)) hintTokens.add(tk);
  }
  let total = 0;
  for (const raw of texts) {
    const norm = String(raw || '').trim().toLowerCase();
    if (!norm) continue;
    if (hintSet.has(norm)) {
      total += 1.0;
      continue;
    }
    const tks = tokenize(norm);
    if (!tks.length || !hintTokens.size) continue;
    let hits = 0;
    for (const tk of tks) {
      if (hintTokens.has(tk)) hits += 1;
    }
    total += Math.min(0.85, hits / Math.max(2, tks.length));
  }
  return total / texts.length;
}

function pairwiseTextOverlap(textsA, textsB) {
  if (!textsA.length || !textsB.length) return 0;
  return textOverlapWithHints(textsA, textsB);
}

// Best Dice similarity between one speech and any line of `lines` (1 for an exact repeat).
function lineFit(text, lines) {
  const norm = String(text || '').trim().toLowerCase();
  if (!norm || !lines || !lines.length) return 0;
  const a = new Set(tokenize(norm));
  let best = 0;
  for (const l of lines) {
    if (String(l).trim().toLowerCase() === norm) return 1;
    const b = new Set(tokenize(l));
    if (!a.size || !b.size) continue;
    let hit = 0;
    for (const t of a) if (b.has(t)) hit += 1;
    const dice = (2 * hit) / (a.size + b.size);
    if (dice > best) best = dice;
  }
  return best;
}

function getOwnWord(state, p) {
  if (state.words && state.words[p] !== undefined && state.words[p] !== null) {
    return state.words[p];
  }
  if (state.mySeat === p && state.myWord !== undefined && state.myWord !== null) {
    return state.myWord;
  }
  return '';
}

function isBlankSeat(state, p, myWord) {
  if (state.roles && state.roles[p] === 'blank') return true;
  if (state.mySeat === p && state.isBlank) return true;
  return !myWord;
}

function speechesBySeat(state, n) {
  const by = new Map();
  for (let i = 0; i < n; i++) by.set(i, []);
  for (const entry of state.speeches || []) {
    if (entry && Number.isInteger(entry.seat) && entry.text) {
      if (!by.has(entry.seat)) by.set(entry.seat, []);
      by.get(entry.seat).push(String(entry.text));
    }
  }
  return by;
}

// Lines of the word's pair: { mine, other, shared }. When the word sits in several pairs,
// take the pair whose lines fit the other players' speeches best.
function pairLines(myWord, bySeat, p) {
  const cands = getPairsForWord(myWord);
  if (!cands.length) return null;
  let best = cands[0];
  if (cands.length > 1) {
    let bestScore = -1;
    for (const c of cands) {
      const all = [...c.hintsA, ...c.hintsB, ...c.shared];
      let sc = 0;
      for (const [seat, texts] of bySeat) {
        if (seat === p) continue;
        for (const t of texts) sc += lineFit(t, all);
      }
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
  }
  const isA = String(myWord).toLowerCase() === best.a.toLowerCase();
  return {
    mine: isA ? best.hintsA : best.hintsB,
    other: isA ? best.hintsB : best.hintsA,
    shared: best.shared,
  };
}

function usedLines(state) {
  return new Set(
    (state.speeches || []).map((e) => (e && e.text ? String(e.text).trim() : '')).filter(Boolean)
  );
}

// First unused line in preferred index order, then any unused, then anything.
function pickLine(lines, prefer, used) {
  for (const i of prefer) {
    if (lines[i] !== undefined && !used.has(lines[i])) return lines[i];
  }
  const free = lines.filter((l) => !used.has(l));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  return lines[Math.floor(Math.random() * lines.length)];
}

function speechMove(state, text) {
  return state.talkMode === 'chat' ? { type: 'chat', text } : { type: 'done', text };
}

// Mean (fit to my word - fit to the other word) over a seat's speeches, -1..1; null when silent.
function leanOf(texts, pl) {
  if (!texts.length) return null;
  let sum = 0;
  for (const t of texts) sum += lineFit(t, pl.mine) - lineFit(t, pl.other);
  return sum / texts.length;
}

// Hard bot: do most other speakers sound like the other word?
function suspectsSelf(state, p, pl, bySeat) {
  let near = 0;
  let far = 0;
  for (const [seat, texts] of bySeat) {
    if (seat === p || !state.alive || !state.alive[seat]) continue;
    const l = leanOf(texts, pl);
    if (l === null) continue;
    if (l < -0.25) far += 1;
    else if (l > 0.25) near += 1;
  }
  return far >= 2 && far > near;
}

function chooseSpeech(state, p) {
  const n = state.numPlayers || (state.alive ? state.alive.length : 0);
  const myWord = getOwnWord(state, p);
  const isBlank = isBlankSeat(state, p, myWord);
  const lang = state._lang === 'en' ? 'en' : 'zh';
  const diff = getDifficulty(state);
  const used = usedLines(state);
  const round = Math.max(1, state.round || 1);
  const bySeat = speechesBySeat(state, n);
  const pl = isBlank ? null : pairLines(myWord, bySeat, p);

  if (!pl) {
    const blank = lang === 'en' ? BLANK_HINTS_EN : BLANK_HINTS_ZH;
    const hints = isBlank ? blank : getHintsForWord(myWord, lang);
    return speechMove(state, pickLine(hints, [], used));
  }

  if (diff === 'easy') {
    return speechMove(state, pickLine(pl.mine, [2, 3, 4].sort(() => Math.random() - 0.5), used));
  }
  if (diff === 'normal') {
    const pref = round === 1 ? [1, 2, 0, 3, 4] : [3, 4, 2, 1, 0];
    return speechMove(state, pickLine(pl.mine, pref, used));
  }

  // hard
  if (suspectsSelf(state, p, pl, bySeat)) {
    const lines = [...pl.shared, pl.other[0], pl.other[1]];
    return speechMove(state, pickLine(lines, [], used));
  }
  if (round === 1 && Math.random() < 0.5) {
    return speechMove(state, pickLine(pl.shared, [], used));
  }
  const lvl = Math.min(round - 1, 3);
  return speechMove(state, pickLine(pl.mine, [lvl, lvl + 1, lvl - 1, 0], used));
}

function voteCommon(state, p) {
  const n = state.numPlayers || (state.alive ? state.alive.length : 0);
  const basePool = Array.isArray(state.voteCandidates) && state.voteCandidates.length
    ? state.voteCandidates
    : Array.from({ length: n }, (_, i) => i);
  const pool = basePool.filter((i) => i !== p && state.alive && state.alive[i]);
  return { n, pool };
}

function peerSimilarity(bySeat, state, p, target) {
  const targetTexts = bySeat.get(target) || [];
  let sim = 0;
  let cnt = 0;
  for (const [other, otherTexts] of bySeat) {
    if (other === p || other === target || !state.alive || !state.alive[other]) continue;
    if (otherTexts.length && targetTexts.length) {
      sim += pairwiseTextOverlap(targetTexts, otherTexts);
      cnt += 1;
    }
  }
  return cnt > 0 ? sim / cnt : 0.5;
}

function chooseVoteHard(state, p, pool, n, myWord, isBlank) {
  const bySeat = speechesBySeat(state, n);
  const pl = isBlank ? null : pairLines(myWord, bySeat, p);
  const prevTally = (state.lastVote && state.lastVote.tally) || {};
  const blend = !pl || suspectsSelf(state, p, pl, bySeat);
  let bestT = pool[0];
  let bestS = -Infinity;
  for (const t of pool) {
    const lean = pl ? leanOf(bySeat.get(t) || [], pl) : null;
    const peer = peerSimilarity(bySeat, state, p, t);
    let score;
    if (!blend) {
      // Civilian view: a seat whose speeches fit the other word, or that nobody else echoes, is suspect.
      score = (lean === null ? 0 : -lean * 60) + (1 - peer) * 25 + (prevTally[t] || 0) * 4;
    } else {
      // Probably the minority: send a likely civilian (fits the other word) who also looks odd.
      score = (lean !== null && lean < 0 ? 20 : 0) + (1 - peer) * 50 + (prevTally[t] || 0) * 20;
    }
    score += Math.random() * 2;
    if (score > bestS) { bestS = score; bestT = t; }
  }
  return { type: 'vote', target: bestT };
}

function chooseVote(state, p) {
  const { n, pool } = voteCommon(state, p);
  if (!pool.length) return { type: 'vote', target: -1 };

  const diff = getDifficulty(state);
  if (diff === 'easy') {
    return { type: 'vote', target: pool[Math.floor(Math.random() * pool.length)] };
  }

  const myWord = getOwnWord(state, p);
  const isBlank = isBlankSeat(state, p, myWord);
  if (diff === 'hard') return chooseVoteHard(state, p, pool, n, myWord, isBlank);

  const lang = state._lang === 'en' ? 'en' : 'zh';
  const by = speechesBySeat(state, n);
  const npl = isBlank ? null : pairLines(myWord, by, p);
  const myHints = isBlank ? [] : npl ? npl.mine.concat(npl.shared) : getHintsForWord(myWord, lang);

  // Score overlap of each alive other player with our own word's hints
  const overlapMap = new Map();
  let speakersCount = 0;
  let mismatchCount = 0;

  for (let i = 0; i < n; i++) {
    if (i === p || !state.alive || !state.alive[i]) continue;
    const texts = by.get(i) || [];
    if (!texts.length || isBlank) {
      overlapMap.set(i, 0.5);
      continue;
    }
    speakersCount += 1;
    const ov = textOverlapWithHints(texts, myHints);
    overlapMap.set(i, ov);
    if (ov < 0.35) mismatchCount += 1;
  }

  // If most players' descriptions don't fit our own word (or we are Blank),
  // assume we are on the undercover side and vote with the majority instead.
  const assumeUndercover = isBlank || (speakersCount >= 2 && mismatchCount > speakersCount / 2);
  const prevTally = (state.lastVote && state.lastVote.tally) || {};

  const cands = pool.map((target) => {
    let score = 50;
    if (!assumeUndercover) {
      const ov = overlapMap.has(target) ? overlapMap.get(target) : 0.5;
      score = (1 - ov) * 100;
      if (prevTally[target]) score += prevTally[target] * 6;
    } else {
      const avgPeerSim = peerSimilarity(by, state, p, target);
      score = (1 - avgPeerSim) * 60 + (prevTally[target] || 0) * 25;
    }
    return { move: { type: 'vote', target }, score };
  });

  return pickFor(state, cands, PICK) || { type: 'vote', target: pool[0] };
}

function getMove(state, idx) {
  if (!state || state.winner !== null) return {};
  const p = idx;
  if (!Number.isInteger(p) || p < 0 || !state.alive || !state.alive[p]) return {};

  if (state.phase === 'speech') {
    const cur = state.speakers && state.speakers[state.speakerPos];
    if (cur !== p) return {};
    return chooseSpeech(state, p);
  }

  if (state.phase === 'vote') {
    if (state.votes && state.votes[p] !== undefined) return {};
    return chooseVote(state, p);
  }

  return {};
}

exports.createBot = (playerIndex) => ({
  name: botName(playerIndex),
  playerIndex,
  getMove: (state, idx) => getMove(state, idx !== undefined ? idx : playerIndex),
});
