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


// Greedy decomposition of a hand into plays (lowest first): straights from mostly-single ranks, full houses,
// triples, pairs, singles. Used to lead with the lowest whole group instead of always a lone low card.
function buildPlan(hand) {
  const byRank = new Map();
  for (const c of [...hand].sort((a, b) => suitVal(a.suit) - suitVal(b.suit))) {
    if (!byRank.has(rankVal(c.rank))) byRank.set(rankVal(c.rank), []);
    byRank.get(rankVal(c.rank)).push(c);
  }
  const plan = [];
  const cnt = (r) => (byRank.has(r) ? byRank.get(r).length : 0);
  const take = (r, n) => byRank.get(r).splice(0, n);
  const clean = () => { for (const [r, cs] of byRank) if (!cs.length) byRank.delete(r); };
  for (let guard = 0; guard < 20 && byRank.size; guard++) {
    const r = Math.min(...byRank.keys());
    // straight starting here (rank 2 never takes part: it sits above the ace)
    if (r <= 7) {
      let have = 0, singles = 0;
      for (let k = 0; k < 5; k++) { if (cnt(r + k)) have++; if (cnt(r + k) === 1) singles++; }
      if (have === 5 && singles >= 4) {
        const cards = [];
        for (let k = 0; k < 5; k++) cards.push(take(r + k, 1)[0]);
        const t = detectType(cards);
        if (t && t.type === 'straight') { plan.push({ cards, rank: r + 4, size: 5 }); clean(); continue; }
        // not a plain straight (e.g. all one suit): put the cards back
        cards.forEach((c, k) => byRank.get(r + k).unshift(c));
      }
    }
    const n = cnt(r);
    if (n >= 3) {
      let pairRank = -1;
      for (const [q, cs] of byRank) if (q !== r && cs.length === 2 && (pairRank < 0 || q < pairRank)) pairRank = q;
      const cards = take(r, 3);
      if (pairRank >= 0) cards.push(...take(pairRank, 2));
      plan.push({ cards, rank: r, size: cards.length });
    } else if (n === 2) {
      plan.push({ cards: take(r, 2), rank: r, size: 2 });
    } else {
      plan.push({ cards: take(r, 1), rank: r, size: 1 });
    }
    clean();
  }
  return plan;
}

// hard: answer a single with a card that is not part of a pair/triple; block with the top card when the leader is nearly out
function findSmartSingle(hand, state, playerIndex) {
  const tp = state.lastPlay && state.lastPlay.play;
  if (!tp || tp.type !== 'single') return null;
  const beats = hand.filter((c) => rankVal(c.rank) > tp.rank || (rankVal(c.rank) === tp.rank && suitVal(c.suit) > (tp.suit || 0)));
  if (!beats.length) return null;
  const leader = state.lastPlayPlayer;
  if (leader >= 0 && leader !== playerIndex && state.hands[leader] && state.hands[leader].length <= 2) {
    return [beats[beats.length - 1]];
  }
  const groups = rankGroups(hand);
  const lone = beats.find((c) => groups.get(c.rank).length === 1);
  return [lone || beats[0]];
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
        if (diff === 'easy') {
          const lowest = findLowestSingle(hand);
          return { cards: [lowest.id] };
        }
        const plan = buildPlan(hand);
        const d3 = hand.find((c) => c.rank === '3' && c.suit === 'd');
        if (!state._opened && d3) {
          const open = plan.find((pl) => pl.cards.includes(d3));
          if (open && detectType(open.cards)) return { cards: open.cards.map((c) => c.id) };
          return { cards: [d3.id] };
        }
        let pick = plan[0];
        if (diff === 'hard') {
          const minOpp = Math.min(...(state.hands || []).map((h, i) => (i === playerIndex ? 99 : h.length)));
          if (plan.length <= 2) {
            // two groups left: lead the strongest first, the weaker one goes out uncontested when the lead holds
            pick = plan.slice().sort((a, b) => b.size - a.size || b.rank - a.rank)[0];
          } else if (minOpp > 1 && plan.some((pl) => pl.size === 5)) {
            // five-card hands shed the most cards per turn and are rarely answered: lead them early
            pick = plan.filter((pl) => pl.size === 5)[0];
          } else if (minOpp <= 1) {
            // an opponent is on its last card: singles are dangerous, lead groups; lone cards only as high as possible
            const groups = plan.filter((pl) => pl.size > 1);
            if (groups.length) pick = groups[0];
            else pick = plan[plan.length - 1];
          }
        }
        if (!detectType(pick.cards)) {
          const lowest = findLowestSingle(hand);
          return { cards: [lowest.id] };
        }
        return { cards: pick.cards.map((c) => c.id) };
      }

      if (diff === 'easy' && Math.random() < 0.3) {
        return { cards: [] };
      }

      // Try to beat
      let beat = diff === 'hard' ? findSmartSingle(hand, state, playerIndex) : null;
      if (!beat) beat = findBeat(hand, state.lastPlay);
      if (beat) {
        if (diff === 'hard') {
          // If beating requires spending a '2' and opponents have plenty of cards and current play is small, hold the '2'
          const hasTwo = beat.some(c => c.rank === '2');
          const lastRank = state.lastPlay && state.lastPlay.play && state.lastPlay.play.rank;
          const otherMaxCards = Math.min(...(state.hands || []).map((h, i) => i === playerIndex ? 0 : h.length));
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
