// Word pairs for Who Is the Undercover (谁是卧底), bot hints included.
// Each pair: { a, b, diff 1|2|3 (3 = the two words are hardest to tell apart),
//   shared: lines that fit both words, hintsA / hintsB: 5 lines from vague to explicit }.
// Hint lines never contain either word and stay within the 30-character chat limit.

const PAIRS_ZH = require('./undercover-words-zh-1').concat(require('./undercover-words-zh-2'));
const PAIRS_EN = require('./undercover-words-en');

const BLANK_HINTS_ZH = [
  '大家平时应该都见过',
  '日常生活中经常能接触到',
  '我觉得和生活息息相关',
  '它的特点其实挺明显的',
  '很常见的一个东西',
  '前面有人说得挺到位',
  '我也经常会用到或者看到',
  '这个范围不算太大'
];

const BLANK_HINTS_EN = [
  'Something most people know well',
  'Pretty common in everyday life',
  'It has a very familiar look',
  'You can spot it quite often',
  'Wait, it fits daily routines',
  'Very recognizable in normal life',
  'Something many of us have seen',
  'Easy to picture once you think of it'
];

// word (lowercase for EN) -> every pair that contains it (a few words appear in several pairs)
const PAIR_MAP = new Map();
function indexPairs(list) {
  for (const p of list) {
    for (const w of [p.a, p.b]) {
      const k = w.toLowerCase();
      if (!PAIR_MAP.has(k)) PAIR_MAP.set(k, []);
      PAIR_MAP.get(k).push(p);
    }
  }
}
indexPairs(PAIRS_ZH);
indexPairs(PAIRS_EN);

function getWordList(lang, wordDiff) {
  const list = lang === 'en' ? PAIRS_EN : PAIRS_ZH;
  const d = { easy: 1, normal: 2, hard: 3 }[wordDiff];
  if (!d) return list;
  const sub = list.filter((p) => p.diff === d);
  return sub.length ? sub : list;
}

// every pair that contains `word` (a few words appear in several pairs)
function getPairsForWord(word) {
  return (word && PAIR_MAP.get(String(word).toLowerCase())) || [];
}

// other (optional): the opposing word, used to pick the right pair when a word is in several pairs
function getPairForWord(word, other) {
  const cands = getPairsForWord(word);
  if (!cands.length) return null;
  if (other && cands.length > 1) {
    const o = String(other).toLowerCase();
    const hit = cands.find((p) => p.a.toLowerCase() === o || p.b.toLowerCase() === o);
    if (hit) return hit;
  }
  return cands[0];
}

// Hints (vague -> explicit) that describe `word`; blank hints when word is empty or unknown.
function getHintsForWord(word, lang, other) {
  const fallback = lang === 'en' ? BLANK_HINTS_EN : BLANK_HINTS_ZH;
  const pair = getPairForWord(word, other);
  if (!pair) return fallback;
  return String(word).toLowerCase() === pair.a.toLowerCase() ? pair.hintsA : pair.hintsB;
}

module.exports = {
  PAIRS_ZH,
  PAIRS_EN,
  BLANK_HINTS_ZH,
  BLANK_HINTS_EN,
  getWordList,
  getHintsForWord,
  getPairForWord,
  getPairsForWord,
};
