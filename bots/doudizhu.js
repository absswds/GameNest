// bots/doudizhu.js
exports.name = 'doudizhu';

const { RANKS, rankGroups } = require('./lib/cards');
const { botName } = require('./lib/bot-name');
const ddz = require('../games/doudizhu');

function rankVal(rank) {
  if (rank === '小王') return 13;
  if (rank === '大王') return 14;
  return RANKS.indexOf(rank);
}

function countBombs(hand) {
  const m = new Map();
  for (const c of hand) m.set(c.rank, (m.get(c.rank)||0)+1);
  let bombs = 0;
  for (const [r, c] of m) if (c === 4) bombs++;
  if (hand.some(c => c.id === 'SJ') && hand.some(c => c.id === 'BJ')) bombs++;
  return bombs;
}

// Lowest play that beats lastPlay, or null. Candidates are validated with the server's own
// detectType/canBeat so the bot never proposes an illegal play (which would hang the room).
function findBeat(hand, lastPlay) {
  if (!lastPlay || !lastPlay.play) return null;
  const tp = lastPlay.play;
  const ok = (cards) => {
    const t = ddz.detectType(cards);
    return t && ddz.canBeat(t, tp) ? cards : null;
  };
  const sorted = [...hand].sort((a, b) => rankVal(a.rank) - rankVal(b.rank));
  const groups = [...rankGroups(hand)].sort((a, b) => rankVal(a[0]) - rankVal(b[0]));
  const byRank = new Map(groups);
  const normal = groups.filter(([r]) => r !== '大王' && r !== '小王');
  let found = null;

  if (tp.type === 'single') {
    for (const c of sorted) { if ((found = ok([c]))) return found; }
  } else if (tp.type === 'pair') {
    for (const [, cs] of normal) { if (cs.length >= 2 && (found = ok(cs.slice(0, 2)))) return found; }
  } else if (tp.type === 'triple' || tp.type === 'triple_one' || tp.type === 'triple_two') {
    for (const [r, cs] of normal) {
      if (cs.length < 3) continue;
      const tri = cs.slice(0, 3);
      if (tp.type === 'triple') found = ok(tri);
      else if (tp.type === 'triple_one') {
        const k = sorted.find(c => c.rank !== r);
        found = k && ok(tri.concat([k]));
      } else {
        const pr = normal.find(([r2, c2]) => r2 !== r && c2.length >= 2);
        found = pr && ok(tri.concat(pr[1].slice(0, 2)));
      }
      if (found) return found;
    }
  } else if (tp.type === 'straight' || tp.type === 'consecutive_pairs' || tp.type === 'plane') {
    const per = tp.type === 'straight' ? 1 : tp.type === 'consecutive_pairs' ? 2 : 3;
    const len = tp.length;
    // ranks 3..A (index 0..11) only; 2 and jokers cannot be part of a run
    for (let start = 0; start + len <= 12; start++) {
      const cards = [];
      for (let i = start; i < start + len; i++) {
        const cs = byRank.get(RANKS[i]);
        if (!cs || cs.length < per) { cards.length = 0; break; }
        cards.push(...cs.slice(0, per));
      }
      if (cards.length && (found = ok(cards))) return found;
    }
  }

  // A bomb beats any non-bomb play; a bigger bomb beats a bomb; the rocket beats everything.
  for (const [, cs] of groups) { if (cs.length === 4 && (found = ok(cs.slice()))) return found; }
  const sj = hand.find(c => c.id === 'SJ');
  const bj = hand.find(c => c.id === 'BJ');
  if (sj && bj && tp.type !== 'rocket') return [sj, bj];
  return null;
}

exports.createBot = function(playerIndex) {
  return {
    name: botName(playerIndex, 'zh'),
    playerIndex: playerIndex,
    getMove: function(state) {
      // ---- continue_vote phase ----
      if (state.phase === 'continue_vote') {
        return { action: 'continue_vote', vote: 'yes' };
      }

      // ---- roundEnd phase ----
      if (state.phase === 'roundEnd') {
        return { action: 'next_round' };
      }

      // ---- bidding phase ----
      if (state.phase === 'bidding') {
        const hand = state.hands[playerIndex];
        const bombs = countBombs(hand);
        const highCards = hand.filter(c => rankVal(c.rank) >= 12).length;
        var strong = (bombs >= 1 && highCards >= 3) || bombs >= 2;

        // 叫抢 mode (state.bidMode === 'score' uses the 0-3 bids below)
        if (state.bidMode !== 'score' && state.callPhase === 'call') {
          return strong ? { call: true } : { pass: true };
        }
        if (state.bidMode !== 'score' && state.callPhase === 'rob') {
          if (!state.eligibleForRob || !state.eligibleForRob[playerIndex]) return { passRob: true };
          if (state.robAttempts && state.robAttempts.indexOf(playerIndex) >= 0) return { passRob: true };
          // Rob if hand is very strong; caller also gets a rob chance
          if (strong) return { rob: true };
          return { passRob: true };
        }

        // 叫分 mode (original)
        let score = 0;
        if (bombs >= 2 || (bombs >= 1 && highCards >= 4)) score = 3;
        else if (bombs >= 1 || highCards >= 3) score = 2;
        else if (highCards >= 2) score = 1;
        if (score <= state.currentBid) score = 0;
        return { score };
      }

      // ---- playing phase ----
      const hand = state.hands[playerIndex];
      const lastPlay = state.lastPlay;
      const isFreePlay = !lastPlay || lastPlay.player === playerIndex;

      if (isFreePlay) {
        const sorted = [...hand].sort((a,b) => rankVal(a.rank) - rankVal(b.rank));
        return { cards: [sorted[0].id] };
      }

      const beat = findBeat(hand, lastPlay);
      if (beat) return { cards: beat.map(c => c.id) };

      return { cards: [] };
    }
  };
};
