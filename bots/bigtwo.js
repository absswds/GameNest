// bots/bigtwo.js
exports.name = 'bigtwo';

const { RANKS, rankVal, rankGroups } = require('./lib/cards');
const { botName } = require('./lib/bot-name');
const { detectType, canBeat, fiveClass } = require('../games/bigtwo');

function suitVal(suit) {
  const order = { s: 3, h: 2, c: 1, d: 0 };
  return order[suit] || 0;
}

// Find lowest single in hand (by rank, then suit)
function findLowestSingle(hand) {
  const sorted = [...hand].sort((a,b) => {
    const rv = rankVal(a.rank) - rankVal(b.rank);
    if (rv !== 0) return rv;
    return suitVal(a.suit) - suitVal(b.suit);
  });
  return sorted[0];
}

// Find a playable combination that beats lastPlay
function findBeat(hand, lastPlay) {
  if (!lastPlay || !lastPlay.play) return null;
  const tp = lastPlay.play;
  const groups = rankGroups(hand);

  if (tp.type === 'single') {
    for (const c of hand) {
      if (rankVal(c.rank) > tp.rank || (rankVal(c.rank) === tp.rank && suitVal(c.suit) > (tp.suit || 0))) {
        return [c];
      }
    }
    return null;
  }

  if (tp.type === 'pair') {
    for (const [rank, cards] of groups) {
      if (cards.length >= 2) {
        if (rankVal(rank) > tp.rank) return cards.slice(0, 2);
        if (rankVal(rank) === tp.rank) {
          // A pair's suit is its highest card: use the two highest suits of this rank
          const bySuit = [...cards].sort((a,b) => suitVal(b.suit) - suitVal(a.suit));
          if (suitVal(bySuit[0].suit) > (tp.suit || 0)) return bySuit.slice(0, 2);
        }
      }
    }
    return null;
  }

  if (tp.type === 'triple') {
    for (const [rank, cards] of groups) {
      if (cards.length >= 3 && rankVal(rank) > tp.rank) return cards.slice(0, 3);
    }
    return null;
  }

  // Five-card hands (straight/flush/full house/four+one/straight flush): any 5-card combination of a
  // higher class, or the same class with a higher rank, beats it. Pick the weakest beating hand.
  if (fiveClass(tp)) {
    const n = hand.length;
    let best = null, bestKey = null;
    for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++)
      for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
        const combo = [hand[a], hand[b], hand[c], hand[d], hand[e]];
        const pt = detectType(combo);
        if (!pt || !fiveClass(pt) || !canBeat(pt, tp)) continue;
        const key = [fiveClass(pt), pt.rank, pt.suit || 0];
        if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
          best = combo; bestKey = key;
        }
      }
    return best;
  }

  if (tp.type === 'straight') {
    const len = tp.length;
    if (hand.length < len) return null;
    // Try to find any straight of same length with higher rank
    const sortedHand = [...hand].sort((a,b) => rankVal(a.rank) - rankVal(b.rank));
    const rankSet = new Set(sortedHand.map(c => c.rank));
    const uniqueByRank = [];
    for (const c of sortedHand) {
      if (uniqueByRank.length === 0 || uniqueByRank[uniqueByRank.length-1].rank !== c.rank) {
        uniqueByRank.push(c);
      }
    }
    for (let i = 0; i <= uniqueByRank.length - len; i++) {
      let consecutive = true;
      for (let j = 1; j < len; j++) {
        if (rankVal(uniqueByRank[i + j].rank) - rankVal(uniqueByRank[i + j - 1].rank) !== 1) {
          consecutive = false; break;
        }
      }
      if (consecutive) {
        const startRank = rankVal(uniqueByRank[i].rank);
        if (startRank > tp.rank) {
          // Gather one card per rank
          const result = [];
          for (let j = 0; j < len; j++) {
            result.push(sortedHand.find(c => c.rank === RANKS[startRank + j]));
          }
          // Five same-suit cards would be a straight flush (a different type): swap one card's suit
          if (len === 5 && result.every(c => c.suit === result[0].suit)) {
            let fixed = false;
            for (let j = 0; j < len && !fixed; j++) {
              const alt = sortedHand.find(c => c.rank === result[j].rank && c.suit !== result[0].suit);
              if (alt) { result[j] = alt; fixed = true; }
            }
            if (!fixed) continue;
          }
          return result;
        }
      }
    }
    return null;
  }

  // For flush, full house, four-one, straight_flush — simpler types are harder to beat
  // Try low singles against complex plays (pragmatic AI)
  return null;
}

const { getDifficulty } = require('./lib/difficulty');

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      const hand = state.hands[playerIndex];
      if (!hand || hand.length === 0) return { cards: [] };

      const diff = getDifficulty(state);
      const isFreePlay = !state.lastPlay || state.lastPlayPlayer === playerIndex;

      if (isFreePlay) {
        if (diff === 'hard') {
          // If we have a pair of low cards, lead with pair to shed cards faster
          const groups = rankGroups(hand);
          for (const [r, cs] of groups) {
            if (cs.length >= 2 && rankVal(r) < 8) {
              return { cards: cs.slice(0, 2).map(c => c.id) };
            }
          }
        }
        const lowest = findLowestSingle(hand);
        return { cards: [lowest.id] };
      }

      if (diff === 'easy' && Math.random() < 0.3) {
        return { cards: [] };
      }

      // Try to beat
      const beat = findBeat(hand, state.lastPlay);
      if (beat) {
        if (diff === 'hard') {
          // If beating requires spending a '2' and opponents have plenty of cards and current play is small, hold the '2'
          const hasTwo = beat.some(c => c.rank === '2');
          const lastRank = state.lastPlay && state.lastPlay.play && state.lastPlay.play.rank;
          const otherMaxCards = Math.max(...(state.hands || []).map((h, i) => i === playerIndex ? 0 : h.length));
          if (hasTwo && otherMaxCards > 5 && lastRank !== undefined && lastRank < 9) {
            return { cards: [] }; // hold the '2'
          }
        }
        return { cards: beat.map(c => c.id) };
      }

      // Pass
      return { cards: [] };
    }
  };
};
