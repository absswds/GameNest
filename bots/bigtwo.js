// bots/bigtwo.js
exports.name = 'bigtwo';

const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function rankVal(rank) {
  return RANKS.indexOf(rank);
}

function suitVal(suit) {
  const order = { s: 3, h: 2, c: 1, d: 0 };
  return order[suit] || 0;
}

function rankGroups(hand) {
  const m = new Map();
  for (const c of hand) {
    if (!m.has(c.rank)) m.set(c.rank, []);
    m.get(c.rank).push(c);
  }
  return m;
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
          // Check if any pair of this rank beats previous suit
          const best = cards.sort((a,b) => suitVal(b.suit) - suitVal(a.suit))[1];
          if (suitVal(best.suit) > (tp.suit || 0)) return cards.slice(0, 2);
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

exports.createBot = function(playerIndex) {
  return {
    name: '电脑' + (playerIndex + 1),
    playerIndex: playerIndex,
    getMove: function(state) {
      const hand = state.hands[playerIndex];
      if (!hand || hand.length === 0) return { cards: [] };

      const isFreePlay = !state.lastPlay || state.lastPlayPlayer === playerIndex;

      if (isFreePlay) {
        // Lead with lowest single
        const lowest = findLowestSingle(hand);
        return { cards: [lowest.id] };
      }

      // Try to beat
      const beat = findBeat(hand, state.lastPlay);
      if (beat) {
        return { cards: beat.map(c => c.id) };
      }

      // Pass
      return { cards: [] };
    }
  };
};
